#!/bin/bash

# Insighting Analytics - Demo Stop Script
# Usage: ./stop_demo.sh

GREEN='\033[0;32m'
NC='\033[0m'

echo ""
echo "Stopping Insighting Analytics Demo..."
echo ""

# Stop backend
echo -n "Stopping backend (port 8000)... "
if lsof -i :8000 | grep LISTEN > /dev/null 2>&1; then
    lsof -i :8000 | grep LISTEN | awk '{print $2}' | xargs kill 2>/dev/null
    echo -e "${GREEN}✓${NC}"
else
    echo "not running"
fi

# Stop frontend
echo -n "Stopping frontend (port 3000)... "
if lsof -i :3000 | grep LISTEN > /dev/null 2>&1; then
    lsof -i :3000 | grep LISTEN | awk '{print $2}' | xargs kill 2>/dev/null
    echo -e "${GREEN}✓${NC}"
else
    echo "not running"
fi

echo ""
echo "Demo stopped."
echo ""
