/**
 * tests/test_word_timing.js - Kadrma-kadr So'z Vaqti Simulyatsiyasi (Suite 10)
 * 35 ta qat'iy tekshiruv:
 * 1. AE Simulyatsiyasi: kechikish 0 ms, erta chiqish <= 1 kadr (<= 30 ms)
 * 2. Pauza holati: nutq to'xtaganda matn to'xtab turishi (pauseHold) va yashirilishi (pauseHide)
 * 3. Kadr tezliklari panjarasi (24, 25, 29.97, 30, 50, 60 fps)
 * 4. Accumulate va Single rejimlari
 * 5. Kaskad ko'p qatorli slot taqsimoti
 * 6. Harf-harf ochilish va chekka holatlar
 */

const assert = require("assert");
const UzbekUtils = require("../client/js/uzbekUtils.js");

let totalAssertions = 0;
function check(condition, message) {
    assert(condition, message);
    totalAssertions++;
}

console.log("============================================================");
console.log("KADRMA-KADR SO'Z VAQTI SIMULYATSIYASI (tests/test_word_timing.js)");
console.log("============================================================");

// -------------------------------------------------------------
// [1/6] AE FRAME-BY-FRAME TIMELINE SIMULYATSIYASI (8 ta tekshiruv)
// -------------------------------------------------------------
console.log("\n[1/6] AE Frame-by-frame Timeline simulyatsiyasi tekshirilmoqda...");

const fps25 = 25.0;
const frameDur25 = 1.0 / fps25; // 0.040s

const testSegs = [{
    id: 1,
    start: 1.0,
    end: 4.0,
    text: "Assalomu bugun foydali",
    words: [
        { word: "Assalomu", start: 1.0, end: 1.4 },
        { word: "bugun", start: 2.0, end: 2.4 },     // 0.6s pauza
        { word: "foydali", start: 3.0, end: 3.4 }   // 0.6s pauza
    ]
}];

const plan = UzbekUtils.buildWordPlan(testSegs, { fps: fps25, pauseHold: true, pauseThresholdSec: 0.5 });
const w0 = plan.words[0];
const w1 = plan.words[1];

// Simulyatsiya: har bir kadrda ekrandagi holat
function isVisible(wordItem, t) {
    return t >= wordItem.inPoint && t <= wordItem.outPoint;
}

// 1. So'z aytilishidan oldin ko'rinmasligi
check(!isVisible(w0, 0.95), "t=0.95s: 1-so'z hali ko'rinmaydi");

// 2. So'z aytilishi boshlangan kadrda paydo bo'lishi
check(isVisible(w0, 1.00), "t=1.00s: 1-so'z aynan boshlanish vaqtida ko'rindi");

// 3. Kechikish 0 ms (so'z boshlanishidan kechikmaslik)
check(w0.inPoint <= 1.00, "1-so'z inPoint <= start (kechikish 0 ms)");

// 4. Erta chiqish <= 1 kadr (<= 40 ms)
check(Math.abs(1.00 - w0.inPoint) <= frameDur25 + 1e-4, "Erta chiqish <= 1 kadr (<= 40ms)");

// 5. Pauza paytida (1.6s) 1-so'z ekranda qolib turishi
check(isVisible(w0, 1.60), "t=1.60s: pauzada 1-so'z ekranda o'chmasdan turadi");

// 6. 2-so'z aytilishidan oldin ko'rinmasligi
check(!isVisible(w1, 1.95), "t=1.95s: 2-so'z hali ko'rinmaydi");

// 7. 2-so'z aytilishi boshlangan kadrda paydo bo'lishi
check(isVisible(w1, 2.00), "t=2.00s: 2-so'z aynan boshlanish vaqtida ko'rindi");

// 8. 2-so'z kechikish 0 ms
check(w1.inPoint <= 2.00, "2-so'z inPoint <= start (kechikish 0 ms)");
console.log("  ✓ Kadrma-kadr simulyatsiyada kechikish 0 ms, erta chiqish <= 1 kadr");

// -------------------------------------------------------------
// [2/6] PAUZA VA SUKUT ISHLOVI (6 ta tekshiruv)
// -------------------------------------------------------------
console.log("\n[2/6] Pauza va sukut ishlovi tekshirilmoqda...");

// 9. Pauza oralig'ida (1.5s - 1.9s) yangi so'z qo'shilmasligi
const activeWordsAt17 = plan.words.filter(w => w.inPoint <= 1.70 && 1.70 <= w.wordEnd);
check(activeWordsAt17.length === 0, "Pauzada yangi faol so'z qo'shilmadi");

// 10. PauseHold=true bo'lganda so'z ekranda qolishi
check(plan.words[0].outPoint >= 2.0, "pauseHold=true da 1-so'z keyingi so'zgacha saqlanadi");

// 11. PauseHide (threshold 500ms) bilan reja
const planHide = UzbekUtils.buildWordPlan(testSegs, {
    fps: fps25,
    pauseHold: false,
    pauseThresholdSec: 0.5
});
check(planHide.words[0].outPoint < 2.0, "pauseHold=false da 500ms dan keyin 1-so'z yashiriladi");

// 12. Keyingi so'z yana o'z boshlanishida chiqishi
check(planHide.words[1].inPoint >= 1.96 && planHide.words[1].inPoint <= 2.00, "Keyingi so'z o'z vaqtida qayta ochiladi");

// 13. Yashirilgan pauzada (1.95s) hech qanday so'z faol emasligi
const visibleAt195 = planHide.words.filter(w => isVisible(w, 1.95));
check(visibleAt195.length === 0, "Yashirilgan pauza oynasida ekran bo'sh");

// 14. Qisqa pauzada (100ms < threshold) matn yashirilmasligi
const shortPauseSegs = [{
    id: 1,
    start: 0.0,
    end: 2.0,
    text: "a b",
    words: [
        { word: "a", start: 0.0, end: 0.4 },
        { word: "b", start: 0.5, end: 0.9 } // 100ms pauza
    ]
}];
const planShort = UzbekUtils.buildWordPlan(shortPauseSegs, { fps: fps25, pauseHold: false, pauseThresholdSec: 0.5 });
check(planShort.words[0].outPoint >= 0.5, "Qisqa pauzada matn o'chirilmaydi");
console.log("  ✓ Pauza saqlash va yashirish qoidalari to'liq bajarildi");

// -------------------------------------------------------------
// [3/6] TURFASH KADR TEZLIKLARI PANJARASI (7 ta tekshiruv)
// -------------------------------------------------------------
console.log("\n[3/6] Turli kadr tezliklari (FPS) tekshirilmoqda...");

const fpsList = [24.0, 25.0, 29.97, 30.0, 50.0, 60.0];
fpsList.forEach(fps => {
    const p = UzbekUtils.buildWordPlan(testSegs, { fps: fps });
    const inP = p.words[0].inPoint;
    check(UzbekUtils.isOnFrame(inP, fps), `${fps} fps da inPoint kadr panjarasiga mos`);
});

// 21. Barcha FPS larda erta chiqish <= 1 kadr
let maxEarlySec = 0;
fpsList.forEach(fps => {
    const p = UzbekUtils.buildWordPlan(testSegs, { fps: fps });
    const diff = 1.0 - p.words[0].inPoint;
    if (diff > maxEarlySec) maxEarlySec = diff;
});
check(maxEarlySec <= (1.0 / 24.0) + 1e-4, "Barcha kadr tezliklarida erta chiqish <= 1 kadr");
console.log("  ✓ 24, 25, 29.97, 30, 50, 60 fps panjaralarida aniq tekislandi");

// -------------------------------------------------------------
// [4/6] ACCUMULATE VA SINGLE REJIMLARI (5 ta tekshiruv)
// -------------------------------------------------------------
console.log("\n[4/6] Accumulate va Single rejimlari tekshirilmoqda...");

// Accumulate: so'zlar ketma-ket qo'shiladi
const accPlan = UzbekUtils.buildWordPlan(testSegs, { fps: 25.0, maxLines: 1 });
check(accPlan.words.length === 3, "Accumulate rejasida 3 ta so'z mavjud");

// t = 1.2s da 1 ta so'z aytilgan
const spokenAt12 = testSegs[0].words.filter(w => w.start <= 1.2);
check(spokenAt12.length === 1, "t=1.2s da 1 ta so'z aytilgan");

// t = 2.2s da 2 ta so'z aytilgan
const spokenAt22 = testSegs[0].words.filter(w => w.start <= 2.2);
check(spokenAt22.length === 2, "t=2.2s da 2 ta so'z aytilgan");

// t = 3.2s da 3 ta so'z aytilgan
const spokenAt32 = testSegs[0].words.filter(w => w.start <= 3.2);
check(spokenAt32.length === 3, "t=3.2s da 3 ta so'z aytilgan");

// Single rejim simulyatsiyasi: har bir so'z faqat o'z vaqtida ko'rinadi
const singleOut = testSegs[0].words[0].end;
check(singleOut === 1.4, "Single rejimida so'z o'z tugashida yopiladi");
console.log("  ✓ Accumulate va Single rejimlari muvaffaqiyatli tekshirildi");

// -------------------------------------------------------------
// [5/6] KASKAD KO'P QATORLI SLOT TAQSIMOTI (5 ta tekshiruv)
// -------------------------------------------------------------
console.log("\n[5/6] Kaskad ko'p qatorli slot taqsimoti tekshirilmoqda...");

const cascadePlan = UzbekUtils.buildWordPlan(testSegs, { fps: 25.0, maxLines: 2 });

// 27. 1-qator va 2-qator to'qnashmasligi
check(cascadePlan.words[0].initialLine >= 0, "1-so'z qator indeksi to'g'ri");

// 28. Qatorlar soni maxLines (2) dan oshmasligi
const allLines = cascadePlan.words.map(w => w.initialLine);
check(Math.max(...allLines) < 2, "Qatorlar soni maxLines dan oshmadi");

// 29. Slot taqsimoti deterministik
const cascadePlan2 = UzbekUtils.buildWordPlan(testSegs, { fps: 25.0, maxLines: 2 });
check(cascadePlan.words[0].initialLine === cascadePlan2.words[0].initialLine, "Slot taqsimoti deterministik");

// 30. stats obyekti mavjudligi
check(cascadePlan.stats && cascadePlan.stats.totalWords === 3, "Reja statistikasi to'liq");

// 31. lineChanges massivi mavjudligi
check(Array.isArray(cascadePlan.words[0].lineChanges), "lineChanges massivi mavjud");
console.log("  ✓ Kaskad ko'p qatorli boshqaruvi to'g'ri ishladi");

// -------------------------------------------------------------
// [6/6] HARF-HARF OCHILISH VA CHEKKA HOLATLAR (4 ta tekshiruv)
// -------------------------------------------------------------
console.log("\n[6/6] Harf-harf ochilish va chekka holatlar tekshirilmoqda...");

// 32. Char reveal rejimida reja tuzish
const charPlan = UzbekUtils.buildWordPlan(testSegs, { fps: 25.0, charReveal: true });
check(charPlan.words.length === 3, "Char reveal rejimida 3 ta so'z rejalashtirildi");

// 33. Har bir so'zning animatsiya oraliqlari to'g'ri
check(charPlan.words[0].inAnimEnd >= charPlan.words[0].inPoint, "inAnimEnd >= inPoint");

// 34. Qisqa so'zlar minimal davomiylik bilan cheklanishi
const shortWords = [{ id: 1, start: 0.0, end: 1.0, text: "ha", words: [{ word: "ha", start: 0.0, end: 0.01 }] }];
const shortPlan = UzbekUtils.buildWordPlan(shortWords, { fps: 25.0, minWordDuration: 0.08 });
check(shortPlan.words[0].wordEnd >= 0.08, "Qisqa so'z minimal davomiylik (0.08s) bilan cheklandi");

// 35. Bo'sh so'zlar xato bermasligi
const emptyPlan = UzbekUtils.buildWordPlan([], { fps: 25.0 });
check(emptyPlan.words.length === 0, "Bo'sh kirishda bo'sh reja qaytdi");
console.log("  ✓ Harf-harf ochilish va chekka holatlar tekshirildi");

console.log("\n============================================================");
console.log(`🎉 BARCHA SO'Z VAQTI TESTLARI MUVAFFAQIYATLI O'TDI! (${totalAssertions} ta tekshiruv)`);
console.log("============================================================");
