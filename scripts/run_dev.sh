#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# ---------- Backend ----------
echo "Setting up backend..."
cd "$ROOT/backend"

# Create venv if it doesn't exist
if [ ! -d ".venv" ]; then
    echo "Creating Python virtual environment..."
    python3.11 -m venv .venv
fi

# Activate venv
source .venv/bin/activate

# Install deps if needed
if [ ! -f ".venv/.deps_installed" ]; then
    echo "Installing Python dependencies..."
    pip install -e ".[dev]" 2>&1 | tail -3
    touch .venv/.deps_installed
fi

echo "Starting backend..."
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!

# ---------- Frontend ----------
echo "Setting up frontend..."
cd "$ROOT/frontend"

# Install node deps if needed
if [ ! -d "node_modules" ]; then
    echo "Installing Node dependencies..."
    npm install
fi

echo "Starting frontend..."
npm run dev &
FRONTEND_PID=$!

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null" EXIT

echo ""
echo "Backend:  http://localhost:8000"
echo "Frontend: http://localhost:3000"
echo "Press Ctrl+C to stop both."
echo ""

wait
