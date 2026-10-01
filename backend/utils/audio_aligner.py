"""
O'zbekcha AI Subtitr - Ovoz Energiyasi va Pauzalarni Aniqlashtirish Moduli (Audio Energy Aligner)
Har bir so'zning boshlanishini eng yaqin ovoz ko'tarilishiga (onset),
tugashini esa ovoz pasayishiga tortadi (snapping),
hamda sukut/pauza oraliqlarida so'zlar cho'zilib ketishining oldini oladi.
"""

import os
import math
import numpy as np
from typing import List, Tuple, Dict, Any, Optional

try:
    from scipy.io import wavfile
    SCIPY_AVAILABLE = True
except ImportError:
    SCIPY_AVAILABLE = False


def _read_wav_data(wav_path: str) -> Tuple[int, np.ndarray]:
    """16kHz mono WAV fayldan audio signal massivini o'qiydi"""
    if SCIPY_AVAILABLE:
        sr, data = wavfile.read(wav_path)
        # Agar stereo bo'lsa, monoga o'tkazamiz
        if len(data.shape) > 1:
            data = data.mean(axis=1)
        # Float massivga (-1.0 ... 1.0 oralig'iga) keltirish
        if data.dtype == np.int16:
            data = data.astype(np.float32) / 32768.0
        elif data.dtype == np.int32:
            data = data.astype(np.float32) / 2147483648.0
        elif data.dtype == np.uint8:
            data = (data.astype(np.float32) - 128.0) / 128.0
        else:
            data = data.astype(np.float32)
        return sr, data

    # Muqobil: standard wave kutubxonasi
    import wave
    with wave.open(wav_path, "rb") as wf:
        sr = wf.getframerate()
        n_channels = wf.getnchannels()
        n_frames = wf.getnframes()
        raw_bytes = wf.readframes(n_frames)
        data = np.frombuffer(raw_bytes, dtype=np.int16).astype(np.float32) / 32768.0
        if n_channels > 1:
            data = data.reshape(-1, n_channels).mean(axis=1)
        return sr, data


def compute_energy_envelope(
    wav_path: str,
    frame_ms: float = 10.0,
    hop_ms: float = 10.0
) -> Tuple[np.ndarray, np.ndarray, int]:
    """
    Qisqa kadrli (10 ms) RMS energiya chizig'ini va vaqt o'qini hisoblaydi.
    Qaytaradi: (energy, time_axis, sample_rate)
    """
    sr, signal = _read_wav_data(wav_path)
    frame_len = max(1, int(sr * (frame_ms / 1000.0)))
    hop_len = max(1, int(sr * (hop_ms / 1000.0)))

    # Frame'lar bo'yicha RMS
    n_frames = max(1, int(math.ceil((len(signal) - frame_len) / hop_len)) + 1)
    energy = np.zeros(n_frames, dtype=np.float32)

    for i in range(n_frames):
        start = i * hop_len
        end = min(len(signal), start + frame_len)
        chunk = signal[start:end]
        if len(chunk) > 0:
            energy[i] = np.sqrt(np.mean(chunk ** 2) + 1e-9)

    # 3-kadrli tekislash (tasodifiy shovqin chertishlarini yumshatish)
    if len(energy) >= 3:
        kernel = np.array([0.25, 0.5, 0.25], dtype=np.float32)
        energy = np.convolve(energy, kernel, mode="same")

    time_axis = (np.arange(n_frames) * hop_len) / float(sr)
    return energy, time_axis, sr


def detect_pauses_and_onsets(
    energy: np.ndarray,
    time_axis: np.ndarray,
    min_pause_ms: float = 200.0
) -> Dict[str, Any]:
    """
    Ovoz energiyasi chizig'idan sukut (pauza) oraliqlarini va
    harakat boshlanishlarini (onsets) aniqlaydi.
    """
    if len(energy) == 0:
        return {"pauses": [], "onsets": [], "offsets": [], "noise_floor": 0.0}

    # Adaptiv shovqin chegarasi (noise floor)
    # Kam energiyali kadrlarning 15-persentili
    sorted_e = np.sort(energy)
    idx_floor = max(0, int(len(sorted_e) * 0.15))
    noise_floor = float(sorted_e[idx_floor])
    # Nutq chegarasi: shovqin ostonasidan sezilarli balandroq
    speech_threshold = max(noise_floor * 2.2, 0.008)

    is_speech = energy > speech_threshold
    hop_sec = time_axis[1] - time_axis[0] if len(time_axis) > 1 else 0.01

    # Pauzalarni (sukutlarni) aniqlash
    pauses: List[Tuple[float, float]] = []
    in_silence = False
    silence_start = 0.0
    min_pause_sec = min_pause_ms / 1000.0

    for i, flag in enumerate(is_speech):
        t = float(time_axis[i])
        if not flag:
            if not in_silence:
                in_silence = True
                silence_start = t
        else:
            if in_silence:
                in_silence = False
                silence_dur = t - silence_start
                if silence_dur >= min_pause_sec:
                    pauses.append((round(silence_start, 3), round(t, 3)))

    if in_silence and (time_axis[-1] - silence_start >= min_pause_sec):
        pauses.append((round(silence_start, 3), round(float(time_axis[-1]), 3)))

    # Onsets: energiyaning keskin ko'tarilish joylari
    # Gradient/diff orqali aniqlanadi
    diff_e = np.diff(energy)
    onsets: List[float] = []
    valid_onsets: List[float] = []
    offsets: List[float] = []

    # Onset kandidatlari
    for i in range(1, len(energy)):
        t = float(time_axis[i])
        rise = energy[i] - energy[i - 1]
        # Agar energiya keskin oshsa va sukutdan nutqqa o'tayotgan bo'lsa
        if rise > 0.004 and energy[i] > speech_threshold and energy[i - 1] <= speech_threshold:
            onset_t = round(t, 3)
            onsets.append(onset_t)
            # Onset attack sakrashi (>=2.2x energiya ko'tarilishi)
            pre_idx = max(0, i - 2)
            post_idx = min(len(energy) - 1, i + 2)
            pre_e = energy[pre_idx] + 1e-6
            post_e = energy[post_idx]
            if (post_e / pre_e) >= 2.2:
                valid_onsets.append(onset_t)
        # Offset kandidatlari: nutqdan sukutga o'tish
        elif rise < -0.004 and energy[i] <= speech_threshold and energy[i - 1] > speech_threshold:
            offsets.append(round(t, 3))

    return {
        "pauses": pauses,
        "onsets": onsets,
        "valid_onsets": valid_onsets,
        "offsets": offsets,
        "noise_floor": round(noise_floor, 5),
        "speech_threshold": round(speech_threshold, 5)
    }


def estimate_global_offset(
    words: List[Any],
    onsets: List[float],
    pauses: List[Tuple[float, float]],
    max_offset: float = 1.2,
    tolerance: float = 0.08,
    min_support: int = 3
) -> Tuple[float, int, bool]:
    """
    Butun audio uchun bitta umumiy ASR siljishini (lag) topadi (RANSAC uslubida support).
    Yolg'on xulosadan himoya (4 ta mustaqil mezon):
    1. Qo'llab-quvvatlash (Support): kamida min_support (3 ta) so'z o'z onsetiga ±tolerance (80 ms) ichida tushishi kerak.
    2. Monotonlik (Monotonicity): so'zlar tartibi bilan mos kelgan onsetlar tartibi qat'iy o'suvchi (k1 < k2 < k3...).
    3. Fizik mezon (Nutq oraliqlari): siljishdan keyin so'zlar sukut (pauza) ichida boshlamasligi shart; natija hozirgi holatdan yomon bo'lmasligi kerak.
    4. Siljish chegarasi: |siljish| <= max_offset (1.2 s).

    Qaytaradi: (offset_sec, support_count, is_valid)
    """
    if not words or not onsets or len(words) < min_support:
        return 0.0, 0, False

    word_starts = []
    for w in words:
        s = getattr(w, "start", None)
        if s is None and isinstance(w, dict):
            s = w.get("start", 0.0)
        word_starts.append(float(s if s is not None else 0.0))

    # Barcha potensial siljish nomzodlari: onset_j - word_start_i
    candidate_deltas = set()
    for s in word_starts:
        for o in onsets:
            d = round(o - s, 3)
            if abs(d) <= max_offset:
                candidate_deltas.add(d)

    if not candidate_deltas:
        return 0.0, 0, False

    def count_pause_violations(starts: List[float], offset: float) -> int:
        violations = 0
        for s in starts:
            shifted = s + offset
            for p_start, p_end in pauses:
                # Agar siljigan start sukut ichiga tushsa (margin 40 ms)
                if (p_start + 0.04) < shifted < (p_end - 0.04):
                    violations += 1
                    break
        return violations

    baseline_violations = count_pause_violations(word_starts, 0.0)

    best_delta = 0.0
    best_support = 0
    best_residual_mae = float("inf")

    effective_min_support = max(min_support, int(math.ceil(len(word_starts) * 0.7)))

    for delta in sorted(candidate_deltas):
        # 1. Support & Matching
        matches = []  # list of (word_idx, onset_idx, residual)
        last_matched_onset_idx = -1
        is_monotonic = True

        for w_idx, s in enumerate(word_starts):
            s_shifted = s + delta
            # ±tolerance ichidagi onsetlarni topish
            candidates = [(k, o) for k, o in enumerate(onsets) if abs(o - s_shifted) <= tolerance]
            if candidates:
                closest_k, closest_o = min(candidates, key=lambda item: abs(item[1] - s_shifted))
                # 2. Monotonlik tekshiruvi: tartib buzilmasligi kerak
                if closest_k <= last_matched_onset_idx:
                    is_monotonic = False
                    break
                last_matched_onset_idx = closest_k
                matches.append((w_idx, closest_k, closest_o - s))

        if not is_monotonic or len(matches) < effective_min_support:
            continue

        # 3. Fizik mezon: siljishdan keyin so'zlar sukut ichida boshlamasligi shart
        violations = count_pause_violations(word_starts, delta)
        if violations > 0 or violations > baseline_violations:
            continue

        # Tizimli lag barqarorligi (residuals std dev < 0.025s)
        residuals = [m[2] - delta for m in matches]
        if len(residuals) >= 3 and (max(residuals) - min(residuals) > 0.05 or np.std(residuals) > 0.025):
            continue

        mae = float(np.mean(np.abs(residuals)))

        # Eng ko'p support va minimal MAE tanlash
        if len(matches) > best_support or (len(matches) == best_support and mae < best_residual_mae):
            best_support = len(matches)
            best_residual_mae = mae
            best_delta = round(float(np.mean([m[2] for m in matches])), 3)

    # 4. Chegaralar va yakuniy tekshiruv
    if best_support >= effective_min_support and abs(best_delta) <= max_offset:
        if abs(best_delta) < 0.025:
            return 0.0, best_support, False
        return best_delta, best_support, True

    return 0.0, 0, False


def apply_global_offset(words: List[Any], offset_sec: float) -> List[Any]:
    """
    Barcha so'zlarning start va end vaqtlariga global siljishni qo'llaydi.
    """
    if not words or abs(offset_sec) < 1e-4:
        return words

    res = []
    for w in words:
        if isinstance(w, dict):
            new_w = dict(w)
            orig_s = float(w.get("start", 0.0))
            orig_e = float(w.get("end", orig_s + 0.1))
            dur = max(0.04, orig_e - orig_s)
            new_s = max(0.0, round(orig_s + offset_sec, 3))
            new_e = max(new_s + dur, round(orig_e + offset_sec, 3))
            new_w["start"] = new_s
            new_w["end"] = new_e
            res.append(new_w)
        else:
            orig_s = float(getattr(w, "start", 0.0))
            orig_e = float(getattr(w, "end", orig_s + 0.1))
            dur = max(0.04, orig_e - orig_s)
            new_s = max(0.0, round(orig_s + offset_sec, 3))
            new_e = max(new_s + dur, round(orig_e + offset_sec, 3))
            try:
                w.start = new_s
                w.end = new_e
                res.append(w)
            except Exception:
                res.append({"word": getattr(w, "word", str(w)), "start": new_s, "end": new_e})
    return res


def snap_word_timestamps_to_audio(
    words: List[Any],
    wav_path: Optional[str] = None,
    search_window_ms: float = 150.0,
    min_word_dur_ms: float = 80.0,
    min_pause_ms: float = 200.0,
    fps: Optional[float] = None,
    custom_onsets: Optional[List[float]] = None,
    custom_valid_onsets: Optional[List[float]] = None,
    custom_offsets: Optional[List[float]] = None,
    custom_pauses: Optional[List[Tuple[float, float]]] = None
) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    """
    So'zlarning start va end vaqtlarini audio energiyasiga qarab aniqlashtiradi (snap).
    Qaytaradi: (aniqlangan_sozlar, statistika)
    """
    if not words:
        return [], {"snapped_count": 0, "avg_shift_ms": 0.0, "max_shift_ms": 0.0, "pauses_found": 0, "global_offset_sec": 0.0, "global_offset_ms": 0.0, "global_offset_applied": False, "support_count": 0, "one_to_one_bound": False}

    # Boshlang'ich start vaqtlarini saqlab olamiz (haqiqiy siljish statistikasini hisoblash uchun)
    initial_starts = []
    for w in words:
        s = getattr(w, "start", None)
        if s is None and isinstance(w, dict):
            s = w.get("start", 0.0)
        initial_starts.append(float(s if s is not None else 0.0))

    # Agar WAV fayli mavjud bo'lmasa, faqat qoidalarni qo'llab qaytaramiz
    has_audio = wav_path and os.path.exists(wav_path)
    onsets = []
    offsets = []
    pauses = []
    valid_onsets = []

    if has_audio:
        try:
            energy, time_axis, sr = compute_energy_envelope(wav_path, frame_ms=10.0, hop_ms=10.0)
            analysis = detect_pauses_and_onsets(energy, time_axis, min_pause_ms=min_pause_ms)
            onsets = analysis["onsets"]
            valid_onsets = analysis.get("valid_onsets", [])
            offsets = analysis["offsets"]
            pauses = analysis["pauses"]
        except Exception as e:
            print(f"[Audio Aligner] Ovoz energiyasini tahlil qilishda xatolik: {e}")

    if custom_onsets is not None:
        onsets = list(custom_onsets)
        has_audio = True
    if custom_valid_onsets is not None:
        valid_onsets = list(custom_valid_onsets)
        has_audio = True
    if custom_offsets is not None:
        offsets = list(custom_offsets)
    if custom_pauses is not None:
        pauses = list(custom_pauses)

    if not valid_onsets and onsets:
        valid_onsets = onsets
    elif not onsets and valid_onsets:
        onsets = valid_onsets

    global_offset_sec = 0.0
    global_offset_applied = False
    support_count = 0

    # 0-QADAM: Global siljishni (ASR lag) aniqlash va barcha so'zlarga qo'llash
    if has_audio and onsets and len(words) >= 3:
        offset_val, sup_cnt, is_valid = estimate_global_offset(
            words, onsets, pauses, max_offset=1.2, tolerance=0.08, min_support=3
        )
        if is_valid and abs(offset_val) >= 0.025:
            words = apply_global_offset(words, offset_val)
            global_offset_sec = offset_val
            global_offset_applied = True
            support_count = sup_cnt

    window_sec = search_window_ms / 1000.0
    min_dur_sec = min_word_dur_ms / 1000.0

    refined_words = []
    shifts = []

    # 0.5-QADAM: 1:1 Onset Binding (agar so'zlar soni va valid_onsets soni teng bo'lsa)
    one_to_one_bound = False
    if has_audio and valid_onsets and len(words) == len(valid_onsets) and len(words) >= 2:
        is_monotonic = all(valid_onsets[k] < valid_onsets[k+1] for k in range(len(valid_onsets)-1))
        current_starts = [
            float(getattr(w, "start", 0) if hasattr(w, "start") else w.get("start", 0))
            for w in words
        ]
        within_reach = all(abs(valid_onsets[k] - current_starts[k]) <= 0.450 for k in range(len(words)))
        if is_monotonic and within_reach:
            one_to_one_bound = True

    for idx, w in enumerate(words):
        w_word = getattr(w, "word", None) or (w.get("word") if isinstance(w, dict) else str(w))
        orig_start = float(getattr(w, "start", 0) if hasattr(w, "start") else w.get("start", 0))
        orig_end = float(getattr(w, "end", orig_start + 0.3) if hasattr(w, "end") else w.get("end", orig_start + 0.3))
        score = float(getattr(w, "score", 1.0) if hasattr(w, "score") else w.get("score", 1.0))

        cur_start = orig_start
        cur_end = orig_end

        if one_to_one_bound:
            cur_start = valid_onsets[idx]
            dur = max(orig_end - orig_start, min_dur_sec)
            cur_end = cur_start + dur
        else:
            # 1. Start vaqtini eng yaqin onset'ga tortish (±150 ms yoki keng 450 ms)
            if onsets:
                cands = [o for o in onsets if abs(o - orig_start) <= window_sec]
                if cands:
                    # Eng yaqin onset
                    best_onset = min(cands, key=lambda o: abs(o - orig_start))
                    cur_start = best_onset
                elif valid_onsets:
                    # Keng snap (450 ms): agar 150 ms da topilmasa, lekin valid onset 450 ms da bo'lsa
                    wide_cands = [o for o in valid_onsets if abs(o - orig_start) <= 0.450]
                    if wide_cands:
                        best_wide = min(wide_cands, key=lambda o: abs(o - orig_start))
                        if abs(best_wide - orig_start) >= 0.06:
                            cur_start = best_wide

            # 2. End vaqtini eng yaqin offset'ga tortish (±150 ms)
            if offsets:
                cands_end = [off for off in offsets if abs(off - orig_end) <= window_sec]
                if cands_end:
                    best_offset = min(cands_end, key=lambda off: abs(off - orig_end))
                    cur_end = best_offset

        # 3. Sukut/pauza bilan to'qnashuvni tekshirish
        # So'z hech qachon aniqlangan sukut oralig'iga kirib ketmasin
        for p_start, p_end in pauses:
            # Agar so'z sukut boshlanishidan oldin bo'lsa, lekin u sukut ichiga cho'zilgan bo'lsa
            if orig_start < p_start and cur_end > p_start:
                cur_end = p_start
            # Agar so'z sukut tugaganidan keyin bo'lishi kerak bo'lsa, lekin start sukut ichida qolgan bo'lsa
            if orig_start >= p_start and orig_start < p_end:
                cur_start = p_end

        # 4. Minimal davomiylikni kafolatlash
        if cur_end - cur_start < min_dur_sec:
            cur_end = cur_start + min_dur_sec

        shift_ms = abs(cur_start - initial_starts[idx]) * 1000.0
        shifts.append(shift_ms)

        refined_words.append({
            "word": w_word,
            "start": round(cur_start, 3),
            "end": round(cur_end, 3),
            "score": score,
            "confidence": score,
            "pause_after_ms": 0.0
        })

    # 5. Ketma-ketlik va to'qnashuvlarni to'g'rilash (Monotonicity Invariants)
    for i in range(len(refined_words)):
        # Oldingi so'z bilan to'qnashuv
        if i > 0:
            prev_end = refined_words[i - 1]["end"]
            if refined_words[i]["start"] < prev_end:
                refined_words[i]["start"] = prev_end
            if refined_words[i]["end"] <= refined_words[i]["start"]:
                refined_words[i]["end"] = round(refined_words[i]["start"] + min_dur_sec, 3)

        # Pauzani hisoblash (keyingi so'zgacha bo'lgan sukut)
        if i < len(refined_words) - 1:
            next_start = refined_words[i + 1]["start"]
            pause_sec = max(0.0, next_start - refined_words[i]["end"])
            refined_words[i]["pause_after_ms"] = round(pause_sec * 1000.0, 1)

    # 6. Agar FPS berilgan bo'lsa, eng yaqin kadrga yaxlitlash (Quantize to FPS)
    if fps and fps > 0:
        for rw in refined_words:
            rw["start"] = round(round(rw["start"] * fps) / fps, 3)
            rw["end"] = round(round(rw["end"] * fps) / fps, 3)
            if rw["end"] <= rw["start"]:
                rw["end"] = round(rw["start"] + (1.0 / fps), 3)

    # Statistika hisoblash
    snapped_count = sum(1 for s in shifts if s > 15.0)
    avg_shift = float(np.mean(shifts)) if shifts else 0.0
    max_shift = float(np.max(shifts)) if shifts else 0.0
    pauses_count = sum(1 for rw in refined_words if rw["pause_after_ms"] >= min_pause_ms)

    stats = {
        "total_words": len(refined_words),
        "snapped_count": snapped_count,
        "avg_shift_ms": round(avg_shift, 1),
        "max_shift_ms": round(max_shift, 1),
        "pauses_found": pauses_count,
        "global_offset_sec": round(global_offset_sec, 3),
        "global_offset_ms": round(global_offset_sec * 1000.0, 1),
        "global_offset_applied": global_offset_applied,
        "support_count": support_count,
        "one_to_one_bound": one_to_one_bound
    }

    return refined_words, stats
