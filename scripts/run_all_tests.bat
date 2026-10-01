@echo off
set PYTHON_CMD=python
if exist .\venv\Scripts\python.exe (
    set PYTHON_CMD=.\venv\Scripts\python.exe
)

echo ======================================================================
echo    O'ZBEKCHA AI SUBTITR - BARCHA 11 TA TEST TO'PLAMINI YURITISH
echo ======================================================================

echo.
echo [1/11] Python NLP Testlari (tests/test_uzbek_nlp.py) - 83 ta tekshiruv...
%PYTHON_CMD% tests/test_uzbek_nlp.py
if errorlevel 1 exit /b 1

echo.
echo [2/11] UzbekUtils JS Testlari (tests/test_uzbek_utils.js) - 57 ta tekshiruv...
node tests/test_uzbek_utils.js
if errorlevel 1 exit /b 1

echo.
echo [3/11] To'liq Pipeline Testlari (tests/test_pipeline.js) - 20 ta tekshiruv...
node tests/test_pipeline.js
if errorlevel 1 exit /b 1

echo.
echo [4/11] Ritm va Beat Python Testlari (tests/test_beats.py) - 33 ta tekshiruv...
%PYTHON_CMD% tests/test_beats.py
if errorlevel 1 exit /b 1

echo.
echo [5/11] Ritm va Beat JS Testlari (tests/test_beats.js) - 25 ta tekshiruv...
node tests/test_beats.js
if errorlevel 1 exit /b 1

echo.
echo [6/11] So'z Rejasi Testlari (tests/test_wordplan.js) - 51 ta tekshiruv...
node tests/test_wordplan.js
if errorlevel 1 exit /b 1

echo.
echo [7/11] So'z Kaskadi Integratsiyasi (tests/test_wordstack.js) - 50 ta tekshiruv...
node tests/test_wordstack.js
if errorlevel 1 exit /b 1

echo.
echo [8/11] Mock AE ExtendScript Kaskad Testi (tests/test_wordstack_ae.js) - 56 ta tekshiruv...
node tests/test_wordstack_ae.js
if errorlevel 1 exit /b 1

echo.
echo [9/11] Sinxronizatsiya va Parity Testlari (tests/test_sync.js) - 36 ta tekshiruv...
node tests/test_sync.js
if errorlevel 1 exit /b 1

echo.
echo [10/11] Kadrma-kadr So'z Vaqti Testlari (tests/test_word_timing.js) - 35 ta tekshiruv...
node tests/test_word_timing.js
if errorlevel 1 exit /b 1

echo.
echo [11/11] Audio Aligner va Global Offset Python Testlari (tests/test_audio_align.py) - 23 ta tekshiruv...
%PYTHON_CMD% tests/test_audio_align.py
if errorlevel 1 exit /b 1

echo.
echo ======================================================================
echo    BARCHA 11 TA TEST TO'PLAMI MUVAFFAQIYATLI O'TDI!
echo    JAMI: 469 TA TEKSHIRUV - 100%% YASHIL!
echo ======================================================================
