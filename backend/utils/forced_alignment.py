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


def _norm_for_mms(text: str) -> str:
    """MMS lug'ati uchun o'zbekcha matnni normallashtirish"""
    if not text:
        return ""
    t = text.lower()
    # O'zbek apostroflarini standartlashtirish
    t = t.replace("oʻ", "o'").replace("o‘", "o'").replace("gʻ", "g'").replace("g‘", "g'")
    t = t.replace("`", "'").replace("ʻ", "'").replace("’", "'").replace("'", "")
    # Harflar va bo'shliqlardan boshqa belgilarni olib tashlash
    import re
    t = re.sub(r"[^a-z\s]", "", t)
    return " ".join(t.split())


def _get_mms_pipeline():
    """MMS model va tokenizer'ni keshdan olish yoki yuklash"""
    global _MMS_BUNDLE, _MMS_MODEL, _MMS_TOKENIZER, _MMS_ALIGNER
    if _MMS_MODEL is None and FORCED_ALIGNMENT_AVAILABLE:
        if hasattr(torchaudio.pipelines, "MMS_FA"):
            _MMS_BUNDLE = torchaudio.pipelines.MMS_FA
            _MMS_MODEL = _MMS_BUNDLE.get_model()
            _MMS_TOKENIZER = _MMS_BUNDLE.get_tokenizer()
            _MMS_ALIGNER = _MMS_BUNDLE.get_aligner()
    return _MMS_BUNDLE, _MMS_MODEL, _MMS_TOKENIZER, _MMS_ALIGNER


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

    if not words:
        return [], "Bo'sh so'zlar ro'yxati"

    try:
        bundle, model, tokenizer, aligner = _get_mms_pipeline()
        if bundle is None or model is None:
            return None, "torchaudio versiyasida MMS_FA quvuri mavjud emas"

        waveform, sample_rate = torchaudio.load(wav_path)
        if sample_rate != bundle.sample_rate:
            waveform = torchaudio.functional.resample(waveform, sample_rate, bundle.sample_rate)

        # Har bir so'zni normallashtirish va token sonini hisoblash
        norm_words = []
        word_token_counts = []
        for w in words:
            nw = _norm_for_mms(w.get("word", "") if isinstance(w, dict) else str(w))
            norm_words.append(nw)
            toks = tokenizer(nw) if nw else []
            word_token_counts.append(len(toks))

        clean_text = " ".join([nw for nw in norm_words if nw]).strip()
        if not clean_text:
            return None, "Normallashtirilgan matn bo'sh"

        with torch.inference_mode():
            emission, _ = model(waveform)
            tokens = tokenizer(clean_text)
            alignment = aligner(emission[0], tokens)

        token_spans = alignment.token_spans if hasattr(alignment, "token_spans") else []
        if not token_spans:
            return None, "Token spanlar topilmadi"

        ratio = waveform.size(1) / emission.size(1) / bundle.sample_rate
        aligned_words = []
        cursor = 0

        for idx, w in enumerate(words):
            n_tok = word_token_counts[idx]
            orig_word = w.get("word", "") if isinstance(w, dict) else str(w)
            orig_start = float(w.get("start", 0.0) if isinstance(w, dict) else 0.0)
            orig_end = float(w.get("end", orig_start + 0.3) if isinstance(w, dict) else orig_start + 0.3)

            if n_tok > 0 and (cursor + n_tok) <= len(token_spans):
                spans = token_spans[cursor : cursor + n_tok]
                cursor += n_tok
                w_start = round(spans[0][0].start * ratio, 3)
                w_end = round(spans[-1][-1].end * ratio, 3)
                aligned_words.append({
                    "word": orig_word,
                    "start": w_start,
                    "end": max(w_end, round(w_start + 0.08, 3)),
                    "score": w.get("score", 1.0) if isinstance(w, dict) else 1.0,
                    "confidence": 1.0,
                    "pause_after_ms": 0.0
                })
            else:
                cursor += max(0, n_tok)
                aligned_words.append({
                    "word": orig_word,
                    "start": orig_start,
                    "end": orig_end,
                    "score": w.get("score", 1.0) if isinstance(w, dict) else 1.0,
                    "confidence": 0.5,
                    "pause_after_ms": 0.0
                })

        return aligned_words, "torchaudio_mms"

    except Exception as e:
        print(f"[Forced Alignment] MMS alignment xatosi: {e}")
        return None, f"MMS alignment xatosi: {str(e)}"
