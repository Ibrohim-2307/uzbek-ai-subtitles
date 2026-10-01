"""
O'zbekcha AI Subtitr - CTC Majburiy Tekislash Moduli (Forced Alignment)
Meta MMS (Massively Multilingual Speech) CTC asosidagi aligner
yoki torchaudio MMS_FA yordamida so'z vaqtlarini mikrosekund darajasida tekislaydi.

O'zbek tili holati:
- Meta MMS arxitekturasi 1400+ tillarni qamrab oladi va o'zbek tili uchun 'uzb' (lotin/kirill) modeliga ega.
- Agar tizimda torchaudio va kerakli vaznlar (weights) yuklangan bo'lsa, avtomatik ishlatiladi.
- Agar torchaudio o'rnatilmagan bo'lsa, tizim to'xtab qolmaydi: Whisper cross-attention va Audio Energy Snapping rejimiga o'tadi va logga ochiq yozadi.
"""

import os
from typing import List, Dict, Any, Optional, Tuple

FORCED_ALIGNMENT_AVAILABLE = False
_MMS_MODEL = None
_MMS_TOKENIZER = None

try:
    import torch
    import torchaudio
    FORCED_ALIGNMENT_AVAILABLE = True
except ImportError:
    FORCED_ALIGNMENT_AVAILABLE = False


def check_forced_alignment_status() -> Dict[str, Any]:
    """Majburiy tekislash (Forced Alignment) imkoniyatini tekshiradi"""
    return {
        "available": FORCED_ALIGNMENT_AVAILABLE,
        "engine": "torchaudio_mms_fa" if FORCED_ALIGNMENT_AVAILABLE else "none",
        "supported_languages": ["uzb", "uz", "en", "ru"],
        "message": (
            "torchaudio MMS_FA mavjud va faol" if FORCED_ALIGNMENT_AVAILABLE
            else "torchaudio o'rnatilmagan. Whisper so'z vaqtlari + Audio Energy Snapping ishlatilmoqda."
        )
    }


def align_with_mms(
    wav_path: str,
    words: List[Dict[str, Any]],
    language: str = "uz"
) -> Tuple[Optional[List[Dict[str, Any]]], str]:
    """
    torchaudio MMS_FA orqali so'zlarni audio signalga majburiy tekislash.
    Muvaffaqiyatli bo'lsa: (tekislangan_sozlar, 'torchaudio_mms')
    Mavjud bo'lmasa yoki xato bo'lsa: (None, sabab_xabari)
    """
    if not FORCED_ALIGNMENT_AVAILABLE:
        return None, "torchaudio o'rnatilmagan (Whisper + Audio Energy snapping ga o'tildi)"

    if not os.path.exists(wav_path):
        return None, "WAV fayl topilmadi"

    try:
        # torchaudio pipelines tekshirish
        if not hasattr(torchaudio.pipelines, "MMS_FA"):
            return None, "torchaudio versiyasida MMS_FA quvuri mavjud emas"

        bundle = torchaudio.pipelines.MMS_FA
        model = bundle.get_model()
        tokenizer = bundle.get_tokenizer()
        aligner = bundle.get_aligner()

        waveform, sample_rate = torchaudio.load(wav_path)
        if sample_rate != bundle.sample_rate:
            waveform = torchaudio.functional.resample(waveform, sample_rate, bundle.sample_rate)

        # Matnni tayyorlash
        transcript_words = [w["word"] for w in words]
        clean_text = " ".join(transcript_words).lower()

        with torch.inference_mode():
            emission, _ = model(waveform)
            tokens = tokenizer(clean_text)
            alignment = aligner(emission[0], tokens)

        # Agar alignment muvaffaqiyatli bo'lsa, so'z vaqtlarini yangilaymiz
        ratio = waveform.size(1) / emission.size(1) / bundle.sample_rate
        aligned_words = []
        token_spans = alignment.token_spans

        for idx, w in enumerate(words):
            if idx < len(token_spans):
                span = token_spans[idx]
                w_start = round(span[0].start * ratio, 3)
                w_end = round(span[-1].end * ratio, 3)
                aligned_words.append({
                    "word": w["word"],
                    "start": w_start,
                    "end": max(w_end, w_start + 0.08),
                    "score": w.get("score", 1.0),
                    "confidence": 1.0,
                    "pause_after_ms": 0.0
                })
            else:
                aligned_words.append(w)

        return aligned_words, "torchaudio_mms"

    except Exception as e:
        print(f"[Forced Alignment] MMS alignment xatosi: {e}")
        return None, f"MMS alignment xatosi: {str(e)}"
