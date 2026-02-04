"""SmartDatalake orchestration — integrates guardrails, schema context, data quality, recommendations."""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any, Dict, List, Optional

import httpx
import pandas as pd
from pandasai import SmartDatalake
from pandasai.llm.base import LLM
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.guardrails import mask_pii
from app.models.schemas import (
    ChatResponse,
    DataQualityReport,
    Recommendation,
    StatResult,
)
from app.services import cache as cache_svc
from app.services import conversation as conv_svc
from app.services import data_quality as dq_svc
from app.services import observability as obs_svc
from app.services import recommendation as rec_svc
from app.services import schema_registry

logger = logging.getLogger(__name__)


class OllamaCloudLLM(LLM):
    """PandasAI v3-compatible LLM that calls Ollama Cloud via native API."""

    def __init__(self, api_base: str, model: str, api_token: str):
        self.model = model
        self._api_base = api_base.rstrip("/")
        self._api_token = api_token

    @property
    def type(self) -> str:
        return "ollama-cloud"

    def call(self, instruction, context=None) -> str:
        # instruction is a BasePrompt object in PandasAI v3
        prompt = instruction.to_string() if hasattr(instruction, "to_string") else str(instruction)

        payload = {
            "model": self.model,
            "messages": [{"role": "user", "content": prompt}],
            "stream": False,
        }

        headers = {"Content-Type": "application/json"}
        if self._api_token:
            headers["Authorization"] = f"Bearer {self._api_token}"

        # Use synchronous httpx client for PandasAI compatibility
        with httpx.Client(timeout=120) as client:
            resp = client.post(
                f"{self._api_base}/api/chat",
                json=payload,
                headers=headers,
            )
            resp.raise_for_status()
            data = resp.json()

        return data.get("message", {}).get("content", "")


def _build_llm():
    """Build an Ollama Cloud-backed LLM for PandasAI."""
    return OllamaCloudLLM(
        api_base=settings.ollama_base_url,
        model=settings.ollama_model,
        api_token=settings.ollama_api_token or "",
    )


def _load_dataframes(
    host: Optional[str] = None,
    port: Optional[int] = None,
    database: Optional[str] = None,
    username: Optional[str] = None,
    password: Optional[str] = None,
) -> List[pd.DataFrame]:
    """Load all tables from PostgreSQL as DataFrames."""
    pwd = password if password is not None else (settings.pg_password or "")
    h = host or settings.pg_host
    p = port or settings.pg_port
    db = database or settings.pg_database
    u = username or settings.pg_username

    if pwd:
        conn_str = f"postgresql://{u}:{pwd}@{h}:{p}/{db}"
    else:
        conn_str = f"postgresql://{u}@{h}:{p}/{db}"

    engine = create_engine(conn_str, pool_pre_ping=True)

    # Get all table names
    with engine.connect() as conn:
        result = conn.execute(text(
            "SELECT table_name FROM information_schema.tables "
            "WHERE table_schema = 'public' AND table_type = 'BASE TABLE'"
        ))
        table_names = [row[0] for row in result]

    dfs = []
    for table_name in table_names:
        try:
            df = pd.read_sql_table(table_name, engine, schema="public")
            df.name = table_name  # PandasAI uses this to identify tables
            dfs.append(df)
            logger.info("Loaded table '%s': %d rows, %d cols", table_name, len(df), len(df.columns))
        except Exception as e:
            logger.warning("Failed to load table '%s': %s", table_name, e)

    return dfs


def _build_system_prompt(datasource_id: Optional[str], glossary_terms: list[dict] | None = None) -> str:
    """Compose system context from schema + glossary."""
    parts = []

    if datasource_id:
        schema_ctx = schema_registry.get_schema_context(datasource_id)
        if schema_ctx:
            parts.append(schema_ctx)

    if glossary_terms:
        gl = ["Business glossary:"]
        for g in glossary_terms:
            gl.append(f"  \"{g['term']}\" = {g['sql_expression']}")
        parts.append("\n".join(gl))

    return "\n\n".join(parts)


async def process_query(
    query: str,
    db: Session,
    *,
    session_id: Optional[str] = None,
    datasource_id: Optional[str] = None,
) -> ChatResponse:
    """Main orchestration: receive NL query, return analysis with quality + recs."""

    # 1. Conversation
    conv = conv_svc.get_or_create_conversation(db, session_id, datasource_id)
    conv_svc.add_message(db, conv.id, "user", query)

    # 2. Get conversation history for LLM context
    history = conv_svc.get_context_messages(db, conv.id)

    # 3. Load glossary terms
    from app.models.orm import GlossaryTerm
    glossary_rows = db.query(GlossaryTerm).all()
    glossary_terms = [{"term": g.term, "sql_expression": g.sql_expression} for g in glossary_rows]

    # 4. Build LLM + load DataFrames from PG
    llm = _build_llm()
    dfs = _load_dataframes()
    chart_dir = Path(settings.chart_output_dir)
    chart_dir.mkdir(parents=True, exist_ok=True)

    if not dfs:
        answer = "No tables found in the database. Please connect a datasource with data."
        conv_svc.add_message(db, conv.id, "assistant", answer)
        return ChatResponse(session_id=conv.id, answer=answer)

    # 5. Build SmartDatalake with DataFrames
    system_prompt = _build_system_prompt(datasource_id, glossary_terms)
    dl = SmartDatalake(
        dfs,
        config={
            "llm": llm,
            "save_charts": True,
            "save_charts_path": str(chart_dir),
            "verbose": False,
            "enable_cache": False,
        },
    )

    # 6. Execute
    generated_sql = None
    generated_code = None
    chart_url = None
    stats_result = None

    with obs_svc.track_latency("pandasai_query") as timing:
        try:
            full_query = query
            if system_prompt:
                full_query = f"Context:\n{system_prompt}\n\nQuestion: {query}"
            result = dl.chat(full_query)
        except Exception as e:
            logger.error("PandasAI query failed: %s", e)
            answer = f"I encountered an error processing your query: {str(e)}"
            conv_svc.add_message(db, conv.id, "assistant", answer)
            return ChatResponse(session_id=conv.id, answer=answer)

    answer = str(result) if result is not None else "No result returned."

    # Try to extract generated code from PandasAI internals
    try:
        last_code = dl.last_code_generated
        if last_code:
            generated_code = last_code
    except Exception:
        pass

    # Check for chart
    charts = list(chart_dir.glob("*.png"))
    if charts:
        latest_chart = max(charts, key=lambda p: p.stat().st_mtime)
        chart_url = f"/static/charts/{latest_chart.name}"

    # 7. PII masking
    answer = mask_pii(answer)

    # 8. Data quality (if we can get a DataFrame)
    dq_report = DataQualityReport()
    try:
        if isinstance(result, pd.DataFrame):
            dq_report = dq_svc.check_dataframe(result)
    except Exception as e:
        logger.warning("Data quality check failed: %s", e)

    # 9. Recommendations
    recommendations: list[Recommendation] = []
    try:
        recommendations = await rec_svc.generate_recommendations(
            analysis_text=answer,
            query=query,
            generated_sql=generated_sql,
        )
    except Exception as e:
        logger.warning("Recommendation generation failed: %s", e)

    # 10. Log
    obs_svc.log_llm_call(
        db,
        model=settings.ollama_model,
        prompt_length=len(query),
        response_length=len(answer),
        latency_ms=timing.get("elapsed_ms", 0),
    )

    # 11. Save assistant message
    conv_svc.add_message(
        db, conv.id, "assistant", answer,
        generated_sql=generated_sql,
        generated_code=generated_code,
        chart_path=chart_url,
        recommendations=[r.model_dump() for r in recommendations],
        data_quality=dq_report.model_dump(),
    )

    return ChatResponse(
        session_id=conv.id,
        answer=answer,
        generated_sql=generated_sql,
        generated_code=generated_code,
        chart_url=chart_url,
        stats=stats_result,
        data_quality=dq_report,
        recommendations=recommendations,
    )
