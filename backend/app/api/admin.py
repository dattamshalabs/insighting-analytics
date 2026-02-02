"""GET /admin/logs — observability dashboard data."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.orm import LLMCallLog, QueryLog
from app.models.schemas import LLMLogOut, QueryLogOut
from app.services import cache as cache_svc

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/logs/llm", response_model=list[LLMLogOut])
async def llm_logs(limit: int = Query(100, le=500), db: Session = Depends(get_db)):
    rows = db.query(LLMCallLog).order_by(LLMCallLog.created_at.desc()).limit(limit).all()
    return [
        LLMLogOut(
            id=r.id, model=r.model, prompt_length=r.prompt_length,
            response_length=r.response_length, tokens_used=r.tokens_used,
            latency_ms=r.latency_ms, error=r.error, created_at=r.created_at,
        )
        for r in rows
    ]


@router.get("/logs/query", response_model=list[QueryLogOut])
async def query_logs(limit: int = Query(100, le=500), db: Session = Depends(get_db)):
    rows = db.query(QueryLog).order_by(QueryLog.created_at.desc()).limit(limit).all()
    return [
        QueryLogOut(
            id=r.id, datasource_id=r.datasource_id, sql=r.sql,
            rows_returned=r.rows_returned, duration_ms=r.duration_ms,
            error=r.error, created_at=r.created_at,
        )
        for r in rows
    ]


@router.get("/cache/stats")
async def cache_stats():
    return cache_svc.stats()


@router.post("/cache/clear")
async def clear_cache():
    cache_svc.clear_all()
    return {"status": "cleared"}
