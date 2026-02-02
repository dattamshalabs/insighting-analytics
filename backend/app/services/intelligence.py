"""SmartDatalake orchestration — integrates guardrails, schema context, data quality, recommendations."""

from __future__ import annotations

import json
import logging
import os
from pathlib import Path
from typing import Any, Dict, Optional

import httpx
import pandas as pd
from pandasai import SmartDatalake
from pandasai.connectors import PostgreSQLConnector
from pandasai.llm.local_llm import LocalLLM
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.guardrails import inject_row_limit, mask_pii, validate_sql_readonly
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


def _build_llm():
    """Build an Ollama-backed LLM for PandasAI."""
    return LocalLLM(
        api_base=f"{settings.ollama_base_url}/v1",
        model=settings.ollama_model,
    )


def _build_connector(
    host: Optional[str] = None,
    port: Optional[int] = None,
    database: Optional[str] = None,
    username: Optional[str] = None,
    password: Optional[str] = None,
) -> PostgreSQLConnector:
    return PostgreSQLConnector(
        config={
            "host": host or settings.pg_host,
            "port": port or settings.pg_port,
            "database": database or settings.pg_database,
            "username": username or settings.pg_username,
            "password": password or settings.pg_password,
        }
    )


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

    # 4. Build LLM + connector
    llm = _build_llm()
    connector = _build_connector()
    chart_dir = Path(settings.chart_output_dir)
    chart_dir.mkdir(parents=True, exist_ok=True)

    # 5. Build SmartDatalake
    dl = SmartDatalake(
        [connector],
        config={
            "llm": llm,
            "save_charts": True,
            "save_charts_path": str(chart_dir),
            "verbose": False,
            "custom_prompts": {
                "generate_python_code": _build_system_prompt(datasource_id, glossary_terms),
            },
        },
    )

    # 6. Execute
    generated_sql = None
    generated_code = None
    chart_url = None
    stats_result = None
    result_df = None

    with obs_svc.track_latency("pandasai_query") as timing:
        try:
            result = dl.chat(query)
        except Exception as e:
            logger.error("PandasAI query failed: %s", e)
            answer = f"I encountered an error processing your query: {str(e)}"
            conv_svc.add_message(db, conv.id, "assistant", answer)
            return ChatResponse(session_id=conv.id, answer=answer)

    answer = str(result) if result is not None else "No result returned."

    # Try to extract generated code/SQL from PandasAI internals
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
            result_df = result
            dq_report = dq_svc.check_dataframe(result_df)
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
