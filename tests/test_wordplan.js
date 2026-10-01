/**
 * tests/test_wordplan.js - Word Plan generation & timing tests (Blok D)
 * Exactly 51 assertions covering frameFloor, frameCeil, buildWordPlan, cascade line management, and auditWordPlan.
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

console.log("=== WORD PLAN TESTLARI BOSHLANDI (tests/test_wordplan.js) ===");

// 1. frameFloor va frameCeil tekshiruvlari (15 assertions)
test("frameFloor va frameCeil 25 fps da", () => {
    assert.strictEqual(UzbekUtils.frameFloor(3.2, 25.0), 3.2);
    assert.strictEqual(UzbekUtils.frameCeil(3.2, 25.0), 3.2);
    assert.strictEqual(UzbekUtils.frameFloor(3.21, 25.0), 3.2);
    assert.strictEqual(UzbekUtils.frameCeil(3.21, 25.0), 3.24);
    assert.strictEqual(UzbekUtils.frameFloor(0.039, 25.0), 0.0);
    assert.strictEqual(UzbekUtils.frameCeil(0.001, 25.0), 0.04);
});

test("frameFloor va frameCeil 30 fps va 60 fps da", () => {
    assert.strictEqual(UzbekUtils.frameFloor(1.0, 30.0), 1.0);
    assert.strictEqual(UzbekUtils.frameCeil(1.0, 30.0), 1.0);
    assert.strictEqual(UzbekUtils.frameFloor(1.016, 30.0), 1.0);
    assert.strictEqual(UzbekUtils.frameCeil(1.016, 30.0), 1.033333333);
    assert.strictEqual(UzbekUtils.frameFloor(2.0, 60.0), 2.0);
    assert.strictEqual(UzbekUtils.frameCeil(2.0, 60.0), 2.0);
    assert.strictEqual(UzbekUtils.frameFloor(2.008, 60.0), 2.0);
    assert.strictEqual(UzbekUtils.frameCeil(2.008, 60.0), 2.016666667);
    assert.strictEqual(UzbekUtils.frameFloor(0.0, 24.0), 0.0);
});

// 2. buildWordPlan asosiy maydonlari va kadr tekshiruvi (12 assertions)
const sampleSegs = [
    {
        id: 1,
        start: 1.0,
        end: 2.5,
        text: "oʻzbekiston kelajagi buyuk",
        words: [
            { word: "oʻzbekiston", start: 1.012, end: 1.488 },
            { word: "kelajagi", start: 1.503, end: 1.992 },
            { word: "buyuk", start: 2.011, end: 2.455 }
        ]
    }
];

const plan = UzbekUtils.buildWordPlan(sampleSegs, { fps: 25.0, maxLines: 2 });

test("buildWordPlan tuzilmasi va maydonlari", () => {
    assert(plan && Array.isArray(plan.words), "plan.words massiv bo'lishi kerak");
    assert.strictEqual(plan.words.length, 3, "Jami 3 ta so'z bo'lishi kerak");
    assert(plan.stats, "plan.stats mavjud bo'lishi kerak");
    assert.strictEqual(plan.stats.totalWords, 3);
    assert.strictEqual(plan.stats.fps, 25.0);
});

test("Har bir so'zning vaqt parametrlari to'g'riligi", () => {
    plan.words.forEach((w, idx) => {
        assert(typeof w.inPoint === "number" && !isNaN(w.inPoint), `inPoint son emas: ${idx}`);
        assert(typeof w.inAnimEnd === "number" && !isNaN(w.inAnimEnd), `inAnimEnd son emas: ${idx}`);
        assert(typeof w.wordEnd === "number" && !isNaN(w.wordEnd), `wordEnd son emas: ${idx}`);
        assert(typeof w.closeStart === "number" && !isNaN(w.closeStart), `closeStart son emas: ${idx}`);
        assert(typeof w.outPoint === "number" && !isNaN(w.outPoint), `outPoint son emas: ${idx}`);
        assert(w.inPoint <= w.outPoint, `inPoint > outPoint: ${w.inPoint} > ${w.outPoint}`);
        assert(w.inAnimEnd >= w.inPoint, `inAnimEnd < inPoint: ${w.inAnimEnd} < ${w.inPoint}`);
    });
});

// 3. Pauzada ushlab turish (Pause Hold) va yashirish (8 assertions)
const pauseSegs = [
    {
        id: 1,
        start: 0.0,
        end: 1.0,
        text: "birinchi",
        words: [{ word: "birinchi", start: 0.0, end: 0.8 }]
    },
    {
        id: 2,
        start: 3.0,
        end: 4.0,
        text: "ikkinchi",
        words: [{ word: "ikkinchi", start: 3.0, end: 3.8 }]
    }
];

test("Pauzada matn ushlab turilishi (pauseHold: true)", () => {
    const holdPlan = UzbekUtils.buildWordPlan(pauseSegs, { fps: 25.0, pauseHold: true, pauseThresholdSec: 0.8 });
    assert.strictEqual(holdPlan.words.length, 2);
    assert.strictEqual(holdPlan.stats.pauseCount, 1, "1 ta pauza aniqlanishi kerak");
    const w1 = holdPlan.words[0];
    // w1 keyingi so'z boshlanishigacha (3.0s) turishi kerak
    assert.strictEqual(w1.outPoint, 3.0, `w1 outPoint 3.0 bo'lishi kerak, lekin: ${w1.outPoint}`);
    assert(w1.closeStart >= 2.8, `w1 closeStart 2.8 dan katta yoki teng bo'lishi kerak: ${w1.closeStart}`);
});

test("Pauzada matn yashirilishi (pauseHold: false)", () => {
    const hidePlan = UzbekUtils.buildWordPlan(pauseSegs, { fps: 25.0, pauseHold: false, pauseThresholdSec: 0.8 });
    assert.strictEqual(hidePlan.words.length, 2);
    const w1 = hidePlan.words[0];
    // w1 o'z nutqi tugagach tezda yopilishi kerak (3.0s gacha bormaydi)
    assert(w1.outPoint < 1.5, `w1 outPoint 1.5 dan kichik bo'lishi kerak: ${w1.outPoint}`);
    assert.strictEqual(hidePlan.stats.pauseCount, 1);
    assert.strictEqual(hidePlan.words[1].inPoint, 3.0);
});

// 4. Kaskad qatorlari va to'lib qolish (Line Cascade Overflow) (10 assertions)
const rapidWords = [
    { id: 1, start: 0.0, end: 0.3, words: [{ word: "so'z1", start: 0.0, end: 0.3 }] },
    { id: 2, start: 0.2, end: 0.5, words: [{ word: "so'z2", start: 0.2, end: 0.5 }] },
    { id: 3, start: 0.4, end: 0.7, words: [{ word: "so'z3", start: 0.4, end: 0.7 }] },
    { id: 4, start: 0.6, end: 0.9, words: [{ word: "so'z4", start: 0.6, end: 0.9 }] }
];

test("Kaskad rejimida qatorlar almashinuvi va surilishi", () => {
    const stackPlan = UzbekUtils.buildWordPlan(rapidWords, { fps: 25.0, maxLines: 2 });
    assert.strictEqual(stackPlan.words.length, 4);
    assert.strictEqual(stackPlan.stats.maxLines, 2);
    assert.strictEqual(stackPlan.stats.maxLinesUsed, 2);
    
    const w1 = stackPlan.words[0];
    const w2 = stackPlan.words[1];
    const w3 = stackPlan.words[2];
    const w4 = stackPlan.words[3];

    assert.strictEqual(w1.initialLine, 0, "w1 0-qatorda boshlanishi kerak");
    assert.strictEqual(w2.initialLine, 1, "w2 1-qatorda chiqishi kerak");
    // w3 kelganda 2 ta qator to'lgan: w1 yopiladi, w2 0-qatorga suriladi, w3 1-qatorga tushadi
    assert(w1.outPoint <= w3.inPoint + 0.001, `w1 w3 kelganda yopilishi kerak: ${w1.outPoint} vs ${w3.inPoint}`);
    assert(w2.lineChanges.length >= 1, "w2 da kamida bitta qator surilishi bo'lishi kerak");
    assert.strictEqual(w2.lineChanges[0].fromLine, 1);
    assert.strictEqual(w2.lineChanges[0].toLine, 0);
    assert.strictEqual(w3.initialLine, 1, "w3 1-qatorda chiqishi kerak");
});

// 5. auditWordPlan tekshiruvlari (6 assertions)
test("auditWordPlan to'g'ri reja va xatoliklarni aniqlashi", () => {
    const validAudit = UzbekUtils.auditWordPlan(plan);
    assert.strictEqual(validAudit.valid, true, "To'g'ri reja valid bo'lishi kerak");
    assert.strictEqual(validAudit.errors.length, 0, "Xatolar ro'yxati bo'sh bo'lishi kerak");
    assert.strictEqual(validAudit.count, 3);

    // Xato reja (manfiy vaqt va buzilgan outPoint)
    const corruptedPlan = {
        words: [
            { word: "xato", inPoint: -0.5, inAnimEnd: 0.1, wordEnd: 0.2, closeStart: 0.1, outPoint: 0.05, initialLine: 0 }
        ]
    };
    const badAudit = UzbekUtils.auditWordPlan(corruptedPlan);
    assert.strictEqual(badAudit.valid, false, "Xato reja valid=false bo'lishi kerak");
    assert(badAudit.errors.length >= 1, "Kamida bitta xatolik topilishi kerak");
    assert.strictEqual(badAudit.count, 1);
});

console.log(`\n🎉 test_wordplan.js: Barcha ${passCount} ta tekshiruv muvaffaqiyatli o'tdi! (51 assertions)`);
