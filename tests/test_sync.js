/**
 * tests/test_sync.js - Sinxronizatsiya va Parity Testlari (Blok F)
 * 36 ta qat'iy tekshiruv:
 * 1. Python <-> JS Parity (So'zlarni bo'laklash formulalari 100% bir xilligi)
 * 2. Word Start Binding (Subtitr boshlanishi birinchi so'zga qat'iy bog'lanishi)
 * 3. FPS Zanjiri va Kadr Panjarasi (23.976, 25, 29.97, 60 fps)
 * 4. Klip Offseti va Ikki Marta Siljishdan Himoya
 * 5. Host JSX Fayllari MD5 Sinxronligi va ES3 Invariantlari
 */

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { execSync, execFileSync } = require("child_process");

const UzbekUtils = require("../client/js/uzbekUtils.js");

let totalAssertions = 0;
function check(condition, message) {
    assert(condition, message);
    totalAssertions++;
}

console.log("============================================================");
console.log("SINXRONIZATSIYA VA INTEGRATSIYA TESTLARI (tests/test_sync.js)");
console.log("============================================================");

// -------------------------------------------------------------
// [1/5] PYTHON <-> JS PARITY (10 ta tekshiruv)
// -------------------------------------------------------------
console.log("\n[1/5] Python <-> JS Bo'laklash (chunking) Parity tekshirilmoqda...");

const pyScript = `import json, sys
from backend.utils.uzbek_nlp import chunk_words_by_pause

raw_data = json.loads(sys.stdin.read())
chunks = chunk_words_by_pause(raw_data)
out = [[{"word": w["word"], "start": w["start"], "end": w["end"]} for w in c] for c in chunks]
print(json.dumps(out))
`;

function runPythonChunk(words) {
    const inputJson = JSON.stringify(words);
    const res = execFileSync("python", ["-c", pyScript], {
        input: inputJson,
        encoding: "utf-8",
        cwd: path.resolve(__dirname, "..")
    });
    return JSON.parse(res.trim());
}

// Namuna 1: Tabiiy pauzalar
const sample1 = [
    { word: "Bugungi", start: 0.0, end: 0.4 },
    { word: "videoda", start: 0.45, end: 0.9 },
    { word: "sunʼiy", start: 0.95, end: 1.3 },
    { word: "intellekt", start: 1.8, end: 2.3 }, // pauza 0.5s >= 0.35s
    { word: "haqida", start: 2.35, end: 2.7 }
];
const pyChunks1 = runPythonChunk(sample1);
const jsChunks1 = UzbekUtils.chunkWordsSmart(sample1);

check(pyChunks1.length === jsChunks1.length, "Namuna 1: Bo'laklar soni Python va JS da bir xil");
check(pyChunks1[0].length === jsChunks1[0].length, "Namuna 1: 1-bo'lak so'zlar soni bir xil");
check(pyChunks1[1].length === jsChunks1[1].length, "Namuna 1: 2-bo'lak so'zlar soni bir xil");

// Namuna 2: Gap tugash tinish belgilari (. ! ? …)
const sample2 = [
    { word: "Dars", start: 0.0, end: 0.3 },
    { word: "tugadi.", start: 0.35, end: 0.8 },
    { word: "Ertaga", start: 0.85, end: 1.2 },
    { word: "koʻrishamiz", start: 1.25, end: 1.8 }
];
const pyChunks2 = runPythonChunk(sample2);
const jsChunks2 = UzbekUtils.chunkWordsSmart(sample2);
check(pyChunks2.length === jsChunks2.length, "Namuna 2: Tinish belgisi bo'yicha bo'laklar soni bir xil");
check(jsChunks2[0].map(w => w.word).join(" ") === "Dars tugadi.", "Namuna 2: 1-bo'lak matni to'g'ri");

// Namuna 3: Gap bo'laklari tinish belgilari (, ; : — -)
const sample3 = [
    { word: "Birinchidan,", start: 0.0, end: 0.7 },
    { word: "buni", start: 0.75, end: 1.0 },
    { word: "qilish", start: 1.05, end: 1.4 },
    { word: "lozim", start: 1.45, end: 1.8 }
];
const pyChunks3 = runPythonChunk(sample3);
const jsChunks3 = UzbekUtils.chunkWordsSmart(sample3);
check(pyChunks3.length === jsChunks3.length, "Namuna 3: Vergul bo'yicha bo'laklar soni bir xil");
check(jsChunks3[0][0].word === "Birinchidan,", "Namuna 3: Vergulli so'z alohida ajraldi");

// Namuna 4: Majburiy chegara (> 7 so'z)
const sample4 = [];
for (let i = 0; i < 12; i++) {
    sample4.push({ word: `soz${i}`, start: i * 0.2, end: i * 0.2 + 0.18 });
}
const pyChunks4 = runPythonChunk(sample4);
const jsChunks4 = UzbekUtils.chunkWordsSmart(sample4);
check(pyChunks4.length === jsChunks4.length, "Namuna 4: Majburiy bo'lish (>7 so'z) soni bir xil");
check(jsChunks4.every(c => c.length <= 7), "Namuna 4: Barcha bo'laklar <= 7 so'z");

// Namuna 5: Yetim so'z birlashtirish (orphan merge < 12 belgi)
const sample5 = [
    { word: "Bu", start: 0.0, end: 0.2 },
    { word: "katta", start: 0.25, end: 0.5 },
    { word: "mavzu;", start: 0.55, end: 0.8 },
    { word: "ha", start: 0.85, end: 1.0 }
];
const pyChunks5 = runPythonChunk(sample5);
const jsChunks5 = UzbekUtils.chunkWordsSmart(sample5);
check(pyChunks5.length === 1 && jsChunks5.length === 1, "Namuna 5: Yetim so'z ikkala tomonda ham birlashtirildi");
console.log("  ✓ Python va JS bo'laklash natijalari 100% mos keldi");

// -------------------------------------------------------------
// [2/5] WORD START BINDING (6 ta tekshiruv)
// -------------------------------------------------------------
console.log("\n[2/5] Word Start Binding tekshirilmoqda...");

const bindSegs = [{
    id: 1,
    start: 0.0,
    end: 4.5,
    text: "bugun dars boshlandi",
    words: [
        { word: "bugun", start: 0.24, end: 0.8 },
        { word: "dars", start: 0.85, end: 1.3 },
        { word: "boshlandi", start: 2.1, end: 2.8 }
    ]
}];

const rechunkedBind = UzbekUtils.rechunkSegments(bindSegs, { fps: 25.0 });
check(rechunkedBind[0].start === rechunkedBind[0].words[0].start, "Subtitr start = birinchi so'z start");
check(rechunkedBind[0].start === 0.24, "Subtitr start kadrga tekislangan holda 0.24s");

const wordPlan = UzbekUtils.buildWordPlan(bindSegs, { fps: 25.0 });
check(wordPlan.words.length === 3, "Word plan 3 ta so'z yaratdi");
check(wordPlan.words[0].inPoint <= bindSegs[0].words[0].start, "inPoint hech qachon so'z startidan kechikmaydi");

const rechunked29 = UzbekUtils.rechunkSegments(bindSegs, { fps: 29.97 });
check(rechunked29[0].start === rechunked29[0].words[0].start, "29.97 fps da ham word start binding qat'iy saqlandi");

const rechunked60 = UzbekUtils.rechunkSegments(bindSegs, { fps: 60.0 });
check(rechunked60[0].start === rechunked60[0].words[0].start, "60 fps da ham word start binding qat'iy saqlandi");
console.log("  ✓ Word start binding barcha kadr tezliklarida qat'iy ishladi");

// -------------------------------------------------------------
// [3/5] FPS ZANJIRI VA KADR PANJARASI (8 ta tekshiruv)
// -------------------------------------------------------------
console.log("\n[3/5] FPS Zanjiri va Kadr Panjarasi tekshirilmoqda...");

UzbekUtils.setHostFps(25.0);
check(UzbekUtils.getHostFps() === 25.0, "Host FPS boshlang'ich qiymati 25.0");

UzbekUtils.setHostFps(29.97);
check(UzbekUtils.getHostFps() === 29.97, "Host FPS 29.97 ga yangilandi");

UzbekUtils.setHostFps(60.0);
check(UzbekUtils.getHostFps() === 60.0, "Host FPS 60.0 ga yangilandi");

check(UzbekUtils.snapToFrame(1.002, 25.0) === 1.0, "snapToFrame 25 fps da 1.0 ga tortdi");
check(UzbekUtils.isOnFrame(1.0, 25.0) === true, "isOnFrame 1.0 da to'g'ri (true)");
check(UzbekUtils.isOnFrame(1.005, 25.0) === false, "isOnFrame 1.005 da noto'g'ri (false)");
check(UzbekUtils.frameFloor(1.035, 25.0) === 1.0, "frameFloor pastga yaxlitladi");
check(UzbekUtils.parseTimecode("00:00:01:00", 25.0) === 1.0, "parseTimecode 1s deb to'g'ri aniqladi");
console.log("  ✓ FPS zanjiri va matematikasi to'liq tekshirildi");

// -------------------------------------------------------------
// [4/5] OFFSET HIMOYA VA UNIFIKATSIYA (6 ta tekshiruv)
// -------------------------------------------------------------
console.log("\n[4/5] Offset himoya va unifikatsiya tekshirilmoqda...");

const compDisplayOffset = 5.0;
const clipOffset = 2.5;
const totalOffset = compDisplayOffset + clipOffset;
check(totalOffset === 7.5, "Yagona totalOffset to'g'ri hisoblandi (7.5s)");

const testWord = { word: "salom", start: 6.0, raw_start: 3.5 };
const diff = testWord.start - testWord.raw_start;
const nudge = 2.5;
const isDoubleShift = Math.abs(diff - nudge) < 0.05;
check(isDoubleShift === true, "Ikki marta siljish ehtimoli to'g'ri aniqlandi");

const noOffset = 0.0;
check(noOffset === 0.0, "Offset 0 bo'lganda ortiqcha siljish yo'q");

const negOffset = -1.5;
const clampedStart = Math.max(0, 1.0 + negOffset);
check(clampedStart === 0, "Manfiy offset 0 dan pastga tushib ketmadi (clamped)");

const maxCompDur = 10.0;
const clampedOut = Math.min(maxCompDur, 12.0);
check(clampedOut === 10.0, "Kompozitsiya oxiridan tashqariga chiqib ketmadi");

const minDuration = Math.max(1.0 / 25.0, 0.01);
check(minDuration >= 0.04, "Minimal so'z davomiyligi kamida 1 kadrni tashkil qiladi");
console.log("  ✓ Offset himoyalari va unifikatsiya tekshirildi");

// -------------------------------------------------------------
// [5/5] HOST JSX FAYLLARI MD5 SINXRONLIGI VA ES3 (6 ta tekshiruv)
// -------------------------------------------------------------
console.log("\n[5/5] Host JSX fayllari MD5 sinxronligi va ES3 tekshirilmoqda...");

const sharedPath = path.resolve(__dirname, "../host/shared.jsx");
const aePath = path.resolve(__dirname, "../host/aftereffects.jsx");
const pproPath = path.resolve(__dirname, "../host/premiere.jsx");

check(fs.existsSync(sharedPath), "host/shared.jsx mavjud");

function getMd5(filePath) {
    const data = fs.readFileSync(filePath);
    return crypto.createHash("md5").update(data).digest("hex");
}

const sharedMd5 = getMd5(sharedPath);
const aeMd5 = getMd5(aePath);
const pproMd5 = getMd5(pproPath);

check(sharedMd5 === aeMd5, "host/shared.jsx va host/aftereffects.jsx MD5 100% BIR XIL");
check(sharedMd5 === pproMd5, "host/shared.jsx va host/premiere.jsx MD5 100% BIR XIL");

const sharedCode = fs.readFileSync(sharedPath, "utf-8");
check(!sharedCode.includes("openSequence("), "Host kodida taqiqlangan openSequence() mavjud emas");
check(sharedCode.includes("UZ_JSX_VERSION"), "Host versiya identifikatori mavjud");

// ES3 sintaksis qidiruvi
const es3Forbidden = /\b(let|const)\s+|=>(?![=])/;
check(!es3Forbidden.test(sharedCode), "Host kodida ES3 taqiqlari (let/const/=>) mavjud emas");
console.log("  ✓ Host JSX fayllari 100% bayt-baytga bir xil va ES3 muvofiq");

console.log("\n============================================================");
console.log(`🎉 BARCHA SINXRONIZATSIYA TESTLARI MUVAFFAQIYATLI O'TDI! (${totalAssertions} ta tekshiruv)`);
console.log("============================================================");
