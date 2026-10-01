"""
O'zbekcha AI Subtitr - Beat & Rhythm Detector Moduli (CapCut Uslubida)
Musiqaning ritmi, ohangi, zarbalari (beats), bass/drop nuqtalarini
va video montaj uchun kadr o'tish (match cut / razor cut) vaqtlarini aniqlaydi.
"""

import os
import math
import subprocess
import shutil
import numpy as np
import scipy.signal
import scipy.io.wavfile
from typing import Dict, Any, List, Optional, Tuple


def check_ffmpeg() -> bool:
    return shutil.which("ffmpeg") is not None


def convert_audio_for_analysis(input_path: str, target_sr: int = 22050) -> str:
    """
    Audio faylni (mp3, wav, aac, m4a, mp4, mov va h.k.) 22050Hz mono WAV formatiga o'tkazadi.
    Vaqtinchalik WAV fayl yo'lini qaytaradi.
    """
    if not os.path.exists(input_path):
        raise FileNotFoundError(f"Fayl topilmadi: {input_path}")

    # Agar allaqachon WAV bo'lsa, to'g'ridan-to'g'ri tekshirib ko'ramiz
    if input_path.lower().endswith(".wav"):
        try:
            sr, _ = scipy.io.wavfile.read(input_path, mmap=True)
            if sr == target_sr:
                return input_path
        except Exception:
            pass

    if not check_ffmpeg():
        if input_path.lower().endswith(".wav"):
            return input_path
        raise RuntimeError("FFmpeg topilmadi. Audio tahlil qilish uchun FFmpeg talab qilinadi.")

    base, _ = os.path.splitext(input_path)
    output_path = f"{base}_beat_temp_{target_sr}.wav"

    cmd = [
        "ffmpeg", "-y", "-i", input_path,
        "-vn",
        "-acodec", "pcm_s16le",
        "-ac", "1",
        "-ar", str(target_sr),
        output_path
    ]
    try:
        subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, check=True)
        return output_path
    except subprocess.CalledProcessError as e:
        raise RuntimeError(f"FFmpeg orqali audioni tayyorlashda xatolik: {e.stderr}")


def estimate_beat_period(beats: List[Dict[str, Any]]) -> Optional[float]:
    """Zarbalar orasidagi MEDIAN oraliq — BPM oktava katlansa ham to'g'ri."""
    if len(beats) < 3:
        return None
    diffs = sorted([
        float(beats[i + 1]["time"]) - float(beats[i]["time"])
        for i in range(len(beats) - 1)
        if float(beats[i + 1]["time"]) - float(beats[i]["time"]) > 0.05
    ])
    return diffs[len(diffs) // 2] if diffs else None


def assign_downbeats(beats: List[Dict[str, Any]], period: float, beats_per_bar: int = 4) -> List[Dict[str, Any]]:
    """
    1) FAZA: '1-zarba' ustiga tushadigan zarbalar KUCHI yig'indisi eng katta variant.
    2) O'RIN + MONOTONLIK (zarba tushib qolsa ham bar raqami surilmaydi).
    """
    if not beats or not period or period <= 0:
        return beats

    # 1) FAZA
    best_phase, best_score = float(beats[0]["time"]), -1.0
    for cand in beats[:min(len(beats), beats_per_bar * 2)]:
        phase = float(cand["time"])
        score = 0.0
        for b in beats:
            if int(round((float(b["time"]) - phase) / period)) % beats_per_bar == 0:
                score += float(b.get("strength", 1.0))
        if score > best_score:
            best_score, best_phase = score, phase

    # 2) O'RIN + MONOTONLIK
    last_pos = None
    for b in beats:
        pos = int(round((float(b["time"]) - best_phase) / period))
        if last_pos is not None and pos <= last_pos:
            pos = last_pos + 1
        last_pos = pos
        b["is_downbeat"] = (pos % beats_per_bar == 0)  # drop ALOHIDA belgi!
        b["bar_pos"] = pos % beats_per_bar
        b["bar"] = (pos // beats_per_bar) + 1
        b["type"] = "drop" if b.get("is_drop") else ("major" if b["is_downbeat"] else "normal")

    return beats


def dedupe_beats(beats: List[Dict[str, Any]], fps: Optional[float] = None, min_interval: Optional[float] = None) -> List[Dict[str, Any]]:
    """Bir kadrga yoki min_interval oralig'iga tushgan zarbalarni birlashtiradi (kuchlirog'i qoladi)."""
    if not beats:
        return []
    f = float(fps) if (fps and fps > 0) else None
    min_gap = (1.0 / f) if f else (min_interval if (min_interval and min_interval > 0) else 0.02)
    sorted_beats = sorted(beats, key=lambda b: float(b.get("time", 0.0)))
    out: List[Dict[str, Any]] = []
    for b in sorted_beats:
        t = float(b.get("time", 0.0))
        st = float(b.get("strength", 1.0))
        if out and abs(t - float(out[-1].get("time", 0.0))) < (min_gap - 1e-9):
            if st > float(out[-1].get("strength", 1.0)):
                out[-1] = b
            continue
        out.append(b)
    return out


def snap_beats_to_frame(beats: List[Dict[str, Any]], fps: float = 25.0) -> List[Dict[str, Any]]:
    """Har bir zarbani eng yaqin kadrga moslaydi (time_raw, frame, time)."""
    if not fps or fps <= 0:
        return beats
    out = []
    for b in beats:
        t = float(b.get("time", 0.0))
        frame = int(round(t * fps))
        nb = dict(b)
        nb["time_raw"] = round(t, 6)
        nb["frame"] = frame
        nb["time"] = frame / fps  # aynan kadr vaqti, yumaloqlanmaydi!
        out.append(nb)
    return out


def sec_to_timecode(seconds: float, fps: float = 25.0) -> str:
    """Non-drop frame vaqt kodi: 00:00:03:05"""
    nominal = int(round(fps)) or 25
    total = int(round(max(0.0, seconds) * fps))
    fr = total % nominal
    total_sec = (total - fr) // nominal
    return "%02d:%02d:%02d:%02d" % (
        total_sec // 3600,
        (total_sec % 3600) // 60,
        total_sec % 60,
        fr
    )


def detect_tempo_and_beats(
    audio_path: str,
    sensitivity: float = 0.5,  # 0.0 (Light) -> 1.0 (Intense)
    mode: str = "auto",        # "auto", "light", "medium", "intense", "drops"
    min_bpm: float = 65.0,
    max_bpm: float = 185.0,
    fps: float = 25.0
) -> Dict[str, Any]:
    """
    CapCut 'Beats' moduli kabi musiqa ritmini, zarbalarini va kadr o'tish nuqtalarini aniqlaydi.
    """
    temp_wav = None
    try:
        # 1. 22050Hz mono WAV ga aylantiramiz
        target_sr = 22050
        temp_wav = convert_audio_for_analysis(audio_path, target_sr=target_sr)

        sample_rate, raw_data = scipy.io.wavfile.read(temp_wav)
        if raw_data.ndim > 1:
            data = raw_data.mean(axis=1).astype(np.float32)
        else:
            data = raw_data.astype(np.float32)

        # Normalizatsiya (-1.0 dan 1.0 gacha)
        max_val = np.max(np.abs(data))
        if max_val > 0:
            data = data / max_val

        total_samples = len(data)
        duration_sec = total_samples / sample_rate
        if duration_sec <= 0.1:
            return {
                "bpm_raw": 120.0,
                "bpm": 120.0,
                "beat_period_sec": 0.5,
                "duration": 0.0,
                "beat_count": 0,
                "downbeat_count": 0,
                "drop_count": 0,
                "sensitivity": sensitivity,
                "mode": mode,
                "fps": fps,
                "beats": [],
                "cut_points": [],
                "cut_frames": [],
                "cut_timecodes": [],
                "waveform": []
            }

        # 2. STFT orqali Spektral Tahlil
        # nperseg = 1024 (taxminan 46ms), noverlap = 512 (taxminan 23ms hop)
        nperseg = 1024
        hop_size = 512
        freqs, times, Zxx = scipy.signal.stft(data, fs=sample_rate, nperseg=nperseg, noverlap=nperseg - hop_size)
        mag = np.abs(Zxx)

        # Chastota polosalari:
        # Bass (20 - 250 Hz) - Kick va Drop zarbalari
        # Mid (250 - 3000 Hz) - Snare, akkordlar, vokal ritmi
        # High (3000 - 10000 Hz) - Hi-hats, zarba cho'qqilari
        bass_mask = (freqs >= 20) & (freqs <= 250)
        mid_mask = (freqs > 250) & (freqs <= 3000)
        high_mask = (freqs > 3000) & (freqs <= 10000)

        bass_mag = mag[bass_mask, :] if np.any(bass_mask) else mag
        mid_mag = mag[mid_mask, :] if np.any(mid_mask) else mag
        high_mag = mag[high_mask, :] if np.any(high_mask) else mag

        # Spektral Oqim (Spectral Flux / Onset Detection Function)
        def spectral_flux(m):
            diff = np.diff(m, axis=1)
            diff = np.maximum(0, diff)  # Faqat energiyaning ko'tarilish lahzasi
            return np.sum(diff, axis=0)

        flux_full = spectral_flux(mag)
        flux_bass = spectral_flux(bass_mag)
        flux_mid = spectral_flux(mid_mag)
        flux_high = spectral_flux(high_mag)

        # Onset vaqtlarini tenglashtirish (diff 1 ta freymga qisqartiradi)
        onset_times = times[1:]
        min_len = min(len(onset_times), len(flux_full))
        onset_times = onset_times[:min_len]
        flux_full = flux_full[:min_len]
        flux_bass = flux_bass[:min_len]
        flux_mid = flux_mid[:min_len]
        flux_high = flux_high[:min_len]

        # Normalizatsiya qilish
        def norm(arr):
            m = np.max(arr)
            return (arr / m) if m > 0 else arr

        flux_full_norm = norm(flux_full)
        flux_bass_norm = norm(flux_bass)
        flux_high_norm = norm(flux_high)

        # Birlashgan ritm funktsiyasi (Bass zarbasi 50%, to'liq spektr 35%, yuqori zarba 15%)
        combined_flux = (0.50 * flux_bass_norm) + (0.35 * flux_full_norm) + (0.15 * flux_high_norm)

        # 3. Tempo (BPM) ni Avtokorrelyatsiya orqali hisoblash
        stft_fps = sample_rate / hop_size  # bu STFT freym chastotasi, LOYIHA fps EMAS
        acorr = np.correlate(combined_flux - np.mean(combined_flux), combined_flux - np.mean(combined_flux), mode='full')
        acorr = acorr[len(acorr) // 2:]

        min_lag = int(stft_fps * 60.0 / max_bpm)
        max_lag = int(stft_fps * 60.0 / min_bpm)
        lag_range = acorr[min_lag:max_lag]

        bpm_raw = 120.0
        if len(lag_range) > 0 and np.max(lag_range) > 0:
            lags = np.arange(min_lag, max_lag)
            bpm_candidates = (stft_fps * 60.0) / lags
            # Standart perceptual prior (120 BPM markazida, oktava va subgarmoniklarni muvozanatlash)
            prior = np.exp(-0.5 * ((np.log2(bpm_candidates / 120.0)) / 0.8) ** 2)
            weighted_acorr = lag_range * prior
            peak_lag = lags[np.argmax(weighted_acorr)]
            detected_bpm = (stft_fps * 60.0) / peak_lag
            bpm_raw = round(detected_bpm, 1)

        bpm = bpm_raw
        while bpm < 75.0:
            bpm *= 2.0  # faqat KO'RSATISH uchun
        while bpm > 165.0:
            bpm /= 2.0
        bpm = round(bpm, 1)

        beat_period_sec = 60.0 / bpm_raw  # grid haqiqiy davr bo'yicha

        # 4. Sezgirlik va Rejimga ko'ra Piklar (Peak picking)
        if mode == "light":
            sensitivity = 0.15
        elif mode == "medium":
            sensitivity = 0.50
        elif mode == "intense":
            sensitivity = 0.85
        elif mode == "drops":
            sensitivity = 0.05

        # Dinamik chegara (Adaptive Moving Average Threshold)
        win_size = int(stft_fps * 0.4)
        if win_size % 2 == 0:
            win_size += 1
        if win_size < 3:
            win_size = 3

        kernel = np.ones(win_size) / win_size
        moving_avg = np.convolve(combined_flux, kernel, mode='same')
        moving_std = np.sqrt(np.maximum(0, np.convolve(combined_flux**2, kernel, mode='same') - moving_avg**2))

        threshold_factor = 2.4 - (sensitivity * 2.1)
        threshold = moving_avg + (threshold_factor * moving_std)

        min_dist_sec = max(0.12, 0.45 - (sensitivity * 0.32))
        min_dist_frames = max(2, int(min_dist_sec * stft_fps))

        peaks, properties = scipy.signal.find_peaks(
            combined_flux,
            height=threshold,
            distance=min_dist_frames
        )

        # 5. Bass Drop va Portlashlarni aniqlash (qat'iylashtirilgan)
        bass_median = float(np.median(flux_bass_norm[flux_bass_norm > 0])) if np.any(flux_bass_norm > 0) else 0.0
        bass_thresh = max(
            np.mean(flux_bass_norm) + (2.5 * np.std(flux_bass_norm)),
            bass_median * 1.6
        )
        drop_peaks, _ = scipy.signal.find_peaks(
            flux_bass_norm,
            height=bass_thresh,
            distance=int(stft_fps * 1.5)  # Droplar orasi kamida 1.5 sekund
        )
        drop_times_set = set(np.round(onset_times[drop_peaks], 2))

        # 6. Zarbalarni tuzish (Beats ro'yxati)
        raw_beats = []
        for p in peaks:
            t = float(onset_times[p])
            strength = float(combined_flux[p])
            is_drop = any(abs(t - dt) < 0.15 for dt in drop_times_set)

            raw_beats.append({
                "time": round(t, 4),
                "strength": round(strength, 3),
                "is_drop": is_drop
            })

        # Agar peaks juda kam bo'lsa (masalan sokin musiqada), tempo bo'yicha grid qo'shamiz
        if len(raw_beats) < 3 and duration_sec > 2.0:
            first_hit = float(onset_times[np.argmax(combined_flux)]) if len(onset_times) > 0 else 0.0
            cur = first_hit
            while cur < duration_sec:
                raw_beats.append({
                    "time": round(cur, 4),
                    "strength": 0.5,
                    "is_drop": False
                })
                cur += beat_period_sec

        # Tartiblash
        raw_beats.sort(key=lambda b: b["time"])

        # Dublikatlarni tozalash (masofa < 0.1s bo'lsa)
        cleaned_beats = []
        last_t = -1.0
        for b in raw_beats:
            if b["time"] - last_t >= 0.10:
                cleaned_beats.append(b)
                last_t = b["time"]

        # Taktdagi o'rnini (Downbeat: 1-zarba, Major, Minor) faza bo'yicha belgilash
        measured_period = estimate_beat_period(cleaned_beats) or beat_period_sec
        cleaned_beats = assign_downbeats(cleaned_beats, measured_period, beats_per_bar=4)

        for idx, b in enumerate(cleaned_beats):
            b["index"] = idx + 1

        # Har bir zarbani loyiha kadriga moslash (snap to frame)
        snapped_beats = snap_beats_to_frame(cleaned_beats, fps=fps)

        # 7. Vizual Waveform (UI Canvas chizish uchun 400 ta nuqta)
        waveform_points = []
        target_points = 400
        step = max(1, total_samples // target_points)
        for i in range(0, total_samples, step):
            chunk = data[i:i + step]
            if len(chunk) > 0:
                val = float(np.max(np.abs(chunk)))
                waveform_points.append(round(val, 3))

        waveform_points = waveform_points[:target_points]

        # 8. Kadr o'tish nuqtalari (Cut timestamps, frames, timecodes)
        cut_points = [b["time"] for b in snapped_beats]
        cut_frames = [b.get("frame", int(round(b["time"] * fps))) for b in snapped_beats]
        cut_timecodes = [sec_to_timecode(b["time"], fps=fps) for b in snapped_beats]

        downbeat_count = sum(1 for b in snapped_beats if b.get("is_downbeat"))
        drop_count = sum(1 for b in snapped_beats if b.get("is_drop"))

        return {
            "bpm_raw": bpm_raw,
            "bpm": bpm,
            "beat_period_sec": round(beat_period_sec, 4),
            "duration": round(duration_sec, 2),
            "beat_count": len(snapped_beats),
            "downbeat_count": downbeat_count,
            "drop_count": drop_count,
            "sensitivity": sensitivity,
            "mode": mode,
            "fps": fps,
            "beats": snapped_beats,
            "cut_points": cut_points,
            "cut_frames": cut_frames,
            "cut_timecodes": cut_timecodes,
            "waveform": waveform_points
        }

    finally:
        # Vaqtinchalik faylni o'chirish (agar yaratilgan bo'lsa)
        if temp_wav and temp_wav != audio_path and os.path.exists(temp_wav):
            try:
                os.remove(temp_wav)
            except Exception:
                pass
