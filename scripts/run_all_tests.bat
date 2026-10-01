@echo off
set PYTHON_CMD=python
if exist .\venv\Scripts\python.exe (
    set PYTHON_CMD=.\venv\Scripts\python.exe
)

echo ======================================================================
echo    O'ZBEKCHA AI SUBTITR - BARCHA 8 TA TEST TO'PLAMINI YURITISH
echo ======================================================================

echo.
echo [1/8] Python NLP Testlari (tests/test_uzbek_nlp.py) - 83 ta tekshiruv...
%PYTHON_CMD% tests/test_uzbek_nlp.py
if errorlevel 1 exit /b 1

echo.
echo [2/8] UzbekUtils JS Testlari (tests/test_uzbek_utils.js) - 57 ta tekshiruv...
node tests/test_uzbek_utils.js
if errorlevel 1 exit /b 1

echo.
echo [3/8] To'liq Pipeline Testlari (tests/test_pipeline.js) - 20 ta tekshiruv...
node tests/test_pipeline.js
if errorlevel 1 exit /b 1

echo.
echo [4/8] Ritm va Beat Python Testlari (tests/test_beats.py) - 33 ta tekshiruv...
%PYTHON_CMD% tests/test_beats.py
if errorlevel 1 exit /b 1

echo.
echo [5/8] Ritm va Beat JS Testlari (tests/test_beats.js) - 25 ta tekshiruv...
node tests/test_beats.js
if errorlevel 1 exit /b 1

echo.
echo [6/8] So'z Rejasi Testlari (tests/test_wordplan.js) - 51 ta tekshiruv...
node tests/test_wordplan.js
if errorlevel 1 exit /b 1

echo.
echo [7/8] So'z Kaskadi Integratsiyasi (tests/test_wordstack.js) - 50 ta tekshiruv...
node tests/test_wordstack.js
if errorlevel 1 exit /b 1

echo.
echo [8/8] Mock AE ExtendScript Kaskad Testi (tests/test_wordstack_ae.js) - 56 ta tekshiruv...
node tests/test_wordstack_ae.js
if errorlevel 1 exit /b 1

echo.
echo ======================================================================
echo    BARCHA 8 TA TEST TO'PLAMI MUVAFFAQIYATLI O'TDI!
echo    JAMI: 375 TA TEKSHIRUV - 100%% YASHIL!
echo ======================================================================
