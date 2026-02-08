# CLAUDE.md — Context for Claude Code

This file provides context for Claude Code when working on this repository.

## Project Overview

Insighting Analytics is a full-stack AI-powered natural language analytics platform. Users ask questions about their data in plain English and receive SQL-backed answers with charts, statistical tests, data quality reports, and on-demand business recommendations. Users can also generate AI dashboards from their datasets.

## Stack

- **Backend:** Python 3.11 (strict requirement — PandasAI does not support 3.12+), FastAPI, PandasAI, SQLAlchemy, Ollama (FOSS LLM)
- **Frontend:** Next.js 14 (App Router), TypeScript, TailwindCSS, Framer Motion, Recharts
- **Data stores:** PostgreSQL/MySQL/MSSQL/Databricks (user data), CSV/Excel uploads, SQLite (app metadata)
- **LLM:** Ollama Cloud with model `gpt-oss:120b-cloud`. Auth via Bearer token in `OLLAMA_API_TOKEN`.

## Build & Run

```bash
# Quick start (recommended):
./start.sh     # Starts backend + frontend
./stop.sh      # Stops both

# Manual (from repo root):
# Backend
cd backend && source .venv/bin/activate
pip install -e ".[dev]"
uvicorn app.main:app --reload --port 8000

# Frontend
cd frontend && npm install && npm run dev
```

## Verify

```bash
cd backend && source .venv/bin/activate
python -c "from app.main import app; print('OK')"
cd frontend && npx next build
curl http://localhost:8000/health
```

## Key Architecture Decisions

- **Ollama only** — no OpenAI dependency. LLM calls go through Ollama Cloud or local Ollama instance.
- **SQLite for metadata** — zero-config local DB, auto-created on first startup.
- **PandasAI SmartDatalake** — core query engine. Generates Python/SQL, executes it, returns results.
- **Guardrails are non-optional** — read-only SQL, timeout, row limits, PII masking.
- **Schema context injection** — auto-introspects database schemas and infers relations.
- **On-demand recommendations** — recommendations are NOT generated automatically. Users click "Get AI Recommendations" button which triggers a separate LLM call via `POST /chat/recommendations`.
- **Multi-database support** — PostgreSQL, MySQL, MS SQL Server, Databricks, CSV, and Excel file uploads.
- **Message feedback** — thumbs up/down on responses stored via `POST /chat/feedback`.

## Directory Layout

```
backend/app/
  api/          → FastAPI routers (9 files). Each router is a thin layer over a service.
  core/         → config.py, database.py, guardrails.py, lifespan.py
  models/       → schemas.py (40+ Pydantic models), orm.py (10 SQLAlchemy tables incl. Dashboard)
  services/     → Business logic (11 files). intelligence.py is main orchestrator, db_engine.py is engine factory.
  skills/       → PandasAI @skill functions (statistical, timeseries, profiling)
  static/       → Generated chart PNGs served via StaticFiles

frontend/src/
  app/          → 6 Next.js pages (chat, dashboards, datasources, glossary, alerts, admin, login)
  components/   → 14 React components organized by domain
    chat/       → MessageBubble, RecommendationCard, ThoughtProcess, DataQualityBanner
    ui/         → Modal, EmptyState, ToggleSwitch, StatCard, Skeleton, ChatHistory, Toast
    charts/     → ChartPanel, ChartTypeSelector
    stats/      → SignificanceBadge, TimeSeriesChart
    schema/     → SchemaViewer
    export/     → ExportMenu
  hooks/        → useAnalyticsChat, useDatasources, useSchemaMap
  lib/          → api.ts (typed fetch wrapper), chartUtils.ts
  types/        → index.ts (all shared TypeScript interfaces)
  contexts/     → AuthContext.tsx

scripts/        → run_dev.sh (legacy dev script)
start.sh        → Start backend + frontend
stop.sh         → Stop all services
```

## API Endpoints

### Chat
- `POST /chat` — Send a query, get analysis response
- `POST /chat/recommendations` — On-demand recommendation generation for a message
- `POST /chat/feedback` — Submit thumbs up/down on a message
- `GET /chat/sessions` — List conversations
- `GET /chat/history/{session_id}` — Get conversation with messages
- `PATCH /chat/sessions/{session_id}` — Rename a conversation
- `DELETE /chat/sessions/{session_id}` — Delete a conversation

### Datasources
- `GET /datasources` — List all datasources
- `POST /datasources` — Create database connection (PostgreSQL, MySQL, MSSQL, Databricks)
- `POST /datasources/upload` — Upload CSV/Excel file as datasource (multipart form)
- `DELETE /datasources/{id}` — Delete a datasource
- `POST /datasources/{id}/refresh-schema` — Re-introspect schema

### Dashboards
- `POST /dashboards/generate` — Generate AI dashboard from prompt + datasource
- `GET /dashboards` — List all saved dashboards
- `GET /dashboards/{id}` — Get a single dashboard
- `DELETE /dashboards/{id}` — Delete a dashboard

### Other
- `GET /schema/{datasource_id}` — Introspected schema
- `GET/POST/PUT/DELETE /alerts` — Scheduled SQL alerts
- `GET/POST/PUT/DELETE /glossary` — Business glossary terms
- `GET /admin/logs/*` — LLM and query logs
- `GET/POST /admin/cache/*` — Cache stats and clearing
- `GET /export/{conversation_id}?format=csv|pdf` — Export conversations

## Code Patterns

- **Backend routers** import from services, never from other routers.
- **All Pydantic models** live in `models/schemas.py`. ORM models in `models/orm.py`.
- **Config** is `Settings` class in `core/config.py` using `pydantic-settings`.
- **DB sessions** are injected via FastAPI `Depends(get_db)`.
- **Frontend API calls** go through `lib/api.ts` which exports a typed `api` object.
- **Pages are `"use client"`** — all pages use client-side rendering.
- **Toast notifications** — use `useToast()` hook from `components/ui/Toast.tsx`.
- **Design system** — custom glass-morphism dark theme with brand indigo/purple palette, surface grays.

## Design System

- **Font:** Inter (UI) + JetBrains Mono (code)
- **Colors:** Brand indigo-500 (#6366f1), surface grays (#09090b to #71717a)
- **Components:** `.glass-card`, `.btn-primary`, `.btn-secondary`, `.btn-ghost`, `.btn-danger`, `.btn-icon`, `.input-glass`, `.badge-*`, `.code-block`
- **Animations:** fade-in-up, typing dots, float, shimmer, pulse-glow, scale-in
- **Patterns:** Noise texture overlay, gradient orbs, inner glow borders

## Environment Variables

Backend (`backend/.env`):
- `PG_HOST/PORT/DATABASE/USERNAME/PASSWORD/SSL_MODE` — default PostgreSQL
- `OLLAMA_BASE_URL`, `OLLAMA_MODEL`, `OLLAMA_API_TOKEN` — LLM config
- `ENCRYPTION_KEY` — Fernet key for stored passwords

Frontend (`frontend/.env.local`):
- `NEXT_PUBLIC_API_URL` — backend URL (default: `http://localhost:8000`)

## Common Tasks

- **Add a new API endpoint:** Create router in `api/`, service in `services/`, models in `schemas.py`, include router in `main.py`.
- **Add a new page:** Create `src/app/<route>/page.tsx`. Add nav link in `layout.tsx`.
- **Reset metadata DB:** Delete `backend/insighting_meta.db` (auto-recreated on restart).

## Gotchas

- PandasAI **requires Python < 3.12**. Must use Python 3.11.
- SQLite metadata DB is auto-created on startup. Delete it to reset.
- Chart PNGs accumulate in `backend/app/static/charts/`.
- `scheduler.py` uses `eval()` for threshold conditions — sandboxed but should be hardened further.
- Login credentials: `admin` / `admin123` (hardcoded in AuthContext.tsx — replace for production).
