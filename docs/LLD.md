# Low-Level Design (LLD) — Insighting Analytics

**Version:** 0.5.0
**Date:** February 2026

---

## 1. Backend Module Design

### 1.1 Module Dependency Graph

```
main.py
  ├── api/chat.py ──────────► services/intelligence.py
  │                           services/conversation.py
  │                           services/recommendation.py
  ├── api/datasources.py ──► services/db_engine.py
  │                           services/schema_registry.py
  ├── api/dashboards.py ───► services/dashboard.py
  │                           services/db_engine.py
  │                           services/email_service.py
  ├── api/schema.py ───────► services/schema_registry.py
  │                           services/question_generator.py
  ├── api/alerts.py ───────► services/scheduler.py
  ├── api/glossary.py
  ├── api/admin.py ────────► services/observability.py
  │                           services/cache.py
  │                           services/email_service.py (SMTP config)
  ├── api/exports.py ──────► services/export.py
  └── api/health.py
```

### 1.2 Router → Service → Model Pattern

Every API router follows a strict layered pattern:

```
Request → Router (api/*.py) → Service (services/*.py) → ORM (models/orm.py)
                                                      → External (LLM, DB)
          ↓                    ↓
        Pydantic schema      Business logic
        validation           orchestration
```

- **Routers** never import from other routers
- **Services** never import from routers
- **Models** are pure data definitions with no business logic

---

## 2. Database Schema (SQLite Metadata)

### 2.1 Entity-Relationship Diagram

```
┌──────────────┐       ┌──────────────────┐       ┌───────────────────┐
│  datasources │       │  conversations   │       │     messages      │
├──────────────┤       ├──────────────────┤       ├───────────────────┤
│ id (PK)      │◄──────│ datasource_id(FK)│       │ id (PK)           │
│ name         │       │ id (PK)          │◄──────│ conversation_id(FK│
│ db_type      │       │ title            │       │ role              │
│ host         │       │ created_at       │       │ content           │
│ port         │       │ updated_at       │       │ generated_sql     │
│ database     │       └──────────────────┘       │ generated_code    │
│ username     │                                   │ chart_path        │
│ encrypted_pwd│       ┌──────────────────┐       │ recommendations   │
│ ssl_mode     │       │ message_feedback │       │ data_quality_json │
│ db_type      │       ├──────────────────┤       │ stats_json        │
│ http_path    │       │ id (PK)          │       │ created_at        │
│ catalog      │       │ message_id (FK)──│──────►└───────────────────┘
│ access_token │       │ rating           │
│ file_path    │       │ created_at       │
│ is_default   │       └──────────────────┘
│ created_at   │
│ updated_at   │       ┌──────────────────┐       ┌───────────────────┐
└──────────────┘       │    dashboards    │       │     alerts        │
                       ├──────────────────┤       ├───────────────────┤
                       │ id (PK)          │       │ id (PK)           │
                       │ title            │       │ name              │
                       │ datasource_id(FK)│       │ datasource_id(FK) │
                       │ prompt           │       │ query             │
                       │ widgets_json     │       │ cron_expression   │
                       │ created_at       │       │ threshold_cond    │
                       │ updated_at       │       │ webhook_url       │
                       └──────────────────┘       │ enabled           │
                                                   │ last_triggered_at │
┌──────────────────┐   ┌──────────────────┐       │ created_at        │
│ glossary_terms   │   │  llm_call_logs   │       └───────────────────┘
├──────────────────┤   ├──────────────────┤
│ id (PK)          │   │ id (PK)          │       ┌───────────────────┐
│ term             │   │ model            │       │   query_logs      │
│ sql_expression   │   │ prompt_length    │       ├───────────────────┤
│ description      │   │ response_length  │       │ id (PK)           │
│ created_at       │   │ tokens_used      │       │ datasource_id     │
│ updated_at       │   │ latency_ms       │       │ sql               │
└──────────────────┘   │ error            │       │ rows_returned     │
                       │ created_at       │       │ duration_ms       │
                       └──────────────────┘       │ error             │
                                                   │ created_at        │
                                                   └───────────────────┘

┌──────────────────┐
│   smtp_config    │
├──────────────────┤
│ id (PK)          │
│ host             │
│ port             │
│ username         │
│ encrypted_pwd    │
│ from_email       │
│ use_tls          │
│ updated_at       │
└──────────────────┘
```

### 2.2 Table Details

**datasources** — Stores connection configurations for all supported database types.
- `db_type` ENUM: `postgresql`, `mysql`, `mssql`, `databricks`, `csv`, `excel`
- `encrypted_password` uses Fernet symmetric encryption
- `file_path` stores uploaded file location (CSV/Excel only)
- `http_path`, `catalog`, `access_token` are Databricks-specific

**messages** — Stores chat messages with embedded analytics results.
- `recommendations_json`, `data_quality_json`, `stats_json` are TEXT columns storing JSON
- Deserialized into Pydantic models when returned via API

**dashboards** — Stores AI-generated dashboard configurations.
- `widgets_json` is a TEXT column storing a JSON array of widget configs
- Each widget has: id, type, title, data, config

**smtp_config** — Stores SMTP configuration for email reports.
- Single-row table (one SMTP config per instance)
- `encrypted_password` uses Fernet symmetric encryption (same key as datasource passwords)
- Configured via Admin UI, not environment variables

---

## 3. Service Design

### 3.1 Intelligence Service (`intelligence.py`)

The main query orchestrator. Processes NL queries through this pipeline:

```
process_query(query, db, session_id, datasource_id)
  │
  ├── 1. Get/create conversation
  ├── 2. Load conversation history (last 10 messages)
  ├── 3. Load glossary terms
  ├── 4. Build LLM (OllamaCloudLLM)
  ├── 5. Load DataFrames from datasource
  │     ├── If datasource_id → _load_dataframes_from_datasource()
  │     │     ├── CSV → pd.read_csv()
  │     │     ├── Excel → pd.read_excel() (all sheets)
  │     │     └── DB → SQLAlchemy engine → pd.read_sql_table()
  │     └── Else → _load_dataframes_default() (env var PG)
  ├── 6. Build SmartDatalake + system prompt
  ├── 7. Execute dl.chat(query)
  ├── 8. Extract generated code, chart path
  ├── 9. PII masking
  ├── 10. Data quality check (if DataFrame result)
  ├── 11. Log to observability
  └── 12. Save assistant message → return ChatResponse
```

### 3.2 Database Engine Factory (`db_engine.py`)

Builds SQLAlchemy connection strings for all supported database types:

| DB Type | Connection String Pattern |
|---------|--------------------------|
| PostgreSQL | `postgresql://{user}:{pwd}@{host}:{port}/{db}` |
| MySQL | `mysql+pymysql://{user}:{pwd}@{host}:{port}/{db}` |
| MSSQL | `mssql+pyodbc://{user}:{pwd}@{host}:{port}/{db}?driver=...` |
| Databricks | `databricks://token:{token}@{host}?http_path=...&catalog=...` |

Also provides:
- `get_table_list_query(db_type)` — DB-specific table listing SQL
- `get_default_schema(db_type)` — Returns `public`, `dbo`, etc.
- `get_row_count_query(db_type, table)` — Fast row count estimates

### 3.3 Dashboard Service (`dashboard.py`)

```
generate_dashboard(prompt, db, datasource_id)
  │
  ├── 1. Load sample data from datasource (100 rows per table)
  ├── 2. Build structured LLM prompt with data context
  ├── 3. Call Ollama LLM via httpx
  ├── 4. Parse JSON response → DashboardWidget[]
  │     Widget types: kpi, bar, line, area, pie, table, insight
  ├── 5. Save to Dashboard table (widgets as JSON)
  └── 6. Return DashboardOut
```

### 3.4 Recommendation Service (`recommendation.py`)

```
generate_recommendations(query, answer, context)
  │
  ├── 1. Build prompt for business recommendations
  ├── 2. Call Ollama LLM via httpx
  ├── 3. Parse JSON response
  ├── 4. Validate and limit to 3 recommendations
  └── 5. Return List[Recommendation]
```

### 3.5 Question Generator (`question_generator.py`)

```
generate_questions(table_names, schema_summary)
  │
  ├── 1. Compute cache key (MD5 of sorted table names)
  ├── 2. Check in-memory cache (TTL = 30 min)
  │     └── Cache hit? → return cached questions
  ├── 3. Build structured prompt with schema summary
  ├── 4. Call Ollama LLM via OpenAI-compatible client
  ├── 5. Parse JSON response → SuggestedQuestion[]
  │     (text, category, icon_hint)
  ├── 6. Cache result
  └── 7. Return questions (fallback to generic if LLM fails)
```

### 3.6 Email Service (`email_service.py`)

```
send_dashboard_email(dashboard_id, recipient_emails, db)
  │
  ├── 1. Load SMTP config from smtp_config table
  ├── 2. Load dashboard from dashboards table
  ├── 3. Render widgets to HTML email template
  │     ├── KPIs → styled inline-block divs
  │     ├── Tables → HTML <table> (max 20 rows)
  │     ├── Insights → formatted text with borders
  │     └── Charts → description placeholder (not renderable in email)
  ├── 4. Build MIMEMultipart message
  ├── 5. Connect to SMTP server (TLS if configured)
  ├── 6. Authenticate + send
  └── 7. Return status
```

### 3.7 Schema Registry (`schema_registry.py`)

```
introspect(datasource_id, connection_string, db_type)
  │
  ├── 1. SQLAlchemy inspect() for tables, columns, PKs
  ├── 2. Extract explicit FK relationships
  ├── 3. Fast row count estimates (DB-specific queries)
  ├── 4. Infer implicit joins by column name patterns
  │     (e.g., orders.user_id → users.id)
  ├── 5. Cache in-memory registry
  └── 6. Return SchemaMap
```

---

## 4. API Endpoint Design

### 4.1 Chat Endpoints

| Method | Path | Request Body | Response |
|--------|------|-------------|----------|
| POST | `/chat` | `{query, session_id?, datasource_id?}` | `ChatResponse` |
| POST | `/chat/recommendations` | `{message_id, session_id}` | `{recommendations[]}` |
| POST | `/chat/feedback` | `{message_id, rating}` | `{status}` |
| GET | `/chat/sessions` | — | `Conversation[]` |
| GET | `/chat/history/{id}` | — | `ConversationDetail` |
| PATCH | `/chat/sessions/{id}` | `{title}` | `Conversation` |
| DELETE | `/chat/sessions/{id}` | — | 204 |

### 4.2 Dashboard Endpoints

| Method | Path | Request Body | Response |
|--------|------|-------------|----------|
| POST | `/dashboards/generate` | `{prompt, datasource_id?}` | `DashboardOut` |
| GET | `/dashboards` | — | `DashboardOut[]` |
| GET | `/dashboards/{id}` | — | `DashboardOut` |
| DELETE | `/dashboards/{id}` | — | 204 |
| POST | `/dashboards/email` | `{dashboard_id, recipients[], subject?}` | `{status, message}` |

### 4.4 Schema Endpoints

| Method | Path | Request Body | Response |
|--------|------|-------------|----------|
| GET | `/schema/{datasource_id}` | — | `SchemaMap` |
| GET | `/schema/suggested-questions` | `?datasource_id={optional}` | `SuggestedQuestionsResponse` |

### 4.5 Admin Endpoints (SMTP)

| Method | Path | Request Body | Response |
|--------|------|-------------|----------|
| GET | `/admin/smtp` | — | `SmtpConfigOut \| null` |
| POST | `/admin/smtp` | `SmtpConfigCreate` | `SmtpConfigOut` |
| POST | `/admin/smtp/test` | — | `{status, message}` |

### 4.3 Datasource Endpoints

| Method | Path | Request Body | Response |
|--------|------|-------------|----------|
| GET | `/datasources` | — | `DatasourceOut[]` |
| POST | `/datasources` | `DatasourceCreate` | `DatasourceOut` |
| POST | `/datasources/upload` | Multipart (file, name) | `DatasourceOut` |
| DELETE | `/datasources/{id}` | — | 204 |
| POST | `/datasources/{id}/refresh-schema` | — | `{tables, relations}` |

---

## 5. Frontend Component Architecture

### 5.1 Component Hierarchy

```
layout.tsx (Root Layout)
├── ToastProvider (context)
├── AuthProvider (context)
├── Navigation Sidebar
│   ├── Logo + Brand
│   ├── Nav Items (6 routes)
│   └── Keyboard Shortcuts
│
├── page.tsx (Chat)
│   ├── ChatHistory (sidebar)
│   │   └── SessionItem (rename, delete)
│   ├── EmptyState (when no messages)
│   ├── MessageBubble[]
│   │   ├── DataTable (tabular results)
│   │   ├── ChartPanel
│   │   │   └── ChartTypeSelector
│   │   ├── ThoughtProcess (SQL/code viewer)
│   │   ├── DataQualityBanner
│   │   ├── RecommendationCard (lazy-loaded)
│   │   └── Action Bar (copy, feedback, timestamp)
│   ├── TypingIndicator
│   └── Input Area (auto-resize textarea)
│
├── dashboards/page.tsx
│   ├── Tab Bar (horizontal, animated underline)
│   ├── GenerateDashboard Modal
│   ├── EmailModal (recipient input, send)
│   └── DashboardGrid
│       ├── KPICard
│       ├── ChartWidget
│       ├── TableWidget (full-width)
│       └── InsightCard (markdown-rendered, full-width)
│
├── datasources/page.tsx
│   ├── DB Type Selector (6 types)
│   ├── Connection Form / Upload Form
│   ├── DatasourceCard[]
│   └── SchemaViewer Modal
│
├── login/page.tsx
├── glossary/page.tsx
├── alerts/page.tsx
└── admin/page.tsx
    ├── LLM Logs Tab
    ├── Query Logs Tab
    ├── Cache Tab
    └── SMTP Config Tab (SmtpConfigSection)
```

### 5.2 State Management

- **No global state library** — React hooks + context only
- `useAnalyticsChat` — messages, sessions, send/receive, feedback, recommendations
- `useDatasources` — CRUD for datasource connections
- `useSchemaMap` — schema loading for a datasource
- `useToast` — notification system (context-based)
- `AuthContext` — login state (session-based, no JWT)

### 5.3 API Client (`lib/api.ts`)

Single typed API client using `fetch`:
- Automatic JSON content-type headers
- Error handling with status code extraction
- 204 response handling (returns undefined)
- Multipart support for file uploads (separate method)

---

## 6. Design System

### 6.1 Color Tokens

| Token | Value | Usage |
|-------|-------|-------|
| `brand-500` | `#6366f1` | Primary actions, active states |
| `surface-100` | `#09090b` | Deepest background |
| `surface-200` | `#18181b` | Card backgrounds |
| `surface-300` | `#27272a` | Elevated surfaces |
| `surface-400` | `#3f3f46` | Borders, dividers |
| `surface-500` | `#52525b` | Secondary text |
| `surface-600` | `#71717a` | Muted text |

### 6.2 Component Classes

| Class | Purpose |
|-------|---------|
| `.glass-card` | Card with border, backdrop-blur, inner glow |
| `.btn-primary` | Gradient button with glow shadow |
| `.btn-secondary` | Bordered button |
| `.btn-ghost` | Text-only button |
| `.btn-danger` | Red action button |
| `.input-glass` | Input with glass-morphism style |
| `.badge-*` | Status badges (brand, success, warning, danger, neutral) |
| `.code-block` | Code display with monospace font |

### 6.3 Animation System

| Animation | Duration | Usage |
|-----------|----------|-------|
| `fade-in-up` | 0.5s | Page entry |
| `typing-dot` | 1.4s | AI thinking indicator |
| `pulse-glow` | 2s | Active indicators |
| `float` | 6s | Decorative elements |
| `scale-in` | 0.2s | Dropdowns, tooltips |
| `slide-in` | 0.3s | Notifications |

---

## 7. Error Handling Strategy

| Layer | Strategy |
|-------|----------|
| API Routers | HTTPException with status codes (400, 404, 500) |
| Services | Try/except with logging, graceful fallbacks |
| PandasAI | Catch query errors, return user-friendly message |
| LLM calls | Timeout (60s), retry not implemented, fallback messages |
| Frontend | Try/catch in hooks, toast error notifications |
| File uploads | Extension validation, size limits |

---

## 8. Caching Strategy

- **In-memory cache** (cachetools) with configurable TTL (default 5 min)
- **Cache key:** Hash of query + datasource_id
- **Optional Redis:** Set `REDIS_URL` in .env for shared cache
- **Schema cache:** In-memory registry per datasource_id
- **No cache** on: recommendations, feedback, file uploads, dashboard generation
