# Insighting Analytics

A production-grade, local-first analytics platform that lets you **chat with your PostgreSQL databases using natural language**. Powered entirely by FOSS: [PandasAI](https://github.com/sinaptik-ai/pandas-ai), [Ollama](https://ollama.com), FastAPI, and Next.js.

Ask questions like *"What were our top 10 customers by revenue last quarter?"* and get back SQL, results, charts, data quality warnings, and actionable recommendations — all from a single chat interface.

---

## Features

| Category | What it does |
|---|---|
| **Natural Language to SQL** | Ask questions in plain English; PandasAI + Ollama generate and execute SQL |
| **Auto Schema Discovery** | Introspects `information_schema`, detects foreign keys, infers joins by naming convention |
| **Data Quality Validation** | Checks null rates, outliers (IQR), freshness, type consistency, volume sanity on every query |
| **Action Recommendations** | Second LLM call generates prioritized business recommendations from analysis results |
| **Conversation Memory** | Persistent sessions stored in SQLite; follow-up questions use prior context |
| **Multi-Datasource** | Connect multiple PostgreSQL instances; credentials encrypted at rest (Fernet) |
| **Business Glossary** | Map terms like "revenue" to SQL expressions; injected into every LLM prompt |
| **Statistical Skills** | ANOVA, anomaly detection, correlation matrix — invoked automatically when relevant |
| **Time-Series Skills** | Trend decomposition, exponential smoothing forecast, period-over-period comparison |
| **Exports** | Download any conversation as PDF or CSV |
| **Scheduled Alerts** | Cron-based SQL queries with threshold conditions; fires webhooks when triggered |
| **Observability** | Logs every LLM call (tokens, latency) and SQL query; viewable in admin dashboard |
| **Guardrails** | Read-only enforcement, 30s query timeout, 10K row cap, PII regex masking |
| **Caching** | In-memory TTL cache for query results and LLM responses |

---

## Tech Stack

Everything is free and open-source.

| Layer | Technology |
|---|---|
| LLM | **Ollama** (`gpt-oss:120b-cloud` via Ollama Cloud, or any local model) |
| Backend | Python 3.11, FastAPI, PandasAI, SQLAlchemy, scipy, statsmodels |
| Frontend | Next.js 14 (App Router), TypeScript, TailwindCSS |
| Databases | PostgreSQL (your data) + SQLite (app metadata — zero config) |
| Scheduling | APScheduler with SQLite job store |
| Caching | cachetools TTL (in-memory) + optional Redis |

---

## Architecture

```
User Query (NL)
  |
  v
Next.js frontend ──POST /chat──> FastAPI backend
                                    |
                      Conversation memory loaded (SQLite)
                      Schema context + glossary injected
                                    |
                                    v
                    PandasAI SmartDatalake + Ollama LLM
                      |                        |
                  SQL generated            Guardrails applied
                      |                   (read-only, timeout, row cap)
                      v
                  PostgreSQL ──results──> Data quality checks
                                              |
                                              v
                                    Recommendations (2nd LLM call)
                                              |
                                              v
                            Response: answer, SQL, chart, stats,
                            data quality report, recommendations
                                              |
                                              v
                                    Next.js renders:
                                    - Message bubble
                                    - Thought process (SQL/code)
                                    - Data quality banner
                                    - Recommendation cards
                                    - Charts
```

---

## Project Structure

```
insighting-analytics/
├── backend/
│   ├── app/
│   │   ├── api/            8 routers (chat, health, datasources, schema, exports, alerts, glossary, admin)
│   │   ├── core/           config, database, guardrails, lifespan
│   │   ├── models/         Pydantic schemas + SQLAlchemy ORM (8 tables)
│   │   ├── services/       9 services (intelligence, schema_registry, data_quality, recommendation,
│   │   │                   conversation, cache, export, scheduler, observability)
│   │   ├── skills/         statistical, timeseries, profiling
│   │   ├── static/charts/  generated chart images
│   │   └── main.py         FastAPI app entry point
│   ├── pyproject.toml
│   └── .env.example
├── frontend/
│   └── src/
│       ├── app/            5 pages (chat, datasources, glossary, alerts, admin)
│       ├── components/     10 components (chat, stats, schema, export)
│       ├── hooks/          3 hooks (useAnalyticsChat, useDatasources, useSchemaMap)
│       ├── lib/            API client
│       └── types/          shared TypeScript types
├── scripts/
│   └── run_dev.sh          starts backend + frontend with venv
├── CLAUDE.md               context file for Claude Code
├── SETUP.md                team setup guide
└── README.md
```

---

## Quick Start

See **[SETUP.md](SETUP.md)** for the full team setup guide with prerequisites and troubleshooting.

```bash
# Clone
git clone https://github.com/dattamshalabs/insighting-analytics.git
cd insighting-analytics

# Copy env files and fill in credentials
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local

# Run (creates venv, installs deps, starts both services)
./scripts/run_dev.sh
```

Backend: http://localhost:8000 | Frontend: http://localhost:3000 | API docs: http://localhost:8000/docs

---

## API Reference

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check |
| `POST` | `/chat` | Send natural language query |
| `GET` | `/chat/sessions` | List all conversations |
| `GET` | `/chat/history/{session_id}` | Get conversation with messages |
| `GET` | `/datasources` | List connected datasources |
| `POST` | `/datasources` | Register a PostgreSQL connection |
| `DELETE` | `/datasources/{id}` | Remove a datasource |
| `POST` | `/datasources/{id}/refresh-schema` | Re-introspect schema |
| `GET` | `/schema/{datasource_id}` | Get schema map with inferred relations |
| `GET` | `/export/{conversation_id}?format=csv\|pdf` | Export conversation |
| `GET` | `/alerts` | List scheduled alerts |
| `POST` | `/alerts` | Create an alert |
| `PUT` | `/alerts/{id}` | Update an alert |
| `DELETE` | `/alerts/{id}` | Delete an alert |
| `GET` | `/glossary` | List business glossary terms |
| `POST` | `/glossary` | Create a glossary term |
| `PUT` | `/glossary/{id}` | Update a glossary term |
| `DELETE` | `/glossary/{id}` | Delete a glossary term |
| `GET` | `/admin/logs/llm` | LLM call logs |
| `GET` | `/admin/logs/query` | SQL query execution logs |
| `GET` | `/admin/cache/stats` | Cache hit/miss statistics |
| `POST` | `/admin/cache/clear` | Clear all caches |

Interactive API docs are available at `/docs` (Swagger) and `/redoc` when the backend is running.

---

## Pages

| Route | Purpose |
|---|---|
| `/` | Main chat interface — ask questions, see answers with charts and recommendations |
| `/datasources` | Connect, manage, and introspect PostgreSQL databases |
| `/glossary` | Define business terms and their SQL equivalents |
| `/alerts` | Create cron-scheduled SQL queries with threshold-based webhook alerts |
| `/admin` | View LLM call logs, query logs, and cache statistics |

---

## Design Principles

- **No Docker** — raw local build, optimized for rapid UAT iteration
- **FOSS-first** — Ollama for inference, no proprietary API dependencies
- **Strictly typed** — Pydantic on the backend, TypeScript on the frontend
- **Modular** — service/router pattern; each service has a single responsibility
- **Safe by default** — read-only queries, timeout limits, PII masking, encrypted credentials

---

## License

Private. Internal use only.
