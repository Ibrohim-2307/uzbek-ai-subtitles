#!/usr/bin/env bash
# ========================================================
#   O'ZBEKCHA AI SUBTITR - ADOBE O'RNATUVCHI (macOS)
# ========================================================

set -e

echo "========================================================"
echo "   O'ZBEKCHA AI SUBTITR - ADOBE O'RNATUVCHI (macOS)     "
echo "========================================================"
echo ""

# 1. Adobe CEP PlayerDebugMode ni yoqish
echo "[1/3] Adobe CEP debug rejimini yoqish..."
for v in {9..14}; do
    defaults write com.adobe.CSXS.$v PlayerDebugMode 1 2>/dev/null || true
done
echo "[OK] PlayerDebugMode yoqildi!"

# 2. Extensions papkasiga symlink qilish
echo ""
echo "[2/3] Plaginni Adobe CEP papkasiga ulash..."
CEP_DIR="$HOME/Library/Application Support/Adobe/CEP/extensions"
TARGET_DIR="$CEP_DIR/com.uzbek.subtitles"
SOURCE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

mkdir -p "$CEP_DIR"

if [ -L "$TARGET_DIR" ] || [ -d "$TARGET_DIR" ]; then
    rm -rf "$TARGET_DIR"
fi

ln -s "$SOURCE_DIR" "$TARGET_DIR"
echo "[OK] Havola yaratildi: $TARGET_DIR"

# 3. Python backend sozlash
echo ""
echo "[3/3] Python backend muhitini sozlash..."
cd "$SOURCE_DIR"

if ! command -v python3 &> /dev/null; then
    echo "[OGOHLANTIRISH] Tizimda python3 topilmadi! Iltimos, brew install python3 ni bajaring."
else
    if [ ! -d "venv" ]; then
        python3 -m venv venv
    fi
    source venv/bin/activate
    pip install --upgrade pip
    pip install -r backend/requirements.txt
    echo "[OK] Python backend tayyor!"
fi

echo ""
echo "========================================================"
echo "   O'RNATISH YAKUNLANDI!"
echo "   1. ./scripts/start_backend.sh ni ishga tushiring"
echo "   2. AE / Premiere Pro: Window -> Extensions bo'limini oching"
echo "========================================================"
