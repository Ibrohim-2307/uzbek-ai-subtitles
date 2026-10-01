#!/usr/bin/env bash
set -e

echo "======================================================================"
echo "   O'ZBEKCHA AI SUBTITR - BARCHA 9 TA TEST TO'PLAMINI YURITISH"
echo "======================================================================"

PYTHON_CMD="python3"
if [ -f "./venv/Scripts/python.exe" ]; then
    PYTHON_CMD="./venv/Scripts/python.exe"
elif [ -f "./venv/bin/python" ]; then
    PYTHON_CMD="./venv/bin/python"
fi

echo ""
echo "[1/9] Python NLP Testlari (tests/test_uzbek_nlp.py) - 83 ta tekshiruv..."
$PYTHON_CMD tests/test_uzbek_nlp.py

echo ""
echo "[2/9] UzbekUtils JS Testlari (tests/test_uzbek_utils.js) - 57 ta tekshiruv..."
node tests/test_uzbek_utils.js

echo ""
echo "[3/9] To'liq Pipeline Testlari (tests/test_pipeline.js) - 20 ta tekshiruv..."
node tests/test_pipeline.js

echo ""
echo "[4/9] Ritm & Beat Python Testlari (tests/test_beats.py) - 33 ta tekshiruv..."
$PYTHON_CMD tests/test_beats.py

echo ""
echo "[5/9] Ritm & Beat JS Testlari (tests/test_beats.js) - 25 ta tekshiruv..."
node tests/test_beats.js

echo ""
echo "[6/9] So'z Rejasi Testlari (tests/test_wordplan.js) - 51 ta tekshiruv..."
node tests/test_wordplan.js

echo ""
echo "[7/9] So'z Kaskadi Integratsiyasi (tests/test_wordstack.js) - 50 ta tekshiruv..."
node tests/test_wordstack.js

echo ""
echo "[8/9] Mock AE ExtendScript Kaskad Testi (tests/test_wordstack_ae.js) - 56 ta tekshiruv..."
node tests/test_wordstack_ae.js

echo ""
echo "[9/9] Sinxronizatsiya va Parity Testlari (tests/test_sync.js) - 36 ta tekshiruv..."
node tests/test_sync.js

echo ""
echo "======================================================================"
echo "   🎉 BARCHA 9 TA TEST TO'PLAMI MUVAFFAQIYATLI O'TDI!"
echo "   JAMI: 411 TA TEKSHIRUV - 100% YASHIL!"
echo "======================================================================"
