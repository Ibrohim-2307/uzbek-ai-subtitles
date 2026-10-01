"""
tests/test_timing_aligner.py - Timing Aligner va Audiodan Vaqt O'lchash Testlari (Suite 12)
33 ta qat'iy tekshiruv:
1. WAV mono 16k o'qish (PyAV/ffmpeg'siz)
2. Fonetik o'xshashlik (Levenshtein, Uzbek o'ziga xosliklari, Whisper xatolarini yengish)
3. Matnni saqlagan holda vaqtlarni tekislash (DP Needleman-Wunsch)
4. Interpolyatsiya, monotonlik, minimal davomiylik va regressiya himoyasi
"""

import os
import sys
import unittest
import tempfile
import numpy as np
from pathlib import Path
from unittest.mock import patch

ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from backend.utils.timing_aligner import (
    read_wav_mono16k,
    normalize_phonetic,
    levenshtein_distance,
    phonetic_similarity,
    align_words_to_timed_words,
    measure_and_align_words,
    check_timing_engine_status
)


class DummyWord:
    def __init__(self, word, start, end, confidence=1.0):
        self.word = word
        self.start = start
        self.end = end
        self.confidence = confidence


class TestTimingAligner(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # 16kHz test WAV fayli yaratamiz
        cls.temp_dir = tempfile.mkdtemp(prefix="test_timing_align_")
        cls.wav_path = os.path.join(cls.temp_dir, "test_16k.wav")
        import wave
        with wave.open(cls.wav_path, "wb") as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)
            wf.setframerate(16000)
            # 1 soniya sukut
            samples = np.zeros(16000, dtype=np.int16)
            wf.writeframes(samples.tobytes())

    # 1. WAV mono 16k o'qish
    def test_01_read_wav_mono16k_valid(self):
        sr, data = read_wav_mono16k(self.wav_path)
        self.assertEqual(sr, 16000)
        self.assertEqual(len(data), 16000)
        self.assertEqual(data.dtype, np.float32)

    # 2. Mavjud bo'lmagan fayl
    def test_02_read_wav_mono16k_missing_file(self):
        with self.assertRaises(FileNotFoundError):
            read_wav_mono16k(os.path.join(self.temp_dir, "nonexistent.wav"))

    # 3. Levenshtein bir xil satrlar
    def test_03_levenshtein_distance_identical(self):
        self.assertEqual(levenshtein_distance("assalomu", "assalomu"), 0)

    # 4. Levenshtein bo'sh satr
    def test_04_levenshtein_distance_empty(self):
        self.assertEqual(levenshtein_distance("salom", ""), 5)
        self.assertEqual(levenshtein_distance("", "dunyo"), 5)

    # 5. Levenshtein almashtirishlar
    def test_05_levenshtein_distance_substitutions(self):
        self.assertEqual(levenshtein_distance("kitob", "katob"), 1)
        self.assertEqual(levenshtein_distance("salom", "salomlar"), 3)

    # 6. Fonetik normallashtirish
    def test_06_normalize_phonetic_uzbek_letters(self):
        self.assertEqual(normalize_phonetic("oʻzbek"), "ozbek")
        self.assertEqual(normalize_phonetic("gʻalaba"), "galaba")
        self.assertEqual(normalize_phonetic("xabar"), "habar")
        self.assertEqual(normalize_phonetic("qalam"), "kalam")

    # 7. Fonetik o'xshashlik bir xil so'z
    def test_07_phonetic_similarity_identical(self):
        self.assertEqual(phonetic_similarity("Assalomu", "assalomu"), 1.0)

    # 8. Katta-kichik harf va tinish belgilari
    def test_08_phonetic_similarity_case_and_punct(self):
        self.assertEqual(phonetic_similarity("Bugun,", "bugun!"), 1.0)

    # 9. Whisper "Khazurgir" vs "hozirgi" >= 0.68
    def test_09_phonetic_similarity_khazurgir_hozirgi(self):
        sim = phonetic_similarity("Khazurgir", "hozirgi")
        self.assertGreaterEqual(sim, 0.68)

    # 10. Butunlay boshqa so'zlar < 0.4
    def test_10_phonetic_similarity_completely_different(self):
        sim = phonetic_similarity("maktab", "avtomobil")
        self.assertLess(sim, 0.4)

    # 11. Bo'sh provayder so'zlari
    def test_11_align_words_empty_provider(self):
        res = align_words_to_timed_words([], [{"word": "a", "start": 0.1, "end": 0.4}])
        self.assertEqual(res, [])

    # 12. Bo'sh timed so'zlari (provayder o'z vaqtlarida qoladi)
    def test_12_align_words_empty_timed(self):
        p = [{"word": "salom", "start": 1.0, "end": 1.4}]
        res = align_words_to_timed_words(p, [])
        self.assertEqual(len(res), 1)
        self.assertEqual(res[0]["start"], 1.0)

    # 13. Aniq 1:1 mos kelish
    def test_13_align_words_exact_match(self):
        p = [
            {"word": "Assalomu", "start": 1.4, "end": 1.8},
            {"word": "alaykum", "start": 3.4, "end": 3.8}
        ]
        t = [
            {"word": "assalomu", "start": 1.0, "end": 1.3},
            {"word": "alaykum", "start": 3.0, "end": 3.3}
        ]
        res = align_words_to_timed_words(p, t)
        self.assertEqual(len(res), 2)
        self.assertEqual(res[0]["start"], 1.0)
        self.assertEqual(res[1]["start"], 3.0)

    # 14. Provayder matni 100% saqlanishi (Whisper xatosi inobatga olinmaydi)
    def test_14_align_words_preserves_provider_text(self):
        p = [{"word": "hozirgi", "start": 1.0, "end": 1.5}]
        t = [{"word": "Khazurgir", "start": 0.8, "end": 1.2}]
        res = align_words_to_timed_words(p, t)
        self.assertEqual(res[0]["word"], "hozirgi")
        self.assertEqual(res[0]["start"], 0.8)

    # 15. Monotonlik kafolati
    def test_15_align_words_monotonic_timestamps(self):
        p = [
            {"word": "bir", "start": 1.0, "end": 1.3},
            {"word": "ikki", "start": 2.0, "end": 2.3},
            {"word": "uch", "start": 3.0, "end": 3.3}
        ]
        t = [
            {"word": "bir", "start": 1.2, "end": 1.5},
            {"word": "ikki", "start": 2.2, "end": 2.5},
            {"word": "uch", "start": 3.2, "end": 3.5}
        ]
        res = align_words_to_timed_words(p, t)
        for i in range(len(res) - 1):
            self.assertLessEqual(res[i]["start"], res[i + 1]["start"])

    # 16. Teskari vaqtlar yo'qligi (start <= end)
    def test_16_align_words_no_inverted_durations(self):
        p = [{"word": "a", "start": 1.0, "end": 1.2}]
        t = [{"word": "a", "start": 2.0, "end": 2.0}]
        res = align_words_to_timed_words(p, t)
        self.assertLess(res[0]["start"], res[0]["end"])

    # 17. Minimal davomiylik (>= 0.08s)
    def test_17_align_words_min_duration_enforced(self):
        p = [{"word": "ha", "start": 1.0, "end": 1.01}]
        t = [{"word": "ha", "start": 1.0, "end": 1.02}]
        res = align_words_to_timed_words(p, t)
        self.assertGreaterEqual(res[0]["end"] - res[0]["start"], 0.08)

    # 18. O'rtadagi tushib qolgan so'z interpolyatsiyasi
    def test_18_align_words_with_dropped_middle_word(self):
        p = [
            {"word": "bir", "start": 1.0, "end": 1.3},
            {"word": "va", "start": 1.4, "end": 1.6},
            {"word": "ikki", "start": 2.0, "end": 2.3}
        ]
        t = [
            {"word": "bir", "start": 1.0, "end": 1.2},
            {"word": "ikki", "start": 3.0, "end": 3.2}
        ]
        res = align_words_to_timed_words(p, t)
        self.assertEqual(len(res), 3)
        self.assertEqual(res[0]["start"], 1.0)
        self.assertEqual(res[2]["start"], 3.0)
        # "va" so'zi 1.2 va 3.0 orasida bo'lishi kerak
        self.assertGreaterEqual(res[1]["start"], 1.2)
        self.assertLessEqual(res[1]["end"], 3.0)

    # 19. Whisper qo'shimcha so'z aytganda provayder so'zlari buzilmasligi
    def test_19_align_words_with_extra_whisper_word(self):
        p = [{"word": "faqat", "start": 1.0, "end": 1.4}]
        t = [
            {"word": "ee", "start": 0.5, "end": 0.8},
            {"word": "faqat", "start": 1.0, "end": 1.3}
        ]
        res = align_words_to_timed_words(p, t)
        self.assertEqual(len(res), 1)
        self.assertEqual(res[0]["word"], "faqat")
        self.assertEqual(res[0]["start"], 1.0)

    # 20. Fonetik o'xshashlik orqali tekislanish
    def test_20_align_words_with_whisper_spelling_variation(self):
        p = [{"word": "hozirgi", "start": 5.0, "end": 5.5}]
        t = [{"word": "khazurgir", "start": 4.8, "end": 5.2}]
        res = align_words_to_timed_words(p, t)
        self.assertEqual(res[0]["start"], 4.8)

    # 21. Metadata va ishonch saqlanishi
    def test_21_align_words_confidence_metadata_preserved(self):
        p = [{"word": "sinov", "start": 1.0, "end": 1.3, "confidence": 0.95, "pause_after_ms": 120.0}]
        t = [{"word": "sinov", "start": 1.1, "end": 1.4, "confidence": 0.98}]
        res = align_words_to_timed_words(p, t)
        self.assertEqual(res[0]["pause_after_ms"], 120.0)
        self.assertGreaterEqual(res[0]["confidence"], 0.95)

    # 22. Birinchi so'z mos kelmasa ekstrapolyatsiya
    def test_22_align_words_first_word_unmatched(self):
        p = [
            {"word": "nomaʼlum", "start": 0.5, "end": 0.8},
            {"word": "kitob", "start": 2.0, "end": 2.4}
        ]
        t = [{"word": "kitob", "start": 2.2, "end": 2.6}]
        res = align_words_to_timed_words(p, t)
        self.assertEqual(len(res), 2)
        self.assertEqual(res[1]["start"], 2.2)
        self.assertLess(res[0]["start"], res[1]["start"])

    # 23. Oxirgi so'z mos kelmasa ekstrapolyatsiya
    def test_23_align_words_last_word_unmatched(self):
        p = [
            {"word": "kitob", "start": 1.0, "end": 1.4},
            {"word": "tugadi", "start": 2.0, "end": 2.3}
        ]
        t = [{"word": "kitob", "start": 1.2, "end": 1.5}]
        res = align_words_to_timed_words(p, t)
        self.assertEqual(len(res), 2)
        self.assertEqual(res[0]["start"], 1.2)
        self.assertGreaterEqual(res[1]["start"], res[0]["end"])

    # 24. WAV yo'q bo'lsa xavfsiz fallback
    def test_24_measure_and_align_words_missing_wav(self):
        words = [{"word": "test", "start": 1.0, "end": 1.5}]
        res, stats, ok = measure_and_align_words("missing.wav", words)
        self.assertFalse(ok)
        self.assertEqual(len(res), 1)
        self.assertEqual(stats["engine"], "provider_estimate")

    # 25. Bo'sh so'zlar ro'yxatida fallback
    def test_25_measure_and_align_words_empty_words(self):
        res, stats, ok = measure_and_align_words(self.wav_path, [])
        self.assertFalse(ok)
        self.assertEqual(res, [])

    # 26. Timing engine status tekshiruvi
    def test_26_check_timing_engine_status_structure(self):
        st = check_timing_engine_status()
        self.assertIn("faster_whisper_available", st)
        self.assertIn("mms_fa_available", st)
        self.assertIn("recommended_engine", st)
        self.assertIn("timing_accuracy", st)

    # 27. Kirill o'zbekcha fonetika
    def test_27_cyrillic_phonetic_normalization(self):
        self.assertEqual(normalize_phonetic("ўзбек"), "ozbek")
        self.assertEqual(normalize_phonetic("ҳаёт"), "hayot")

    # 28. Takrorlangan unlilar (cho'zish) qisqarishi
    def test_28_repeated_vowel_normalization(self):
        self.assertEqual(normalize_phonetic("haaaaa"), "ha")
        self.assertEqual(normalize_phonetic("keeeeldik"), "keldik")

    # 29. Katta matn (50 ta so'z) tezkor ishlashi
    def test_29_long_sequence_performance(self):
        p = [{"word": f"soz_{i}", "start": i * 0.5, "end": i * 0.5 + 0.3} for i in range(50)]
        t = [{"word": f"soz_{i}", "start": i * 0.5 + 0.05, "end": i * 0.5 + 0.35} for i in range(50)]
        res = align_words_to_timed_words(p, t)
        self.assertEqual(len(res), 50)
        self.assertEqual(res[49]["start"], 49 * 0.5 + 0.05)

    # 30. DummyWord obyektlari bilan moslik
    def test_30_dict_and_object_input_compatibility(self):
        p = [DummyWord("salom", 1.0, 1.4)]
        t = [DummyWord("salom", 1.2, 1.6)]
        res = align_words_to_timed_words(p, t)
        self.assertEqual(res[0]["start"], 1.2)

    # 31. Mock qilingan transcribe bilan to'liq quvur
    @patch("backend.utils.timing_aligner.transcribe_words_local")
    def test_31_measure_and_align_mocked_transcribe(self, mock_trans):
        mock_trans.return_value = [
            {"word": "Assalomu", "start": 0.99, "end": 1.4},
            {"word": "bugun", "start": 2.99, "end": 3.4}
        ]
        p = [
            {"word": "Assalomu", "start": 1.4, "end": 1.8},
            {"word": "bugun", "start": 3.4, "end": 3.8}
        ]
        res, stats, ok = measure_and_align_words(self.wav_path, p)
        self.assertTrue(ok)
        self.assertEqual(stats["matched_count"], 2)
        self.assertEqual(res[0]["start"], 0.99)
        self.assertEqual(res[1]["start"], 2.99)

    # 32. Gap penalty noto'g'ri birikishni oldini oladi
    def test_32_gap_penalty_prevents_misalignment(self):
        p = [{"word": "olma", "start": 1.0, "end": 1.4}]
        t = [{"word": "daftar", "start": 1.0, "end": 1.4}]
        res = align_words_to_timed_words(p, t)
        # Turli so'zlar bo'lgani uchun o'z vaqtida qoladi
        self.assertEqual(res[0]["start"], 1.0)
        self.assertFalse(res[0]["measured"])

    # 33. Measured bayrog'i to'g'ri qo'yilishi
    def test_33_measured_flag_tracking(self):
        p = [
            {"word": "aniq", "start": 1.0, "end": 1.4},
            {"word": "mavhum", "start": 2.0, "end": 2.4}
        ]
        t = [{"word": "aniq", "start": 1.1, "end": 1.4}]
        res = align_words_to_timed_words(p, t)
        self.assertTrue(res[0]["measured"])
        self.assertFalse(res[1]["measured"])


if __name__ == "__main__":
    unittest.main(verbosity=2)
