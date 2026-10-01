#!/usr/bin/env bash
echo "========================================================"
echo "   O'ZBEKCHA AI SUBTITR - FASTAPI SERVER ISHGA TUSHMOQDA"
echo "========================================================"
echo ""

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$DIR"

if [ -f "venv/bin/activate" ]; then
    source venv/bin/activate
fi

python3 -m uvicorn backend.main:app --host 127.0.0.1 --port 8765 --reload
