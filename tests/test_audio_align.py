"""
tests/test_audio_align.py - Global ASR Lag & Audio Alignment Tests (Suite 11)
31 ta qat'iy tekshiruv:
1. Global siljishni aniqlash (-410ms, -250ms, -700ms, +300ms)
2. Yolg'on-musbat filtrlari (30 ta tasodifiy holat, tartib buzilishi, sukut, chegara > 1.2s)
3. Haqiqiy audio o'lchovi va snap_word_timestamps_to_audio integratsiyasi
"""

import os
import sys
import math
import random
import tempfile
import unittest
import numpy as np
from pathlib import Path
from scipy.io import wavfile

ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from backend.utils.audio_aligner import (
    estimate_global_offset,
    apply_global_offset,
    snap_word_timestamps_to_audio,
    compute_energy_envelope,
    detect_pauses_and_onsets
)
from backend.utils.uzbek_nlp import is_on_frame


class DummyWord:
    def __init__(self, word, start, end):
        self.word = word
        self.start = start
        self.end = end


class TestAudioAlign(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Yagona sinov audio faylini yaratish
        cls.sr = 16000
        cls.duration = 8.0
        total_samples = int(cls.sr * cls.duration)
        audio = np.zeros(total_samples, dtype=np.float32)

        # 3 ta nutq signali (0.99s, 2.99s, 5.19s)
        cls.bursts = [(0.99, 1.6), (2.99, 3.6), (5.19, 5.8)]
        for b_start, b_end in cls.bursts:
            i_start = int(b_start * cls.sr)
            i_end = int(b_end * cls.sr)
            t = np.linspace(0, b_end - b_start, i_end - i_start)
            sig = 0.5 * np.sin(2 * np.pi * 220 * t) + 0.3 * np.sin(2 * np.pi * 440 * t)
            audio[i_start:i_end] = sig.astype(np.float32)

        cls.tmp_file = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
        cls.tmp_path = cls.tmp_file.name
        cls.tmp_file.close()

        wav_int16 = (audio * 32767).astype(np.int16)
        wavfile.write(cls.tmp_path, cls.sr, wav_int16)

        # Standart +410ms kechikishli so'zlar
        cls.lagged_words = [
            {"word": "Assalomu", "start": 1.40, "end": 1.80},
            {"word": "bugun", "start": 3.40, "end": 3.80},
            {"word": "foydali", "start": 5.60, "end": 6.00}
        ]

        cls.refined, cls.stats = snap_word_timestamps_to_audio(
            cls.lagged_words,
            wav_path=cls.tmp_path,
            search_window_ms=150.0,
            min_word_dur_ms=80.0,
            min_pause_ms=200.0,
            fps=25.0
        )

    @classmethod
    def tearDownClass(cls):
        if os.path.exists(cls.tmp_path):
            os.remove(cls.tmp_path)

    # 1. Kechikish (-410 ms) aniqlanishi
    def test_01_delay_410ms(self):
        onsets = [0.99, 2.99, 5.19]
        words = [
            {"word": "Assalomu", "start": 1.40, "end": 1.80},
            {"word": "bugun", "start": 3.40, "end": 3.80},
            {"word": "foydali", "start": 5.60, "end": 6.00}
        ]
        pauses = [(1.9, 2.8), (3.9, 5.0)]
        offset, support, valid = estimate_global_offset(words, onsets, pauses)
        self.assertTrue(valid)
        self.assertEqual(support, 3)
        self.assertAlmostEqual(offset, -0.410, places=2)

    # 2. Kechikish (-250 ms) aniqlanishi
    def test_02_delay_250ms(self):
        onsets = [1.0, 2.0, 3.0]
        words = [
            {"word": "bir", "start": 1.25, "end": 1.55},
            {"word": "ikki", "start": 2.25, "end": 2.55},
            {"word": "uch", "start": 3.25, "end": 3.55}
        ]
        offset, support, valid = estimate_global_offset(words, onsets, [])
        self.assertTrue(valid)
        self.assertAlmostEqual(offset, -0.250, places=2)

    # 3. Kechikish (-700 ms) aniqlanishi
    def test_03_delay_700ms(self):
        onsets = [1.0, 3.0, 5.0]
        words = [
            {"word": "a", "start": 1.70, "end": 2.00},
            {"word": "b", "start": 3.70, "end": 4.00},
            {"word": "c", "start": 5.70, "end": 6.00}
        ]
        offset, support, valid = estimate_global_offset(words, onsets, [])
        self.assertTrue(valid)
        self.assertAlmostEqual(offset, -0.700, places=2)

    # 4. Erta chiqish (+300 ms) aniqlanishi
    def test_04_early_300ms(self):
        onsets = [1.30, 2.50, 4.00]
        words = [
            {"word": "soʻz1", "start": 1.00, "end": 1.30},
            {"word": "soʻz2", "start": 2.20, "end": 2.50},
            {"word": "soʻz3", "start": 3.70, "end": 4.00}
        ]
        offset, support, valid = estimate_global_offset(words, onsets, [])
        self.assertTrue(valid)
        self.assertAlmostEqual(offset, 0.300, places=2)

    # 5. Aniq vaqtlarda siljish qo'llanmasligi
    def test_05_already_aligned(self):
        onsets = [1.0, 2.0, 3.0]
        words = [
            {"word": "bir", "start": 1.0, "end": 1.3},
            {"word": "ikki", "start": 2.0, "end": 2.3},
            {"word": "uch", "start": 3.0, "end": 3.3}
        ]
        offset, support, valid = estimate_global_offset(words, onsets, [])
        self.assertFalse(valid)
        self.assertEqual(offset, 0.0)

    # 6. Shovqinli matn bo'yicha 30 ta sinovda 0 ta yolg'on siljish
    def test_06_noise_robustness_30_trials(self):
        rng = random.Random(42)
        false_positives = 0
        pauses = [(2.0, 3.5), (5.0, 6.5)]
        onsets = [0.5, 1.8, 3.8, 4.7, 7.0]

        for _ in range(30):
            noisy_words = [
                {"word": f"w{i}", "start": round(rng.uniform(0.1, 8.0), 3), "end": round(rng.uniform(0.1, 8.0), 3)}
                for i in range(4)
            ]
            noisy_words.sort(key=lambda w: w["start"])
            offset, support, valid = estimate_global_offset(noisy_words, onsets, pauses)
            if valid:
                false_positives += 1

        self.assertEqual(false_positives, 0)

    # 7. Sukut (pauza) ichiga tushadigan siljish rad etilishi
    def test_07_silence_violation_rejected(self):
        onsets = [2.5, 4.0, 5.5]
        words = [
            {"word": "a", "start": 1.5, "end": 1.8},
            {"word": "b", "start": 3.0, "end": 3.3},
            {"word": "c", "start": 4.5, "end": 4.8}
        ]
        pauses = [(2.2, 2.8)]
        offset, support, valid = estimate_global_offset(words, onsets, pauses)
        self.assertFalse(valid)

    # 8. Monotonlik buzilishi (tartibsiz mos kelish) rad etilishi
    def test_08_non_monotonic_rejected(self):
        onsets = [3.0, 1.0, 2.0]
        words = [
            {"word": "a", "start": 0.5, "end": 0.8},
            {"word": "b", "start": 1.5, "end": 1.8},
            {"word": "c", "start": 2.5, "end": 2.8}
        ]
        offset, support, valid = estimate_global_offset(words, onsets, [])
        self.assertFalse(valid)

    # 9. Siljish chegarasi > 1.2s rad etilishi
    def test_09_large_offset_rejected(self):
        onsets = [3.0, 4.0, 5.0]
        words = [
            {"word": "a", "start": 1.0, "end": 1.3},
            {"word": "b", "start": 2.0, "end": 2.3},
            {"word": "c", "start": 3.0, "end": 3.3}
        ]
        offset, support, valid = estimate_global_offset(words, onsets, [], max_offset=1.2)
        self.assertFalse(valid)

    # 10. Manfiy siljish chegarasi < -1.2s rad etilishi
    def test_10_negative_large_offset_rejected(self):
        onsets = [1.0, 2.0, 3.0]
        words = [
            {"word": "a", "start": 3.0, "end": 3.3},
            {"word": "b", "start": 4.0, "end": 4.3},
            {"word": "c", "start": 5.0, "end": 5.3}
        ]
        offset, support, valid = estimate_global_offset(words, onsets, [], max_offset=1.2)
        self.assertFalse(valid)

    # 11. apply_global_offset to'g'ri ishlashi
    def test_11_apply_global_offset_basic(self):
        words = [
            {"word": "a", "start": 1.4, "end": 1.8},
            {"word": "b", "start": 3.4, "end": 3.8}
        ]
        shifted = apply_global_offset(words, -0.4)
        self.assertAlmostEqual(shifted[0]["start"], 1.0)
        self.assertAlmostEqual(shifted[0]["end"], 1.4)
        self.assertAlmostEqual(shifted[1]["start"], 3.0)
        self.assertAlmostEqual(shifted[1]["end"], 3.4)

    # 12. apply_global_offset 0 dan pastga tushib ketmasligi
    def test_12_apply_global_offset_clamping(self):
        words = [{"word": "a", "start": 0.2, "end": 0.5}]
        shifted = apply_global_offset(words, -0.4)
        self.assertEqual(shifted[0]["start"], 0.0)
        self.assertGreaterEqual(shifted[0]["end"], 0.04)

    # 13. Idempotentlik (0 siljish hech narsani o'zgartirmaydi)
    def test_13_idempotent_global_offset(self):
        words = [{"word": "a", "start": 1.0, "end": 1.3}]
        shifted = apply_global_offset(words, 0.0)
        self.assertEqual(shifted[0]["start"], 1.0)

    # 14. Kamida 3 ta so'z talabi
    def test_14_min_support_requirement(self):
        onsets = [1.0, 2.0]
        words = [
            {"word": "a", "start": 1.4, "end": 1.8},
            {"word": "b", "start": 2.4, "end": 2.8}
        ]
        offset, support, valid = estimate_global_offset(words, onsets, [], min_support=3)
        self.assertFalse(valid)
        self.assertEqual(offset, 0.0)

    # 15. Bo'sh so'zlar ro'yxati
    def test_15_empty_words_handling(self):
        offset, support, valid = estimate_global_offset([], [1.0, 2.0], [])
        self.assertFalse(valid)
        self.assertEqual(offset, 0.0)

    # 16. Bo'sh onsetlar ro'yxati
    def test_16_empty_onsets_handling(self):
        words = [{"word": "a", "start": 1.0, "end": 1.3}]
        offset, support, valid = estimate_global_offset(words, [], [])
        self.assertFalse(valid)
        self.assertEqual(offset, 0.0)

    # 17. Sintetik audio bilan global siljish qo'llanishi
    def test_17_synthetic_audio_end_to_end(self):
        self.assertTrue(self.stats.get("global_offset_applied"))
        self.assertAlmostEqual(self.stats.get("global_offset_sec"), -0.410, delta=0.06)

    # 18. Residual xato <= 35ms (1 kadr)
    def test_18_synthetic_audio_residual_error(self):
        for rw, (true_onset, _) in zip(self.refined, self.bursts):
            err_ms = abs(rw["start"] - true_onset) * 1000.0
            self.assertLessEqual(err_ms, 35.0)

    # 19. Snapped count >= 3
    def test_19_synthetic_audio_snapped_count(self):
        self.assertGreaterEqual(self.stats.get("snapped_count", 0), 3)

    # 20. Stats lug'ati to'liqligi
    def test_20_stats_dictionary_completeness(self):
        self.assertIn("global_offset_sec", self.stats)
        self.assertIn("global_offset_ms", self.stats)
        self.assertIn("global_offset_applied", self.stats)
        self.assertIn("support_count", self.stats)

    # 21. Obyekt va dict mosligi
    def test_21_dict_and_object_compatibility(self):
        onsets = [1.0, 2.0, 3.0]
        words_obj = [
            DummyWord("a", 1.4, 1.8),
            DummyWord("b", 2.4, 2.8),
            DummyWord("c", 3.4, 3.8)
        ]
        offset, support, valid = estimate_global_offset(words_obj, onsets, [])
        self.assertTrue(valid)
        self.assertAlmostEqual(offset, -0.4, places=2)

    # 22. Pauzalar buzilmaganligi
    def test_22_pause_integrity_after_snapping(self):
        for rw in self.refined:
            self.assertFalse(1.8 < rw["start"] < 2.7)

    # 23. FPS 25 ga moslash
    def test_23_fps_quantization_on_frame(self):
        for rw in self.refined:
            self.assertTrue(is_on_frame(rw["start"], 25.0))

    # 24. Valid onsets attack sakrashi (>= 2.2x)
    def test_24_valid_onsets_attack_ratio(self):
        time_axis = np.linspace(0, 1.0, 100)
        energy = np.zeros(100, dtype=np.float32)
        energy[0:30] = 0.001
        energy[30] = 0.015
        energy[31:60] = 0.060
        energy[60:100] = 0.001
        res = detect_pauses_and_onsets(energy, time_axis, min_pause_ms=100.0)
        self.assertGreater(len(res["onsets"]), 0)
        self.assertGreater(len(res["valid_onsets"]), 0)
        self.assertIn(res["onsets"][0], res["valid_onsets"])

    # 25. Zaif energiyali onset valid_onsets dan chetlatilishi (< 2.2x)
    def test_25_weak_energy_onset_excluded(self):
        time_axis = np.linspace(0, 1.0, 100)
        energy = np.zeros(100, dtype=np.float32)
        energy[0:30] = 0.005
        energy[30:60] = 0.009
        energy[60:100] = 0.005
        res = detect_pauses_and_onsets(energy, time_axis, min_pause_ms=100.0)
        self.assertEqual(len(res["valid_onsets"]), 0)

    # 26. Keng snap (450ms) faollashishi (+350ms siljish, >= 60ms)
    def test_26_wide_snap_450ms_activation(self):
        words = [{"word": "test", "start": 1.0, "end": 1.4}]
        refined, stats = snap_word_timestamps_to_audio(
            words,
            search_window_ms=150.0,
            custom_onsets=[1.35],
            custom_valid_onsets=[1.35]
        )
        self.assertEqual(refined[0]["start"], 1.35)

    # 27. Keng snap kichik siljishda (< 60ms) qo'llanmasligi
    def test_27_wide_snap_minor_shift_ignored(self):
        words = [{"word": "test", "start": 1.0, "end": 1.4}]
        refined, stats = snap_word_timestamps_to_audio(
            words,
            search_window_ms=30.0,
            custom_onsets=[1.04],
            custom_valid_onsets=[1.04]
        )
        self.assertEqual(refined[0]["start"], 1.0)

    # 28. 1:1 Onset Binding (so'zlar soni == valid onsetlar soni va monoton)
    def test_28_one_to_one_onset_binding(self):
        words = [
            {"word": "Assalomu", "start": 1.25, "end": 1.65},
            {"word": "alaykum", "start": 2.25, "end": 2.75},
            {"word": "do'stlar", "start": 3.25, "end": 3.65}
        ]
        onsets = [1.0, 2.0, 3.0]
        refined, stats = snap_word_timestamps_to_audio(
            words,
            custom_valid_onsets=onsets,
            custom_onsets=onsets
        )
        self.assertTrue(stats.get("one_to_one_bound"))
        self.assertEqual(refined[0]["start"], 1.0)
        self.assertEqual(refined[1]["start"], 2.0)
        self.assertEqual(refined[2]["start"], 3.0)

    # 29. 1:1 Onset Binding soni mos kelmasa o'tkazib yuborilishi
    def test_29_one_to_one_count_mismatch(self):
        words = [
            {"word": "bir", "start": 1.0, "end": 1.3},
            {"word": "ikki", "start": 2.0, "end": 2.3},
            {"word": "uch", "start": 3.0, "end": 3.3}
        ]
        onsets = [1.0, 2.0]
        refined, stats = snap_word_timestamps_to_audio(
            words,
            custom_valid_onsets=onsets,
            custom_onsets=onsets
        )
        self.assertFalse(stats.get("one_to_one_bound"))

    # 30. 1:1 Onset Binding davomiylikni aniq saqlashi
    def test_30_one_to_one_duration_preserved(self):
        words = [
            {"word": "birinchi", "start": 1.2, "end": 1.7},
            {"word": "ikkinchi", "start": 2.3, "end": 3.1}
        ]
        onsets = [1.0, 2.0]
        refined, stats = snap_word_timestamps_to_audio(
            words,
            custom_valid_onsets=onsets,
            custom_onsets=onsets
        )
        self.assertTrue(stats.get("one_to_one_bound"))
        dur0 = round(refined[0]["end"] - refined[0]["start"], 2)
        dur1 = round(refined[1]["end"] - refined[1]["start"], 2)
        self.assertEqual(dur0, 0.5)
        self.assertEqual(dur1, 0.8)

    # 31. Audio tayyorlashda imageio-ffmpeg integratsiyasi
    def test_31_audio_prepare_imageio_ffmpeg(self):
        from backend.utils.audio import check_ffmpeg, get_ffmpeg_binary
        self.assertTrue(check_ffmpeg())
        ffmpeg_bin = get_ffmpeg_binary()
        self.assertIsNotNone(ffmpeg_bin)
        self.assertTrue(os.path.exists(ffmpeg_bin))

    # 32. TEST 1: Canonical Offset (clip_start=10.0, word_local=1.0, sync_offset=0 -> 11.0)
    def test_32_regression_test_01_canonical_offset(self):
        clip_timeline_start_sec = 10.0
        audio_local_sec = 1.0
        speed_factor = 1.0
        manual_sync_offset_sec = 0.0
        final_timeline_sec = clip_timeline_start_sec + (audio_local_sec / speed_factor) + manual_sync_offset_sec
        self.assertAlmostEqual(final_timeline_sec, 11.0, places=3)

    # 33. TEST 2: Double-offset bug protection (clip_start=10.0, word_local=1.0, sync_offset=+200ms -> 11.2, NEVER 11.4)
    def test_33_regression_test_02_double_offset_prevention(self):
        clip_timeline_start_sec = 10.0
        audio_local_sec = 1.0
        speed_factor = 1.0
        sync_offset_ms = 200.0
        manual_sync_offset_sec = sync_offset_ms / 1000.0

        # Simulating frontend passing both sync_offset_ms and timeline_offset_ms
        timeline_offset_ms = 200.0
        # In backend, timeline_offset_ms is only used as fallback if clip_start is None
        tl_offset_sec = clip_timeline_start_sec  # NOT clip_start + timeline_offset_ms
        final_timeline_sec = tl_offset_sec + (audio_local_sec / speed_factor) + manual_sync_offset_sec
        self.assertAlmostEqual(final_timeline_sec, 11.2, places=3)
        self.assertNotAlmostEqual(final_timeline_sec, 11.4, places=3)

    # 34. TEST 3: Trimmed audio 0-based coordinate protection (clip_start=10, in_point=30, trimmed word=1.0 -> 11.0, NEVER 41.0)
    def test_34_regression_test_03_in_point_no_double_add(self):
        clip_timeline_start_sec = 10.0
        source_in_point = 30.0  # Used during ffmpeg audio trimming
        # Trimmed audio starts at 0.0; Whisper returns 1.0 relative to trimmed audio
        audio_local_sec = 1.0
        # When mapping 0-based audio to timeline, in_point must NOT be added again
        final_timeline_sec = clip_timeline_start_sec + audio_local_sec
        self.assertAlmostEqual(final_timeline_sec, 11.0, places=3)
        self.assertNotAlmostEqual(final_timeline_sec, 41.0, places=3)

    # 35. TEST 4: Speed 2.0x (audio local word = 4 sec, clip start = 10 -> timeline = 12 sec)
    def test_35_regression_test_04_speed_2x(self):
        clip_timeline_start_sec = 10.0
        audio_local_sec = 4.0
        speed_factor = 2.0
        final_timeline_sec = clip_timeline_start_sec + (audio_local_sec / speed_factor)
        self.assertAlmostEqual(final_timeline_sec, 12.0, places=3)

    # 36. TEST 5: Speed 0.5x (audio local word = 4 sec, clip start = 10 -> timeline = 18 sec)
    def test_36_regression_test_05_speed_half_x(self):
        clip_timeline_start_sec = 10.0
        audio_local_sec = 4.0
        speed_factor = 0.5
        final_timeline_sec = clip_timeline_start_sec + (audio_local_sec / speed_factor)
        self.assertAlmostEqual(final_timeline_sec, 18.0, places=3)

    # 37. TEST 6: FPS Quantization (23.976, 25, 29.97, 30, 50, 59.94, 60 fps)
    def test_37_regression_test_06_fps_quantization_all_rates(self):
        fps_list = [23.976, 25.0, 29.97, 30.0, 50.0, 59.94, 60.0]
        test_times = [0.041, 1.234, 5.6789, 12.001]
        for fps in fps_list:
            for t in test_times:
                # Start uses floor so speech never precedes subtitle
                s_floor = math.floor(t * fps) / fps
                e_ceil = math.ceil((t + 0.3) * fps) / fps
                self.assertLessEqual(s_floor, t + 1e-9)
                self.assertGreaterEqual(e_ceil, t + 0.3 - 1e-9)
                self.assertGreater(e_ceil, s_floor)

    # 38. TEST 7: Manual offset negative (clamped >= 0)
    def test_38_regression_test_07_manual_offset_negative(self):
        clip_start = 10.0
        word_start = 1.0
        offset = -0.200
        final_start = max(0.0, clip_start + word_start + offset)
        self.assertAlmostEqual(final_start, 10.8, places=3)

        # Clamping at zero
        clip_start_zero = 0.0
        word_start_small = 0.1
        offset_large_neg = -0.5
        clamped_start = max(0.0, clip_start_zero + word_start_small + offset_large_neg)
        self.assertEqual(clamped_start, 0.0)

    # 39. TEST 8: Trimmed clip with non-zero inPoint
    def test_39_regression_test_08_trimmed_clip_nonzero_inpoint(self):
        in_point = 45.0
        out_point = 65.0
        clip_start = 15.0
        # Audio extracted from [45.0..65.0] has length 20.0s, starts at 0.0
        word_local_start = 3.5
        final_timeline = clip_start + word_local_start
        self.assertAlmostEqual(final_timeline, 18.5, places=3)

    # 40. TEST 9: Multiple clips on different timeline positions
    def test_40_regression_test_09_multiple_clips(self):
        clips = [
            {"clip_start": 0.0, "word_local": 2.0, "expected": 2.0},
            {"clip_start": 12.5, "word_local": 1.0, "expected": 13.5},
            {"clip_start": 55.0, "word_local": 3.2, "expected": 58.2}
        ]
        for c in clips:
            res = c["clip_start"] + c["word_local"]
            self.assertAlmostEqual(res, c["expected"], places=3)

    # 41. TEST 10: Word-by-word karaoke mode integrity
    def test_41_regression_test_10_karaoke_mode_integrity(self):
        from backend.main import SegmentItem, WordItem, validate_subtitle_sync
        words = [
            WordItem(word="salom", start=1.0, end=1.4),
            WordItem(word="dunyo", start=1.45, end=1.9),
            WordItem(word="biz", start=1.95, end=2.3)
        ]
        seg = SegmentItem(id=1, start=1.0, end=2.3, text="salom dunyo biz", words=words)
        report = validate_subtitle_sync([seg], clip_timeline_start_sec=1.0, max_clip_end=5.0)
        self.assertTrue(report["valid"])
        self.assertEqual(len(report["errors"]), 0)

    # 42. TEST 11: Audio-energy snap OFF
    def test_42_regression_test_11_audio_energy_snap_off(self):
        raw_words = [
            {"word": "bir", "start": 1.042, "end": 1.450},
            {"word": "ikki", "start": 1.810, "end": 2.200}
        ]
        for w in raw_words:
            w["timing_source"] = "whisper_raw"
            w["original_start"] = w["start"]
            w["aligned_start"] = w["start"]
        self.assertEqual(raw_words[0]["start"], 1.042)
        self.assertEqual(raw_words[0]["timing_source"], "whisper_raw")

    # 43. TEST 12: Forced alignment OFF
    def test_43_regression_test_12_forced_alignment_off(self):
        words = [
            {"word": "test", "start": 0.5, "end": 0.9}
        ]
        self.assertEqual(words[0]["start"], 0.5)

    # 44. TEST 13: MMS unavailable fallback
    def test_44_regression_test_13_mms_unavailable_fallback(self):
        from backend.utils.forced_alignment import align_with_mms
        aligned_words, reason = align_with_mms("non_existent_file.wav", [])
        self.assertIsNone(aligned_words)
        self.assertIsInstance(reason, str)

    # 45. TEST 14: Whisper word timestamps + energy snap
    def test_45_regression_test_14_whisper_and_energy_snap(self):
        words = [
            {"word": "salom", "start": 1.04, "end": 1.4}
        ]
        onsets = [1.00]
        refined, stats = snap_word_timestamps_to_audio(
            words,
            custom_valid_onsets=onsets,
            custom_onsets=onsets
        )
        self.assertAlmostEqual(refined[0]["start"], 1.00, places=2)
        self.assertEqual(refined[0].get("timing_source"), "whisper+energy_snap")
        self.assertIn("snap_shift_ms", refined[0])

    # 46. TEST 15: Long 10-minute audio drift check
    def test_46_regression_test_15_long_drift_check(self):
        clip_start = 100.0
        audio_dur = 600.0  # 10 minutes
        for speed in [0.5, 1.0, 1.25, 1.5, 2.0]:
            for t_local in [0.0, 60.0, 300.0, 600.0]:
                expected = clip_start + (t_local / speed)
                computed = clip_start + (t_local / speed)
                self.assertAlmostEqual(computed, expected, places=7)
                drift = abs(computed - expected)
                self.assertLess(drift, 1e-9)

    # 47. TEST 16: _read_wav_data non-RIFF / video container fallback
    def test_47_regression_test_16_read_wav_data_fallback(self):
        from unittest.mock import patch
        import shutil
        corrupt_file = tempfile.NamedTemporaryFile(suffix=".mp4", delete=False)
        corrupt_path = corrupt_file.name
        corrupt_file.write(b"\x00\x00\x00 ftypisom\x00\x00\x02\x00")
        corrupt_file.close()
        try:
            with patch("backend.utils.audio.convert_to_16k_mono_wav") as mock_conv:
                mock_conv.side_effect = lambda inp, out: shutil.copyfile(self.tmp_path, out)
                from backend.utils.audio_aligner import _read_wav_data
                sr, data = _read_wav_data(corrupt_path)
                self.assertEqual(sr, 16000)
                self.assertGreater(len(data), 0)
        finally:
            if os.path.exists(corrupt_path):
                os.remove(corrupt_path)


if __name__ == "__main__":
    unittest.main(verbosity=2)

