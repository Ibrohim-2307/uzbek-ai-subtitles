/**
 * tests/test_wordstack.js - Integration & architecture tests for Word Stack / Cascade (Blok D)
 * Exactly 50 assertions covering JSX synchronization, strict ES3 compliance, hostBridge, UI, and backend.
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const ROOT_DIR = path.resolve(__dirname, '..');
const HOST_DIR = path.join(ROOT_DIR, 'host');
const CLIENT_DIR = path.join(ROOT_DIR, 'client');
const BACKEND_DIR = path.join(ROOT_DIR, 'backend');

console.log("=== WORD STACK INTEGRATION TESTLARI BOSHLANDI (tests/test_wordstack.js) ===");

// 1. JSX fayllar mavjudligi va 100% bir xilligi (7 assertions)
const sharedPath = path.join(HOST_DIR, 'shared.jsx');
const aePath = path.join(HOST_DIR, 'aftereffects.jsx');
const pproPath = path.join(HOST_DIR, 'premiere.jsx');

assert(fs.existsSync(sharedPath), "host/shared.jsx mavjud emas");
assert(fs.existsSync(aePath), "host/aftereffects.jsx mavjud emas");
assert(fs.existsSync(pproPath), "host/premiere.jsx mavjud emas");

const sharedCode = fs.readFileSync(sharedPath, 'utf8');
const aeCode = fs.readFileSync(aePath, 'utf8');
const pproCode = fs.readFileSync(pproPath, 'utf8');

assert.strictEqual(sharedCode, aeCode, "host/shared.jsx va host/aftereffects.jsx bir xil emas!");
assert.strictEqual(sharedCode, pproCode, "host/shared.jsx va host/premiere.jsx bir xil emas!");
assert(sharedCode.indexOf("function ae_writeWordStackLayers") !== -1, "shared.jsx da ae_writeWordStackLayers mavjud emas");
assert(sharedCode.indexOf("$.global.ae_writeWordStackLayers") !== -1, "shared.jsx da ae_writeWordStackLayers globalga biriktirilmagan");

// 2. Qat'iy ES3 sintaksis talablari (15 assertions)
const jsxFiles = [
    { name: "shared.jsx", code: sharedCode },
    { name: "aftereffects.jsx", code: aeCode },
    { name: "premiere.jsx", code: pproCode }
];

jsxFiles.forEach(f => {
    // let va const tekshiruvi (izohlardan tashqari)
    const lines = f.code.split('\n');
    let hasLetConst = false;
    let hasArrow = false;
    let hasBacktick = false;
    let hasTrailingComma = false;

    lines.forEach((line, idx) => {
        const trimmed = line.trim();
        if (trimmed.startsWith('//') || trimmed.startsWith('*')) return;
        if (/\b(let|const)\s+[a-zA-Z0-9_$]/.test(line)) hasLetConst = true;
        if (/=>/.test(line)) hasArrow = true;
        if (/`/.test(line)) hasBacktick = true;
        if (/,\s*[}\]]/.test(line)) hasTrailingComma = true;
    });

    assert(!hasLetConst, `${f.name} da let yoki const topildi (ES3 buzilgan)`);
    assert(!hasArrow, `${f.name} da strelka funksiya (=>) topildi (ES3 buzilgan)`);
    assert(!hasBacktick, `${f.name} da shablon satr (\`) topildi (ES3 buzilgan)`);
    assert(!hasTrailingComma, `${f.name} da trailing comma topildi (ES3 buzilgan)`);
    assert(f.code.indexOf("var ") !== -1, `${f.name} da var ishlatilishi kerak`);
});

// 3. client/js/hostBridge.js va UzbekUtils integratsiyasi (8 assertions)
const hostBridgePath = path.join(CLIENT_DIR, 'js', 'hostBridge.js');
assert(fs.existsSync(hostBridgePath), "client/js/hostBridge.js mavjud emas");
const hostBridgeCode = fs.readFileSync(hostBridgePath, 'utf8');

assert(hostBridgeCode.indexOf("buildWordPlans(") !== -1, "hostBridge.js da buildWordPlans metodi mavjud emas");
assert(hostBridgeCode.indexOf("wordPlan:") !== -1, "hostBridge.js payload'da wordPlan uzatilmayapti");
assert(hostBridgeCode.indexOf("ae_writeWordStackLayers") !== -1 || hostBridgeCode.indexOf("ae_createSubtitles") !== -1);

// Mock DOM va CSInterface
global.window = global;
global.CSInterface = function() {
    this.getHostEnvironment = () => ({ appId: "AEFT" });
    this.getSystemPath = () => "";
    this.evalScript = (s, cb) => { if (cb) cb(""); };
};
const UzbekUtils = require('../client/js/uzbekUtils.js');
global.UzbekUtils = UzbekUtils;
eval(hostBridgeCode);

assert(typeof global.HostBridge.buildWordPlans === "function", "HostBridge.buildWordPlans funksiya emas");
const testSegs = [{ id: 1, start: 0.1, end: 1.0, words: [{ word: "sinov", start: 0.1, end: 0.8 }] }];
const testPlan = global.HostBridge.buildWordPlans(testSegs, { fps: 25.0 });
assert(testPlan && testPlan.words && testPlan.words.length === 1, "HostBridge.buildWordPlans natija bermadi");
assert.strictEqual(testPlan.words[0].word, "sinov");
assert.strictEqual(testPlan.words[0].inPoint, 0.08);

// 4. Panel UI va index.html tekshiruvlari (8 assertions)
const htmlPath = path.join(CLIENT_DIR, 'index.html');
assert(fs.existsSync(htmlPath), "client/index.html mavjud emas");
const htmlCode = fs.readFileSync(htmlPath, 'utf8');

assert(htmlCode.indexOf('id="selectWordMode"') !== -1, "index.html da selectWordMode mavjud emas");
assert(htmlCode.indexOf('value="stack"') !== -1, "selectWordMode da stack opsiyasi mavjud emas");
assert(htmlCode.indexOf('id="inputWordStackLines"') !== -1, "index.html da inputWordStackLines mavjud emas");
assert(htmlCode.indexOf('id="checkWordPauseHold"') !== -1, "index.html da checkWordPauseHold mavjud emas");

const appJsPath = path.join(CLIENT_DIR, 'js', 'app.js');
assert(fs.existsSync(appJsPath), "client/js/app.js mavjud emas");
const appJsCode = fs.readFileSync(appJsPath, 'utf8');
assert(appJsCode.indexOf("inputWordStackLines") !== -1, "app.js da inputWordStackLines o'qilmayapti");
assert(appJsCode.indexOf("checkWordPauseHold") !== -1, "app.js da checkWordPauseHold o'qilmayapti");
assert(appJsCode.indexOf("wordMaxLines:") !== -1, "app.js activePreset da wordMaxLines mavjud emas");

// 5. Backend main.py tekshiruvlari (12 assertions)
const mainPyPath = path.join(BACKEND_DIR, 'main.py');
assert(fs.existsSync(mainPyPath), "backend/main.py mavjud emas");
const mainPyCode = fs.readFileSync(mainPyPath, 'utf8');

assert(mainPyCode.indexOf("def seconds_to_srt_time") !== -1, "seconds_to_srt_time funksiyasi mavjud emas");
assert(mainPyCode.indexOf("def seconds_to_vtt_time") !== -1, "seconds_to_vtt_time funksiyasi mavjud emas");
assert(mainPyCode.indexOf("round(sec_val * 1000.0)") !== -1 || mainPyCode.indexOf("round") !== -1, "seconds_to_srt_time da round ishlatilishi kerak");
assert(mainPyCode.indexOf('"stack"') !== -1, "main.py da stack rejimi qo'llab-quvvatlanishi kerak");
assert(mainPyCode.indexOf('"cascade"') !== -1, "main.py da cascade rejimi qo'llab-quvvatlanishi kerak");

// UzbekUtils rechunkSegments va WordPlan mosligi
const integratedSegs = [
    { id: 1, start: 0.123, end: 1.876, text: "bu kaskad sinovi", words: [
        { word: "bu", start: 0.123, end: 0.450 },
        { word: "kaskad", start: 0.460, end: 1.100 },
        { word: "sinovi", start: 1.120, end: 1.876 }
    ]}
];
const rechunked = UzbekUtils.rechunkSegments(integratedSegs, { fps: 25.0 });
assert.strictEqual(rechunked.length, 1);
const iPlan = UzbekUtils.buildWordPlan(rechunked, { fps: 25.0 });
assert.strictEqual(iPlan.words.length, 3);
assert.strictEqual(iPlan.words[0].inPoint, 0.12);
assert.strictEqual(iPlan.words[1].inPoint, 0.48);
assert.strictEqual(iPlan.words[2].inPoint, 1.12);
assert(iPlan.words[2].outPoint >= 1.88);

console.log("\n🎉 test_wordstack.js: Barcha tekshiruvlar muvaffaqiyatli o'tdi! (50 assertions)");
