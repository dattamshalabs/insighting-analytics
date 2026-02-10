# Setup Guide

Step-by-step instructions to get Insighting Analytics running locally or on a Linux server.

---

## Prerequisites

| Requirement | Version | Check |
|---|---|---|
| Python | **3.9 – 3.11** (3.11 recommended; 3.12+ will NOT work) | `python3.11 --version` |
| Node.js | 18+ | `node --version` |
| npm | 9+ | `npm --version` |
| Git | any | `git --version` |

---

## Quick Start

The fastest way to get running — `start.sh` handles venv creation, dependency installation, and launching both services:

```bash
git clone https://github.com/dattamshalabs/insighting-analytics.git
cd insighting-analytics

# Configure backend environment (see "Configure environment" below)
cp backend/.env.example backend/.env
nano backend/.env

# Configure frontend environment
cp frontend/.env.example frontend/.env.local

# Start everything
./start.sh
```

Services will be available at:
- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:8000
- **API Docs:** http://localhost:8000/docs

**Demo Credentials:**
| Role | Email | Password |
|------|-------|----------|
| User | `demo@insighting.ai` | `demo2024!` |
| Admin | `admin@insighting.ai` | `admin2024!` |

To stop all services:
```bash
./stop.sh
```

---

## First-Time Setup (Manual / Linux Server)

### 1. Install prerequisites

```bash
sudo apt update && sudo apt install -y python3.11 python3.11-venv git curl

# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs
```

### 2. Clone the repo

```bash
git clone https://github.com/dattamshalabs/insighting-analytics.git
cd insighting-analytics
```

### 3. Backend setup

```bash
cd backend
python3.11 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"

# Verify
python -c "from app.main import app; print('Backend OK')"
```

### 4. Configure environment

```bash
cp .env.example .env
nano .env
```

Edit `backend/.env` with your actual values:

```ini
# === REQUIRED ===

# Default PostgreSQL datasource (you can also add datasources via the UI)
PG_HOST=your-postgres-host.example.com
PG_PORT=5432
PG_DATABASE=your_database
PG_USERNAME=your_username
PG_PASSWORD=your_password
PG_SSL_MODE=disable              # "require" for cloud-hosted

# Ollama Cloud — the LLM
OLLAMA_BASE_URL=https://api.ollama.com
OLLAMA_MODEL=gpt-oss:120b-cloud
OLLAMA_USERNAME=<ask team lead>
OLLAMA_API_TOKEN=<ask team lead>

# === OPTIONAL (defaults are fine for UAT) ===

CHART_OUTPUT_DIR=app/static/charts
CORS_ORIGINS=["http://localhost:3000"]
METADATA_DB_PATH=insighting_meta.db
CACHE_TTL_SECONDS=300
SCHEDULER_ENABLED=true
QUERY_TIMEOUT_SECONDS=30
MAX_RESULT_ROWS=10000
PII_MASKING_ENABLED=true
```

### 5. Frontend setup

```bash
cd ../frontend
npm install
cp .env.example .env.local
nano .env.local
```

`frontend/.env.local` — update if backend is on a different host/port:

```ini
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### 6. Build frontend for production

```bash
npm run build
```

You should see `Compiled successfully` and a route table.

### 7. Start and verify

**Recommended — use the start/stop scripts:**

```bash
cd /path/to/insighting-analytics
./start.sh     # Starts backend + frontend (creates venv/installs deps if needed)
./stop.sh      # Stops all services
```

**Manual start:**

```bash
# Start backend
cd backend && source .venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8000 &

# Start frontend
cd ../frontend
npm run dev &
```

| Check | Command / URL | Expected |
|---|---|---|
| Backend health | `curl http://localhost:8000/health` | `{"status":"ok","version":"0.5.0"}` |
| API docs | http://localhost:8000/docs | Swagger UI loads |
| Frontend | http://localhost:3000 | Login page loads |

**Demo Credentials:** `demo@insighting.ai` / `demo2024!` or `admin@insighting.ai` / `admin2024!`

---

## Every Restart

```bash
cd /path/to/insighting-analytics
./start.sh
```

The script automatically:
- Stops any previously running instances
- Creates the Python venv if it doesn't exist
- Installs dependencies if not already installed
- Starts backend (port 8000) and frontend (port 3000)
- Writes PIDs to `.pids` for clean shutdown

To stop:
```bash
./stop.sh
```

**Logs:**
```bash
tail -f backend.log     # Backend logs
tail -f frontend.log    # Frontend logs
```

---

## Seed the HR Demo Dataset (Optional)

The project includes a 7-table HR/People Analytics dataset for immediate exploration. To seed it:

```bash
# Create the database (if it doesn't exist)
createdb -p 5432 insighting_demo

# Seed the HR tables (employees, attrition, performance, recognition, surveys, learning, promotions)
psql -p 5432 -d insighting_demo -f scripts/seed_hr_data.sql
```

This creates 4,450 rows across 7 tables with realistic correlations. You can immediately ask questions like:
- "What is the average attrition rate by department?"
- "Is there a relationship between tenure and exit interview scores?"
- "Show top 10 performers by rating"

---

## Configure SMTP for Email Reports (Optional)

To enable emailing dashboard reports:

1. Go to http://localhost:3000/admin
2. Click the **SMTP** tab
3. Fill in your SMTP details (host, port, username, password, from email, TLS)
4. Click **Test Connection** to verify
5. Click **Save**

Now you can click the email icon on any dashboard to send it as a formatted HTML report.

**Supported SMTP providers:** Gmail (smtp.gmail.com:587), Outlook (smtp.office365.com:587), AWS SES, SendGrid, or any SMTP server.

---

## Connect a Datasource

Insighting Analytics supports multiple database types via pre-built connectors:

| Connector | How to Connect |
|---|---|
| **PostgreSQL** | Host, port, database, username, password |
| **MySQL** | Host, port, database, username, password |
| **MS SQL Server** | Host, port, database, username, password |
| **Databricks** | Host, HTTP path, catalog, access token |
| **CSV file** | Upload `.csv` file directly |
| **Excel file** | Upload `.xlsx` file directly |

**Option A — via `.env` (default PostgreSQL datasource):**
The PG credentials in `backend/.env` are used as the default datasource.

**Option B — via the UI (recommended for multiple datasources):**
1. Go to http://localhost:3000/datasources
2. Select the database type (PostgreSQL, MySQL, SQL Server, Databricks, CSV, or Excel)
3. Fill in the connection details or upload a file
4. Click "Connect"
5. The schema will be auto-introspected

---

## Features

- **JWT Authentication** — secure login with access tokens (30 min) + refresh tokens (7 days)
- **Natural language analytics** — ask questions about your data in plain English
- **View SQL Query** — see the generated SQL for every response
- **Multi-database support** — PostgreSQL, MySQL, MSSQL, Databricks, CSV, Excel
- **AI dashboards** — generate dashboards with KPI cards, charts, tables, and formatted AI insights
- **Dynamic dashboard prompts** — AI suggests dashboards based on your datasource schema
- **Dashboard iteration** — refine dashboards with feedback; track iteration history
- **Dashboard tabs** — browse multiple dashboards via horizontal tab navigation
- **Email reports** — send dashboard reports via email with configurable SMTP (Admin > SMTP)
- **Alert connectors** — send alerts via Email, Slack webhook, or SFTP
- **Dynamic suggested questions** — LLM generates contextual questions from your actual schema
- **On-demand recommendations** — click "Get AI Recommendations" on any response for business insights
- **Statistical analysis** — significance tests, time series analysis, data profiling
- **Data quality reports** — automated data quality scoring with issue detection
- **Message feedback** — thumbs up/down on responses for quality tracking
- **Conversation management** — search, rename, delete chat sessions
- **Export** — download conversations as CSV or PDF
- **Business glossary** — define terms with formula types and dependencies
- **Scheduled alerts** — set up SQL-based alerts with cron schedules
- **Schema introspection** — auto-discovers tables, columns, types, and relationships
- **Security hardened** — rate limiting, safe eval, SQL injection prevention, input validation
- **HR demo dataset** — 7-table People Analytics dataset (4,450 rows) included for out-of-the-box exploration

---

## Troubleshooting

### `ModuleNotFoundError: No module named 'pandasai'`
You're using the wrong Python version. PandasAI requires Python < 3.12.
```bash
python --version   # must show 3.9, 3.10, or 3.11
```
Recreate the venv with `python3.11 -m venv .venv`.

### `Backend starts but chat returns errors`
- Check that `backend/.env` has valid database credentials
- Check that the Ollama Cloud URL and API token are correct
- Check `backend.log` for error details

### `Frontend shows "Failed to fetch"` or CORS errors
- Make sure the backend is running on port 8000
- Check that `CORS_ORIGINS` in `backend/.env` includes your frontend URL
- Check that `NEXT_PUBLIC_API_URL` in `frontend/.env.local` is `http://localhost:8000`

### `insighting_meta.db` is corrupted or you want to reset
```bash
rm backend/insighting_meta.db
# Restart the backend — it will recreate the DB automatically
```

### `npm run dev` fails with module errors
```bash
rm -rf frontend/node_modules frontend/.next
cd frontend && npm install
```

### PandasAI error: "import of sys/seaborn not in whitelist"
Seaborn must be installed in the backend venv:
```bash
cd backend && source .venv/bin/activate
pip install seaborn
```
The `custom_whitelisted_dependencies` in `intelligence.py` already includes `seaborn`, `scipy`, and `numpy`.

### Port already in use
```bash
./stop.sh
# Or manually:
lsof -ti :8000 | xargs kill 2>/dev/null
lsof -ti :3000 | xargs kill 2>/dev/null
```
