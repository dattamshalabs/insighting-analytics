"""SmartDatalake orchestration — integrates guardrails, schema context, data quality, recommendations."""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any, Dict, List, Optional

import pandas as pd
from openai import OpenAI
from pandasai import SmartDatalake
from pandasai.llm.base import LLM
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.guardrails import mask_pii
from app.models.orm import Datasource
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
from app.services.db_engine import build_connection_string, get_default_schema

logger = logging.getLogger(__name__)


class OllamaCloudLLM(LLM):
    """PandasAI v3-compatible LLM that calls Ollama Cloud via OpenAI client."""

    def __init__(self, api_base: str, model: str, api_key: str):
        self.model = model
        self._client = OpenAI(base_url=api_base, api_key=api_key)

    @property
    def type(self) -> str:
        return "ollama-cloud"

    def call(self, instruction, context=None) -> str:
        # instruction is a BasePrompt object in PandasAI v3
        prompt = instruction.to_string() if hasattr(instruction, "to_string") else str(instruction)
        resp = self._client.chat.completions.create(
            model=self.model,
            messages=[{"role": "user", "content": prompt}],
        )
        return resp.choices[0].message.content or ""


def _build_llm():
    """Build an Ollama Cloud-backed LLM for PandasAI."""
    return OllamaCloudLLM(
        api_base=f"{settings.ollama_base_url}/v1",
        model=settings.ollama_model,
        api_key=settings.ollama_api_token or "dummy",
    )


def _decrypt_password(encrypted: str) -> str:
    """Decrypt a datasource password."""
    if not settings.encryption_key or not encrypted:
        return encrypted or ""
    from cryptography.fernet import Fernet
    f = Fernet(settings.encryption_key.encode())
    return f.decrypt(encrypted.encode()).decode()


def _load_dataframes_from_datasource(ds: Datasource) -> List[pd.DataFrame]:
    """Load DataFrames from a specific datasource."""
    db_type = ds.db_type or "postgresql"

    # File-based datasources
    if db_type == "csv":
        if not ds.file_path:
            return []
        try:
            df = pd.read_csv(ds.file_path)
            df.name = Path(ds.file_path).stem
            logger.info("Loaded CSV '%s': %d rows, %d cols", ds.file_path, len(df), len(df.columns))
            return [df]
        except Exception as e:
            logger.warning("Failed to load CSV '%s': %s", ds.file_path, e)
            return []

    if db_type == "excel":
        if not ds.file_path:
            return []
        try:
            xls = pd.ExcelFile(ds.file_path)
            dfs = []
            for sheet in xls.sheet_names:
                df = pd.read_excel(xls, sheet_name=sheet)
                df.name = sheet
                dfs.append(df)
                logger.info("Loaded Excel sheet '%s': %d rows, %d cols", sheet, len(df), len(df.columns))
            return dfs
        except Exception as e:
            logger.warning("Failed to load Excel '%s': %s", ds.file_path, e)
            return []

    # Database-backed datasources
    pwd = _decrypt_password(ds.encrypted_password) if ds.encrypted_password else ""
    conn_str = build_connection_string(
        db_type=db_type,
        host=ds.host,
        port=ds.port,
        database=ds.database,
        username=ds.username,
        password=pwd,
        ssl_mode=ds.ssl_mode or "disable",
        http_path=ds.http_path,
        catalog=ds.catalog,
        access_token=_decrypt_password(ds.access_token) if ds.access_token else None,
    )

    engine = create_engine(conn_str, pool_pre_ping=True)
    schema_name = get_default_schema(db_type) or None

    # Get table names
    with engine.connect() as conn:
        if db_type == "postgresql":
            result = conn.execute(text(
                "SELECT table_name FROM information_schema.tables "
                "WHERE table_schema = 'public' AND table_type = 'BASE TABLE'"
            ))
        elif db_type == "mysql":
            result = conn.execute(text(
                "SELECT table_name FROM information_schema.tables "
                "WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE'"
            ))
        elif db_type == "mssql":
            result = conn.execute(text(
                "SELECT table_name FROM information_schema.tables "
                "WHERE table_schema = 'dbo' AND table_type = 'BASE TABLE'"
            ))
        else:
            result = conn.execute(text(
                "SELECT table_name FROM information_schema.tables "
                "WHERE table_type = 'BASE TABLE'"
            ))
        table_names = [row[0] for row in result]

    dfs = []
    for table_name in table_names:
        try:
            df = pd.read_sql_table(table_name, engine, schema=schema_name)
            df.name = table_name
            dfs.append(df)
            logger.info("Loaded table '%s': %d rows, %d cols", table_name, len(df), len(df.columns))
        except Exception as e:
            logger.warning("Failed to load table '%s': %s", table_name, e)

    return dfs


def _load_dataframes_default() -> List[pd.DataFrame]:
    """Load all tables from the default PostgreSQL datasource (env vars)."""
    pwd = settings.pg_password or ""
    if pwd:
        conn_str = f"postgresql://{settings.pg_username}:{pwd}@{settings.pg_host}:{settings.pg_port}/{settings.pg_database}"
    else:
        conn_str = f"postgresql://{settings.pg_username}@{settings.pg_host}:{settings.pg_port}/{settings.pg_database}"

    engine = create_engine(conn_str, pool_pre_ping=True)

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
            df.name = table_name
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

    # 4. Build LLM + load DataFrames from specified datasource or defaults
    llm = _build_llm()

    if datasource_id:
        ds = db.query(Datasource).filter(Datasource.id == datasource_id).first()
        if ds:
            dfs = _load_dataframes_from_datasource(ds)
        else:
            dfs = _load_dataframes_default()
    else:
        dfs = _load_dataframes_default()

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
            "save_charts": False,
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

    # Check for chart — PandasAI saves temp charts to {project_root}/exports/charts/
    import shutil
    pandasai_chart_dir = Path("exports/charts")
    if pandasai_chart_dir.exists():
        temp_charts = list(pandasai_chart_dir.glob("*.png"))
        if temp_charts:
            latest = max(temp_charts, key=lambda p: p.stat().st_mtime)
            dest = chart_dir / latest.name
            shutil.copy2(str(latest), str(dest))
            chart_url = f"/static/charts/{latest.name}"
    # Also check our own chart dir
    if not chart_url:
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

    # 9. Recommendations — now generated on-demand via /chat/recommendations
    recommendations: list[Recommendation] = []

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
