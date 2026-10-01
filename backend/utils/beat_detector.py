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


def detect_tempo_and_beats(
    audio_path: str,
    sensitivity: float = 0.5,  # 0.0 (Light) -> 1.0 (Intense)
    mode: str = "auto",        # "auto", "light", "medium", "intense", "drops"
    min_bpm: float = 65.0,
    max_bpm: float = 185.0
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
                "bpm": 120.0,
                "duration": 0.0,
                "beats": [],
                "cut_points": [],
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
            diff = np.maximum(0, diff) # Faqat energiyaning ko'tarilish lahzasi
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
        fps = sample_rate / hop_size  # Taxminan 43.06 freym/sek
        acorr = np.correlate(combined_flux - np.mean(combined_flux), combined_flux - np.mean(combined_flux), mode='full')
        acorr = acorr[len(acorr)//2:]

        min_lag = int(fps * 60.0 / max_bpm)
        max_lag = int(fps * 60.0 / min_bpm)
        lag_range = acorr[min_lag:max_lag]
        
        bpm = 120.0
        if len(lag_range) > 0 and np.max(lag_range) > 0:
            peak_lag = np.argmax(lag_range) + min_lag
            detected_bpm = (fps * 60.0) / peak_lag
            # Agar BPM juda past yoki yuqori bo'lsa, oktavasini to'g'irlaymiz
            while detected_bpm < 75.0:
                detected_bpm *= 2.0
            while detected_bpm > 165.0:
                detected_bpm /= 2.0
            bpm = round(detected_bpm, 1)

        beat_period_sec = 60.0 / bpm

        # 4. Sezgirlik va Rejimga ko'ra Piklar (Peak picking)
        # CapCut sezgirligi: Light (1), Normal (2), Dynamic (3), Intense (4), Max (5)
        # sensitivity parametri: 0.0 (juda yengil) dan 1.0 (o'ta tez/har bir zarba)
        # Mode bo'yicha parametrlar
        if mode == "light":
            sensitivity = 0.15
        elif mode == "medium":
            sensitivity = 0.50
        elif mode == "intense":
            sensitivity = 0.85
        elif mode == "drops":
            sensitivity = 0.05

        # Dinamik chegara (Adaptive Moving Average Threshold)
        win_size = int(fps * 0.4)
        if win_size % 2 == 0:
            win_size += 1
        if win_size < 3:
            win_size = 3
        
        kernel = np.ones(win_size) / win_size
        moving_avg = np.convolve(combined_flux, kernel, mode='same')
        moving_std = np.sqrt(np.maximum(0, np.convolve(combined_flux**2, kernel, mode='same') - moving_avg**2))

        # Sezgirlik qanchalik baland bo'lsa, threshold past bo'ladi
        # sensitivity = 0.0 -> factor = 2.2 (faqat eng kuchli zarbalar)
        # sensitivity = 1.0 -> factor = 0.2 (deyarli barcha ritmik zarbalar)
        threshold_factor = 2.4 - (sensitivity * 2.1)
        threshold = moving_avg + (threshold_factor * moving_std)

        # Min masofa:
        # Light rejimda: kamida yarim sekund (0.45s) yoki butun takt
        # Intense rejimda: 1/8 takt (0.15s)
        min_dist_sec = max(0.12, 0.45 - (sensitivity * 0.32))
        min_dist_frames = max(2, int(min_dist_sec * fps))

        peaks, properties = scipy.signal.find_peaks(
            combined_flux,
            height=threshold,
            distance=min_dist_frames
        )

        # 5. Bass Drop va Portlashlarni aniqlash
        bass_thresh = np.mean(flux_bass_norm) + (2.0 * np.std(flux_bass_norm))
        drop_peaks, _ = scipy.signal.find_peaks(
            flux_bass_norm,
            height=bass_thresh,
            distance=int(fps * 1.5)  # Droplar orasi kamida 1.5 sekund
        )
        drop_times_set = set(np.round(onset_times[drop_peaks], 2))

        # 6. Zarbalarni tuzish (Beats ro'yxati)
        raw_beats = []
        for p in peaks:
            t = float(onset_times[p])
            strength = float(combined_flux[p])
            is_drop = any(abs(t - dt) < 0.15 for dt in drop_times_set)
            
            raw_beats.append({
                "time": round(t, 3),
                "strength": round(strength, 3),
                "is_drop": is_drop
            })

        # Agar peaks juda kam bo'lsa (masalan sokin musiqada), tempo bo'yicha grid qo'shamiz
        if len(raw_beats) < 3 and duration_sec > 2.0:
            first_hit = float(onset_times[np.argmax(combined_flux)]) if len(onset_times) > 0 else 0.0
            cur = first_hit
            while cur < duration_sec:
                raw_beats.append({
                    "time": round(cur, 3),
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

        # Taktdagi o'rnini (Downbeat: 1-zarba, Major, Minor) belgilash
        # CapCut'dagidek har bir taktning 1-zarbasi (Downbeat) oltin rangda ko'rinadi
        beats_result = []
        beat_counter = 0
        for idx, b in enumerate(cleaned_beats):
            # Taxminiy 4/4 takt bo'yicha downbeat
            is_downbeat = (idx % 4 == 0) or b["is_drop"]
            b_type = "drop" if b["is_drop"] else ("major" if is_downbeat else "normal")
            beats_result.append({
                "index": idx + 1,
                "time": b["time"],
                "strength": b["strength"],
                "is_downbeat": is_downbeat,
                "is_drop": b["is_drop"],
                "type": b_type
            })

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

        # 8. Kadr o'tish nuqtalari (Cut timestamps)
        cut_points = [b["time"] for b in beats_result]

        return {
            "bpm": bpm,
            "duration": round(duration_sec, 2),
            "beat_count": len(beats_result),
            "sensitivity": sensitivity,
            "mode": mode,
            "beats": beats_result,
            "cut_points": cut_points,
            "waveform": waveform_points
        }

    finally:
        # Vaqtinchalik faylni o'chirish (agar yaratilgan bo'lsa)
        if temp_wav and temp_wav != audio_path and os.path.exists(temp_wav):
            try:
                os.remove(temp_wav)
            except Exception:
                pass
