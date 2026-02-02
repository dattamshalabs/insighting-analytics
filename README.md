# Insighting Analytics

A production-grade, local-first analytics platform powered by PandasAI, FastAPI, and **Ollama** (FOSS LLM).
Chat with your PostgreSQL databases using natural language, with built-in
statistical hypothesis testing, data quality validation, auto schema discovery, and action recommendations.

## Architecture

```
insighting-analytics/
├── backend/                       # Python 3.11+ / FastAPI
│   ├── app/
│   │   ├── api/                   # FastAPI routers
│   │   │   ├── chat.py            # POST /chat + conversation history
│   │   │   ├── health.py          # GET /health
│   │   │   ├── datasources.py     # CRUD datasource connections
│   │   │   ├── schema.py          # Schema introspection + inferred relations
│   │   │   ├── exports.py         # PDF/CSV export
│   │   │   ├── alerts.py          # Scheduled insight alerts
│   │   │   ├── glossary.py        # Business term → SQL mappings
│   │   │   └── admin.py           # Observability logs
│   │   ├── core/
│   │   │   ├── config.py          # pydantic-settings (multi-datasource, cache, Ollama)
│   │   │   ├── lifespan.py        # Startup: DB init, scheduler start
│   │   │   ├── database.py        # SQLAlchemy engine/session (SQLite metadata DB)
│   │   │   └── guardrails.py      # Read-only enforcement, timeout, PII masking
│   │   ├── models/
│   │   │   ├── schemas.py         # Pydantic request/response models
│   │   │   └── orm.py             # SQLAlchemy ORM: conversations, datasources, alerts, glossary
│   │   ├── services/
│   │   │   ├── intelligence.py    # SmartDatalake orchestration (Ollama LLM)
│   │   │   ├── schema_registry.py # Auto-introspect + inferred joins
│   │   │   ├── data_quality.py    # Null rates, outliers, freshness, type checks
│   │   │   ├── recommendation.py  # LLM-powered action recommendations
│   │   │   ├── conversation.py    # Conversation memory (SQLite)
│   │   │   ├── cache.py           # In-memory TTL cache
│   │   │   ├── export.py          # PDF/CSV generation
│   │   │   ├── scheduler.py       # APScheduler for alert cron jobs
│   │   │   └── observability.py   # LLM/query call logging
│   │   ├── skills/
│   │   │   ├── statistical.py     # ANOVA, anomaly detection, correlation
│   │   │   ├── timeseries.py      # Trend detection, forecasting, period comparison
│   │   │   └── profiling.py       # Auto data profiling on datasource connect
│   │   ├── static/charts/
│   │   └── main.py
│   ├── tests/
│   ├── pyproject.toml
│   └── .env.example
├── frontend/                      # Next.js 14 App Router / TypeScript
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx           # Chat (main)
│   │   │   ├── datasources/       # Manage PG connections
│   │   │   ├── glossary/          # Business glossary editor
│   │   │   ├── alerts/            # Scheduled alerts manager
│   │   │   ├── admin/             # Observability logs viewer
│   │   │   └── layout.tsx         # Sidebar nav
│   │   ├── components/
│   │   │   ├── chat/              # MessageBubble, ThoughtProcess, RecommendationCard, DataQualityBanner
│   │   │   ├── stats/             # SignificanceBadge, TimeSeriesChart
│   │   │   ├── schema/            # SchemaViewer (ERD-style)
│   │   │   └── export/            # ExportMenu
│   │   ├── hooks/                 # useAnalyticsChat, useDatasources, useSchemaMap
│   │   ├── lib/                   # API client
│   │   └── types/                 # Shared TypeScript types
│   ├── package.json
│   └── .env.example
├── scripts/
│   └── run_dev.sh
├── .gitignore
└── README.md
```

## Tech Stack (FOSS-First)

| Layer      | Technology                                              |
|------------|---------------------------------------------------------|
| Backend    | FastAPI, PandasAI, SQLAlchemy, scipy, statsmodels       |
| Frontend   | Next.js 14, TailwindCSS, TypeScript                    |
| Database   | PostgreSQL (any host) + SQLite (local metadata)         |
| LLM        | **Ollama** (llama3, mistral, etc.) — fully open-source  |
| Stats      | scipy (ANOVA), statsmodels (time series), IQR anomaly   |
| Scheduling | APScheduler                                             |
| Caching    | cachetools (in-memory TTL) + optional Redis             |

## Data Flow

```
User Query (NL) → Next.js → FastAPI /chat
  → Conversation memory loaded (SQLite)
  → Schema context + Business glossary injected into prompt
  → PandasAI SmartDatalake (PostgreSQLConnector + Ollama LLM)
    → SQL generation + execution on PostgreSQL
    → Guardrails: read-only check, row limit, timeout
    → Optional: Statistical/TimeSeries skills
    → Optional: Chart saved to /static/charts/
  → Data quality checks on result
  → Recommendations generated via second Ollama call
  → Response { answer, sql, chart, stats, data_quality, recommendations }
  → Next.js → Rendered UI with quality banners + recommendation cards
```

## Features

- **Natural language to SQL** via PandasAI + Ollama (FOSS)
- **Auto schema discovery** with relationship inference (FK + name-matching)
- **Data quality validation** — nulls, outliers, freshness, type consistency
- **Action recommendations** — LLM-generated business advice per query
- **Conversation memory** — persistent sessions with context for follow-up queries
- **Multi-datasource** — connect multiple PostgreSQL instances
- **Business glossary** — map terms like "revenue" to SQL expressions
- **Exports** — PDF and CSV for any conversation
- **Scheduled alerts** — cron-based queries with webhook notifications
- **Observability** — LLM call logs, query logs, latency tracking
- **Statistical skills** — ANOVA, anomaly detection, correlation analysis
- **Time-series skills** — trend detection, forecasting, period-over-period comparison
- **Guardrails** — read-only enforcement, query timeout, row caps, PII masking

## Quick Start

```bash
# 1. Copy env files
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local

# 2. Fill in your credentials in backend/.env
#    - PostgreSQL connection details
#    - Ollama base URL (default: http://localhost:11434)

# 3. Install backend dependencies
cd backend && pip install -e .

# 4. Install frontend dependencies
cd frontend && npm install

# 5. Start Ollama (if running locally)
ollama serve

# 6. Run both services
./scripts/run_dev.sh
```

Backend: http://localhost:8000
Frontend: http://localhost:3000

## API Endpoints

| Method | Path                              | Description                    |
|--------|-----------------------------------|--------------------------------|
| GET    | /health                           | Health check                   |
| POST   | /chat                             | Send NL query                  |
| GET    | /chat/sessions                    | List conversations             |
| GET    | /chat/history/{id}                | Get conversation messages      |
| GET    | /datasources                      | List datasources               |
| POST   | /datasources                      | Register a PG connection       |
| DELETE | /datasources/{id}                 | Remove datasource              |
| POST   | /datasources/{id}/refresh-schema  | Re-introspect schema           |
| GET    | /schema/{datasource_id}           | Get schema map + relations     |
| GET    | /export/{conversation_id}         | Export as CSV or PDF           |
| GET    | /alerts                           | List alerts                    |
| POST   | /alerts                           | Create alert                   |
| PUT    | /alerts/{id}                      | Update alert                   |
| DELETE | /alerts/{id}                      | Delete alert                   |
| GET    | /glossary                         | List glossary terms            |
| POST   | /glossary                         | Create term                    |
| PUT    | /glossary/{id}                    | Update term                    |
| DELETE | /glossary/{id}                    | Delete term                    |
| GET    | /admin/logs/llm                   | LLM call logs                  |
| GET    | /admin/logs/query                 | SQL query logs                 |
| GET    | /admin/cache/stats                | Cache statistics               |
| POST   | /admin/cache/clear                | Clear all caches               |

## Constraints

- **No Docker** — raw local build optimized for UAT
- **FOSS-first** — Ollama for LLM inference, all OSS dependencies
- **Strictly typed** — Pydantic models + TypeScript throughout
- **Modular** — Service/Router pattern, separated concerns
