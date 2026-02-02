"""LLM call logging, query logging, latency tracking."""

from __future__ import annotations

import logging
import time
from contextlib import contextmanager
from typing import Optional

from sqlalchemy.orm import Session

from app.models.orm import LLMCallLog, QueryLog

logger = logging.getLogger(__name__)


@contextmanager
def track_latency(label: str = "operation"):
    """Context manager that yields a dict with `elapsed_ms` on exit."""
    ctx: dict = {}
    start = time.perf_counter()
    try:
        yield ctx
    finally:
        ctx["elapsed_ms"] = round((time.perf_counter() - start) * 1000, 2)
        logger.info("%s completed in %.2f ms", label, ctx["elapsed_ms"])


def log_llm_call(
    db: Session,
    *,
    model: str,
    prompt_length: int,
    response_length: int,
    tokens_used: Optional[int] = None,
    latency_ms: float = 0,
    error: Optional[str] = None,
) -> LLMCallLog:
    entry = LLMCallLog(
        model=model,
        prompt_length=prompt_length,
        response_length=response_length,
        tokens_used=tokens_used,
        latency_ms=latency_ms,
        error=error,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


def log_query(
    db: Session,
    *,
    datasource_id: Optional[str] = None,
    sql: str,
    rows_returned: Optional[int] = None,
    duration_ms: Optional[float] = None,
    error: Optional[str] = None,
) -> QueryLog:
    entry = QueryLog(
        datasource_id=datasource_id,
        sql=sql,
        rows_returned=rows_returned,
        duration_ms=duration_ms,
        error=error,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry
