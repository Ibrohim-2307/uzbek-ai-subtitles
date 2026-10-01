/**
 * BEAT DETECTOR & CEP HOST BRIDGE INTEGRATION TESTS (JavaScript / Node.js)
 * 
 * 1. Statik tekshiruvlar:
 *    - client/js/*.js dagi barcha HostBridge.<method> chaqiruvlari hostBridge.js da mavjudligi
 *    - hostBridge.js dagi barcha eval("host_func(...)") nishonlari host/shared.jsx da mavjudligi
 *    - host/*.jsx fayllari 100% bir xilligi
 *    - host/*.jsx fayllarida qat'iy ES3 sintaksis talablari (no const/let, no arrow, no backticks, no trailing commas)
 * 2. Klip offset matematikasi (UzbekUtils):
 *    - beatToTimelineTime (turli inPoint, start, speed, fps)
 *    - Manfiy natijalarni 0 ga cheklash
 *    - 60 fps da isOnFrame tekshiruvi
 *    - beatsToTimeline (audio_time, frame, is_drop saqlanishi)
 *    - dedupeBeats (bir kadr oralig'idagi takroriylarni filtrlash)
 *    - beatTolerance (kadrga bog'liq ruxsat etilgan oraliq)
 * 3. BeatManager.beatsForTimeline() DOM stub testi:
 *    - Mock DOM / window muhitida beats.js ni tekshirish
 *    - clipStart=10, clipInPoint=2, clipOutPoint=12, fps=25 holatida bosh va oxir qirqimlari
 *    - Kadr panjarasiga (snapToFrame) to'liq mosligi
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log("=".repeat(60));
console.log("BEAT DETECTOR & CEP HOST BRIDGE JAVASCRIPT TESTLARI");
console.log("=".repeat(60));

const ROOT_DIR = path.resolve(__dirname, '..');
const CLIENT_JS_DIR = path.join(ROOT_DIR, 'client', 'js');
const HOST_DIR = path.join(ROOT_DIR, 'host');

// ============================================================================
// 1. STATIK TEKSHIRUVLAR
// ============================================================================
console.log("\n[1/3] Statik tahlil va arxitektura tekshiruvlari...");

// 1.1 HostBridge obyektini yuklash
const hostBridgePath = path.join(CLIENT_JS_DIR, 'hostBridge.js');
assert(fs.existsSync(hostBridgePath), "hostBridge.js fayli mavjud emas!");
const hostBridgeCode = fs.readFileSync(hostBridgePath, 'utf8');

// Mock CSInterface & global window
global.window = global;
global.CSInterface = function() {
    this.getHostEnvironment = () => ({ appId: "PPRO" });
    this.getSystemPath = () => "";
    this.evalScript = (s, cb) => { if (cb) cb(""); };
};

// Evaluate hostBridge in current context
eval(hostBridgeCode);
assert(global.HostBridge, "HostBridge obyekti globalda aniqlanmadi!");

// 1.2 client/js dagi barcha HostBridge chaqiruvlarini tekshirish
const jsFiles = fs.readdirSync(CLIENT_JS_DIR).filter(f => f.endsWith('.js') && !f.includes('.bak'));
const hostBridgeCalls = new Set();
const hbCallRegex = /(?:window\.)?HostBridge\.([a-zA-Z0-9_]+)/g;

jsFiles.forEach(file => {
    const code = fs.readFileSync(path.join(CLIENT_JS_DIR, file), 'utf8');
    let m;
    while ((m = hbCallRegex.exec(code)) !== null) {
        hostBridgeCalls.add(m[1]);
    }
});

console.log(`  Topilgan HostBridge murojaatlari soni: ${hostBridgeCalls.size}`);
hostBridgeCalls.forEach(member => {
    assert(
        member in global.HostBridge,
        `XATOLIK: '${member}' a'zosi HostBridge da mavjud emas!`
    );
});
console.log("  ✓ Barcha HostBridge.<method> chaqiruvlari hostBridge.js da mavjud");

// 1.3 hostBridge.js dagi eval(...) nishonlarini host/shared.jsx bilan solishtirish
const sharedJsxPath = path.join(HOST_DIR, 'shared.jsx');
assert(fs.existsSync(sharedJsxPath), "host/shared.jsx fayli topilmadi!");
const sharedJsxCode = fs.readFileSync(sharedJsxPath, 'utf8');

// eval("funcName(...)") yoki eval(`funcName(...)`) larni ajratib olish
const evalTargets = new Set();
const evalRegex = /eval\s*\(\s*[`"']([a-zA-Z0-9_]+)\s*\(/g;
let em;
while ((em = evalRegex.exec(hostBridgeCode)) !== null) {
    evalTargets.add(em[1]);
}

console.log(`  Topilgan host eval funksiyalari soni: ${evalTargets.size}`);
evalTargets.forEach(fn => {
    const fnDefRegex = new RegExp(`function\\s+${fn}\\s*\\(`, 'g');
    assert(
        fnDefRegex.test(sharedJsxCode),
        `XATOLIK: '${fn}' funksiyasi host/shared.jsx da e'lon qilinmagan!`
    );
});
console.log("  ✓ Barcha eval host nishonlari host/shared.jsx da mavjud");

// 1.4 host/*.jsx fayllarining bir xilligi
const aeJsxPath = path.join(HOST_DIR, 'aftereffects.jsx');
const prJsxPath = path.join(HOST_DIR, 'premiere.jsx');
assert(fs.existsSync(aeJsxPath), "host/aftereffects.jsx topilmadi!");
assert(fs.existsSync(prJsxPath), "host/premiere.jsx topilmadi!");

const aeJsxCode = fs.readFileSync(aeJsxPath, 'utf8');
const prJsxCode = fs.readFileSync(prJsxPath, 'utf8');

assert.strictEqual(sharedJsxCode, aeJsxCode, "host/aftereffects.jsx host/shared.jsx bilan bir xil emas!");
assert.strictEqual(sharedJsxCode, prJsxCode, "host/premiere.jsx host/shared.jsx bilan bir xil emas!");
console.log("  ✓ host/shared.jsx, host/aftereffects.jsx va host/premiere.jsx 100% BIR XIL");

// 1.5 host/*.jsx fayllarida ES3 qoidalariga rioya qilinganligini tekshirish
function checkES3Compliance(code, filename) {
    // Izohlarni va qatorli stringlarni tozalash
    let cleanCode = code
        .replace(/\/\*[\s\S]*?\*\//g, '')  // block comments
        .replace(/\/\/.*/g, '')             // line comments
        .replace(/"(?:[^"\\]|\\.)*"/g, '""') // string literals
        .replace(/'(?:[^'\\]|\\.)*'/g, "''");

    // 1. const / let yo'qligi
    const constLetMatch = cleanCode.match(/\b(const|let)\b/);
    assert(!constLetMatch, `${filename} da ES6 'const/let' topildi! ES3 da faqat 'var' ishlatilishi shart.`);

    // 2. Arrow function yo'qligi
    const arrowMatch = cleanCode.match(/=>/);
    assert(!arrowMatch, `${filename} da ES6 '=>' (arrow function) topildi! ES3 da faqat 'function' ishlatilishi shart.`);

    // 3. Backtick (template string) yo'qligi
    const backtickMatch = cleanCode.match(/`/);
    assert(!backtickMatch, `${filename} da ES6 template literal (\`) topildi! ES3 da string qo'shish (+) ishlatilishi shart.`);

    // 4. Trailing commas yo'qligi: e.g. [1, 2,] yoki {a: 1, b: 2,}
    const trailingCommaMatch = cleanCode.match(/,\s*[}\]]/);
    assert(!trailingCommaMatch, `${filename} da trailing comma topildi! ExtendScript ES3 da bu sintaksis xatosi beradi.`);
}

checkES3Compliance(sharedJsxCode, "host/shared.jsx");
checkES3Compliance(aeJsxCode, "host/aftereffects.jsx");
checkES3Compliance(prJsxCode, "host/premiere.jsx");
console.log("  ✓ Barcha host/*.jsx fayllari sof ES3 sintaksisiga 100% muvofiq");


// ============================================================================
// 2. KLIP OFFSET MATEMATIKASI (UzbekUtils)
// ============================================================================
console.log("\n[2/3] Klip offset va kadr panjarasi matematikasi (UzbekUtils)...");

const UzbekUtils = require(path.join(CLIENT_JS_DIR, 'uzbekUtils.js'));
global.UzbekUtils = UzbekUtils;

// 2.1 beatToTimelineTime hisoblashlari
// Case A: start=0, inPoint=0, speed=1, fps=25 -> beat 3.0 -> 3.0
const tA = UzbekUtils.beatToTimelineTime(3.0, { start: 0, inPoint: 0, speed: 1, fps: 25 });
assert.strictEqual(tA, 3.0, `Case A xato: kutilgan 3.0, olindi ${tA}`);

// Case B: start=10, inPoint=2, speed=1, fps=25 -> beat 3.0 -> 10 + (3 - 2)/1 = 11.0
const tB = UzbekUtils.beatToTimelineTime(3.0, { start: 10, inPoint: 2, speed: 1, fps: 25 });
assert.strictEqual(tB, 11.0, `Case B xato: kutilgan 11.0, olindi ${tB}`);

// Case C: start=10, inPoint=2, speed=2, fps=25 -> beat 3.0 -> 10 + (3 - 2)/2 = 10.5 -> 25 fps da 263-kadr (10.52s)
const tC = UzbekUtils.beatToTimelineTime(3.0, { start: 10, inPoint: 2, speed: 2, fps: 25 });
assert.strictEqual(tC, 10.52, `Case C xato: kutilgan 10.52, olindi ${tC}`);

// Case D: Manfiy natijani 0 ga cheklash (start=0, inPoint=5, beat=1 -> -4 -> 0)
const tD = UzbekUtils.beatToTimelineTime(1.0, { start: 0, inPoint: 5, speed: 1, fps: 25 });
assert.strictEqual(tD, 0.0, `Case D xato: manfiy vaqt 0 ga cheklanmadi: ${tD}`);

console.log("  ✓ beatToTimelineTime formulalari va cheklovlari to'g'ri ishladi");

// 2.2 60 fps da isOnFrame tekshiruvi (6 decimals bug qaytmasligi uchun)
for (let frame = 0; frame <= 180; frame++) {
    const rawTime = frame / 60.0;
    const snapped = UzbekUtils.snapToFrame(rawTime + 0.0001, 60.0);
    assert(
        UzbekUtils.isOnFrame(snapped, 60.0),
        `60 fps da kadr chetga chiqdi: frame=${frame}, snapped=${snapped}`
    );
}
console.log("  ✓ 60 fps da snapToFrame va isOnFrame 180 ta kadrda aniq ishladi");

// 2.3 beatTolerance tekshiruvi
const tol25 = UzbekUtils.beatTolerance(25, 2);
assert.strictEqual(Number(tol25.toFixed(4)), 0.08, `25 fps 2 kadr tolerance 0.08 bo'lishi kerak, olindi ${tol25}`);
const tol60 = UzbekUtils.beatTolerance(60, 2);
assert.strictEqual(Number(tol60.toFixed(5)), Number((2 / 60).toFixed(5)));
console.log("  ✓ beatTolerance fps ga qarab dinamik hisoblandi");

// 2.4 dedupeBeats tekshiruvi (bir kadrga tushgan zarbalardan eng kuchlisi qolishi)
const rawBeats = [
    { time: 1.000, strength: 0.4 },
    { time: 1.015, strength: 0.95 }, // 25 fps da 1/25 = 0.04s, demak 1.000 va 1.015 bitta kadr oralig'i
    { time: 2.000, strength: 0.6 }
];
const deduped = UzbekUtils.dedupeBeats(rawBeats, 25);
assert.strictEqual(deduped.length, 2, `dedupeBeats 2 ta beat qaytarishi kerak, olindi ${deduped.length}`);
assert.strictEqual(deduped[0].strength, 0.95, "Kuchliroq zarba saqlanmadi!");
console.log("  ✓ dedupeBeats bir kadr oralig'idagi kuchliroq zarbani to'g'ri saqlab qoldi");

// 2.5 beatsToTimeline maydonlari saqlanishi
const sampleBeats = [
    { time: 2.0, strength: 0.8, is_downbeat: true, is_drop: true, type: "drop" },
    { time: 4.5, strength: 0.6, is_downbeat: false, is_drop: false, type: "normal" }
];
const clipDef = { start: 5.0, inPoint: 1.0, speed: 1.0, fps: 25.0 };
const mapped = UzbekUtils.beatsToTimeline(sampleBeats, clipDef);

assert.strictEqual(mapped.length, 2);
assert.strictEqual(mapped[0].audio_time, 2.0, "audio_time saqlanmadi!");
assert.strictEqual(mapped[0].time, 6.0, `Timeline time 6.0 bo'lishi kerak, olindi ${mapped[0].time}`);
assert.strictEqual(mapped[0].frame, 150, `Frame 150 bo'lishi kerak, olindi ${mapped[0].frame}`);
assert.strictEqual(mapped[0].is_drop, true, "is_drop bayrog'i saqlanmadi!");
assert.strictEqual(mapped[0].is_downbeat, true, "is_downbeat bayrog'i saqlanmadi!");
assert.strictEqual(mapped[0].type, "drop", "type saqlanmadi!");
console.log("  ✓ beatsToTimeline barcha metadata va bayroqlarni to'liq saqlab qoldi");


// ============================================================================
// 3. BeatManager.beatsForTimeline() DOM STUB TESTI
// ============================================================================
console.log("\n[3/3] BeatManager.beatsForTimeline() DOM stub testi...");

// Mock document for beats.js
const mockElements = {};
global.document = {
    getElementById: (id) => {
        if (!mockElements[id]) {
            mockElements[id] = {
                style: {},
                textContent: "",
                innerHTML: "",
                addEventListener: () => {},
                getContext: () => ({
                    clearRect: () => {},
                    beginPath: () => {},
                    arc: () => {},
                    fill: () => {},
                    stroke: () => {},
                    moveTo: () => {},
                    lineTo: () => {},
                    closePath: () => {}
                }),
                getBoundingClientRect: () => ({ left: 0, width: 800, height: 120 })
            };
        }
        return mockElements[id];
    },
    createElement: () => ({
        style: {},
        addEventListener: () => {},
        setAttribute: () => {},
        appendChild: () => {},
        click: () => {},
        remove: () => {}
    }),
    body: {
        appendChild: () => {},
        removeChild: () => {}
    },
    addEventListener: () => {}
};

// Load beats.js
const beatsJsPath = path.join(CLIENT_JS_DIR, 'beats.js');
assert(fs.existsSync(beatsJsPath), "client/js/beats.js topilmadi!");
const beatsJsCode = fs.readFileSync(beatsJsPath, 'utf8');
eval(beatsJsCode);

const BeatManager = global.BeatManager;
assert(BeatManager, "BeatManager obyekti yuklanmadi!");

// Test holati:
// Klip timeline'da start = 10.0 da boshlanadi
// Audio fayl ichidagi inPoint = 2.0, outPoint = 12.0
// Tezlik = 1.0, fps = 25.0
BeatManager.fps = 25.0;
BeatManager.clipStart = 10.0;
BeatManager.clipInPoint = 2.0;
BeatManager.clipOutPoint = 12.0;
BeatManager.clipSpeed = 1.0;

// Test zarbalari:
BeatManager.activeBeats = [
    { time: 0.5, strength: 0.8, is_downbeat: false, is_drop: false, type: "normal" },  // Bosh qirqimdan oldin (< 2.0) -> TUSHIB QOLISHI KERAK
    { time: 1.5, strength: 0.7, is_downbeat: false, is_drop: false, type: "normal" },  // Bosh qirqimdan oldin (< 2.0) -> TUSHIB QOLISHI KERAK
    { time: 2.0, strength: 0.9, is_downbeat: true,  is_drop: true,  type: "drop" },    // InPoint chegarasida (== 2.0) -> QOLADI -> timeline: 10.0
    { time: 4.0, strength: 0.6, is_downbeat: false, is_drop: false, type: "normal" },  // Klip ichida -> QOLADI -> timeline: 12.0
    { time: 8.0, strength: 0.6, is_downbeat: false, is_drop: false, type: "normal" },  // Klip ichida -> QOLADI -> timeline: 16.0
    { time: 12.0, strength: 0.9, is_downbeat: true, is_drop: false, type: "major" },   // OutPoint chegarasida (== 12.0) -> QOLADI -> timeline: 20.0
    { time: 13.5, strength: 0.5, is_downbeat: false, is_drop: false, type: "normal" }   // Oxirgi qirqimdan keyin (> 12.0) -> TUSHIB QOLISHI KERAK
];

const timelineResults = BeatManager.beatsForTimeline();

// Tekshiruvlar:
// 1. Faqat 4 ta beat qolishi kerak (2.0, 4.0, 8.0, 12.0)
assert.strictEqual(
    timelineResults.length,
    4,
    `Qirqilgan zarbalar to'g'ri filtrlanmadi: kutilgan 4, olindi ${timelineResults.length}`
);

// 2. audio_time va timeline time mosligi
const expectedTimes = [10.0, 12.0, 16.0, 20.0];
const expectedAudioTimes = [2.0, 4.0, 8.0, 12.0];

timelineResults.forEach((b, idx) => {
    assert.strictEqual(
        b.index,
        idx + 1,
        `Index ketma-ketligi buzilgan: ${b.index} !== ${idx + 1}`
    );
    assert.strictEqual(
        b.audio_time,
        expectedAudioTimes[idx],
        `audio_time noto'g'ri: ${b.audio_time} !== ${expectedAudioTimes[idx]}`
    );
    assert.strictEqual(
        b.time,
        expectedTimes[idx],
        `timeline time noto'g'ri: ${b.time} !== ${expectedTimes[idx]}`
    );
    assert(
        UzbekUtils.isOnFrame(b.time, 25.0),
        `Beat time ${b.time} 25 fps kadr panjarasida emas!`
    );
    assert.strictEqual(
        b.frame,
        Math.round(expectedTimes[idx] * 25.0),
        `Kadr raqami noto'g'ri: ${b.frame}`
    );
});

// Drop va downbeat saqlanishi
assert.strictEqual(timelineResults[0].type, "drop");
assert.strictEqual(timelineResults[0].is_drop, true);
assert.strictEqual(timelineResults[3].type, "major");

console.log("  ✓ beatsForTimeline() bosh va oxir qirqimlarini to'g'ri eladi va timeline kadrlariga joylashtirdi");

console.log("\n" + "=".repeat(60));
console.log("BARCHA JAVASCRIPT TESTLARI YASHIL! (100% SUCCESS)");
console.log("=".repeat(60));
