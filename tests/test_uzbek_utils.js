/**
 * tests/test_uzbek_utils.js - Node.js test suite for UzbekUtils (client/js/uzbekUtils.js)
 * Covers 60+ assertions matching uzbek_nlp.py and all 10 acceptance criteria.
 */

const assert = require('assert');
const path = require('path');
const UzbekUtils = require('../client/js/uzbekUtils.js');

let passCount = 0;
function test(name, fn) {
    try {
        fn();
        passCount++;
    } catch (e) {
        console.error(`FAIL: ${name}`);
        throw e;
    }
}

console.log("=== UZBEK UTILS TESTLARI BOSHLANDI (tests/test_uzbek_utils.js) ===");

// 1. oʻ va gʻ belgilari (U+02BB)
test("o' / g' variantlari U+02BB ga o'tishi", () => {
    assert.strictEqual(UzbekUtils.fixOg("o'zbek"), "oʻzbek");
    assert.strictEqual(UzbekUtils.fixOg("o‘zbek"), "oʻzbek");
    assert.strictEqual(UzbekUtils.fixOg("o`zbek"), "oʻzbek");
    assert.strictEqual(UzbekUtils.fixOg("oʼzbek"), "oʻzbek");
    assert.strictEqual(UzbekUtils.fixOg("oʻzbek"), "oʻzbek");
    assert.strictEqual(UzbekUtils.fixOg("O'zbekiston"), "Oʻzbekiston");
    assert.strictEqual(UzbekUtils.fixOg("g'alla"), "gʻalla");
    assert.strictEqual(UzbekUtils.fixOg("G'oya"), "Gʻoya");
    assert.strictEqual(UzbekUtils.fixOg("to'g'ri"), "toʻgʻri");
    assert.strictEqual(UzbekUtils.fixOg("ko'p"), "koʻp");
    assert.strictEqual(UzbekUtils.fixOg("bo'yicha"), "boʻyicha");
});

// 2. Ayn (tutuq belgisi) (U+02BC)
test("Ayn belgilari U+02BC ga o'tishi", () => {
    assert.strictEqual(UzbekUtils.fixAyn("ma'lumot"), "maʼlumot");
    assert.strictEqual(UzbekUtils.fixAyn("sun'iy"), "sunʼiy");
    assert.strictEqual(UzbekUtils.fixAyn("ta'lim"), "taʼlim");
    assert.strictEqual(UzbekUtils.fixAyn("san'at"), "sanʼat");
    assert.strictEqual(UzbekUtils.fixAyn("qat'iy"), "qatʼiy");
    assert.strictEqual(UzbekUtils.fixAyn("e'tibor"), "eʼtibor");
    assert.strictEqual(UzbekUtils.fixAyn("a'zo"), "aʼzo");
    assert.strictEqual(UzbekUtils.fixAyn("mu'jiza"), "muʼjiza");
    assert.strictEqual(UzbekUtils.fixAyn("ma'no"), "maʼno");
});

// 3. Inglizcha istisnolar (NOT_AYN_WORDS)
test("NOT_AYN_WORDS o'zgarmasligi", () => {
    assert.strictEqual(UzbekUtils.fixAyn("don't"), "don't");
    assert.strictEqual(UzbekUtils.fixAyn("it's"), "it's");
    assert.strictEqual(UzbekUtils.fixAyn("can't"), "can't");
    assert.strictEqual(UzbekUtils.fixAyn("that's"), "that's");
    assert.strictEqual(UzbekUtils.fixAyn("let's"), "let's");
});

// 4. Apostrofi yo'qolgan so'zlarni tiklash
test("Apostrofi yo'qolgan so'zlarni tiklash", () => {
    assert.strictEqual(UzbekUtils.fixAynWords("malumot"), "maʼlumot");
    assert.strictEqual(UzbekUtils.fixAynWords("malumotlarimiz"), "maʼlumotlarimiz");
    assert.strictEqual(UzbekUtils.fixAynWords("suniy"), "sunʼiy");
    assert.strictEqual(UzbekUtils.fixAynWords("talim"), "taʼlim");
    assert.strictEqual(UzbekUtils.fixOgWords("ozbek"), "oʻzbek");
    assert.strictEqual(UzbekUtils.fixOgWords("ozbekiston"), "oʻzbekiston");
    assert.strictEqual(UzbekUtils.fixOgWords("togri"), "toʻgʻri");
    assert.strictEqual(UzbekUtils.fixOgWords("yol"), "yoʻl");
    assert.strictEqual(UzbekUtils.fixOgWords("yoq"), "yoʻq");
    assert.strictEqual(UzbekUtils.fixOgWords("yolgon"), "yolgʻon");
    assert.strictEqual(UzbekUtils.fixOgWords("yolgonchi"), "yolgʻonchi");
});

// 5. Xavfli o'zaklar tegilmasligi
test("Xavfli o'zaklar o'zgarmasligi", () => {
    assert.strictEqual(UzbekUtils.fixAynWords("aloqa"), "aloqa");
    assert.strictEqual(UzbekUtils.fixAynWords("sher"), "sher");
    assert.strictEqual(UzbekUtils.fixOgWords("on"), "on");
    assert.strictEqual(UzbekUtils.fixOgWords("ot"), "ot");
    assert.strictEqual(UzbekUtils.fixOgWords("ol"), "ol");
    assert.strictEqual(UzbekUtils.fixOgWords("och"), "och");
});

// 6. To'liq normalizatsiya va Idempotentlik
test("normalizeUzbekText va Idempotentlik", () => {
    const raw = "bugungi videoda ozbekistonda suniy intellekt haqida malumot";
    const expected = "bugungi videoda oʻzbekistonda sunʼiy intellekt haqida maʼlumot";
    const res = UzbekUtils.normalizeUzbekText(raw);
    assert.strictEqual(res, expected);
    // Idempotentlik
    assert.strictEqual(UzbekUtils.normalizeUzbekText(res), expected);
});

// 7. Lotin <-> Kirill yo'qotishsiz transliteratsiyasi
test("Lotin <-> Kirill transliteratsiyasi", () => {
    assert.strictEqual(UzbekUtils.lotinToKirill("Yoʻq"), "Йўқ");
    assert.strictEqual(UzbekUtils.lotinToKirill("yoʻl"), "йўл");
    assert.strictEqual(UzbekUtils.lotinToKirill("maʼlumot"), "маълумот");
    assert.strictEqual(UzbekUtils.lotinToKirill("Oʻzbekiston"), "Ўзбекистон");
    assert.strictEqual(UzbekUtils.lotinToKirill("sunʼiy"), "сунъий");
    assert.strictEqual(UzbekUtils.lotinToKirill("sanʼat"), "санъат");
    assert.strictEqual(UzbekUtils.lotinToKirill("toʻgʻri"), "тўғри");
    assert.strictEqual(UzbekUtils.lotinToKirill("Eʼlon"), "Эълон");
    assert.strictEqual(UzbekUtils.lotinToKirill("qatʼiy"), "қатъий");
    assert.strictEqual(UzbekUtils.lotinToKirill("gazeta"), "газета");

    // Roundtrip
    const testWords = ["Oʻzbekiston", "maʼlumot", "sunʼiy", "sanʼat", "toʻgʻri", "Eʼlon", "Yoʻq", "qatʼiy", "gazeta"];
    testWords.forEach(w => {
        const cyr = UzbekUtils.lotinToKirill(w);
        const lat = UzbekUtils.kirillToLotin(cyr);
        assert.strictEqual(lat, w, `Roundtrip buzildi: ${w} -> ${cyr} -> ${lat}`);
    });
});

// 8. Sonlarni so'zga aylantirish
test("Sonlarni so'zga aylantirish", () => {
    assert.strictEqual(UzbekUtils.numberToUzbekWords(100), "yuz");
    assert.strictEqual(UzbekUtils.numberToUzbekWords(1000), "ming");
    assert.strictEqual(UzbekUtils.numberToUzbekWords(2000), "ikki ming");
    assert.strictEqual(UzbekUtils.numberToUzbekWords(1000000), "bir million");
    assert.strictEqual(UzbekUtils.numberToUzbekWords(2026), "ikki ming yigirma olti");
    assert.strictEqual(UzbekUtils.numberToUzbekWords(0), "nol");

    // replaceNumbersWithWords
    assert.strictEqual(UzbekUtils.replaceNumbersWithWords("100"), "yuz");
    assert.strictEqual(UzbekUtils.replaceNumbersWithWords("1000"), "ming");
    assert.strictEqual(UzbekUtils.replaceNumbersWithWords("1 000 000"), "bir million");
    assert.strictEqual(UzbekUtils.replaceNumbersWithWords("3.5"), "uch butun oʻndan besh");
    assert.strictEqual(UzbekUtils.replaceNumbersWithWords("soat 12:30 da"), "soat 12:30 da");
    assert.strictEqual(UzbekUtils.replaceNumbersWithWords("tel: 90-90-123"), "tel: 90-90-123");
    assert.strictEqual(UzbekUtils.replaceNumbersWithWords("v1.5"), "v1.5");
    assert.strictEqual(UzbekUtils.replaceNumbersWithWords("5-6"), "5-6");
    assert.strictEqual(UzbekUtils.replaceNumbersWithWords("50%"), "50%");
});

// 9. Satr chegarasi (splitIntoLines)
test("splitIntoLines chegarasi (max 42 belgi, max 2 qator)", () => {
    const lines = UzbekUtils.splitIntoLines("Bugun biz oʻzbek tili sunʼiy intellekt modeli haqida batafsil maʼlumot beramiz", 42, 2);
    assert.strictEqual(lines.length, 2);
    lines.forEach(l => {
        assert(l.length <= 42, `Qator uzunligi ${l.length} > 42`);
    });
});

// 10. Vaqt va Kadr aniqligi
test("Vaqt va Kadr aniqligi", () => {
    assert.strictEqual(UzbekUtils.snapToFrame(3.214, 25), 3.2);
    assert.strictEqual(UzbekUtils.isOnFrame(3.2, 25), true);
    assert.strictEqual(UzbekUtils.formatSrtTime(3.2), "00:00:03,200");
    assert.strictEqual(UzbekUtils.formatFrameTime(3.2, 25), "00:00:03:05");
    assert.strictEqual(UzbekUtils.parseTimecode("00:00:03:05", 25), 3.2);
    assert.strictEqual(UzbekUtils.parseTimecode("00:00:03,200", 25), 3.2);
    assert.strictEqual(UzbekUtils.parseTimecode("03:20", 25), 200.0);
});

// 11. rechunkSegments (Karaoke vaqtlari saqlanishi)
test("rechunkSegments karaoke so'z vaqtlarini saqlashi", () => {
    const segs = [{
        id: 1,
        start: 0.0,
        end: 4.0,
        text: "bugungi darsda ozbekistonda talim",
        words: [
            { word: "bugungi", start: 0.0, end: 0.8 },
            { word: "darsda", start: 0.82, end: 1.5 },
            { word: "ozbekistonda", start: 1.54, end: 2.8 },
            { word: "talim", start: 2.85, end: 3.9 }
        ]
    }];
    const rechunked = UzbekUtils.rechunkSegments(segs, { fps: 25, maxChars: 42, maxLines: 2, normalize: true });
    assert(rechunked.length >= 1);
    const w1 = rechunked[0].words;
    assert.strictEqual(w1[2].word, "oʻzbekistonda");
    assert.strictEqual(w1[3].word, "taʼlim");
    w1.forEach(w => {
        assert(UzbekUtils.isOnFrame(w.start, 25), `So'z start kadrda emas: ${w.start}`);
        assert(UzbekUtils.isOnFrame(w.end, 25), `So'z end kadrda emas: ${w.end}`);
    });
});

// 12. chunkWordsSmart pauzalar bo'yicha bo'laklash
test("chunkWordsSmart pauzalar bo'yicha bo'laklash", () => {
    const words = [
        { word: "Bugun", start: 0.0, end: 0.3 },
        { word: "biz", start: 0.35, end: 0.6 },
        { word: "darsda", start: 0.65, end: 1.0 },
        { word: "gaplashamiz", start: 1.5, end: 2.2 }, // pause = 0.5s >= 0.35s
        { word: "ertaga", start: 2.25, end: 2.7 }
    ];
    const chunks = UzbekUtils.chunkWordsSmart(words);
    assert.strictEqual(chunks.length, 2);
    assert.deepStrictEqual(chunks[0].map(w => w.word), ["Bugun", "biz", "darsda"]);
    assert.deepStrictEqual(chunks[1].map(w => w.word), ["gaplashamiz", "ertaga"]);
});

// 13. chunkWordsSmart tinish belgilari bo'yicha bo'laklash
test("chunkWordsSmart tinish belgilari bo'yicha bo'laklash", () => {
    const words = [
        { word: "Dars", start: 0.0, end: 0.3 },
        { word: "boshlandi.", start: 0.35, end: 0.9 }, // . punctuation, len "Dars boshlandi." = 15 >= 12
        { word: "Hamma", start: 0.95, end: 1.3 },
        { word: "eshitsin", start: 1.35, end: 1.8 }
    ];
    const chunks = UzbekUtils.chunkWordsSmart(words);
    assert.strictEqual(chunks.length, 2);
    assert.deepStrictEqual(chunks[0].map(w => w.word), ["Dars", "boshlandi."]);
    assert.deepStrictEqual(chunks[1].map(w => w.word), ["Hamma", "eshitsin"]);
});

// 14. chunkWordsSmart majburiy chegaralar (7 so'z / 56 belgi)
test("chunkWordsSmart majburiy chegaralar (7 so'z / 56 belgi)", () => {
    const words = [];
    for (let i = 0; i < 14; i++) {
        words.push({ word: `soz${i}`, start: i * 0.2, end: i * 0.2 + 0.18 });
    }
    const chunks = UzbekUtils.chunkWordsSmart(words, { maxWords: 7, maxCharsLine: 28, maxLines: 2 });
    assert.strictEqual(chunks.length, 2);
    assert.strictEqual(chunks[0].length, 7);
    assert.strictEqual(chunks[1].length, 7);
});

// 15. chunkWordsSmart yetim so'zni birlashtirish (orphan merge)
test("chunkWordsSmart yetim so'zni birlashtirish (orphan merge)", () => {
    const words = [
        { word: "Bu", start: 0.0, end: 0.2 },
        { word: "katta", start: 0.25, end: 0.5 },
        { word: "mavzu;", start: 0.55, end: 0.8 }, // len "Bu katta mavzu;" = 15 >= 12
        { word: "ha", start: 0.85, end: 1.0 }       // "ha" = 2 chars < 12 chars orphan!
    ];
    const chunks = UzbekUtils.chunkWordsSmart(words);
    assert.strictEqual(chunks.length, 1);
    assert.deepStrictEqual(chunks[0].map(w => w.word), ["Bu", "katta", "mavzu;", "ha"]);
});

// 16. Word start binding va rechunkSegments yangi qoidasi
test("Word start binding va rechunkSegments yangi qoidasi", () => {
    const segs = [{
        id: 1,
        start: 0.0,
        end: 5.0,
        text: "bugungi darsda ozbekistonda suniy intellekt haqida gaplashamiz",
        words: [
            { word: "bugungi", start: 0.12, end: 0.6 },
            { word: "darsda", start: 0.65, end: 1.1 },
            { word: "ozbekistonda", start: 1.15, end: 2.0 },
            { word: "suniy", start: 2.05, end: 2.5 },
            { word: "intellekt", start: 2.55, end: 3.2 },
            { word: "haqida", start: 3.25, end: 3.8 },
            { word: "gaplashamiz", start: 4.5, end: 4.9 } // pause = 0.7s >= 0.35s
        ]
    }];
    const rechunked = UzbekUtils.rechunkSegments(segs, { fps: 25 });
    assert.strictEqual(rechunked.length, 2);
    // Word start binding tekshiruvi:
    assert.strictEqual(rechunked[0].start, rechunked[0].words[0].start);
    assert.strictEqual(rechunked[1].start, rechunked[1].words[0].start);
    assert.strictEqual(rechunked[0].words[0].word, "bugungi");
    assert.strictEqual(rechunked[1].words[0].word, "gaplashamiz");
});

console.log(`\n=======================================================`);
console.log(`🎉 BARCHA UZBEK UTILS TESTLARI (${passCount} ta guruh) MUVAFFAQIYATLI O'TDI!`);
console.log(`=======================================================`);
