"""
tests/test_audio_align.py - Global ASR Lag & Audio Alignment Tests (Suite 11)
23 ta qat'iy tekshiruv:
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


if __name__ == "__main__":
    unittest.main(verbosity=2)
