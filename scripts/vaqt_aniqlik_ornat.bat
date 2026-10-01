@echo off
chcp 65001 >nul
echo ======================================================================
echo    SO'Z VAQTI ANIQLIGINI O'RNATISH (faster-whisper)
echo ======================================================================

set PYTHON_CMD=python
if exist .\venv\Scripts\python.exe (
    set PYTHON_CMD=.\venv\Scripts\python.exe
)

echo.
echo [1/2] faster-whisper kutubxonasi o'rnatilmoqda...
%PYTHON_CMD% -m pip install faster-whisper

echo.
echo [2/2] O'rnatish tekshirilmoqda...
%PYTHON_CMD% -c "import faster_whisper; print('✅ faster-whisper muvaffaqiyatli o\'rnatildi (versiya:', faster_whisper.__version__, ')')"
if errorlevel 1 (
    echo ❌ Xatolik yuz berdi.
    exit /b 1
)

echo.
echo ======================================================================
echo    O'RNATISH YAKUNLANDI! Audiodan so'z vaqti o'lchovi faollashtirildi.
echo ======================================================================
