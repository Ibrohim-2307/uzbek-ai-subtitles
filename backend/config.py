"""
O'zbekcha AI Subtitr - Konfiguratsiya va sozlamalar moduli
Foydalanuvchi sozlamalari, API kalitlari va shaxsiy lug'atni xavfsiz boshqaradi.
"""

import os
import json
import base64
from pathlib import Path
from typing import Dict, Any, Optional
from pydantic import BaseModel, Field

# Sozlamalar saqlanadigan asosiy papka: ~/.uz_subtitles
CONFIG_DIR = Path.home() / ".uz_subtitles"
CONFIG_FILE = CONFIG_DIR / "config.json"
DICTIONARY_FILE = CONFIG_DIR / "custom_dictionary.json"

# Standart sozlamalar
DEFAULT_CONFIG: Dict[str, Any] = {
    "provider": "local_whisper",  # "local_whisper", "google", "azure", "custom"
    "model_size": "small",        # "tiny", "base", "small", "medium", "large-v3"
    "device": "auto",             # "auto", "cuda", "cpu"
    "compute_type": "auto",       # "auto", "float16", "int8"
    "language": "uz",
    "script": "latin",            # "latin" yoki "cyrillic"
    "convert_numbers": False,     # Raqamlarni so'z ko'rinishida yozish
    "max_line_length": 35,        # Subtitrdagi maksimal belgilar soni
    "max_lines": 2,               # Subtitrdagi qatorlar soni
    "highlight_karaoke": True,    # So'zlarni ajratib ko'rsatish
    "forced_alignment": True,     # CTC MMS Majburiy tekislash (agar mavjud bo'lsa)
    "audio_energy_snap": True,    # Ovoz energiyasi bo'yicha aniqlashtirish (snap)
    "pause_hide_text": False,     # Pauza bo'lganda matnni yashirish
    "pause_hide_threshold_ms": 800, # Necha ms pauzada matn yashiriladi
    "char_reveal": False,         # Uzun so'zlar uchun harf-harf/bo'g'in-bo'g'in ochilish
    "api_keys": {
        "gemini": "",
        "google_cloud": "",
        "azure_speech": "",
        "azure_region": "eastus",
        "custom_api_url": "",
        "custom_api_key": ""
    }
}

# Standart o'zbekcha tez-tez adashiladigan so'zlar lug'ati
DEFAULT_DICTIONARY: Dict[str, str] = {
    "xarakat": "harakat",
    "xam": "ham",
    "xar": "har",
    "xatto": "hatto",
    "xafa": "xafa",
    "xavo": "havo",
    "eshitildi": "eshitildi",
    "videoni": "videoni",
    "yutub": "YouTube",
    "telegramm": "Telegram",
    "instaram": "Instagram",
    "montaj": "montaj",
    "subtitr": "subtitr"
}


def _obfuscate(text: str) -> str:
    """Oddiy shifrlash (ochiq holda faylda ko'rinmasligi uchun)"""
    if not text:
        return ""
    return base64.b64encode(text.encode("utf-8")).decode("utf-8")


def _deobfuscate(encoded: str) -> str:
    """Shifrdan chiqarish"""
    if not encoded:
        return ""
    try:
        return base64.b64decode(encoded.encode("utf-8")).decode("utf-8")
    except Exception:
        return encoded


class AppConfig(BaseModel):
    provider: str = Field(default="local_whisper")
    model_size: str = Field(default="small")
    device: str = Field(default="auto")
    compute_type: str = Field(default="auto")
    language: str = Field(default="uz")
    script: str = Field(default="latin")
    convert_numbers: bool = Field(default=False)
    max_line_length: int = Field(default=35)
    max_lines: int = Field(default=2)
    highlight_karaoke: bool = Field(default=True)
    forced_alignment: bool = Field(default=True)
    audio_energy_snap: bool = Field(default=True)
    pause_hide_text: bool = Field(default=False)
    pause_hide_threshold_ms: int = Field(default=800)
    char_reveal: bool = Field(default=False)
    api_keys: Dict[str, str] = Field(default_factory=dict)


class ConfigManager:
    def __init__(self):
        CONFIG_DIR.mkdir(parents=True, exist_ok=True)
        self.config = self.load_config()
        self.dictionary = self.load_dictionary()

    def load_config(self) -> Dict[str, Any]:
        """Sozlamalarni diskdan o'qiydi yoki standartini yaratadi"""
        if not CONFIG_FILE.exists():
            self.save_config(DEFAULT_CONFIG)
            return DEFAULT_CONFIG.copy()

        try:
            with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
            # Kalitlarni deshifrlash
            if "api_keys" in data:
                for k, v in data["api_keys"].items():
                    if k.endswith("_key") or k in ("gemini", "google_cloud", "azure_speech"):
                        data["api_keys"][k] = _deobfuscate(v)
            # Standart kalitlar bilan birlashtirish
            merged = DEFAULT_CONFIG.copy()
            merged.update(data)
            return merged
        except Exception as e:
            print(f"[Xatolik] Sozlamalarni o'qishda xatolik: {e}")
            return DEFAULT_CONFIG.copy()

    def save_config(self, new_config: Dict[str, Any]) -> bool:
        """Sozlamalarni diskka xavfsiz saqlaydi"""
        try:
            to_save = new_config.copy()
            if "api_keys" in to_save:
                obfuscated_keys = {}
                for k, v in to_save["api_keys"].items():
                    if k.endswith("_key") or k in ("gemini", "google_cloud", "azure_speech"):
                        obfuscated_keys[k] = _obfuscate(v)
                    else:
                        obfuscated_keys[k] = v
                to_save["api_keys"] = obfuscated_keys

            with open(CONFIG_FILE, "w", encoding="utf-8") as f:
                json.dump(to_save, f, ensure_ascii=False, indent=2)
            self.config = new_config
            return True
        except Exception as e:
            print(f"[Xatolik] Sozlamalarni saqlashda xatolik: {e}")
            return False

    def load_dictionary(self) -> Dict[str, str]:
        """Shaxsiy o'zbekcha lug'atni o'qiydi"""
        if not DICTIONARY_FILE.exists():
            self.save_dictionary(DEFAULT_DICTIONARY)
            return DEFAULT_DICTIONARY.copy()
        try:
            with open(DICTIONARY_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return DEFAULT_DICTIONARY.copy()

    def save_dictionary(self, dictionary: Dict[str, str]) -> bool:
        """Shaxsiy lug'atni diskka saqlaydi"""
        try:
            with open(DICTIONARY_FILE, "w", encoding="utf-8") as f:
                json.dump(dictionary, f, ensure_ascii=False, indent=2)
            self.dictionary = dictionary
            return True
        except Exception as e:
            print(f"[Xatolik] Lug'atni saqlashda xatolik: {e}")
            return False


config_manager = ConfigManager()
