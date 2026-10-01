"""
O'zbekcha AI Subtitr - Python NLP Moduli Testlari (tests/test_uzbek_nlp.py)
Talab: 83+ test holatini qamrab olish
"""

import sys
import unittest
from pathlib import Path

# Loyiha ildiz papkasini sys.path ga qo'shish
ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from backend.utils.uzbek_nlp import (
    APOS_OFFICIAL_OG, APOS_OFFICIAL_AYN,
    fix_og, fix_ayn, fix_og_words, fix_ayn_words,
    normalize_uzbek_text, normalize_to_style,
    kirill_to_lotin, lotin_to_kirill,
    number_to_uzbek_words, replace_numbers_with_words,
    split_into_lines, split_long_segment,
    snap_to_frame, is_on_frame,
    format_srt_time, format_frame_time, parse_timecode,
    chunk_words_by_pause
)


class TestUzbekNLP(unittest.TestCase):

    # ==================== 1. BELGILAR STANDARTI (Oʻ va Gʻ) ====================
    def test_01_fix_og_basic(self):
        self.assertEqual(fix_og("o'zbek"), "oʻzbek")
        self.assertEqual(fix_og("o‘zbek"), "oʻzbek")
        self.assertEqual(fix_og("o`zbek"), "oʻzbek")
        self.assertEqual(fix_og("oʼzbek"), "oʻzbek")
        self.assertEqual(fix_og("oʻzbek"), "oʻzbek")

    def test_02_fix_og_uppercase(self):
        self.assertEqual(fix_og("O'zbekiston"), "Oʻzbekiston")
        self.assertEqual(fix_og("O‘zbekiston"), "Oʻzbekiston")
        self.assertEqual(fix_og("G'alla"), "Gʻalla")
        self.assertEqual(fix_og("G‘oz"), "Gʻoz")

    def test_03_fix_og_with_space(self):
        self.assertEqual(fix_og("o 'zbek"), "oʻzbek")
        self.assertEqual(fix_og("g 'alla"), "gʻalla")

    def test_04_fix_og_various_words(self):
        self.assertEqual(fix_og("to'g'ri"), "toʻgʻri")
        self.assertEqual(fix_og("bo'yicha"), "boʻyicha")
        self.assertEqual(fix_og("ko'p"), "koʻp")
        self.assertEqual(fix_og("yo'l"), "yoʻl")
        self.assertEqual(fix_og("yo'q"), "yoʻq")

    # ==================== 2. AYN BELGISI (TUTUQ) ====================
    def test_05_fix_ayn_basic(self):
        self.assertEqual(fix_ayn("ma'lumot"), "maʼlumot")
        self.assertEqual(fix_ayn("ma’lumot"), "maʼlumot")
        self.assertEqual(fix_ayn("ma`lumot"), "maʼlumot")
        self.assertEqual(fix_ayn("ma‘lumot"), "maʼlumot")

    def test_06_fix_ayn_words_list(self):
        self.assertEqual(fix_ayn("sun'iy"), "sunʼiy")
        self.assertEqual(fix_ayn("ta'lim"), "taʼlim")
        self.assertEqual(fix_ayn("san'at"), "sanʼat")
        self.assertEqual(fix_ayn("qat'iy"), "qatʼiy")
        self.assertEqual(fix_ayn("e'tibor"), "eʼtibor")
        self.assertEqual(fix_ayn("a'zo"), "aʼzo")
        self.assertEqual(fix_ayn("da'vo"), "daʼvo")
        self.assertEqual(fix_ayn("e'lon"), "eʼlon")
        self.assertEqual(fix_ayn("mu'jiza"), "muʼjiza")
        self.assertEqual(fix_ayn("ma'no"), "maʼno")
        self.assertEqual(fix_ayn("she'riyat"), "sheʼriyat")

    def test_07_not_ayn_exceptions(self):
        self.assertEqual(fix_ayn("don't stop"), "don't stop")
        self.assertEqual(fix_ayn("it's cool"), "it's cool")
        self.assertEqual(fix_ayn("let's go"), "let's go")
        self.assertEqual(fix_ayn("can't touch"), "can't touch")
        self.assertEqual(fix_ayn("i'm ready"), "i'm ready")

    # ==================== 3. AYN TIKLASH LUG'ATI ====================
    def test_08_restore_ayn_dropped(self):
        self.assertEqual(fix_ayn_words("malumot"), "maʼlumot")
        self.assertEqual(fix_ayn_words("suniy"), "sunʼiy")
        self.assertEqual(fix_ayn_words("talim"), "taʼlim")
        self.assertEqual(fix_ayn_words("sanat"), "sanʼat")
        self.assertEqual(fix_ayn_words("qatiy"), "qatʼiy")
        self.assertEqual(fix_ayn_words("etibor"), "eʼtibor")
        self.assertEqual(fix_ayn_words("azo"), "aʼzo")
        self.assertEqual(fix_ayn_words("davo"), "daʼvo")
        self.assertEqual(fix_ayn_words("elon"), "eʼlon")
        self.assertEqual(fix_ayn_words("mujiza"), "muʼjiza")
        self.assertEqual(fix_ayn_words("mano"), "maʼno")
        self.assertEqual(fix_ayn_words("maruza"), "maʼruza")
        self.assertEqual(fix_ayn_words("masul"), "masʼul")
        self.assertEqual(fix_ayn_words("juziy"), "juzʼiy")

    def test_09_restore_ayn_with_suffixes(self):
        self.assertEqual(fix_ayn_words("malumotlarimiz"), "maʼlumotlarimiz")
        self.assertEqual(fix_ayn_words("suniyning"), "sunʼiyning")
        self.assertEqual(fix_ayn_words("talimga"), "taʼlimga")
        self.assertEqual(fix_ayn_words("sanatda"), "sanʼatda")
        self.assertEqual(fix_ayn_words("elonlar"), "eʼlonlar")

    def test_10_dangerous_words_untouched(self):
        # alo, sher, os, ot, on kabi so'zlarga tegilmasligi shart
        self.assertEqual(fix_ayn_words("alo"), "alo")
        self.assertEqual(fix_ayn_words("sher"), "sher")
        self.assertEqual(fix_ayn_words("ot"), "ot")
        self.assertEqual(fix_ayn_words("on"), "on")

    # ==================== 4. Oʻ VA Gʻ SO'ZLARINI TIKLASH ====================
    def test_11_restore_og_dropped(self):
        self.assertEqual(fix_og_words("ozbek"), "oʻzbek")
        self.assertEqual(fix_og_words("ozbekiston"), "oʻzbekiston")
        self.assertEqual(fix_og_words("ozbekcha"), "oʻzbekcha")
        self.assertEqual(fix_og_words("togri"), "toʻgʻri")
        self.assertEqual(fix_og_words("togrilik"), "toʻgʻrilik")
        self.assertEqual(fix_og_words("yol"), "yoʻl")
        self.assertEqual(fix_og_words("yoq"), "yoʻq")
        self.assertEqual(fix_og_words("kop"), "koʻp")
        self.assertEqual(fix_og_words("kocha"), "koʻcha")
        self.assertEqual(fix_og_words("boyicha"), "boʻyicha")
        self.assertEqual(fix_og_words("organish"), "oʻrganish")
        self.assertEqual(fix_og_words("galla"), "gʻalla")
        self.assertEqual(fix_og_words("gisht"), "gʻisht")
        self.assertEqual(fix_og_words("goya"), "gʻoya")
        self.assertEqual(fix_og_words("osha"), "oʻsha")

    def test_12_og_exceptions_yolgon(self):
        # yolgon -> yolgʻon (yoʻlgʻon emas!)
        self.assertEqual(fix_og_words("yolgon"), "yolgʻon")
        self.assertEqual(fix_og_words("yolgonchi"), "yolgʻonchi")
        self.assertEqual(fix_og_words("yolgonchilik"), "yolgʻonchilik")

    def test_13_og_forbidden_stems(self):
        # oz, on, ot, ol, och ga tegilmasin
        self.assertEqual(fix_og_words("oz"), "oz")
        self.assertEqual(fix_og_words("on"), "on")
        self.assertEqual(fix_og_words("ot"), "ot")
        self.assertEqual(fix_og_words("ol"), "ol")
        self.assertEqual(fix_og_words("och"), "och")

    # ==================== 5. NORMALIZE_UZBEK_TEXT ====================
    def test_14_normalize_full_sentence(self):
        raw = "bugungi videoda ozbekistonda suniy intellekt haqida malumot"
        expected = "bugungi videoda oʻzbekistonda sunʼiy intellekt haqida maʼlumot"
        self.assertEqual(normalize_uzbek_text(raw), expected)

    def test_15_idempotent(self):
        t = "Bugungi videoda oʻzbekistonda sunʼiy intellekt haqida maʼlumot beramiz."
        self.assertEqual(normalize_uzbek_text(t), t)
        self.assertEqual(normalize_uzbek_text(normalize_uzbek_text(t)), t)

    def test_16_normalize_to_styles(self):
        text = "oʻzbek maʼlumot"
        self.assertEqual(normalize_to_style(text, "official"), "oʻzbek maʼlumot")
        self.assertEqual(normalize_to_style(text, "typographic"), "o‘zbek ma’lumot")
        self.assertEqual(normalize_to_style(text, "ascii"), "o'zbek ma'lumot")

    # ==================== 6. LOTIN <-> KIRILL ====================
    def test_17_yoq_to_cyrillic(self):
        self.assertEqual(lotin_to_kirill("Yoʻq"), "Йўқ")
        self.assertEqual(lotin_to_kirill("yoʻq"), "йўқ")
        self.assertEqual(lotin_to_kirill("YOʻQ"), "ЙЎҚ")
        self.assertEqual(kirill_to_lotin("Йўқ"), "Yoʻq")
        self.assertEqual(kirill_to_lotin("йўқ"), "yoʻq")

    def test_18_yol_to_cyrillic(self):
        self.assertEqual(lotin_to_kirill("Yoʻl"), "Йўл")
        self.assertEqual(kirill_to_lotin("Йўл"), "Yoʻl")

    def test_19_malumot_to_cyrillic(self):
        self.assertEqual(lotin_to_kirill("maʼlumot"), "маълумот")
        self.assertEqual(kirill_to_lotin("маълумот"), "maʼlumot")

    def test_20_roundtrip_words(self):
        words = [
            "Oʻzbekiston", "maʼlumot", "sunʼiy", "sanʼat",
            "toʻgʻri", "Eʼlon", "Yoʻq", "qatʼiy", "gazeta"
        ]
        for w in words:
            cyr = lotin_to_kirill(w)
            lat = kirill_to_lotin(cyr)
            self.assertEqual(lat, w, f"Failed roundtrip for {w}: {cyr} -> {lat}")

    # ==================== 7. RAQAMLAR (SONLAR) ====================
    def test_21_number_100_1000(self):
        self.assertEqual(replace_numbers_with_words("100"), "yuz")
        self.assertEqual(replace_numbers_with_words("1000"), "ming")
        self.assertEqual(replace_numbers_with_words("1000000"), "bir million")
        self.assertEqual(replace_numbers_with_words("1 000 000"), "bir million")
        self.assertEqual(replace_numbers_with_words("2000"), "ikki ming")
        self.assertEqual(replace_numbers_with_words("2026"), "ikki ming yigirma olti")

    def test_22_zero_and_negative(self):
        self.assertEqual(replace_numbers_with_words("0"), "nol")
        self.assertEqual(replace_numbers_with_words("-5"), "minus besh")

    def test_23_decimal_numbers(self):
        self.assertEqual(replace_numbers_with_words("3.5"), "uch butun oʻndan besh")
        self.assertEqual(replace_numbers_with_words("0.5"), "nol butun oʻndan besh")

    def test_24_protected_numbers(self):
        self.assertEqual(replace_numbers_with_words("soat 12:30 da"), "soat 12:30 da")
        self.assertEqual(replace_numbers_with_words("tel: 90-90-123"), "tel: 90-90-123")
        self.assertEqual(replace_numbers_with_words("versiya v1.5"), "versiya v1.5")
        self.assertEqual(replace_numbers_with_words("5-6 kishi"), "5-6 kishi")
        self.assertEqual(replace_numbers_with_words("50% chegirma"), "50% chegirma")

    # ==================== 8. SUBTITR SATRLARI ====================
    def test_25_split_lines_short(self):
        text = "Salom dunyo"
        lines = split_into_lines(text, max_chars=42, max_lines=2)
        self.assertEqual(lines, ["Salom dunyo"])

    def test_26_split_lines_balanced(self):
        text = "Bugungi darsimizda oʻzbekcha subtitrlarni oʻrganamiz"
        lines = split_into_lines(text, max_chars=42, max_lines=2)
        self.assertEqual(len(lines), 2)
        for l in lines:
            self.assertLessEqual(len(l), 42)

    def test_27_split_long_segment(self):
        text = "Bugun biz sunʼiy intellekt yordamida videolarga oʻzbekcha subtitr yaratishni oʻrganamiz"
        blocks = split_long_segment(text, max_chars=42, max_lines=2)
        self.assertGreater(len(blocks), 1)
        for b in blocks:
            b_lines = b.split("\n")
            self.assertLessEqual(len(b_lines), 2)
            for bl in b_lines:
                self.assertLessEqual(len(bl), 42)

    # ==================== 9. KADR ANIQ VAQTI ====================
    def test_28_snap_to_frame(self):
        self.assertEqual(snap_to_frame(3.214, 25.0), 3.2)
        self.assertEqual(snap_to_frame(0.038, 25.0), 0.04)
        self.assertTrue(is_on_frame(3.2, 25.0))
        self.assertFalse(is_on_frame(3.214, 25.0))

    def test_29_format_srt_time(self):
        self.assertEqual(format_srt_time(3.2), "00:00:03,200")
        self.assertEqual(format_srt_time(65.5), "00:01:05,500")

    def test_30_format_frame_time(self):
        self.assertEqual(format_frame_time(3.2, 25.0), "00:00:03:05")
        self.assertEqual(format_frame_time(0.0, 25.0), "00:00:00:00")

    def test_31_parse_timecode(self):
        self.assertEqual(parse_timecode("00:00:03:05", 25.0), 3.2)
        self.assertEqual(parse_timecode("00:00:03,200", 25.0), 3.2)
        self.assertEqual(parse_timecode("00:00:03.200", 25.0), 3.2)
        self.assertEqual(parse_timecode("03:20", 25.0), 200.0)
        self.assertEqual(parse_timecode("12.5", 25.0), 12.5)

    # ==================== 10. SO'ZLARNI BO'LAKLASH (PAUZA VA TINISH BELGISI) ====================
    def test_32_chunk_words_by_pause_basic(self):
        words = [
            {"word": "Salom", "start": 0.0, "end": 0.4},
            {"word": "doʻstlar", "start": 0.45, "end": 0.9},
            {"word": "bugun", "start": 1.4, "end": 1.8},
            {"word": "yangi", "start": 1.85, "end": 2.2},
            {"word": "dars", "start": 2.25, "end": 2.6}
        ]
        chunks = chunk_words_by_pause(words)
        self.assertEqual(len(chunks), 2)
        self.assertEqual([w["word"] for w in chunks[0]], ["Salom", "doʻstlar"])
        self.assertEqual([w["word"] for w in chunks[1]], ["bugun", "yangi", "dars"])

    def test_33_chunk_words_by_punctuation(self):
        words = [
            {"word": "Dars", "start": 0.0, "end": 0.3},
            {"word": "tugadi.", "start": 0.35, "end": 0.8},
            {"word": "Endi", "start": 0.85, "end": 1.1},
            {"word": "dam", "start": 1.15, "end": 1.4},
            {"word": "olamiz", "start": 1.45, "end": 1.8}
        ]
        chunks = chunk_words_by_pause(words)
        self.assertEqual(len(chunks), 2)
        self.assertEqual([w["word"] for w in chunks[0]], ["Dars", "tugadi."])
        self.assertEqual([w["word"] for w in chunks[1]], ["Endi", "dam", "olamiz"])

    def test_34_chunk_words_by_clause_punctuation(self):
        words = [
            {"word": "Birinchidan,", "start": 0.0, "end": 0.7},
            {"word": "biz", "start": 0.75, "end": 0.95},
            {"word": "rejani", "start": 1.0, "end": 1.4},
            {"word": "tuzdik", "start": 1.45, "end": 1.85}
        ]
        chunks = chunk_words_by_pause(words)
        self.assertEqual(len(chunks), 2)
        self.assertEqual([w["word"] for w in chunks[0]], ["Birinchidan,"])
        self.assertEqual([w["word"] for w in chunks[1]], ["biz", "rejani", "tuzdik"])

    def test_35_chunk_words_by_pause_threshold(self):
        words = [
            {"word": "Bu", "start": 0.0, "end": 0.2},
            {"word": "birinchi", "start": 0.25, "end": 0.7},
            {"word": "gap", "start": 0.75, "end": 1.0},
            {"word": "davomi", "start": 1.36, "end": 1.7},
            {"word": "boshlandi", "start": 1.75, "end": 2.1}
        ]
        chunks = chunk_words_by_pause(words, pause_threshold=0.35)
        self.assertEqual(len(chunks), 2)
        self.assertEqual([w["word"] for w in chunks[0]], ["Bu", "birinchi", "gap"])
        self.assertEqual([w["word"] for w in chunks[1]], ["davomi", "boshlandi"])

    def test_36_chunk_words_forced_max_words(self):
        words = [{"word": f"soʻz{i}", "start": float(i) * 0.2, "end": float(i) * 0.2 + 0.18} for i in range(12)]
        chunks = chunk_words_by_pause(words, max_words=7)
        self.assertGreater(len(chunks), 1)
        for c in chunks:
            self.assertLessEqual(len(c), 7)

    def test_37_chunk_words_forced_max_chars(self):
        words = [
            {"word": "juda_uzun_soʻz_1_bir_ikki", "start": 0.0, "end": 0.5},
            {"word": "juda_uzun_soʻz_2_uch_tort", "start": 0.55, "end": 1.0},
            {"word": "juda_uzun_soʻz_3_besh_olti", "start": 1.05, "end": 1.5}
        ]
        chunks = chunk_words_by_pause(words, max_chars_line=28, max_lines=2)
        for c in chunks:
            txt = " ".join([w["word"] for w in c])
            self.assertLessEqual(len(txt), 56)

    def test_38_chunk_words_orphan_merge(self):
        words_orphan = [
            {"word": "Bu", "start": 0.0, "end": 0.2},
            {"word": "katta", "start": 0.25, "end": 0.5},
            {"word": "mavzu;", "start": 0.55, "end": 0.8},
            {"word": "ha", "start": 0.85, "end": 1.0}
        ]
        chunks = chunk_words_by_pause(words_orphan)
        self.assertEqual(len(chunks), 1)
        self.assertEqual([w["word"] for w in chunks[0]], ["Bu", "katta", "mavzu;", "ha"])


if __name__ == "__main__":
    unittest.main(verbosity=2)
