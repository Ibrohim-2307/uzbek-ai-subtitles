@echo off
chcp 65001 > nul
set PYTHONUTF8=1
set PYTHONIOENCODING=utf-8
echo ========================================================
echo    O'ZBEKCHA AI SUBTITR - FASTAPI SERVER ISHGA TUSHMOQDA
echo ========================================================
echo.

cd /d "%~dp0.."

if exist "venv\Scripts\python.exe" (
    echo [OK] Virtual muhit (venv) faollashtirildi!
    echo Backend manzili: http://127.0.0.1:8765
    echo.
    "venv\Scripts\python.exe" -m uvicorn backend.main:app --host 127.0.0.1 --port 8765 --reload
) else if exist "%LOCALAPPDATA%\Programs\Python\Python311\python.exe" (
    echo [OK] Python 3.11 topildi!
    echo Backend manzili: http://127.0.0.1:8765
    echo.
    "%LOCALAPPDATA%\Programs\Python\Python311\python.exe" -m uvicorn backend.main:app --host 127.0.0.1 --port 8765 --reload
) else (
    echo [Eslatma] Asosiy tizim python ishlatilmoqda...
    python -m uvicorn backend.main:app --host 127.0.0.1 --port 8765 --reload
)

pause
