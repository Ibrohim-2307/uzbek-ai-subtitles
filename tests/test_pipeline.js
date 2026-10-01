/**
 * tests/test_pipeline.js - Full pipeline integration test:
 * STT Output -> UzbekUtils (normalization, frame snap, 42 chars line split, karaoke preservation)
 *            -> ExtendScript payload generation for AE & Premiere Pro
 */

const assert = require('assert');
const path = require('path');
const UzbekUtils = require('../client/js/uzbekUtils.js');

console.log("=== FULL PIPELINE TESTLARI BOSHLANDI (tests/test_pipeline.js) ===");

// 1. Simulyatsiya qilingan STT natijasi (xom matn, yo'qolgan apostroflar, kadrga tekislanmagan vaqtlar)
const mockSttSegments = [
    {
        id: 0,
        start: 0.123,
        end: 4.876,
        text: "bugungi darsda ozbekistonda suniy intellekt va talim tizimi haqida gaplashamiz",
        words: [
            { word: "bugungi", start: 0.123, end: 0.654 },
            { word: "darsda", start: 0.680, end: 1.120 },
            { word: "ozbekistonda", start: 1.150, end: 2.100 },
            { word: "suniy", start: 2.150, end: 2.700 },
            { word: "intellekt", start: 2.750, end: 3.400 },
            { word: "va", start: 3.420, end: 3.550 },
            { word: "talim", start: 3.580, end: 4.050 },
            { word: "tizimi", start: 4.080, end: 4.450 },
            { word: "haqida", start: 4.480, end: 4.750 },
            { word: "gaplashamiz", start: 4.770, end: 4.876 }
        ]
    }
];

const targetFps = 25.0;

// 2. Rechunking (hostBridge.js dagi kabi)
const rechunked = UzbekUtils.rechunkSegments(mockSttSegments, {
    fps: targetFps,
    maxChars: 42,
    maxLines: 2,
    normalize: true
});

assert(rechunked.length >= 1, "Rechunked bo'sh bo'lmasligi kerak");
console.log(`  Hosil bo'lgan subtitr bloklari soni: ${rechunked.length}`);

rechunked.forEach((seg, sIdx) => {
    console.log(`\n  Blok ${sIdx + 1}: [${seg.start}s -> ${seg.end}s]`);
    console.log(`    Matn: "${seg.text.replace(/\n/g, ' \\n ')}"`);

    // A) Kadr tekshiruvi
    assert(UzbekUtils.isOnFrame(seg.start, targetFps), `Blok boshlanishi kadrda emas: ${seg.start}`);
    assert(UzbekUtils.isOnFrame(seg.end, targetFps), `Blok tugashi kadrda emas: ${seg.end}`);
    assert(seg.end > seg.start, `Blok davomiyligi 0 yoki manfiy`);

    // B) Satr chegarasi tekshiruvi (max 42 belgi, max 2 qator)
    const lines = seg.text.split('\n');
    assert(lines.length <= 2, `Qatorlar soni 2 tadan ko'p: ${lines.length}`);
    lines.forEach(line => {
        assert(line.length <= 42, `Qator uzunligi 42 dan oshdi: ${line.length} ("${line}")`);
    });

    // C) Karaoke so'zlar tekshiruvi
    if (seg.words && seg.words.length > 0) {
        seg.words.forEach(w => {
            assert(UzbekUtils.isOnFrame(w.start, targetFps), `So'z start kadrda emas: ${w.word} (${w.start})`);
            assert(UzbekUtils.isOnFrame(w.end, targetFps), `So'z end kadrda emas: ${w.word} (${w.end})`);
            assert(w.end >= w.start, `So'z end < start: ${w.word}`);
        });
    }
});

// C) Imlo tekshiruvi (barcha bloklar birlashganda)
const fullRechunkedText = rechunked.map(s => s.text).join(' ');
assert(fullRechunkedText.includes("oʻzbekistonda"), "oʻzbekistonda tiklanmadi");
assert(fullRechunkedText.includes("sunʼiy"), "sunʼiy tiklanmadi");
assert(fullRechunkedText.includes("taʼlim"), "taʼlim tiklanmadi");

// 3. AE va Premiere uchun JSON payload tayyorlash
const aePayload = JSON.stringify({
    segments: rechunked,
    fps: targetFps,
    leadIn: 0.05
});
assert(aePayload.length > 0);
const parsedPayload = JSON.parse(aePayload);
assert.strictEqual(parsedPayload.segments.length, rechunked.length);

console.log("\n=======================================================");
console.log("🎉 TO'LIQ PIPELINE TESTI MUVAFFAQIYATLI O'TDI!");
console.log("=======================================================");
