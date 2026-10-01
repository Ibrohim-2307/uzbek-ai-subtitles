#!/usr/bin/env bash
set -e

echo "======================================================================"
echo "   SO'Z VAQTI ANIQLIGINI O'RNATISH (faster-whisper)"
echo "======================================================================"

PYTHON_CMD="python3"
if [ -f "./venv/Scripts/python.exe" ]; then
    PYTHON_CMD="./venv/Scripts/python.exe"
elif [ -f "./venv/bin/python" ]; then
    PYTHON_CMD="./venv/bin/python"
fi

echo ""
echo "[1/2] faster-whisper kutubxonasi o'rnatilmoqda..."
$PYTHON_CMD -m pip install faster-whisper

echo ""
echo "[2/2] O'rnatish tekshirilmoqda..."
$PYTHON_CMD -c "import faster_whisper; print('✅ faster-whisper muvaffaqiyatli o\'rnatildi (versiya:', faster_whisper.__version__, ')')"

echo ""
echo "======================================================================"
echo "   O'RNATISH YAKUNLANDI! Audiodan so'z vaqti o'lchovi faollashtirildi."
echo "======================================================================"
