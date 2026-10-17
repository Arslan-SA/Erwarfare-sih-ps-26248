#!/usr/bin/env bash
# backend/scripts/run_dev.sh
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )/.." && pwd )"
cd "$DIR"

if [ ! -d ".venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv .venv
    .venv/bin/pip install -e .
fi

echo "Starting FastAPI Uvicorn Server on http://localhost:8000..."
export PYTHONPATH=.
.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
