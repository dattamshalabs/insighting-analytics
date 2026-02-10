"""GET /admin/logs — observability dashboard data + SMTP config."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.auth import require_admin
from app.core.database import get_db
from app.models.orm import LLMCallLog, QueryLog, SmtpConfig, User
from app.models.schemas import LLMLogOut, QueryLogOut, SmtpConfigCreate, SmtpConfigOut
from app.services import cache as cache_svc
from app.services import email_service

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/logs/llm", response_model=list[LLMLogOut])
async def llm_logs(
    limit: int = Query(100, le=500),
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin),
):
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
async def query_logs(
    limit: int = Query(100, le=500),
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin),
):
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
async def cache_stats(admin_user: User = Depends(require_admin)):
    return cache_svc.stats()


@router.post("/cache/clear")
async def clear_cache(admin_user: User = Depends(require_admin)):
    cache_svc.clear_all()
    return {"status": "cleared"}


# ---------------------------------------------------------------------------
# SMTP configuration
# ---------------------------------------------------------------------------

@router.get("/smtp", response_model=SmtpConfigOut | None)
async def get_smtp_config(
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin),
):
    """Get current SMTP configuration."""
    cfg = db.query(SmtpConfig).first()
    if not cfg:
        return None
    return SmtpConfigOut(
        id=cfg.id, host=cfg.host, port=cfg.port,
        username=cfg.username, from_email=cfg.from_email, use_tls=cfg.use_tls,
    )


@router.post("/smtp", response_model=SmtpConfigOut)
async def save_smtp_config(
    body: SmtpConfigCreate,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin),
):
    """Create or update SMTP configuration."""
    existing = db.query(SmtpConfig).first()

    # Encrypt password if provided
    encrypted_password = None
    if body.password:
        from app.core.config import settings
        if settings.encryption_key:
            from cryptography.fernet import Fernet
            f = Fernet(settings.encryption_key.encode())
            encrypted_password = f.encrypt(body.password.encode()).decode()
        else:
            encrypted_password = body.password

    if existing:
        existing.host = body.host
        existing.port = body.port
        existing.username = body.username
        if encrypted_password is not None:
            existing.encrypted_password = encrypted_password
        existing.from_email = body.from_email
        existing.use_tls = body.use_tls
        db.commit()
        db.refresh(existing)
        cfg = existing
    else:
        cfg = SmtpConfig(
            host=body.host,
            port=body.port,
            username=body.username,
            encrypted_password=encrypted_password,
            from_email=body.from_email,
            use_tls=body.use_tls,
        )
        db.add(cfg)
        db.commit()
        db.refresh(cfg)

    return SmtpConfigOut(
        id=cfg.id, host=cfg.host, port=cfg.port,
        username=cfg.username, from_email=cfg.from_email, use_tls=cfg.use_tls,
    )


@router.post("/smtp/test")
async def test_smtp(
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin),
):
    """Test SMTP connection."""
    result = email_service.test_smtp_connection(db)
    if result["status"] == "error":
        return result
    return result
