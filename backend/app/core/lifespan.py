"""App startup: init DB, schema discovery, cache, scheduler."""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.core.database import init_db

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # --- Startup ---
    logger.info("Initializing metadata database...")
    init_db()

    logger.info("Seeding demo users...")
    from app.core.database import SessionLocal
    from app.services.seed_users import seed_demo_users
    db = SessionLocal()
    try:
        seed_demo_users(db)
    finally:
        db.close()

    logger.info("Starting scheduler...")
    from app.services.scheduler import start_scheduler
    start_scheduler()

    logger.info("Startup complete")
    yield

    # --- Shutdown ---
    from app.services.scheduler import stop_scheduler
    stop_scheduler()
    logger.info("Shutdown complete")
