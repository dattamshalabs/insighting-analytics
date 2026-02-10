"""FastAPI app entry point."""

from __future__ import annotations

import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.core.config import settings
from app.core.lifespan import lifespan
from app.core.rate_limit import limiter

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)

app = FastAPI(
    title="Insighting Analytics",
    version="0.4.0",
    description="Chat with your PostgreSQL databases using natural language. Powered by Ollama + PandasAI.",
    lifespan=lifespan,
)

# Rate limiting
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS - restricted to safe methods and headers
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-Requested-With"],
)

# Static files (charts)
app.mount("/static", StaticFiles(directory="app/static"), name="static")

# --- Routers ---
from app.api.admin import router as admin_router
from app.api.alerts import router as alerts_router
from app.api.auth import router as auth_router
from app.api.chat import router as chat_router
from app.api.dashboards import router as dashboards_router
from app.api.datasources import router as datasources_router
from app.api.exports import router as exports_router
from app.api.glossary import router as glossary_router
from app.api.health import router as health_router
from app.api.schema import router as schema_router

app.include_router(health_router)
app.include_router(auth_router)
app.include_router(chat_router)
app.include_router(datasources_router)
app.include_router(dashboards_router)
app.include_router(schema_router)
app.include_router(exports_router)
app.include_router(alerts_router)
app.include_router(glossary_router)
app.include_router(admin_router)
