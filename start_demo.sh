#!/bin/bash

# Insighting Analytics - Demo Startup Script
# Usage: ./start_demo.sh

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"
FRONTEND_DIR="$SCRIPT_DIR/frontend"

echo ""
echo "=========================================="
echo "  Insighting Analytics - Demo Startup"
echo "=========================================="
echo ""

# Function to check if a port is in use
port_in_use() {
    lsof -i :"$1" | grep LISTEN > /dev/null 2>&1
}

# Function to wait for a service to be ready
wait_for_service() {
    local url=$1
    local name=$2
    local max_attempts=30
    local attempt=1

    while [ $attempt -le $max_attempts ]; do
        if curl -s "$url" > /dev/null 2>&1; then
            return 0
        fi
        sleep 1
        attempt=$((attempt + 1))
    done
    return 1
}

# Step 1: Check PostgreSQL
echo -n "[1/6] Checking PostgreSQL... "
if pg_isready -h localhost -p 5432 > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC}"
else
    # Try connecting with psql as fallback
    if PGPASSWORD=postgres psql -h localhost -U postgres -c "SELECT 1" > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC}"
    else
        echo -e "${YELLOW}⚠ Cannot verify (continuing anyway)${NC}"
    fi
fi

# Step 2: Kill existing processes
echo -n "[2/6] Cleaning up existing processes... "
if port_in_use 8000; then
    lsof -i :8000 | grep LISTEN | awk '{print $2}' | xargs kill 2>/dev/null || true
fi
if port_in_use 3000; then
    lsof -i :3000 | grep LISTEN | awk '{print $2}' | xargs kill 2>/dev/null || true
fi
sleep 2
echo -e "${GREEN}✓${NC}"

# Step 3: Start Backend
echo -n "[3/6] Starting backend... "
cd "$BACKEND_DIR"
source .venv/bin/activate
nohup uvicorn app.main:app --host 0.0.0.0 --port 8000 > backend.log 2>&1 &
BACKEND_PID=$!

if wait_for_service "http://localhost:8000/health" "backend"; then
    echo -e "${GREEN}✓${NC} (PID: $BACKEND_PID)"
else
    echo -e "${RED}✗ Failed to start${NC}"
    echo "Check logs: $BACKEND_DIR/backend.log"
    exit 1
fi

# Step 4: Start Frontend
echo -n "[4/6] Starting frontend... "
cd "$FRONTEND_DIR"

# Load nvm
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

nohup npm run dev > frontend.log 2>&1 &
FRONTEND_PID=$!

if wait_for_service "http://localhost:3000" "frontend"; then
    echo -e "${GREEN}✓${NC} (PID: $FRONTEND_PID)"
else
    echo -e "${RED}✗ Failed to start${NC}"
    echo "Check logs: $FRONTEND_DIR/frontend.log"
    exit 1
fi

# Step 5: Register Datasource
echo -n "[5/6] Registering datasource... "
DS_RESPONSE=$(curl -s -X POST http://localhost:8000/datasources \
  -H "Content-Type: application/json" \
  -d '{"name": "HR Analytics Database", "host": "localhost", "port": 5432, "database": "postgres", "username": "postgres", "password": "postgres", "ssl_mode": "disable"}')

DS_ID=$(echo "$DS_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['id'])" 2>/dev/null)

if [ -n "$DS_ID" ]; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${YELLOW}⚠ May already exist${NC}"
    # Try to get existing datasource
    DS_ID=$(curl -s http://localhost:8000/datasources | python3 -c "import sys, json; ds=json.load(sys.stdin); print(ds[0]['id'] if ds else '')" 2>/dev/null)
fi

# Step 6: Refresh Schema
echo -n "[6/6] Refreshing schema... "
if [ -n "$DS_ID" ]; then
    SCHEMA_RESPONSE=$(curl -s -X POST "http://localhost:8000/datasources/$DS_ID/refresh-schema")
    TABLES=$(echo "$SCHEMA_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('tables', 0))" 2>/dev/null)
    RELATIONS=$(echo "$SCHEMA_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('relations', 0))" 2>/dev/null)
    echo -e "${GREEN}✓${NC} ($TABLES tables, $RELATIONS relations)"
else
    echo -e "${YELLOW}⚠ Skipped (no datasource ID)${NC}"
fi

# Done!
echo ""
echo "=========================================="
echo -e "  ${GREEN}Demo is ready!${NC}"
echo "=========================================="
echo ""
echo "  Frontend:  http://localhost:3000"
echo "  Backend:   http://localhost:8000"
echo "  API Docs:  http://localhost:8000/docs"
echo ""
echo "  Login:     admin / admin123"
echo ""
echo "=========================================="
echo ""

# Open browser (macOS)
if command -v open &> /dev/null; then
    echo "Opening browser..."
    open "http://localhost:3000"
fi

echo ""
echo "To stop the demo later, run:"
echo "  ./stop_demo.sh"
echo ""
