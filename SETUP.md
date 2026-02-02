# Setup Guide

Step-by-step instructions to get Insighting Analytics running on a Linux server.

---

## Prerequisites

| Requirement | Version | Check |
|---|---|---|
| Python | **3.9 – 3.11** (3.11 recommended; 3.12+ will NOT work) | `python3.11 --version` |
| Node.js | 18+ | `node --version` |
| npm | 9+ | `npm --version` |
| Git | any | `git --version` |
| PostgreSQL | access to any PG instance (local, RDS, etc.) | `psql --version` |

---

## First-Time Setup (Linux Server)

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

```bash
# Start backend
cd ../backend
source .venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8000 &

# Start frontend
cd ../frontend
npm start &
```

| Check | Command / URL | Expected |
|---|---|---|
| Backend health | `curl http://localhost:8000/health` | `{"status":"ok","version":"0.2.0"}` |
| API docs | http://localhost:8000/docs | Swagger UI loads |
| Frontend | http://localhost:3000 | Login page loads |

**Login credentials:** `admin` / `admin123`

---

## Every Restart

```bash
cd /path/to/insighting-analytics

# Start backend
cd backend
source .venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8000 &

# Start frontend
cd ../frontend
npm start &
```

Or use the included script:

```bash
cd /path/to/insighting-analytics
./scripts/run_dev.sh
```

### Persistent service (survives SSH disconnect)

```bash
cd /path/to/insighting-analytics

nohup bash -c 'cd backend && source .venv/bin/activate && uvicorn app.main:app --host 0.0.0.0 --port 8000' > backend.log 2>&1 &
nohup bash -c 'cd frontend && npm start' > frontend.log 2>&1 &
```

To stop:

```bash
# Find and kill processes
lsof -i :8000 | grep LISTEN | awk '{print $2}' | xargs kill
lsof -i :3000 | grep LISTEN | awk '{print $2}' | xargs kill
```

---

## Connect a Datasource

**Option A — via `.env` (default datasource):**
The PG credentials in `backend/.env` are used as the default datasource.

**Option B — via the UI (multiple datasources):**
1. Go to http://localhost:3000/datasources
2. Click "Add Datasource"
3. Fill in the connection details
4. Click "Connect"
5. The schema will be auto-introspected

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

### Port already in use
```bash
lsof -i :8000 | grep LISTEN | awk '{print $2}' | xargs kill
lsof -i :3000 | grep LISTEN | awk '{print $2}' | xargs kill
```
