# Setup Guide

Step-by-step instructions for the team to get Insighting Analytics running locally for UAT.

---

## Prerequisites

| Requirement | Version | Check |
|---|---|---|
| Python | **3.9 – 3.11** (3.11 recommended; 3.12+ will NOT work) | `python3.11 --version` |
| Node.js | 18+ | `node --version` |
| npm | 9+ | `npm --version` |
| Git | any | `git --version` |
| PostgreSQL | access to any PG instance (local, RDS, etc.) | `psql --version` |

### Install Python 3.11 (if not present)

**macOS (Homebrew):**
```bash
brew install python@3.11
```

**Ubuntu/Debian:**
```bash
sudo apt update && sudo apt install python3.11 python3.11-venv
```

**pyenv (any platform):**
```bash
pyenv install 3.11
pyenv local 3.11
```

### Install Node.js 18+ (if not present)

```bash
# via nvm (recommended)
nvm install 18
nvm use 18

# or via Homebrew
brew install node@18
```

---

## 1. Clone the repository

```bash
git clone https://github.com/dattamshalabs/insighting-analytics.git
cd insighting-analytics
```

---

## 2. Backend setup

```bash
cd backend

# Create virtual environment with Python 3.11
python3.11 -m venv .venv

# Activate it
source .venv/bin/activate    # macOS/Linux
# .venv\Scripts\activate     # Windows

# Install all dependencies
pip install -e ".[dev]"

# Verify
python -c "from app.main import app; print('Backend OK')"
```

You should see `Backend OK`.

---

## 3. Configure environment

```bash
# From the repo root
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
```

Edit `backend/.env` with your actual values:

```ini
# === REQUIRED ===

# PostgreSQL — the database you want to query
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

`frontend/.env.local` — usually no changes needed:
```ini
NEXT_PUBLIC_API_URL=http://localhost:8000
```

---

## 4. Frontend setup

```bash
cd frontend
npm install
```

Verify:
```bash
npx next build
```

You should see `Compiled successfully` and a route table.

---

## 5. Run

**Option A — combined script (recommended):**
```bash
# From repo root
./scripts/run_dev.sh
```

**Option B — separate terminals:**

Terminal 1 (backend):
```bash
cd backend
source .venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Terminal 2 (frontend):
```bash
cd frontend
npm run dev
```

---

## 6. Verify it's working

| Check | Command / URL | Expected |
|---|---|---|
| Backend health | `curl http://localhost:8000/health` | `{"status":"ok","version":"0.2.0"}` |
| API docs | http://localhost:8000/docs | Swagger UI loads |
| Frontend | http://localhost:3000 | Chat page loads with sidebar |

---

## 7. Connect a datasource (first time)

You have two options:

**Option A — via `.env` (default datasource):**
The PG credentials in `backend/.env` are used as the default datasource. PandasAI will query this database when you send a chat message.

**Option B — via the UI (multiple datasources):**
1. Go to http://localhost:3000/datasources
2. Click "Add Datasource"
3. Fill in the connection details
4. Click "Connect"
5. The schema will be auto-introspected

---

## 8. Test the chat

1. Go to http://localhost:3000
2. Type a question like: `How many rows are in each table?`
3. You should see:
   - An answer with data
   - A "Show thought process" link (click to see generated SQL/code)
   - Data quality warnings (if applicable)
   - Recommendation cards (if the LLM generates them)

---

## UAT Test Scenarios

### Basic queries
- [ ] "Show me the first 10 rows of [table_name]"
- [ ] "How many records are in [table_name]?"
- [ ] "What are the column names and types in [table_name]?"

### Analytical queries
- [ ] "What is the average [numeric_column] grouped by [category_column]?"
- [ ] "Show me the trend of [value] over [date_column]"
- [ ] "Which [entity] has the highest [metric]?"

### Features
- [ ] Connect a datasource via /datasources and verify schema loads
- [ ] Click "Schema" button and verify tables/columns/relationships appear
- [ ] Add a glossary term via /glossary (e.g., "revenue" = `SUM(amount)`)
- [ ] Send a query using that glossary term
- [ ] Create an alert via /alerts
- [ ] Check /admin for LLM and query logs
- [ ] Export a conversation as CSV
- [ ] Start a new chat and verify a follow-up question uses context

### Guardrails
- [ ] Try a write query like "DELETE FROM users" — should be blocked by PandasAI
- [ ] Verify PII masking: if results contain email addresses, they should appear as `[EMAIL]`

---

## Troubleshooting

### `ModuleNotFoundError: No module named 'pandasai'`
You're using the wrong Python version. PandasAI requires Python < 3.12.
```bash
python --version   # must show 3.9, 3.10, or 3.11
```
Recreate the venv with `python3.11 -m venv .venv`.

### `Backend starts but chat returns errors`
- Check that `backend/.env` has valid PostgreSQL credentials
- Check that the Ollama Cloud URL and API token are correct
- Check the terminal for error logs

### `Frontend shows "Failed to fetch"` or CORS errors
- Make sure the backend is running on port 8000
- Check that `CORS_ORIGINS` in `backend/.env` includes `http://localhost:3000`
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

### Port already in use
```bash
# Find and kill the process on port 8000
lsof -i :8000 | grep LISTEN
kill -9 <PID>

# Same for port 3000
lsof -i :3000 | grep LISTEN
kill -9 <PID>
```

---

## Team Contacts

| Role | Who | For |
|---|---|---|
| Ollama credentials | Team lead | `OLLAMA_USERNAME` and `OLLAMA_API_TOKEN` values |
| PostgreSQL access | DBA / DevOps | Connection strings for test databases |
| Bug reports | GitHub Issues | https://github.com/dattamshalabs/insighting-analytics/issues |
