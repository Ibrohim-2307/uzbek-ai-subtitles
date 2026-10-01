/**
 * tests/test_wordstack_ae.js - Real execution test of ExtendScript ae_writeWordStackLayers in a simulated AE environment
 * Exactly 56 assertions covering mock AE comp, layer generation, pop/fade keyframes, line shifting, 60fps, clip offset, and clamping.
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log("=== MOCK AE EXTENDSCRIPT SO'Z KASKAD TESTLARI BOSHLANDI (tests/test_wordstack_ae.js) ===");

// 1. Mock After Effects Object Model
function createMockProperty(name, defaultValue) {
    return {
        name: name,
        value: defaultValue,
        keyframes: [],
        children: {},
        setValue: function(v) { this.value = v; },
        setValueAtTime: function(t, v) { this.keyframes.push({ time: t, value: v }); },
        property: function(subName) {
            if (!this.children[subName]) {
                this.children[subName] = createMockProperty(subName, null);
            }
            return this.children[subName];
        },
        addProperty: function(propType) {
            const p = createMockProperty(propType, null);
            this.children[propType] = p;
            return p;
        }
    };
}

function CompItem() {}
global.CompItem = CompItem;

function createMockComp(options = {}) {
    const fps = options.fps || 25.0;
    const dur = options.duration || 30.0;
    const displayStart = options.displayStartTime || 0.0;
    const w = options.width || 1920;
    const h = options.height || 1080;

    const layersList = [];

    const comp = Object.create(CompItem.prototype);
    Object.assign(comp, {
        name: "MockComp",
        width: w,
        height: h,
        frameRate: fps,
        duration: dur,
        displayStartTime: displayStart,
        time: 0.0,
        selectedLayers: [],
        layers: {
            addText: function(text) {
                const layer = {
                    name: text,
                    comment: "",
                    startTime: 0.0,
                    inPoint: 0.0,
                    outPoint: dur,
                    removed: false,
                    props: {
                        "Source Text": createMockProperty("Source Text", {
                            text: text,
                            fontSize: 50,
                            font: "ArialMT",
                            fillColor: [1, 1, 1],
                            applyFill: true,
                            strokeColor: [0, 0, 0],
                            strokeWidth: 2,
                            applyStroke: true,
                            justification: 1
                        }),
                        "Position": createMockProperty("Position", [w / 2, h * 0.85]),
                        "Scale": createMockProperty("Scale", [100, 100]),
                        "Opacity": createMockProperty("Opacity", 100),
                        "Text": createMockProperty("Text", null)
                    },
                    property: function(pName) {
                        if (!this.props[pName]) {
                            this.props[pName] = createMockProperty(pName, null);
                        }
                        return this.props[pName];
                    },
                    remove: function() {
                        this.removed = true;
                        const idx = layersList.indexOf(this);
                        if (idx !== -1) layersList.splice(idx, 1);
                    }
                };
                layersList.push(layer);
                return layer;
            }
        },
        layer: function(idx) { return layersList[idx - 1]; },
        _allLayers: layersList
    });

    Object.defineProperty(comp, "numLayers", {
        get: function() { return layersList.length; },
        configurable: true,
        enumerable: true
    });

    return comp;
}

// Global ExtendScript environment setup
global.ParagraphJustification = { CENTER_JUSTIFY: 1 };
global.app = {
    project: { activeItem: null },
    beginUndoGroup: function() {},
    endUndoGroup: function() {}
};
global.$ = { global: global };

// Load host/shared.jsx into global context
const sharedJsxCode = fs.readFileSync(path.join(__dirname, '..', 'host', 'shared.jsx'), 'utf8');
eval(sharedJsxCode);

assert(typeof ae_writeWordStackLayers === "function", "ae_writeWordStackLayers yuklanmadi");
assert(typeof ae_createSubtitles === "function", "ae_createSubtitles yuklanmadi");

const UzbekUtils = require('../client/js/uzbekUtils.js');

// ============================================================================
// TEST 1: Bitta so'z animatsiyasi (12 assertions)
// ============================================================================
const comp1 = createMockComp({ fps: 25.0 });
const singleWordSeg = [{ id: 1, start: 1.0, end: 1.5, words: [{ word: "salom", start: 1.0, end: 1.5 }] }];
const plan1 = UzbekUtils.buildWordPlan(singleWordSeg, { fps: 25.0, pauseHold: true });

const res1Raw = ae_writeWordStackLayers(comp1, plan1, { wordAnimation: "pop" }, {});
const res1 = JSON.parse(res1Raw);

assert.strictEqual(res1.ok, true, "res1 ok bo'lishi kerak");
assert.strictEqual(res1.count, 1, "1 ta qatlam yaratilishi kerak");
assert.strictEqual(comp1._allLayers.length, 1, "Kompozitsiyada faqat 1 ta qatlam qolishi kerak (andoza o'chirilgan)");

const layer1 = comp1._allLayers[0];
assert.strictEqual(layer1.name, "[UZ_WORD] salom");
assert.strictEqual(layer1.comment, "UZ_AI_SUBTITLE");
assert.strictEqual(layer1.inPoint, 1.0);
assert(layer1.outPoint > 1.5);
assert.strictEqual(layer1.property("Source Text").keyframes.length, 0, "Source Text da kalit bo'lmasligi kerak (bo'shatish taqiqlangan)");

const scaleKeys1 = layer1.property("Scale").keyframes;
assert(scaleKeys1.length >= 3, "Pop animatsiyasi uchun kamida 3 ta Scale kaliti kerak");
assert.deepStrictEqual(scaleKeys1[0].value, [88, 88]);
assert.deepStrictEqual(scaleKeys1[1].value, [112, 112]);
assert.deepStrictEqual(scaleKeys1[2].value, [100, 100]);
assert(layer1.property("Opacity").keyframes.length >= 1, "Yopilish opacity kaliti bo'lishi kerak");

// ============================================================================
// TEST 2: Kaskadli 3 ta so'z va qator surilishi (12 assertions)
// ============================================================================
const comp2 = createMockComp({ fps: 25.0 });
const rapidSegs = [
    { id: 1, start: 0.0, end: 0.4, words: [{ word: "bir", start: 0.0, end: 0.4 }] },
    { id: 2, start: 0.2, end: 0.6, words: [{ word: "ikki", start: 0.2, end: 0.6 }] },
    { id: 3, start: 0.4, end: 0.8, words: [{ word: "uch", start: 0.4, end: 0.8 }] }
];
const plan2 = UzbekUtils.buildWordPlan(rapidSegs, { fps: 25.0, maxLines: 2 });
const res2 = JSON.parse(ae_writeWordStackLayers(comp2, plan2, { wordAnimation: "pop" }, {}));

assert.strictEqual(res2.ok, true);
assert.strictEqual(res2.count, 3);
assert.strictEqual(comp2._allLayers.length, 3);

const lBir = comp2._allLayers[0];
const lIkki = comp2._allLayers[1];
const lUch = comp2._allLayers[2];

assert.strictEqual(lBir.name, "[UZ_WORD] bir");
assert.strictEqual(lIkki.name, "[UZ_WORD] ikki");
assert.strictEqual(lUch.name, "[UZ_WORD] uch");

// lIkki 1-qatordan 0-qatorga surilishi kerak (Position kaliti)
const posKeysIkki = lIkki.property("Position").keyframes;
assert(posKeysIkki.length >= 2, "Ikkinchi qatlamda surilish uchun 2 ta Position kaliti kerak");
assert(posKeysIkki[0].value[1] > posKeysIkki[1].value[1], "Y pozitsiyasi tepaga (kichikroq Y ga) surilishi kerak");
assert(lBir.outPoint <= lUch.inPoint, "lBir lUch chiqqanda yopilgan bo'lishi kerak");
assert.strictEqual(lBir.property("Source Text").keyframes.length, 0);
assert.strictEqual(lIkki.property("Source Text").keyframes.length, 0);
assert.strictEqual(lUch.property("Source Text").keyframes.length, 0);

// ============================================================================
// TEST 3: 60 FPS kadr panjarasi (8 assertions)
// ============================================================================
const comp60 = createMockComp({ fps: 60.0 });
const seg60 = [{ id: 1, start: 0.05, end: 0.25, words: [{ word: "tez", start: 0.05, end: 0.25 }] }];
const plan60 = UzbekUtils.buildWordPlan(seg60, { fps: 60.0 });
const res60 = JSON.parse(ae_writeWordStackLayers(comp60, plan60, { wordAnimation: "fade" }, {}));

assert.strictEqual(res60.ok, true);
assert.strictEqual(comp60._allLayers.length, 1);
const lTez = comp60._allLayers[0];
assert(UzbekUtils.isOnFrame(lTez.inPoint, 60.0), `60 fps da inPoint kadrda emas: ${lTez.inPoint}`);
assert(UzbekUtils.isOnFrame(lTez.outPoint, 60.0), `60 fps da outPoint kadrda emas: ${lTez.outPoint}`);
const opKeys60 = lTez.property("Opacity").keyframes;
assert(opKeys60.length >= 2, "Fade animatsiyasi uchun Opacity kalitlari bo'lishi kerak");
assert.strictEqual(opKeys60[0].value, 0);
assert.strictEqual(opKeys60[1].value, 100);
assert.strictEqual(lTez.property("Source Text").keyframes.length, 0);

// ============================================================================
// TEST 4: Klip offset va DisplayStartTime (8 assertions)
// ============================================================================
const compOffset = createMockComp({ fps: 25.0, displayStartTime: 5.0 });
const segOff = [{ id: 1, start: 1.0, end: 2.0, words: [{ word: "offsetli", start: 1.0, end: 2.0 }] }];
const planOff = UzbekUtils.buildWordPlan(segOff, { fps: 25.0 });
const resOff = JSON.parse(ae_writeWordStackLayers(compOffset, planOff, {}, { clipOffset: 3.0 }));

assert.strictEqual(resOff.ok, true);
assert.strictEqual(compOffset._allLayers.length, 1);
const lOff = compOffset._allLayers[0];
// Kutilgan inPoint = 1.0 + 5.0 (displayStart) + 3.0 (clipOffset) = 9.0s
assert.strictEqual(lOff.inPoint, 9.0, `Offsetli inPoint 9.0 bo'lishi kerak, lekin: ${lOff.inPoint}`);
assert.strictEqual(lOff.startTime, 9.0);
assert(lOff.outPoint > 9.0);
assert.strictEqual(lOff.name, "[UZ_WORD] offsetli");
assert.strictEqual(lOff.comment, "UZ_AI_SUBTITLE");
assert.strictEqual(lOff.property("Source Text").keyframes.length, 0);

// ============================================================================
// TEST 5: Kompozitsiya chegaralariga qisqarish (Clamping) (8 assertions)
// ============================================================================
const compClamp = createMockComp({ fps: 25.0, duration: 10.0 });
const segClamp = [
    { id: 1, start: 8.0, end: 12.0, words: [{ word: "uzoq", start: 8.0, end: 12.0 }] },
    { id: 2, start: 15.0, end: 18.0, words: [{ word: "tashqarida", start: 15.0, end: 18.0 }] }
];
const planClamp = UzbekUtils.buildWordPlan(segClamp, { fps: 25.0 });
const resClamp = JSON.parse(ae_writeWordStackLayers(compClamp, planClamp, {}, {}));

assert.strictEqual(resClamp.ok, true);
// Faqat birinchi so'z qo'yilishi kerak, ikkinchisi 10.0s dan keyin bo'lgani uchun o'tkazib yuboriladi
assert.strictEqual(resClamp.count, 1);
assert.strictEqual(compClamp._allLayers.length, 1);
const lClamp = compClamp._allLayers[0];
assert.strictEqual(lClamp.name, "[UZ_WORD] uzoq");
assert.strictEqual(lClamp.inPoint, 8.0);
assert.strictEqual(lClamp.outPoint, 10.0, "Komp davomiyligiga (10.0) qisqarishi kerak");
assert.strictEqual(lClamp.property("Source Text").keyframes.length, 0);

// ============================================================================
// TEST 6: ae_createSubtitles umumiy integratsiyasi (8 assertions)
// ============================================================================
const compFull = createMockComp({ fps: 25.0 });
app.project.activeItem = compFull;

// Eski qatlam qo'shib qo'yamiz (tozalanishini tekshirish uchun)
const oldLayer = compFull.layers.addText("Eski Subtitr");
oldLayer.comment = "UZ_AI_SUBTITLE";

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

const payloadFull = {
    segments: sampleSegs,
    wordPlan: plan,
    style: { wordAnimation: "pop" }
};
const fullResRaw = ae_createSubtitles(JSON.stringify(payloadFull));
const fullRes = JSON.parse(fullResRaw);

assert.strictEqual(fullRes.ok, true);
assert.strictEqual(fullRes.count, 3);
assert.strictEqual(compFull._allLayers.length, 3);
assert.strictEqual(compFull._allLayers[0].name, "[UZ_WORD] oʻzbekiston");
assert.strictEqual(compFull._allLayers[1].name, "[UZ_WORD] kelajagi");
assert.strictEqual(compFull._allLayers[2].name, "[UZ_WORD] buyuk");
assert.strictEqual(compFull._allLayers[0].comment, "UZ_AI_SUBTITLE");
assert.strictEqual(compFull._allLayers[0].property("Source Text").keyframes.length, 0);

console.log("\n🎉 test_wordstack_ae.js: Barcha simulyatsiya tekshiruvlari muvaffaqiyatli o'tdi! (56 assertions)");
