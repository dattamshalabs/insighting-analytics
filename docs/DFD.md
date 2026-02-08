# Data Flow Diagrams (DFD) — Insighting Analytics

**Version:** 0.2.0
**Date:** February 2026

---

## Level 0 — Context Diagram

```
                    ┌───────────────────────┐
                    │                       │
   ─── Query ─────►│                       │──── Answer + Charts ────►
                    │   Insighting          │
   ─── DB Creds ──►│   Analytics           │──── Dashboard ──────────►
                    │   Platform            │
   ─── Files ─────►│                       │──── Recommendations ───►
                    │                       │
   ─── Feedback ──►│                       │──── Exports ───────────►
                    │                       │
                    └───────────┬───────────┘
                                │
                    ┌───────────┴───────────┐
                    │                       │
                    │   External Systems    │
                    │   - Ollama LLM        │
                    │   - User Databases    │
                    │                       │
                    └───────────────────────┘
```

**External Entities:** End User, Ollama Cloud LLM, User Databases (PG/MySQL/MSSQL/Databricks)
**System:** Insighting Analytics Platform

---

## Level 1 — Major Process Flows

```
┌──────────┐                                              ┌──────────────┐
│          │     1. NL Query                               │              │
│          │─────────────────────►┌──────────────┐         │              │
│          │                      │ 1.0          │         │              │
│          │                      │ Query        │────────►│  User        │
│          │◄─────────────────────│ Processing   │ Answer  │  Databases   │
│          │  Answer + Charts     │              │◄────────│  (PG/MySQL/  │
│          │                      └──────┬───────┘         │   MSSQL/etc) │
│          │                             │                 │              │
│          │     2. Get Recommendations  │ Schema +        └──────────────┘
│          │─────────────────────►┌──────┴───────┐
│  User    │                      │ 2.0          │         ┌──────────────┐
│          │◄─────────────────────│ Recommend-   │────────►│              │
│          │  Recommendations     │ ation Engine │◄────────│  Ollama      │
│          │                      └──────────────┘         │  Cloud LLM   │
│          │                                               │              │
│          │     3. Generate Dashboard                     │              │
│          │─────────────────────►┌──────────────┐         │              │
│          │                      │ 3.0          │────────►│              │
│          │◄─────────────────────│ Dashboard    │◄────────│              │
│          │  Dashboard Widgets   │ Generator    │         └──────────────┘
│          │                      └──────────────┘
│          │                                               ┌──────────────┐
│          │     4. Connect Datasource                     │              │
│          │─────────────────────►┌──────────────┐         │  SQLite      │
│          │                      │ 4.0          │────────►│  Metadata    │
│          │◄─────────────────────│ Datasource   │◄────────│  Database    │
│          │  Connection Status   │ Manager      │         │              │
│          │                      └──────────────┘         │              │
│          │                                               │              │
│          │     5. Manage Sessions                        │              │
│          │─────────────────────►┌──────────────┐         │              │
│          │                      │ 5.0          │────────►│              │
│          │◄─────────────────────│ Conversation │◄────────│              │
│          │  Chat History        │ Manager      │         │              │
│          │                      └──────────────┘         └──────────────┘
└──────────┘
```

---

## Level 2 — Query Processing (Process 1.0)

```
┌──────────┐
│  User    │
└────┬─────┘
     │ NL Query + session_id + datasource_id
     ▼
┌─────────────────┐
│ 1.1             │
│ Conversation    │──── Save user message ────► [SQLite: messages]
│ Management      │◄── Load history (10 msgs) ─ [SQLite: messages]
└────────┬────────┘
         │ query + history
         ▼
┌─────────────────┐
│ 1.2             │
│ Glossary        │◄── Load terms ──────────── [SQLite: glossary_terms]
│ Resolution      │
└────────┬────────┘
         │ query + glossary context
         ▼
┌─────────────────┐
│ 1.3             │
│ Schema Context  │◄── Get schema map ──────── [In-memory: _registry]
│ Injection       │
└────────┬────────┘
         │ enriched query with schema + glossary
         ▼
┌─────────────────┐
│ 1.4             │                            ┌──────────────────┐
│ Data Loading    │◄── Load tables as DF ──────│ User Database    │
│ (DB Engine)     │    (PG/MySQL/MSSQL/CSV)    │ or File Upload   │
└────────┬────────┘                            └──────────────────┘
         │ DataFrames[]
         ▼
┌─────────────────┐                            ┌──────────────────┐
│ 1.5             │──── Send prompt ──────────►│ Ollama Cloud LLM │
│ PandasAI        │◄── Generated code/SQL ─────│                  │
│ SmartDatalake   │                            └──────────────────┘
└────────┬────────┘
         │ raw result (DataFrame/str/chart)
         ▼
┌─────────────────┐
│ 1.6             │
│ PII Masking     │── Regex mask emails, phones, SSNs
└────────┬────────┘
         │ masked result
         ▼
┌─────────────────┐
│ 1.7             │
│ Data Quality    │── Check nulls, uniqueness, outliers, types
│ Assessment      │
└────────┬────────┘
         │ result + DQ report
         ▼
┌─────────────────┐
│ 1.8             │──── Log LLM call ─────────► [SQLite: llm_call_logs]
│ Observability   │──── Log query ─────────────► [SQLite: query_logs]
│ Logging         │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 1.9             │──── Save assistant msg ───► [SQLite: messages]
│ Response        │
│ Assembly        │──── ChatResponse ──────────► User
└─────────────────┘
```

---

## Level 2 — Dashboard Generation (Process 3.0)

```
┌──────────┐
│  User    │
└────┬─────┘
     │ prompt + datasource_id
     ▼
┌─────────────────┐
│ 3.1             │
│ Sample Data     │◄── Load 100 rows/table ──── [User Database]
│ Loading         │    or CSV/Excel file         [File Upload]
└────────┬────────┘
         │ table schemas + sample data + stats
         ▼
┌─────────────────┐                            ┌──────────────────┐
│ 3.2             │──── Structured prompt ─────►│ Ollama Cloud LLM │
│ LLM Dashboard   │◄── JSON widget array ──────│                  │
│ Prompt          │                            └──────────────────┘
└────────┬────────┘
         │ raw JSON
         ▼
┌─────────────────┐
│ 3.3             │
│ Widget Parser   │── Parse JSON → DashboardWidget[]
│ & Validator     │── Handle markdown code blocks
│                 │── Limit to 8 widgets
└────────┬────────┘
         │ validated widgets
         ▼
┌─────────────────┐
│ 3.4             │──── Save dashboard ────────► [SQLite: dashboards]
│ Persistence     │
│                 │──── DashboardOut ──────────► User
└─────────────────┘
```

---

## Level 2 — Datasource Connection (Process 4.0)

```
┌──────────┐
│  User    │
└────┬─────┘
     │ db_type + credentials OR file upload
     ▼
┌─────────────────┐
│ 4.1             │
│ Input           │── Validate db_type, required fields
│ Validation      │── Validate file extension (.csv/.xlsx)
└────────┬────────┘
         │
         ├──── File? ──────────► ┌──────────────┐
         │                       │ 4.2a         │
         │                       │ File Upload  │── Save to data/uploads/
         │                       │ Handler      │── Create DB entry
         │                       └──────┬───────┘
         │                              │
         └──── Database? ──────► ┌──────┴───────┐
                                 │ 4.2b         │
                                 │ Credential   │── Encrypt password (Fernet)
                                 │ Encryption   │── Build connection string
                                 └──────┬───────┘
                                        │
                                        ▼
                                 ┌──────────────┐
                                 │ 4.3          │── Save to ──► [SQLite: datasources]
                                 │ Datasource   │
                                 │ Persistence  │
                                 └──────┬───────┘
                                        │
                                        ▼
                                 ┌──────────────┐     ┌──────────────────┐
                                 │ 4.4          │────►│ User Database    │
                                 │ Schema       │◄────│                  │
                                 │ Introspection│     └──────────────────┘
                                 └──────┬───────┘
                                        │ SchemaMap
                                        ▼
                                 [In-memory: _registry]
```

---

## Level 2 — On-Demand Recommendations (Process 2.0)

```
┌──────────┐
│  User    │  clicks "Get AI Recommendations"
└────┬─────┘
     │ message_id + session_id
     ▼
┌─────────────────┐
│ 2.1             │◄── Load message ───────────── [SQLite: messages]
│ Message         │
│ Retrieval       │── Check existing recommendations
└────────┬────────┘
         │
         ├── Has recommendations? ──► Return existing (skip LLM)
         │
         └── No recommendations? ──► Continue
                    │
                    ▼
         ┌─────────────────┐                  ┌──────────────────┐
         │ 2.2             │──── Prompt ─────►│ Ollama Cloud LLM │
         │ Recommendation  │◄── JSON ─────────│                  │
         │ Generation      │                  └──────────────────┘
         └────────┬────────┘
                  │ Recommendation[]
                  ▼
         ┌─────────────────┐
         │ 2.3             │──── Update msg ──► [SQLite: messages]
         │ Persistence     │
         │                 │──── Response ────► User
         └─────────────────┘
```

---

## Data Store Catalog

| Store | Type | Content | Persistence |
|-------|------|---------|-------------|
| SQLite metadata DB | File | Conversations, messages, datasources, dashboards, alerts, glossary, logs, feedback | Persistent (auto-created) |
| Schema registry | Memory | Introspected schemas per datasource | Session-scoped (lost on restart) |
| Query cache | Memory/Redis | Query results keyed by hash | TTL-based (5 min default) |
| Chart artifacts | File | Generated PNG charts | Persistent (accumulates) |
| Uploaded files | File | CSV/Excel data files | Persistent (in data/uploads/) |
| User databases | External | Customer data (PG/MySQL/MSSQL/Databricks) | External, read-only access |
| Ollama Cloud | External | LLM inference service | Stateless API |

---

## Data Flow Summary Table

| Flow | Source | Destination | Data | Trigger |
|------|--------|-------------|------|---------|
| Query | User → Backend | Backend → LLM → DB | NL query | User sends message |
| Response | Backend → Frontend | — | Answer + SQL + chart + DQ | Query completion |
| Recommendations | User → Backend → LLM | Backend → SQLite | Recommendation[] | User clicks button |
| Feedback | User → Backend | SQLite | rating (up/down) | User clicks thumb |
| Dashboard Gen | User → Backend → LLM | SQLite | Widget[] | User creates dashboard |
| Datasource | User → Backend | SQLite + Schema Registry | Connection config | User adds datasource |
| File Upload | User → Backend | Filesystem + SQLite | File bytes + metadata | User uploads CSV/Excel |
| Schema Introspect | Backend → User DB | Memory registry | Tables, columns, FKs | On datasource create/refresh |
| Export | User → Backend | — | CSV/PDF file download | User exports conversation |
| Alerts | Scheduler → Backend → DB | SQLite + Webhook | Alert trigger data | Cron schedule |
