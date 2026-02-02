"""APScheduler: run saved queries on cron, trigger alerts."""

from __future__ import annotations

import logging
from typing import Optional

import httpx
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from sqlalchemy import create_engine, text

from app.core.config import settings
from app.core.database import SessionLocal
from app.models.orm import Alert

logger = logging.getLogger(__name__)

_scheduler: Optional[AsyncIOScheduler] = None


def get_scheduler() -> AsyncIOScheduler:
    global _scheduler
    if _scheduler is None:
        _scheduler = AsyncIOScheduler()
    return _scheduler


def start_scheduler() -> None:
    if not settings.scheduler_enabled:
        logger.info("Scheduler disabled via config")
        return
    sched = get_scheduler()
    if not sched.running:
        _load_alert_jobs(sched)
        sched.start()
        logger.info("Scheduler started")


def stop_scheduler() -> None:
    if _scheduler and _scheduler.running:
        _scheduler.shutdown(wait=False)
        logger.info("Scheduler stopped")


def _load_alert_jobs(sched: AsyncIOScheduler) -> None:
    """Load all enabled alerts as scheduler jobs."""
    db = SessionLocal()
    try:
        alerts = db.query(Alert).filter(Alert.enabled == True).all()
        for alert in alerts:
            add_alert_job(sched, alert)
        logger.info("Loaded %d alert jobs", len(alerts))
    finally:
        db.close()


def add_alert_job(sched: AsyncIOScheduler, alert: Alert) -> None:
    job_id = f"alert_{alert.id}"
    # Remove existing job if any
    if sched.get_job(job_id):
        sched.remove_job(job_id)
    try:
        trigger = CronTrigger.from_crontab(alert.cron_expression)
    except ValueError:
        logger.error("Invalid cron expression for alert %s: %s", alert.id, alert.cron_expression)
        return
    sched.add_job(
        _execute_alert,
        trigger=trigger,
        id=job_id,
        args=[alert.id],
        replace_existing=True,
    )


def remove_alert_job(alert_id: str) -> None:
    sched = get_scheduler()
    job_id = f"alert_{alert_id}"
    if sched.get_job(job_id):
        sched.remove_job(job_id)


async def _execute_alert(alert_id: str) -> None:
    """Execute alert query and check threshold."""
    db = SessionLocal()
    try:
        alert = db.query(Alert).filter(Alert.id == alert_id).first()
        if not alert or not alert.enabled:
            return

        # For now, execute against default PG connection
        engine = create_engine(settings.pg_connection_string, pool_pre_ping=True)
        with engine.connect() as conn:
            result = conn.execute(text(alert.query))
            rows = result.fetchall()

        # Simple threshold eval
        if rows:
            first_val = rows[0][0] if rows[0] else None
            triggered = _eval_condition(first_val, alert.threshold_condition)
        else:
            triggered = False

        if triggered:
            logger.info("Alert '%s' triggered (value=%s)", alert.name, first_val)
            import datetime
            alert.last_triggered_at = datetime.datetime.utcnow()
            db.commit()

            if alert.webhook_url:
                await _send_webhook(alert, first_val)
    except Exception as e:
        logger.error("Alert execution failed for %s: %s", alert_id, e)
    finally:
        db.close()


def _eval_condition(value, condition: str) -> bool:
    """Evaluate a simple threshold like 'result > 100'."""
    try:
        return eval(condition, {"__builtins__": {}}, {"result": value})
    except Exception:
        return False


async def _send_webhook(alert: Alert, value) -> None:
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            await client.post(alert.webhook_url, json={
                "alert_name": alert.name,
                "value": str(value),
                "condition": alert.threshold_condition,
            })
    except Exception as e:
        logger.error("Webhook failed for alert %s: %s", alert.name, e)
