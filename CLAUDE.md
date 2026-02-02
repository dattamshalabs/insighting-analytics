# CLAUDE.md — Context for Claude Code

This file provides context for Claude Code when working on this repository.

## Project Overview

Insighting Analytics is a full-stack natural language analytics platform. Users ask questions about their PostgreSQL data in plain English and receive SQL-backed answers with charts, statistical tests, data quality reports, and business recommendations.

## Stack

- **Backend:** Python 3.11 (strict requirement — PandasAI does not support 3.12+), FastAPI, PandasAI, SQLAlchemy, Ollama (FOSS LLM)
- **Frontend:** Next.js 14 (App Router), TypeScript, TailwindCSS
- **Data stores:** PostgreSQL (user data), SQLite (app metadata — conversations, datasources, alerts, glossary, logs)
- **LLM:** Ollama Cloud with model `gpt-oss:120b-cloud`. Auth via Bearer token in `OLLAMA_API_TOKEN`.

## Build & Run

```bash
# Backend (from repo root)
cd backend
python3.11 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
uvicorn app.main:app --reload --port 8000

# Frontend (from repo root)
cd frontend
npm install
npm run dev

# Or use the combined script:
./scripts/run_dev.sh
```

## Verify

```bash
# Backend imports
cd backend && source .venv/bin/activate
python -c "from app.main import app; print('OK')"

# Frontend build
cd frontend && npx next build

# Health check (server must be running)
curl http://localhost:8000/health
```

## Key Architecture Decisions

- **Ollama only** — no OpenAI dependency. LLM calls go through Ollama Cloud (`https://api.ollama.com`) or a local Ollama instance. The `intelligence.py` service uses PandasAI's `LocalLLM` pointing at Ollama's OpenAI-compatible `/v1` endpoint. The `recommendation.py` service calls Ollama's native `/api/chat` endpoint directly.
- **SQLite for metadata** — zero-config local DB. Created automatically on first startup via `lifespan.py` → `init_db()`. File: `backend/insighting_meta.db`.
- **PandasAI SmartDatalake** — the core query engine. Receives a PostgreSQL connector + Ollama LLM, generates Python/SQL, executes it, returns results. Wrapped by `services/intelligence.py`.
- **Guardrails are non-optional** — `guardrails.py` enforces read-only SQL, statement timeout, row limits, and PII masking. These run on every query.
- **Schema context injection** — `schema_registry.py` introspects PostgreSQL `information_schema` and infers implicit joins by column name patterns (e.g., `user_id` → `users.id`). This schema context is injected into every LLM prompt.
- **Two-phase LLM calls** — first call: PandasAI generates + executes the query. Second call: `recommendation.py` generates action recommendations from the result.

## Directory Layout

```
backend/app/
  api/          → FastAPI routers (8 files). Each router is a thin layer over a service.
  core/         → config.py (pydantic-settings), database.py (SQLAlchemy), guardrails.py, lifespan.py
  models/       → schemas.py (30+ Pydantic models), orm.py (8 SQLAlchemy tables)
  services/     → Business logic (9 files). intelligence.py is the main orchestrator.
  skills/       → PandasAI @skill functions (statistical, timeseries, profiling)
  static/       → Generated chart PNGs served via StaticFiles

frontend/src/
  app/          → 5 Next.js pages (chat, datasources, glossary, alerts, admin)
  components/   → 10 React components organized by domain
  hooks/        → 3 custom hooks wrapping API calls
  lib/          → api.ts (typed fetch wrapper for all backend endpoints)
  types/        → index.ts (all shared TypeScript interfaces)
```

## Code Patterns

- **Backend routers** import from services, never from other routers. Services import from `core/` and `models/`.
- **All Pydantic models** live in `models/schemas.py`. ORM models in `models/orm.py`.
- **Config** is a single `Settings` class in `core/config.py` using `pydantic-settings`. Access via `from app.core.config import settings`.
- **DB sessions** are injected via FastAPI `Depends(get_db)`.
- **Frontend API calls** go through `lib/api.ts` which exports a typed `api` object. Hooks wrap `api` calls with React state.
- **Pages are `"use client"`** — all pages use client-side rendering since they manage interactive state.

## Environment Variables

Backend (`backend/.env`):
- `PG_HOST`, `PG_PORT`, `PG_DATABASE`, `PG_USERNAME`, `PG_PASSWORD`, `PG_SSL_MODE` — default PostgreSQL connection
- `OLLAMA_BASE_URL` — Ollama endpoint (default: `https://api.ollama.com`)
- `OLLAMA_MODEL` — model name (default: `gpt-oss:120b-cloud`)
- `OLLAMA_API_TOKEN` — Bearer token for Ollama Cloud auth
- `ENCRYPTION_KEY` — Fernet key for encrypting stored datasource passwords

Frontend (`frontend/.env.local`):
- `NEXT_PUBLIC_API_URL` — backend URL (default: `http://localhost:8000`)

## Common Tasks

- **Add a new API endpoint:** Create router in `api/`, service in `services/`, Pydantic models in `models/schemas.py`, include router in `main.py`.
- **Add a new PandasAI skill:** Add a `@skill` decorated function in `skills/`. PandasAI discovers skills automatically when passed to SmartDatalake.
- **Add a new frontend page:** Create `src/app/<route>/page.tsx`. Add nav link in `src/app/layout.tsx`.
- **Modify the database schema:** Edit `models/orm.py`, then delete `insighting_meta.db` (it will be recreated on next startup).

## Testing

```bash
cd backend && source .venv/bin/activate
pytest                    # run all tests
ruff check app/           # lint
ruff format app/          # format
```

Frontend has no test suite yet. Type-check via `npx next build`.

## Gotchas

- PandasAI **requires Python < 3.12**. The venv must use Python 3.11.
- PandasAI was installed with `--no-deps` initially due to build issues; the full install now works in the 3.11 venv.
- The SQLite metadata DB (`insighting_meta.db`) is auto-created on startup. Delete it to reset all conversations, datasources, alerts, and glossary terms.
- Chart PNGs accumulate in `backend/app/static/charts/`. They are gitignored but not auto-cleaned.
- `scheduler.py` uses `eval()` for threshold conditions (e.g., `result > 100`). This is sandboxed with `__builtins__: {}` but should be hardened further before production.
