# High-Level Design (HLD) — Insighting Analytics

**Version:** 0.4.0
**Date:** February 2026

---

## 1. Executive Summary

Insighting Analytics is a full-stack AI-powered natural language analytics platform. Users connect databases (PostgreSQL, MySQL, MS SQL Server, Databricks) or upload files (CSV, Excel), then ask questions in plain English. The system generates SQL, executes it, and returns answers with charts, statistical tests, data quality reports, and on-demand business recommendations. Users can also generate AI-powered dashboards (with tab navigation and email sharing), receive LLM-generated suggested questions based on their schema, and configure SMTP for emailing dashboard reports.

---

## 2. System Architecture

```
                        ┌─────────────────────────────────┐
                        │          End Users               │
                        │     (Browser - port 3000)        │
                        └────────────┬────────────────────┘
                                     │ HTTPS / HTTP
                                     ▼
                        ┌─────────────────────────────────┐
                        │       Frontend (Next.js 14)      │
                        │    App Router + React 18 + TS    │
                        │       TailwindCSS + Recharts     │
                        │         Framer Motion            │
                        │          Port 3000               │
                        └────────────┬────────────────────┘
                                     │ REST API (JSON)
                                     ▼
                        ┌─────────────────────────────────┐
                        │       Backend (FastAPI)          │
                        │        Python 3.11               │
                        │     PandasAI + SQLAlchemy        │
                        │         Port 8000                │
                        └───┬──────┬──────┬───────┬───────┘
                            │      │      │       │
              ┌─────────────┘      │      │       └─────────────┐
              ▼                    ▼      ▼                     ▼
   ┌──────────────────┐  ┌─────────────────┐  ┌──────────────────────┐
   │   Ollama Cloud   │  │   User Data     │  │  SQLite Metadata DB  │
   │   LLM Service    │  │   Databases     │  │  (Auto-created)      │
   │                  │  │                 │  │                      │
   │  gpt-oss:120b   │  │  PostgreSQL     │  │  - Conversations     │
   │                  │  │  MySQL          │  │  - Messages          │
   │  OpenAI-compat   │  │  MS SQL Server  │  │  - Dashboards        │
   │  API endpoint    │  │  Databricks     │  │  - Alerts            │
   └──────────────────┘  │  CSV / Excel    │  │  - Glossary          │
                         └─────────────────┘  │  - Feedback          │
                                              │  - Logs              │
                                              └──────────────────────┘
```

---

## 3. Component Overview

### 3.1 Frontend (Next.js 14)
- **Framework:** Next.js 14 with App Router, all pages client-rendered
- **Language:** TypeScript 5
- **Styling:** TailwindCSS with custom glass-morphism dark theme
- **Charts:** Recharts (bar, line, area, pie/donut)
- **Animations:** Framer Motion
- **Pages:** Login, Chat (main), Dashboards, Datasources, Glossary, Alerts, Admin

### 3.2 Backend (FastAPI)
- **Framework:** FastAPI with async handlers
- **Language:** Python 3.11 (strict — PandasAI does not support 3.12+)
- **Query Engine:** PandasAI SmartDatalake (generates Python/SQL from NL), whitelists seaborn/scipy/numpy
- **ORM:** SQLAlchemy 2.0
- **LLM:** Ollama Cloud via OpenAI-compatible API
- **Email:** smtplib + email.mime for SMTP-based dashboard report delivery

### 3.3 LLM (Ollama Cloud)
- OpenAI-compatible API endpoint
- Model: `gpt-oss:120b-cloud`
- Bearer token authentication
- Used for: NL-to-SQL translation, recommendations, dashboard generation

### 3.4 Data Layer
- **User Data:** Multi-database support via SQLAlchemy engine factory
- **App Metadata:** SQLite (zero-config, auto-created on startup)
- **File Uploads:** Stored in `data/uploads/`
- **Chart Artifacts:** PNG images in `backend/app/static/charts/`

---

## 4. Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Ollama-only LLM | No OpenAI dependency. FOSS-friendly. |
| SQLite for metadata | Zero-config deployment. No external DB needed for app state. |
| PandasAI SmartDatalake | Mature NL-to-SQL engine with built-in charting. |
| On-demand recommendations | Reduces latency on primary query. User controls when to fetch. |
| Multi-database engine factory | Single abstraction for PostgreSQL, MySQL, MSSQL, Databricks, CSV, Excel. |
| Dynamic suggested questions | LLM generates questions from actual schema — improves discoverability. |
| SMTP email via admin UI | No env-var SMTP config needed. Admin sets it up via UI, passwords encrypted. |
| Dashboard tab navigation | Horizontal tabs for multi-dashboard browsing — replaces vertical stacking. |
| Lightweight markdown renderer | Custom regex-based renderer — no react-markdown dependency. |
| Client-rendered pages | Simpler deployment (no SSR concerns). All data via REST API. |
| Glass-morphism design | Premium, modern aesthetic. Consistent brand language. |

---

## 5. Non-Functional Requirements

| Requirement | Target |
|-------------|--------|
| Query latency | < 30s (configurable timeout) |
| Max result rows | 10,000 (configurable) |
| Concurrent users | 50+ (uvicorn async) |
| PII protection | Regex-based masking on responses |
| SQL safety | Read-only guardrails, no DDL/DML |
| Caching | In-memory with 5-min TTL (Redis optional) |
| Deployment | Single-command via start.sh |

---

## 6. Security Architecture

- **Authentication:** Session-based (credentials in AuthContext — production should use JWT)
- **Credential Storage:** Fernet encryption for datasource passwords
- **SQL Guardrails:** Read-only enforcement, query timeout, row limits
- **PII Masking:** Automatic regex-based masking of emails, phone numbers, SSNs
- **CORS:** Configurable allowed origins
- **File Uploads:** Extension validation (.csv, .xlsx, .xls only)

---

## 7. Deployment Architecture

```
┌─────────────────────────────────────────────────┐
│                  Host Machine                    │
│                                                  │
│  ┌─────────────┐    ┌─────────────────────────┐ │
│  │  Frontend    │    │  Backend                │ │
│  │  Next.js     │───▶│  FastAPI + Uvicorn      │ │
│  │  Port 3000   │    │  Port 8000              │ │
│  └─────────────┘    │                          │ │
│                      │  ┌───────────────────┐  │ │
│                      │  │  SQLite meta.db   │  │ │
│                      │  └───────────────────┘  │ │
│                      │  ┌───────────────────┐  │ │
│                      │  │  data/uploads/    │  │ │
│                      │  └───────────────────┘  │ │
│                      │  ┌───────────────────┐  │ │
│                      │  │  static/charts/   │  │ │
│                      │  └───────────────────┘  │ │
│                      └─────────────────────────┘ │
│                              │                    │
│                     ┌────────┴────────┐           │
│                     ▼                 ▼           │
│            ┌──────────────┐  ┌──────────────┐    │
│            │ Ollama Cloud │  │ User DBs     │    │
│            │ (External)   │  │ (PG/MySQL/..)│    │
│            └──────────────┘  └──────────────┘    │
└─────────────────────────────────────────────────┘
```

---

## 8. Technology Stack Summary

| Layer | Technology | Version |
|-------|-----------|---------|
| Frontend Framework | Next.js (App Router) | 14.x |
| Frontend Language | TypeScript | 5.x |
| Frontend Styling | TailwindCSS | 3.4 |
| Frontend Charts | Recharts | 2.x |
| Frontend Animations | Framer Motion | 11.x |
| Backend Framework | FastAPI | 0.115+ |
| Backend Language | Python | 3.11 |
| Query Engine | PandasAI | 2.0+ |
| ORM | SQLAlchemy | 2.0+ |
| Metadata DB | SQLite | Built-in |
| LLM | Ollama Cloud | gpt-oss:120b |
| Visualization | seaborn, matplotlib | 0.13+, 3.9+ |
| Encryption | Cryptography (Fernet) | 43+ |
| Email | smtplib (stdlib) + email.mime | Built-in |
| Scheduling | APScheduler | 3.10+ |
| Export | ReportLab (PDF) | 4.2+ |
