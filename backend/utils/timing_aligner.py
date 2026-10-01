"""
O'zbekcha AI Subtitr - Audiodan So'z Vaqtlarini O'lchash va Tekislash Moduli (Timing Aligner)
Lokal Faster-Whisper yoki akustik o'lchovlar orqali provayder (masalan Gemini)
matnini saqlagan holda so'z vaqtlarini audiodan aniq o'lchaydi va moslashtiradi.
"""

import os
import re
import math
from typing import List, Dict, Any, Optional, Tuple
import numpy as np

try:
    from faster_whisper import WhisperModel
    FASTER_WHISPER_AVAILABLE = True
except ImportError:
    FASTER_WHISPER_AVAILABLE = False

try:
    from scipy.io import wavfile
    SCIPY_AVAILABLE = True
except ImportError:
    SCIPY_AVAILABLE = False

_CACHED_WHISPER_MODEL = None
_CACHED_MODEL_SIZE = None


def read_wav_mono16k(wav_path: str) -> Tuple[int, np.ndarray]:
    """
    16kHz mono WAV faylni PyAV/ffmpeg'siz sof Python/scipy/wave orqali o'qiydi.
    Agar fayl non-RIFF yoki video konteyner bo'lsa, vaqtincha 16k WAV ga o'tkazib o'qiydi.
    Qaytaradi: (sample_rate, np.ndarray[float32])
    """
    if not os.path.exists(wav_path):
        raise FileNotFoundError(f"WAV fayl topilmadi: {wav_path}")

    def _parse_wav(target_path: str) -> Tuple[int, np.ndarray]:
        if SCIPY_AVAILABLE:
            sr, data = wavfile.read(target_path)
            if len(data.shape) > 1:
                data = data.mean(axis=1)
            if data.dtype == np.int16:
                data = data.astype(np.float32) / 32768.0
            elif data.dtype == np.int32:
                data = data.astype(np.float32) / 2147483648.0
            elif data.dtype == np.uint8:
                data = (data.astype(np.float32) - 128.0) / 128.0
            else:
                data = data.astype(np.float32)
            return sr, data

        import wave
        with wave.open(target_path, "rb") as wf:
            sr = wf.getframerate()
            n_channels = wf.getnchannels()
            n_frames = wf.getnframes()
            raw_bytes = wf.readframes(n_frames)
            data = np.frombuffer(raw_bytes, dtype=np.int16).astype(np.float32) / 32768.0
            if n_channels > 1:
                data = data.reshape(-1, n_channels).mean(axis=1)
            return sr, data

    try:
        return _parse_wav(wav_path)
    except Exception:
        # Fayl non-RIFF (masalan MP4/MP3) yoki noto'g'ri sarlavhali bo'lsa, FFmpeg orqali vaqtincha 16k WAV ga o'tkazamiz
        import tempfile
        from .audio import convert_to_16k_mono_wav
        tmp_w = tempfile.NamedTemporaryFile(delete=False, suffix=".wav")
        try:
            tmp_w.close()
            convert_to_16k_mono_wav(wav_path, tmp_w.name)
            return _parse_wav(tmp_w.name)
        finally:
            if os.path.exists(tmp_w.name):
                try:
                    os.remove(tmp_w.name)
                except Exception:
                    pass


CYR_TO_LAT = {
    'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo',
    'ж': 'j', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
    'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
    'ф': 'f', 'х': 'h', 'ҳ': 'h', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'ъ': '',
    'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya', 'ў': 'o', 'ғ': 'g', 'қ': 'k'
}


def normalize_phonetic(word: str) -> str:
    """
    Fonetik solishtirish uchun o'zbekcha so'zni normallashtiradi.
    Masalan: 'Khazurgir' -> 'hazirgi', 'oʻzbek' -> 'ozbek', 'ўзбек' -> 'ozbek'
    """
    if not word:
        return ""
    w = str(word).lower().strip()
    # Apostroflar va tutashuvlar
    w = w.replace("oʻ", "o").replace("o‘", "o").replace("gʻ", "g").replace("g‘", "g")
    w = w.replace("`", "'").replace("ʻ", "'").replace("’", "'").replace("'", "")
    # Kirillchadan lotinchaga
    for c, l in CYR_TO_LAT.items():
        w = w.replace(c, l)
    # Tinish belgilarini olib tashlash
    w = re.sub(r"[^\w\s]", "", w)
    w = w.replace("kh", "h").replace("x", "h").replace("q", "k")
    # Takroriy unlilarni qisqartirish (masalan: aa -> a)
    w = re.sub(r"(.)\1+", r"\1", w)
    return w


def levenshtein_distance(s1: str, s2: str) -> int:
    """Ikki satr orasidagi Levenshtein masofasini hisoblaydi"""
    if s1 == s2:
        return 0
    if len(s1) == 0:
        return len(s2)
    if len(s2) == 0:
        return len(s1)

    v0 = list(range(len(s2) + 1))
    v1 = [0] * (len(s2) + 1)

    for i in range(len(s1)):
        v1[0] = i + 1
        for j in range(len(s2)):
            cost = 0 if s1[i] == s2[j] else 1
            v1[j + 1] = min(v1[j] + 1, v0[j + 1] + 1, v0[j] + cost)
        v0 = v1[:]

    return v0[len(s2)]


def phonetic_similarity(w1: str, w2: str) -> float:
    """
    Ikki so'zning fonetik o'xshashligini hisoblaydi (0.0 dan 1.0 gacha).
    Whisper 'Khazurgir' deb yozsa ham 'hozirgi' bilan >= 0.68 o'xshashlik beradi.
    """
    if not w1 or not w2:
        return 0.0

    c1 = re.sub(r"[^\w]", "", str(w1).lower())
    c2 = re.sub(r"[^\w]", "", str(w2).lower())
    if c1 == c2:
        return 1.0

    p1 = normalize_phonetic(w1)
    p2 = normalize_phonetic(w2)
    if p1 == p2:
        return 1.0

    # Tovushlar uyg'unligi (vowel harmonization: a/o, u/i)
    h1 = p1.replace("o", "a").replace("u", "i")
    h2 = p2.replace("o", "a").replace("u", "i")

    max_len = max(len(h1), len(h2))
    if max_len == 0:
        return 1.0

    dist = levenshtein_distance(h1, h2)
    sim = max(0.0, 1.0 - (dist / float(max_len)))

    # Prefix mosligi uchun kichik bonus (masalan boshlanishi mos)
    if h1 and h2 and (h1.startswith(h2[:3]) or h2.startswith(h1[:3])):
        sim = min(1.0, sim + 0.08)

    return round(sim, 3)


def get_cached_whisper_model(model_size: str = "tiny") -> Optional[Any]:
    """Faster-whisper modelini keshlaydi (Nvidia GPU/CUDA mavjud bo'lsa float16, aks holda CPU int8)"""
    global _CACHED_WHISPER_MODEL, _CACHED_MODEL_SIZE
    if not FASTER_WHISPER_AVAILABLE:
        return None

    if _CACHED_WHISPER_MODEL is None or _CACHED_MODEL_SIZE != model_size:
        try:
            device = "cpu"
            compute_type = "int8"
            try:
                import ctranslate2
                if ctranslate2.get_cuda_device_count() > 0:
                    device = "cuda"
                    compute_type = "float16"
            except Exception:
                pass

            try:
                _CACHED_WHISPER_MODEL = WhisperModel(
                    model_size,
                    device=device,
                    compute_type=compute_type
                )
            except Exception:
                # Agar CUDA drayver xatosi bersa, CPU ga fallback
                _CACHED_WHISPER_MODEL = WhisperModel(
                    model_size,
                    device="cpu",
                    compute_type="int8"
                )
            _CACHED_MODEL_SIZE = model_size
        except Exception as e:
            print(f"[Timing Aligner] WhisperModel yuklashda xatolik: {e}")
            return None

    return _CACHED_WHISPER_MODEL


def transcribe_words_local(
    wav_path: str,
    model_size: str = "tiny",
    language: str = "uz"
) -> List[Dict[str, Any]]:
    """
    Audiodan lokal faster-whisper orqali so'z vaqtlarini o'lchaydi.
    Qaytaradi: [{'word': str, 'start': float, 'end': float, 'confidence': float}, ...]
    """
    if not FASTER_WHISPER_AVAILABLE:
        raise RuntimeError("faster-whisper o'rnatilmagan")

    if not os.path.exists(wav_path):
        raise FileNotFoundError(f"WAV fayl topilmadi: {wav_path}")

    model = get_cached_whisper_model(model_size=model_size)
    if model is None:
        return []

    segments_generator, info = model.transcribe(
        wav_path,
        language=language if language != "auto" else None,
        task="transcribe",
        word_timestamps=True,
        condition_on_previous_text=False,
        vad_filter=True,
        vad_parameters=dict(min_silence_duration_ms=200, speech_pad_ms=80),
        beam_size=1,
        temperature=0.0
    )

    measured_words = []
    for seg in segments_generator:
        if hasattr(seg, "words") and seg.words:
            for w in seg.words:
                clean_w = w.word.strip()
                if clean_w:
                    measured_words.append({
                        "word": clean_w,
                        "start": round(float(w.start), 3),
                        "end": round(float(w.end), 3),
                        "confidence": round(float(getattr(w, "probability", 1.0)), 3)
                    })

    return measured_words


def align_words_to_timed_words(
    provider_words: List[Any],
    timed_words: List[Any],
    min_similarity: float = 0.55
) -> List[Dict[str, Any]]:
    """
    Provayder MATNINI saqlagan holda, so'z vaqtlarini audiodan o'lchangan
    so'z vaqtlariga dinamik dasturlash (Needleman-Wunsch / DP) orqali tekislaydi.
    Provayder matni va tartibi 100% o'zgarmaydi!
    """
    if not provider_words:
        return []

    # Standartlashtirish
    p_items = []
    for w in provider_words:
        if isinstance(w, dict):
            p_items.append(dict(w))
        else:
            p_items.append({
                "word": getattr(w, "word", str(w)),
                "start": float(getattr(w, "start", 0.0)),
                "end": float(getattr(w, "end", 0.1)),
                "confidence": float(getattr(w, "confidence", 1.0))
            })

    if not timed_words:
        return p_items

    t_items = []
    for w in timed_words:
        if isinstance(w, dict):
            t_items.append(dict(w))
        else:
            t_items.append({
                "word": getattr(w, "word", str(w)),
                "start": float(getattr(w, "start", 0.0)),
                "end": float(getattr(w, "end", 0.1)),
                "confidence": float(getattr(w, "confidence", 1.0))
            })

    N = len(p_items)
    M = len(t_items)

    # DP jadvali: dp[i][j] - provider[0..i-1] va timed[0..j-1] eng yaxshi moslik balli
    # Ball: phonetic_similarity(p, t) agar >= min_similarity, aks holda jarima
    dp = np.zeros((N + 1, M + 1), dtype=np.float32)
    trace = np.zeros((N + 1, M + 1), dtype=np.int8)  # 0: diag, 1: up (gap in t), 2: left (gap in p)

    GAP_PENALTY = -0.3

    for i in range(1, N + 1):
        dp[i][0] = i * GAP_PENALTY
        trace[i][0] = 1
    for j in range(1, M + 1):
        dp[0][j] = j * GAP_PENALTY
        trace[0][j] = 2

    for i in range(1, N + 1):
        pw = p_items[i - 1]["word"]
        for j in range(1, M + 1):
            tw = t_items[j - 1]["word"]
            sim = phonetic_similarity(pw, tw)
            match_score = sim if sim >= min_similarity else -0.5

            score_diag = dp[i - 1][j - 1] + match_score
            score_up = dp[i - 1][j] + GAP_PENALTY
            score_left = dp[i][j - 1] + GAP_PENALTY

            best = max(score_diag, score_up, score_left)
            dp[i][j] = best

            if best == score_diag:
                trace[i][j] = 0
            elif best == score_up:
                trace[i][j] = 1
            else:
                trace[i][j] = 2

    # Traceback orqali mosliklarni topish
    curr_i = N
    curr_j = M
    matched_pairs: Dict[int, int] = {}  # p_idx -> t_idx

    while curr_i > 0 and curr_j > 0:
        dir_code = trace[curr_i][curr_j]
        if dir_code == 0:
            pw = p_items[curr_i - 1]["word"]
            tw = t_items[curr_j - 1]["word"]
            if phonetic_similarity(pw, tw) >= min_similarity:
                matched_pairs[curr_i - 1] = curr_j - 1
            curr_i -= 1
            curr_j -= 1
        elif dir_code == 1:
            curr_i -= 1
        else:
            curr_j -= 1

    # Natija massivini qurish va mos kelmagan so'zlarni interpolyatsiya qilish
    result = []
    for i in range(N):
        orig_w = p_items[i]
        item = {
            "word": orig_w["word"],
            "start": orig_w["start"],
            "end": orig_w["end"],
            "confidence": orig_w.get("confidence", 1.0),
            "pause_after_ms": orig_w.get("pause_after_ms", 0.0),
            "measured": False
        }

        if i in matched_pairs:
            t_match = t_items[matched_pairs[i]]
            item["start"] = t_match["start"]
            item["end"] = t_match["end"]
            item["confidence"] = max(item["confidence"], t_match.get("confidence", 0.9))
            item["measured"] = True

        result.append(item)

    # Mos kelmagan so'zlarni interpolyatsiya orqali to'g'rilash
    for i in range(N):
        if not result[i]["measured"]:
            # Oldingi va keyingi mos kelgan so'zlarni topamiz
            prev_m = None
            next_m = None
            for p in range(i - 1, -1, -1):
                if result[p]["measured"]:
                    prev_m = p
                    break
            for nx in range(i + 1, N):
                if result[nx]["measured"]:
                    next_m = nx
                    break

            if prev_m is not None and next_m is not None:
                # Ikkita ma'lum nuqta o'rtasida proporsional taqsimlash
                span_start = result[prev_m]["end"]
                span_end = result[next_m]["start"]
                num_unmatched = next_m - prev_m - 1
                unmatched_idx = i - prev_m - 1
                if span_end > span_start and num_unmatched > 0:
                    step = (span_end - span_start) / float(num_unmatched + 1)
                    calc_s = round(span_start + unmatched_idx * step, 3)
                    calc_e = round(calc_s + step * 0.8, 3)
                    result[i]["start"] = calc_s
                    result[i]["end"] = max(calc_e, calc_s + 0.08)
            elif prev_m is not None:
                # Faqat oldingi nuqta bor
                orig_dur = max(0.08, result[i]["end"] - result[i]["start"])
                calc_s = round(result[prev_m]["end"] + 0.04, 3)
                result[i]["start"] = calc_s
                result[i]["end"] = round(calc_s + orig_dur, 3)
            elif next_m is not None:
                # Faqat keyingi nuqta bor
                orig_dur = max(0.08, result[i]["end"] - result[i]["start"])
                calc_e = round(result[next_m]["start"] - 0.04, 3)
                calc_s = max(0.0, round(calc_e - orig_dur, 3))
                result[i]["start"] = calc_s
                result[i]["end"] = round(calc_s + orig_dur, 3)

    # Qat'iy monotonlik va minimal davomiylikni tekshirish hamda kanonik metama'lumotlarni o'rnatish
    for i in range(N):
        orig_s = float(p_items[i]["start"])
        orig_e = float(p_items[i]["end"])
        if result[i]["end"] - result[i]["start"] < 0.08:
            result[i]["end"] = round(result[i]["start"] + 0.08, 3)
        if i > 0 and result[i]["start"] < result[i - 1]["start"]:
            result[i]["start"] = result[i - 1]["start"]
            if result[i]["end"] - result[i]["start"] < 0.08:
                result[i]["end"] = round(result[i]["start"] + 0.08, 3)

        result[i]["raw_start"] = orig_s
        result[i]["raw_end"] = orig_e
        result[i]["original_start"] = orig_s
        result[i]["aligned_start"] = result[i]["start"]
        result[i]["snap_shift_ms"] = round(abs(result[i]["start"] - orig_s) * 1000.0, 1)
        if result[i].get("measured"):
            result[i]["timing_source"] = "whisper_measured"
            result[i]["timing_confidence"] = float(result[i].get("confidence", 0.9))
        else:
            result[i]["timing_source"] = "interpolated"
            result[i]["timing_confidence"] = 0.5

    return result


def measure_and_align_words(
    wav_path: str,
    provider_words: List[Any],
    model_size: str = "tiny",
    language: str = "uz"
) -> Tuple[List[Dict[str, Any]], Dict[str, Any], bool]:
    """
    Provayder so'zlarini audiodan o'lchash va tekislash bosh boshqaruvchisi.
    Qaytaradi: (aligned_words, stats, success)
    """
    if not provider_words:
        return [], {"engine": "none", "matched_count": 0, "total": 0}, False

    if not os.path.exists(wav_path) or not FASTER_WHISPER_AVAILABLE:
        p_list = [w if isinstance(w, dict) else dict(w) for w in provider_words]
        return p_list, {"engine": "provider_estimate", "matched_count": 0, "total": len(provider_words)}, False

    try:
        timed_words = transcribe_words_local(wav_path, model_size=model_size, language=language)
        if not timed_words:
            p_list = [w if isinstance(w, dict) else dict(w) for w in provider_words]
            return p_list, {"engine": "whisper_empty", "matched_count": 0, "total": len(provider_words)}, False

        aligned = align_words_to_timed_words(provider_words, timed_words)
        matched_cnt = sum(1 for w in aligned if w.get("measured"))

        stats = {
            "engine": "local_whisper_measured",
            "matched_count": matched_cnt,
            "total": len(provider_words),
            "match_ratio": round(matched_cnt / max(1, len(provider_words)), 2)
        }
        return aligned, stats, True
    except Exception as e:
        print(f"[Timing Aligner] O'lchashda xatolik: {e}")
        p_list = [w if isinstance(w, dict) else dict(w) for w in provider_words]
        return p_list, {"engine": "error_fallback", "error": str(e)}, False


def check_timing_engine_status() -> Dict[str, Any]:
    """Tizimda mavjud vaqt o'lchash dvigatellarini tekshiradi"""
    mms_status = False
    try:
        import torchaudio
        mms_status = hasattr(torchaudio.pipelines, "MMS_FA")
    except Exception:
        mms_status = False

    return {
        "faster_whisper_available": FASTER_WHISPER_AVAILABLE,
        "mms_fa_available": mms_status,
        "recommended_engine": "mms_fa" if mms_status else ("faster_whisper" if FASTER_WHISPER_AVAILABLE else "provider_estimate"),
        "timing_accuracy": "high (audio measured)" if (FASTER_WHISPER_AVAILABLE or mms_status) else "estimate"
    }
