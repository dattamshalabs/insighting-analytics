# CLAUDE.md — Context for Claude Code

This file provides context for Claude Code when working on this repository.

## Project Overview

Insighting Analytics is a full-stack AI-powered natural language analytics platform. Users ask questions about their data in plain English and receive SQL-backed answers with charts, statistical tests, data quality reports, and on-demand business recommendations. Users can also generate AI dashboards from their datasets.

## Stack

- **Backend:** Python 3.11 (strict requirement — PandasAI does not support 3.12+), FastAPI, PandasAI, SQLAlchemy, seaborn, scipy, Ollama (FOSS LLM)
- **Frontend:** Next.js 14 (App Router), TypeScript, TailwindCSS, Framer Motion, Recharts
- **Data stores:** PostgreSQL/MySQL/MSSQL/Databricks (user data), CSV/Excel uploads, SQLite (app metadata)
- **LLM:** Ollama Cloud with model `gpt-oss:120b-cloud`. Auth via Bearer token in `OLLAMA_API_TOKEN`.
- **Email:** SMTP via smtplib, admin-configurable through the UI. Passwords encrypted with Fernet.
- **Authentication:** JWT-based with bcrypt password hashing. Access tokens (30 min) + refresh tokens (7 days).

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

## Demo Credentials

Demo users are auto-created on first startup:

| Role | Email | Password |
|------|-------|----------|
| **User** | `demo@insighting.ai` | `demo2024!` |
| **Admin** | `admin@insighting.ai` | `admin2024!` |

## Key Architecture Decisions

- **Ollama only** — no OpenAI dependency. LLM calls go through Ollama Cloud or local Ollama instance.
- **SQLite for metadata** — zero-config local DB, auto-created on first startup.
- **JWT authentication** — All API endpoints (except /health, /auth/*) require authentication.
- **PandasAI SmartDatalake** — core query engine. Generates Python/SQL, executes it, returns results.
- **Guardrails are non-optional** — read-only SQL, timeout, row limits, PII masking.
- **Schema context injection** — auto-introspects database schemas and infers relations.
- **On-demand recommendations** — recommendations are NOT generated automatically. Users click "Get AI Recommendations" button which triggers a separate LLM call via `POST /chat/recommendations`.
- **Multi-database support** — PostgreSQL, MySQL, MS SQL Server, Databricks, CSV, and Excel file uploads.
- **Message feedback** — thumbs up/down on responses stored via `POST /chat/feedback`.
- **Dynamic suggested questions** — LLM generates 6 analytical questions based on the actual database schema. Cached for 30 min. Falls back to generic questions if LLM is unavailable.
- **Dashboard email reports** — SMTP configuration stored in `smtp_config` table. Dashboards rendered as HTML email with styled KPIs, tables, and insights.
- **Dashboard iteration** — Users can iterate on dashboards with feedback. Iteration history is stored.
- **Dashboard tabs** — Multiple dashboards displayed as horizontal tabs with animated underline. Each tab has delete button.
- **Markdown insights** — InsightCard renders markdown (headings, bold, italic, bullets, numbered lists) via a lightweight custom renderer (no external dependency).
- **PandasAI whitelisted libs** — `seaborn`, `scipy`, `numpy` are whitelisted in SmartDatalake config for correlation/scatter plots.
- **HR demo dataset** — 7-table People Analytics dataset in `scripts/seed_hr_data.sql` (4,450 rows) with realistic correlations.
- **Alert connectors** — Alerts can be sent via Email, Slack webhook, or SFTP.
- **Glossary formulae** — Business glossary terms support formula types (expression/calculation/metric), result types, and dependencies.

## Security Features (v0.4.0+)

- **Safe expression evaluation** — `simpleeval` replaces `eval()` for threshold conditions
- **SQL injection prevention** — Parameterized queries for row count lookups
- **Rate limiting** — 100 requests/minute via slowapi
- **File upload validation** — MIME type detection with python-magic, 50MB size limit
- **Input validation** — Pydantic field validators for cron expressions, email addresses, lengths
- **Restricted CORS** — Limited methods and headers

## Directory Layout

```
backend/app/
  api/          → FastAPI routers (10 files). Each router is a thin layer over a service.
  core/         → config.py, database.py, guardrails.py, lifespan.py, auth.py, rate_limit.py
  models/       → schemas.py (60+ Pydantic models), orm.py (15 SQLAlchemy tables)
  services/     → Business logic (15 files). intelligence.py is main orchestrator,
                  auth.py for JWT, alert_connectors.py for notifications, sql_validator.py
  skills/       → PandasAI @skill functions (statistical, timeseries, profiling)
  static/       → Generated chart PNGs served via StaticFiles
  tests/        → pytest tests with in-memory SQLite fixtures

frontend/src/
  app/          → 7 Next.js pages (chat, dashboards, datasources, glossary, alerts, admin, login)
  components/   → 14 React components organized by domain
    chat/       → MessageBubble, RecommendationCard, ThoughtProcess, DataQualityBanner
    ui/         → Modal, EmptyState, ToggleSwitch, StatCard, Skeleton, ChatHistory, Toast
    charts/     → ChartPanel, ChartTypeSelector
    stats/      → SignificanceBadge, TimeSeriesChart
    schema/     → SchemaViewer
    export/     → ExportMenu
  hooks/        → useAnalyticsChat, useDatasources, useSchemaMap
  lib/          → api.ts (typed fetch wrapper with JWT refresh), chartUtils.ts
  types/        → index.ts (all shared TypeScript interfaces)
  contexts/     → AuthContext.tsx (JWT token management)
  test/         → vitest setup and component tests

scripts/        → seed_hr_data.sql (HR dataset), run_dev.sh (legacy dev script)
start.sh        → Start backend + frontend
stop.sh         → Stop all services
```

## API Endpoints

### Authentication
- `POST /auth/register` — Register new user account
- `POST /auth/login` — Authenticate and get access/refresh tokens
- `POST /auth/refresh` — Get new access token using refresh token
- `POST /auth/logout` — Revoke refresh token
- `GET /auth/me` — Get current user profile

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
- `PATCH /dashboards/{id}/iterate` — Iterate on dashboard with feedback
- `GET /dashboards/{id}/iterations` — Get iteration history
- `POST /dashboards/email` — Send dashboard report via email (requires SMTP config)

### Alerts
- `GET/POST/PUT/DELETE /alerts` — Scheduled SQL alerts
- `GET /alerts/{id}/connectors` — List connectors for alert
- `POST /alerts/{id}/connectors` — Add connector (email/slack/sftp)
- `DELETE /alerts/{id}/connectors/{connector_id}` — Remove connector

### Glossary
- `GET/POST/PUT/DELETE /glossary` — Business glossary terms with SQL formulae

### Schema
- `GET /schema/{datasource_id}` — Introspected schema with inferred relations
- `GET /schema/suggested-questions?datasource_id={optional}` — LLM-powered suggested questions from schema

### Admin (requires admin role)
- `GET /admin/logs/llm` — LLM call logs
- `GET /admin/logs/query` — Query execution logs
- `GET/POST /admin/cache/*` — Cache stats and clearing
- `GET/POST /admin/smtp` — SMTP configuration
- `POST /admin/smtp/test` — Test SMTP connection

### Other
- `GET /export/{conversation_id}?format=csv|pdf` — Export conversations

## Code Patterns

- **Backend routers** import from services, never from other routers.
- **All Pydantic models** live in `models/schemas.py`. ORM models in `models/orm.py`.
- **Config** is `Settings` class in `core/config.py` using `pydantic-settings`.
- **DB sessions** are injected via FastAPI `Depends(get_db)`.
- **Authentication** is injected via `Depends(get_current_user)` or `Depends(require_admin)`.
- **Frontend API calls** go through `lib/api.ts` which exports a typed `api` object.
- **JWT tokens** are stored in localStorage and auto-refreshed on 401.
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
- `ENCRYPTION_KEY` — Fernet key for stored passwords and SMTP credentials
- `JWT_SECRET_KEY` — Secret key for JWT tokens (generate with `python -c "import secrets; print(secrets.token_urlsafe(32))"`)

Frontend (`frontend/.env.local`):
- `NEXT_PUBLIC_API_URL` — backend URL (default: `http://localhost:8000`)

**Note:** SMTP configuration is managed via the Admin UI (not env vars). Stored in the `smtp_config` SQLite table with encrypted passwords.

## Testing

```bash
# Backend tests
cd backend && source .venv/bin/activate && pytest -v

# Frontend tests
cd frontend && npm test
```

## Common Tasks

- **Add a new API endpoint:** Create router in `api/`, service in `services/`, models in `schemas.py`, include router in `main.py`.
- **Add a new page:** Create `src/app/<route>/page.tsx`. Add nav link in `layout.tsx`.
- **Reset metadata DB:** Delete `backend/insighting_meta.db` (auto-recreated on restart).
- **Add new user:** Use `POST /auth/register` or add directly to database.

## Gotchas

- PandasAI **requires Python < 3.12**. Must use Python 3.11.
- SQLite metadata DB is auto-created on startup. Delete it to reset.
- Chart PNGs accumulate in `backend/app/static/charts/`.
- Threshold conditions use `simpleeval` for safe evaluation (no `eval()`).
- Demo users are auto-seeded on first startup.
- **seaborn must be installed** in the backend venv — PandasAI generates code using it for correlation/scatter plots.
- PandasAI config must whitelist `seaborn`, `scipy`, `numpy` via `custom_whitelisted_dependencies` or imports will be blocked.
- The `/schema/suggested-questions` route must be defined BEFORE `/{datasource_id}` in schema.py to avoid FastAPI path conflicts.
- SMTP passwords are encrypted with Fernet before storage. The `ENCRYPTION_KEY` env var must be set for this to work.
- `JWT_SECRET_KEY` must be set in production (defaults to insecure value for development).

## HR Demo Dataset

The project ships with a 7-table People Analytics dataset for demo purposes:

| Table | Rows | Purpose |
|-------|------|---------|
| `employees` | 500 | Core employee master data |
| `employee_attrition` | 150 | Exit records with reasons and tenure |
| `performance_ratings` | 1000 | Quarterly performance reviews |
| `employee_recognition` | 300 | Recognition awards and points |
| `pulse_surveys` | 2000 | Employee engagement survey responses |
| `employee_learning` | 400 | Training courses and completion |
| `employee_promotions` | 100 | Promotion history |

Seed it with: `psql -p 5432 -d insighting_demo -f scripts/seed_hr_data.sql`

Data has realistic correlations: attrition employees have lower survey scores, high performers get more recognition/promotions, attrition skews toward Sales/Support.
