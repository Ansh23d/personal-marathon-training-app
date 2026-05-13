#!/bin/bash
# Start both backend and frontend dev servers

ROOT="$(cd "$(dirname "$0")" && pwd)"

# Backend
echo "Starting backend..."
cd "$ROOT/backend"
if [ ! -d ".venv" ]; then
  echo "Creating Python virtual environment..."
  python3 -m venv .venv
  source .venv/bin/activate
  pip install -r requirements.txt -q
else
  source .venv/bin/activate
fi

if [ ! -f ".env" ]; then
  echo ""
  echo "ERROR: backend/.env not found."
  echo "Copy backend/.env.example to backend/.env and fill in your Strava credentials."
  echo ""
  exit 1
fi

uvicorn app.main:app --reload --port 8000 &
BACKEND_PID=$!

# Frontend
echo "Starting frontend..."
cd "$ROOT/frontend"
npm run dev &
FRONTEND_PID=$!

echo ""
echo "  Backend:  http://localhost:8000"
echo "  Frontend: http://localhost:5173"
echo ""
echo "Press Ctrl+C to stop both servers"

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null" EXIT INT TERM
wait
