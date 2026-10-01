import os
import sys
import math
import wave
import tempfile
import numpy as np

# Loyiha ildizini sys.path ga qo'shish
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from backend.utils.beat_detector import (
    snap_beats_to_frame,
    estimate_beat_period,
    assign_downbeats,
    sec_to_timecode,
    detect_tempo_and_beats
)


def dedupe_beats_py(beats, fps=25.0):
    f = float(fps)
    min_gap = 1.0 / f if f > 0 else 0.02
    sorted_beats = sorted(beats, key=lambda b: float(b.get("time", 0)))
    out = []
    for b in sorted_beats:
        t = float(b.get("time", 0))
        if out and abs(t - float(out[-1].get("time", 0))) < (min_gap - 1e-9):
            if float(b.get("strength", 0)) > float(out[-1].get("strength", 0)):
                out[-1] = b
            continue
        out.append(b)
    return out


def test_1_snap_beats_to_frame():
    print("Test 1: snap_beats_to_frame tekshirilmoqda...")
    raw = [
        {"time": 0.021, "strength": 0.5},
        {"time": 0.518, "strength": 0.8},
        {"time": 1.001, "strength": 0.9}
    ]
    snapped_25 = snap_beats_to_frame(raw, fps=25.0)

    # 0.021 @ 25 -> round(0.525) = 1 -> frame 1, time 1/25 = 0.04
    assert snapped_25[0]["frame"] == 1, f"Kutilgan frame 1, lekin {snapped_25[0]['frame']}"
    assert abs(snapped_25[0]["time"] - 0.04) < 1e-6, f"Kutilgan time 0.04, lekin {snapped_25[0]['time']}"
    assert snapped_25[0]["time_raw"] == 0.021, f"time_raw saqlanmadi"

    # 0.518 @ 25 -> round(12.95) = 13 -> frame 13, time 13/25 = 0.52
    assert snapped_25[1]["frame"] == 13, f"Kutilgan frame 13, lekin {snapped_25[1]['frame']}"
    assert abs(snapped_25[1]["time"] - 0.52) < 1e-6, f"Kutilgan time 0.52, lekin {snapped_25[1]['time']}"

    # 1.001 @ 25 -> round(25.025) = 25 -> frame 25, time 25/25 = 1.0
    assert snapped_25[2]["frame"] == 25, f"Kutilgan frame 25, lekin {snapped_25[2]['frame']}"
    assert abs(snapped_25[2]["time"] - 1.0) < 1e-6, f"Kutilgan time 1.0, lekin {snapped_25[2]['time']}"

    # @ 30 fps
    raw_30 = [{"time": 0.5333, "strength": 0.7}]
    snapped_30 = snap_beats_to_frame(raw_30, fps=30.0)
    # 0.5333 * 30 = 15.999 -> frame 16
    assert snapped_30[0]["frame"] == 16, f"Kutilgan frame 16, lekin {snapped_30[0]['frame']}"
    assert abs(snapped_30[0]["time"] - (16.0 / 30.0)) < 1e-6, f"Kutilgan 16/30, lekin {snapped_30[0]['time']}"

    print("  ✓ Test 1 muvaffaqiyatli o'tdi")


def test_2_dedupe_beats():
    print("Test 2: dedupe_beats tekshirilmoqda...")
    beats = [
        {"time": 0.501, "strength": 0.4},
        {"time": 0.519, "strength": 0.95},  # Bitta kadr oralig'ida (1/25 = 0.04), kuchlirog'i
        {"time": 1.000, "strength": 0.6}
    ]
    deduped = dedupe_beats_py(beats, fps=25.0)
    assert len(deduped) == 2, f"Kutilgan 2 ta zarba, lekin {len(deduped)}"
    assert deduped[0]["strength"] == 0.95, f"Kuchliroq zarba qolmadi: {deduped[0]}"
    print("  ✓ Test 2 muvaffaqiyatli o'tdi")


def test_3_estimate_beat_period():
    print("Test 3: estimate_beat_period tekshirilmoqda...")
    # Bitta zarba tushib qolgan ketma-ketlik: 0.0, 0.5, 1.0, [1.5 tushib qoldi], 2.0, 2.5, 3.0
    beats = [
        {"time": 0.0},
        {"time": 0.5},
        {"time": 1.0},
        {"time": 2.0},  # oraliq 1.0
        {"time": 2.5},
        {"time": 3.0}
    ]
    period = estimate_beat_period(beats)
    assert period is not None, "Period aniqlanmadi"
    assert abs(period - 0.5) < 1e-4, f"Kutilgan median period 0.5, lekin {period}"
    print("  ✓ Test 3 muvaffaqiyatli o'tdi")


def test_4_assign_downbeats():
    print("Test 4: assign_downbeats faza va monotonlik tekshirilmoqda...")
    # 8 ta zarba, 4-takt. 0-chi zarba yoki 4-chi zarba eng kuchli (anchor)
    beats = [
        {"time": 0.0, "strength": 0.9},
        {"time": 0.5, "strength": 0.4},
        {"time": 1.0, "strength": 0.5},
        {"time": 1.5, "strength": 0.4},
        {"time": 2.0, "strength": 0.95},
        {"time": 2.5, "strength": 0.3},
        {"time": 3.0, "strength": 0.5},
        {"time": 3.5, "strength": 0.4}
    ]
    res = assign_downbeats(beats, period=0.5, beats_per_bar=4)
    downbeats = [b for b in res if b["is_downbeat"]]
    assert len(downbeats) == 2, f"Kutilgan 2 ta downbeat, lekin {len(downbeats)}"
    assert res[0]["is_downbeat"] is True, "0.0 dagi zarba downbeat bo'lishi kerak"
    assert res[4]["is_downbeat"] is True, "2.0 dagi zarba downbeat bo'lishi kerak"
    assert res[0]["bar_pos"] == 0
    assert res[1]["bar_pos"] == 1
    assert res[2]["bar_pos"] == 2
    assert res[3]["bar_pos"] == 3

    # Zarba tushib qolganda ham faza buzilmasligi
    beats_missing = [
        {"time": 0.0, "strength": 0.95},
        {"time": 0.5, "strength": 0.4},
        {"time": 1.0, "strength": 0.5},
        # 1.5 tushib qoldi!
        {"time": 2.0, "strength": 0.9},
        {"time": 2.5, "strength": 0.4}
    ]
    res2 = assign_downbeats(beats_missing, period=0.5, beats_per_bar=4)
    # 2.0 s pos = round(2.0/0.5) = 4 -> 4 % 4 == 0 -> downbeat bo'lishi shart!
    assert res2[3]["is_downbeat"] is True, "1.5 tushib qolganda 2.0 bar boshi bo'lib qolishi shart"
    assert res2[3]["bar_pos"] == 0
    print("  ✓ Test 4 muvaffaqiyatli o'tdi")


def test_5_sec_to_timecode():
    print("Test 5: sec_to_timecode tekshirilmoqda...")
    tc25 = sec_to_timecode(3.2, fps=25.0)
    assert tc25 == "00:00:03:05", f"Kutilgan 00:00:03:05, lekin {tc25}"

    tc30 = sec_to_timecode(10.5, fps=30.0)
    assert tc30 == "00:00:10:15", f"Kutilgan 00:00:10:15, lekin {tc30}"
    print("  ✓ Test 5 muvaffaqiyatli o'tdi")


def test_6_real_audio_synthesis():
    print("Test 6: Haqiqiy audio sintezi va detect_tempo_and_beats tekshirilmoqda...")
    sr = 22050
    duration = 12.0
    total_samples = int(sr * duration)
    audio = np.zeros(total_samples, dtype=np.float32)

    # 120 BPM: zarba har 0.5 soniyada
    beat_interval = 0.5
    t_axis = np.arange(int(sr * 0.15)) / sr  # 150ms kick so'nishi

    for beat_idx in range(int(duration / beat_interval)):
        beat_time = beat_idx * beat_interval
        start_samp = int(beat_time * sr)
        if start_samp + len(t_axis) >= total_samples:
            break

        # Kick drum: past chastota (120Hz -> 50Hz) + so'nuvchi envelope
        freq = 60.0
        decay = np.exp(-t_axis * 20.0)
        kick = np.sin(2.0 * np.pi * freq * t_axis) * decay

        # Har 4-zarba (downbeat) kuchliroq
        amp = 1.0 if (beat_idx % 4 == 0) else 0.65
        audio[start_samp:start_samp + len(t_axis)] += kick * amp

        # Hi-hat oralig'i (0.25s da)
        hh_time = beat_time + 0.25
        hh_samp = int(hh_time * sr)
        hh_len = int(sr * 0.04)
        if hh_samp + hh_len < total_samples:
            hh_t = np.arange(hh_len) / sr
            hh = (np.random.rand(hh_len).astype(np.float32) * 2 - 1) * np.exp(-hh_t * 80.0) * 0.25
            audio[hh_samp:hh_samp + hh_len] += hh

    # Normalizatsiya
    max_amp = np.max(np.abs(audio))
    if max_amp > 0:
        audio = audio / max_amp

    audio_int16 = (audio * 32767).astype(np.int16)

    # Temp WAV faylga yozish
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tf:
        temp_wav_path = tf.name

    try:
        with wave.open(temp_wav_path, "wb") as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)
            wf.setframerate(sr)
            wf.writeframes(audio_int16.tobytes())

        # Test @ 25 fps
        res25 = detect_tempo_and_beats(temp_wav_path, sensitivity=0.5, mode="auto", fps=25.0)

        # 1) BPM va period
        bpm_raw = res25["bpm_raw"]
        period = res25["beat_period_sec"]
        print(f"    Aniqlangan BPM: {bpm_raw} (Display BPM: {res25['bpm']}), Period: {period}s")
        assert 112.0 <= bpm_raw <= 128.0, f"BPM 120+-8 bo'lishi kerak, lekin {bpm_raw}"
        assert 0.44 <= period <= 0.56, f"Period 0.5+-0.06 bo'lishi kerak, lekin {period}"

        # 2) Zarbalar soni va tartiblanganligi
        beats25 = res25["beats"]
        assert len(beats25) >= 20, f"Zarbalar soni >= 20 bo'lishi kerak, lekin {len(beats25)}"
        times = [b["time"] for b in beats25]
        assert times == sorted(times), "Zarbalar vaqti tartiblangan emas!"

        # 3) BARCHA vaqtlar 1/25 kadr panjarasida
        for b in beats25:
            assert "frame" in b, f"Beatda 'frame' maydoni yo'q: {b}"
            t = b["time"]
            diff_from_frame = abs(t * 25.0 - round(t * 25.0))
            assert diff_from_frame < 1e-9, f"Vaqt {t} 1/25 panjarasida emas (diff: {diff_from_frame})"

        # 4) Downbeat oralig'i (har 4 zarbada, taxminan 2.0s +- 0.35s)
        downbeats = [b for b in beats25 if b["is_downbeat"]]
        assert len(downbeats) >= 4, f"Kamida 4 ta downbeat bo'lishi kerak, lekin {len(downbeats)}"
        db_diffs = [downbeats[i + 1]["time"] - downbeats[i]["time"] for i in range(len(downbeats) - 1)]
        avg_db_diff = sum(db_diffs) / len(db_diffs)
        print(f"    O'rtacha downbeat oralig'i: {avg_db_diff:.3f}s (kutilgan ~2.0s)")
        assert 1.65 <= avg_db_diff <= 2.35, f"Downbeat oralig'i 2.0+-0.35s bo'lishi kerak, lekin {avg_db_diff}"

        # 5) Test @ 30 fps
        res30 = detect_tempo_and_beats(temp_wav_path, sensitivity=0.5, mode="auto", fps=30.0)
        assert res30["fps"] == 30.0, f"res30 fps 30.0 bo'lishi kerak, lekin {res30['fps']}"
        for b in res30["beats"]:
            t = b["time"]
            diff30 = abs(t * 30.0 - round(t * 30.0))
            assert diff30 < 1e-9, f"Vaqt {t} 1/30 panjarasida emas (diff: {diff30})"

        print("  ✓ Test 6 muvaffaqiyatli o'tdi")

    finally:
        if os.path.exists(temp_wav_path):
            try:
                os.remove(temp_wav_path)
            except Exception:
                pass


if __name__ == "__main__":
    print("=" * 60)
    print("BEAT DETECTOR PYTHON TESTLARI BOSHLANDI")
    print("=" * 60)
    test_1_snap_beats_to_frame()
    test_2_dedupe_beats()
    test_3_estimate_beat_period()
    test_4_assign_downbeats()
    test_5_sec_to_timecode()
    test_6_real_audio_synthesis()
    print("=" * 60)
    print("BARCHA PYTHON TESTLARI YASHIL! (100% SUCCESS)")
    print("=" * 60)
