@echo off
set PYTHON_CMD=python
if exist .\venv\Scripts\python.exe (
    set PYTHON_CMD=.\venv\Scripts\python.exe
)

echo ======================================================================
echo    O'ZBEKCHA AI SUBTITR - BARCHA 9 TA TEST TO'PLAMINI YURITISH
echo ======================================================================

echo.
echo [1/9] Python NLP Testlari (tests/test_uzbek_nlp.py) - 83 ta tekshiruv...
%PYTHON_CMD% tests/test_uzbek_nlp.py
if errorlevel 1 exit /b 1

echo.
echo [2/9] UzbekUtils JS Testlari (tests/test_uzbek_utils.js) - 57 ta tekshiruv...
node tests/test_uzbek_utils.js
if errorlevel 1 exit /b 1

echo.
echo [3/9] To'liq Pipeline Testlari (tests/test_pipeline.js) - 20 ta tekshiruv...
node tests/test_pipeline.js
if errorlevel 1 exit /b 1

echo.
echo [4/9] Ritm va Beat Python Testlari (tests/test_beats.py) - 33 ta tekshiruv...
%PYTHON_CMD% tests/test_beats.py
if errorlevel 1 exit /b 1

echo.
echo [5/9] Ritm va Beat JS Testlari (tests/test_beats.js) - 25 ta tekshiruv...
node tests/test_beats.js
if errorlevel 1 exit /b 1

echo.
echo [6/9] So'z Rejasi Testlari (tests/test_wordplan.js) - 51 ta tekshiruv...
node tests/test_wordplan.js
if errorlevel 1 exit /b 1

echo.
echo [7/9] So'z Kaskadi Integratsiyasi (tests/test_wordstack.js) - 50 ta tekshiruv...
node tests/test_wordstack.js
if errorlevel 1 exit /b 1

echo.
echo [8/9] Mock AE ExtendScript Kaskad Testi (tests/test_wordstack_ae.js) - 56 ta tekshiruv...
node tests/test_wordstack_ae.js
if errorlevel 1 exit /b 1

echo.
echo [9/9] Sinxronizatsiya va Parity Testlari (tests/test_sync.js) - 36 ta tekshiruv...
node tests/test_sync.js
if errorlevel 1 exit /b 1

echo.
echo ======================================================================
echo    BARCHA 9 TA TEST TO'PLAMI MUVAFFAQIYATLI O'TDI!
echo    JAMI: 411 TA TEKSHIRUV - 100%% YASHIL!
echo ======================================================================
