#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
PIDFILE="$ROOT/.pids"

echo ""
echo "  ┌──────────────────────────────────────┐"
echo "  │    Insighting Analytics Platform      │"
echo "  │    Starting services...               │"
echo "  └──────────────────────────────────────┘"
echo ""

# Stop any existing instances
if [ -f "$PIDFILE" ]; then
    echo "Stopping previous instances..."
    while IFS= read -r pid; do
        kill "$pid" 2>/dev/null || true
    done < "$PIDFILE"
    rm -f "$PIDFILE"
    sleep 1
fi

# Also kill any lingering processes on our ports
for PORT in 8000 3000; do
    lsof -ti ":$PORT" 2>/dev/null | xargs kill 2>/dev/null || true
done
sleep 1

# ---------- Backend ----------
echo "[1/2] Starting backend..."
cd "$ROOT/backend"

# Create venv if it doesn't exist
if [ ! -d ".venv" ]; then
    echo "  Creating Python virtual environment (python3.11)..."
    python3.11 -m venv .venv
fi

source .venv/bin/activate

# Install deps if needed
if [ ! -f ".venv/.deps_installed" ]; then
    echo "  Installing Python dependencies..."
    pip install -e ".[dev]" 2>&1 | tail -5
    touch .venv/.deps_installed
fi

nohup uvicorn app.main:app --host 0.0.0.0 --port 8000 > "$ROOT/backend.log" 2>&1 &
BACKEND_PID=$!
echo "$BACKEND_PID" > "$PIDFILE"
echo "  Backend started (PID: $BACKEND_PID)"

# ---------- Frontend ----------
echo "[2/2] Starting frontend..."
cd "$ROOT/frontend"

# Install node deps if needed
if [ ! -d "node_modules" ]; then
    echo "  Installing Node dependencies..."
    npm install --silent
fi

nohup npm run dev > "$ROOT/frontend.log" 2>&1 &
FRONTEND_PID=$!
echo "$FRONTEND_PID" >> "$PIDFILE"
echo "  Frontend started (PID: $FRONTEND_PID)"

# Wait for services to be ready
echo ""
echo "  Waiting for services..."
sleep 3

echo ""
echo "  ┌───────────────────────────────────────────────┐"
echo "  │  Services Running:                            │"
echo "  │                                               │"
echo "  │  Backend:   http://localhost:8000             │"
echo "  │  Frontend:  http://localhost:3000             │"
echo "  │  API Docs:  http://localhost:8000/docs        │"
echo "  │                                               │"
echo "  │  Demo Credentials:                            │"
echo "  │    User:  demo@insighting.ai / demo2024!      │"
echo "  │    Admin: admin@insighting.ai / admin2024!    │"
echo "  │                                               │"
echo "  │  Logs:                                        │"
echo "  │    Backend:  tail -f backend.log              │"
echo "  │    Frontend: tail -f frontend.log             │"
echo "  │                                               │"
echo "  │  Stop: ./stop.sh                              │"
echo "  └───────────────────────────────────────────────┘"
echo ""
