#!/bin/bash
set -e
cd "$(dirname "$0")"

# Create venv if missing
if [ ! -d venv ]; then
    python3 -m venv venv
fi

source venv/bin/activate

# Install (quiet)
pip install -r requirements.txt -q 2>/dev/null

echo "[Vision] Starting server on :3001 …"
uvicorn main:app --host 0.0.0.0 --port 3001 --log-level warning
