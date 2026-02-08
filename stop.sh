#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
PIDFILE="$ROOT/.pids"

echo ""
echo "  Stopping Insighting Analytics..."
echo ""

STOPPED=0

# Stop tracked PIDs
if [ -f "$PIDFILE" ]; then
    while IFS= read -r pid; do
        if kill -0 "$pid" 2>/dev/null; then
            kill "$pid" 2>/dev/null && echo "  Stopped process $pid" && STOPPED=$((STOPPED + 1))
        fi
    done < "$PIDFILE"
    rm -f "$PIDFILE"
fi

# Also kill any processes on our ports as a safety net
for PORT in 8000 3000; do
    PIDS=$(lsof -ti ":$PORT" 2>/dev/null || true)
    if [ -n "$PIDS" ]; then
        echo "$PIDS" | xargs kill 2>/dev/null && STOPPED=$((STOPPED + 1))
        echo "  Stopped process on port $PORT"
    fi
done

if [ "$STOPPED" -eq 0 ]; then
    echo "  No running services found."
else
    echo ""
    echo "  All services stopped."
fi
echo ""
