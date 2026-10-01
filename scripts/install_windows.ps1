# ========================================================
#   O'ZBEKCHA AI SUBTITR - POWERSHELL O'RNATUVCHI (WINDOWS)
# ========================================================

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "   O'ZBEKCHA AI SUBTITR - ADOBE O'RNATUVCHI (WINDOWS)   " -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Adobe CEP PlayerDebugMode yoqish
Write-Host "[1/3] Adobe CEP debug rejimini faollashtirish..." -ForegroundColor Yellow
$csxsVersions = 9..14
foreach ($v in $csxsVersions) {
    $regPath = "HKCU:\Software\Adobe\CSXS.$v"
    if (!(Test-Path $regPath)) {
        New-Item -Path $regPath -Force | Out-Null
    }
    Set-ItemProperty -Path $regPath -Name "PlayerDebugMode" -Value "1" -Force
}
Write-Host "[OK] PlayerDebugMode yoqildi!" -ForegroundColor Green

# 2. Extensions papkasiga havola yaratish
Write-Host "`n[2/3] Plaginni Adobe CEP papkasiga ulash..." -ForegroundColor Yellow
$cepDir = "$env:APPDATA\Adobe\CEP\extensions"
$targetDir = "$cepDir\com.uzbek.subtitles"
$sourceDir = (Get-Item "$PSScriptRoot\..").FullName

if (!(Test-Path $cepDir)) {
    New-Item -ItemType Directory -Path $cepDir -Force | Out-Null
}

if (Test-Path $targetDir) {
    Write-Host "Eski papka tozalanmoqda..." -ForegroundColor Gray
    Remove-Item -Path $targetDir -Recurse -Force | Out-Null
}

New-Item -ItemType Junction -Path $targetDir -Target $sourceDir | Out-Null
Write-Host "[OK] Plagin muvaffaqiyatli bog'landi: $targetDir" -ForegroundColor Green

# 3. Python backend tekshirish
Write-Host "`n[3/3] Python backend tekshirilmoqda..." -ForegroundColor Yellow
Set-Location $sourceDir

$python = Get-Command python -ErrorAction SilentlyContinue
if ($null -eq $python) {
    Write-Host "[OGOHLANTIRISH] Tizimda Python topilmadi! Iltimos, Python 3.10+ o'rnating." -ForegroundColor Red
} else {
    if (!(Test-Path "venv")) {
        Write-Host "Virtual muhit (venv) yaratilmoqda..." -ForegroundColor Gray
        python -m venv venv
    }
    Write-Host "Paketlar o'rnatilmoqda..." -ForegroundColor Gray
    & ".\venv\Scripts\python.exe" -m pip install --upgrade pip | Out-Null
    & ".\venv\Scripts\pip.exe" install -r backend\requirements.txt
    Write-Host "[OK] Python backend tayyor!" -ForegroundColor Green
}

Write-Host "`n========================================================" -ForegroundColor Cyan
Write-Host "  O'RNATISH YAKUNLANDI!                                " -ForegroundColor Green
Write-Host "  1. .\scripts\start_backend.bat ni ishga tushiring     " -ForegroundColor White
Write-Host "  2. AE / Premiere Pro: Window -> Extensions           " -ForegroundColor White
Write-Host "========================================================" -ForegroundColor Cyan
