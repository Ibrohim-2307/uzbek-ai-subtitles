@echo off
chcp 65001 > nul
echo ========================================================
echo    O'ZBEKCHA AI SUBTITR - ADOBE O'RNATUVCHI (WINDOWS)
echo ========================================================
echo.

:: 1. Adobe CEP PlayerDebugMode ni yoqish (barcha CSXS versiyalari uchun)
echo [1/3] Adobe CEP debug rejimini yoqish...
reg add "HKCU\Software\Adobe\CSXS.9" /v PlayerDebugMode /t REG_SZ /d 1 /f >nul 2>&1
reg add "HKCU\Software\Adobe\CSXS.10" /v PlayerDebugMode /t REG_SZ /d 1 /f >nul 2>&1
reg add "HKCU\Software\Adobe\CSXS.11" /v PlayerDebugMode /t REG_SZ /d 1 /f >nul 2>&1
reg add "HKCU\Software\Adobe\CSXS.12" /v PlayerDebugMode /t REG_SZ /d 1 /f >nul 2>&1
reg add "HKCU\Software\Adobe\CSXS.13" /v PlayerDebugMode /t REG_SZ /d 1 /f >nul 2>&1
reg add "HKCU\Software\Adobe\CSXS.14" /v PlayerDebugMode /t REG_SZ /d 1 /f >nul 2>&1
echo [OK] Adobe CEP Debug rejimi faollashtirildi!

:: 2. CEP extensions papkasiga bog'lash (Junction yoki Copy)
echo.
echo [2/3] Plaginni Adobe CEP papkasiga ulash...
set "TARGET_DIR=%APPDATA%\Adobe\CEP\extensions\com.uzbek.subtitles"
set "SOURCE_DIR=%~dp0.."

if not exist "%APPDATA%\Adobe\CEP\extensions" (
    mkdir "%APPDATA%\Adobe\CEP\extensions"
)

if exist "%TARGET_DIR%" (
    echo Eski versiya tozalanmoqda...
    rmdir /S /Q "%TARGET_DIR%" >nul 2>&1
)

:: Papkalar bog'lanishi (Junction orqali kod o'zgarsa plagin avtomatik yangilanadi)
mklink /J "%TARGET_DIR%" "%SOURCE_DIR%"
if errorlevel 1 (
    echo [Eslatma] Havola yaratib bo'lmadi, fayllar to'g'ridan-to'g'ri nusxalanmoqda...
    xcopy /E /I /Y "%SOURCE_DIR%" "%TARGET_DIR%"
)
echo [OK] Plagin Adobe tizimiga muvaffaqiyatli ulandi!

:: 3. Python va kutubxonalarni sozlash
echo.
echo [3/3] Python backend muhitini tekshirish...
cd /d "%SOURCE_DIR%"

where python >nul 2>&1
if errorlevel 1 (
    echo [OGOHLANTIRISH] Tizimda Python topilmadi!
    echo Iltimos, python.org saytidan Python 3.10+ yuklab oling va PATH ga qo'shing.
    goto :FINISH
)

if not exist "venv" (
    echo Virtual muhit (venv) yaratilmoqda...
    python -m venv venv
)

echo Paketlar o'rnatilmoqda (bu bir necha daqiqa olishi mumkin)...
call venv\Scripts\activate
python -m pip install --upgrade pip
pip install -r backend\requirements.txt

echo.
echo ========================================================
echo    TABRIKLAYMIZ! O'RNATISH MUVAFFAQIYATLI YAKUNLANDI!
echo ========================================================
echo.
echo Plaginni ishlatish uchun:
echo 1. scripts\start_backend.bat ni ishga tushiring.
echo 2. Adobe After Effects yoki Premiere Pro dasturini oching.
echo 3. Yuqori menyudan: Window - Extensions - O'zbekcha AI Subtitr ni bosing!
echo.

:FINISH
pause
