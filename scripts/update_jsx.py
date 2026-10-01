import re

new_ppro = '''function ppro_insertMogrtSubtitles(payloadJson) {
    try {
        var seq = ppro_getSeq();
        if (!seq) {
            return JSON.stringify({ ok: false, success: false, message: "Aktiv sequence topilmadi" });
        }

        var dataStr = payloadJson;
        try {
            if (dataStr.indexOf("%7B") !== -1 || dataStr.indexOf("%22") !== -1) {
                dataStr = decodeURIComponent(dataStr);
            }
        } catch (decErr) {}

        var data = JSON.parse(dataStr);
        var mogrtPath = data.mogrtPath || "";
        var segments = data.segments || [];

        // Standart MOGRT fayli
        var mogrtFile = null;
        if (mogrtPath) {
            mogrtFile = new File(mogrtPath);
        }

        // Foydalanuvchi videosi joylashgan trekning bevosita tepasidagi trek (masalan: V1 ustidagi V2)
        var targetTrackIndex = ppro_findTargetVideoTrackIndex(seq);

        // Oldingi joylashtirilgan barcha subtitrlarni tozalash (ustma-ust minmasligi va boshqa qatordan yangi qo'shilmasligi uchun)
        ppro_cleanupOldSubtitles(seq, targetTrackIndex);

        var insertedCount = 0;
        var leadInSec = (typeof data.leadIn === "number") ? data.leadIn : 0.0;
        var prevEnd = 0.0;
        var lastTrackItem = null;
        var lastActualStart = 0.0;

        for (var i = 0; i < segments.length; i++) {
            var seg = segments[i];
            var segText = (seg.text || "").trim();
            if (!segText) continue;

            // Segment o'z shabloniga ega bo'lishi mumkin (men hohlagan joyini hohlagan animatsiyada qila oley)
            var currentMogrtPath = seg.mogrtPath || mogrtPath;
            var currentMogrtFile = currentMogrtPath ? new File(currentMogrtPath) : mogrtFile;
            if (!currentMogrtFile || !currentMogrtFile.exists) {
                currentMogrtFile = mogrtFile;
            }
            if (!currentMogrtFile || !currentMogrtFile.exists) continue;

            var sStart = parseFloat(seg.start) || 0.0;
            var sEnd = parseFloat(seg.end) || (sStart + 1.0);

            // Agar so'zlar bo'lsa, nutq aytilishining aniq birinchi va oxirgi vaqtini olish
            if (seg.words && seg.words.length > 0) {
                var firstWordStart = parseFloat(seg.words[0].start);
                if (!isNaN(firstWordStart) && firstWordStart >= 0) {
                    sStart = firstWordStart;
                }
                var lastWordEnd = parseFloat(seg.words[seg.words.length - 1].end);
                if (!isNaN(lastWordEnd) && lastWordEnd > sStart) {
                    sEnd = lastWordEnd;
                }
            }

            // Animatsiya chiqish vaqtini hisobga olish (lead-in):
            // Nutq boshlanishidan 0.15s oldin animatsiya boshlanadi, nutq aytilayotganda matn to'liq ko'rinib turadi
            var actualStart = Math.max(0, sStart - leadInSec);
            if (actualStart < prevEnd) {
                if (lastTrackItem && actualStart > lastActualStart + 0.1) {
                    try {
                        var trimT = new Time();
                        trimT.seconds = actualStart;
                        lastTrackItem.end = trimT;
                        prevEnd = actualStart;
                    } catch (tErr) {
                        actualStart = prevEnd;
                    }
                } else {
                    actualStart = prevEnd;
                }
            }
            var actualEnd = Math.max(actualStart + 0.25, sEnd);
            prevEnd = actualEnd;

            var timeTicks = String(Math.round(actualStart * 254016000000));

            try {
                // To'g'ridan-to'g'ri VIDEO TREKKA (V2) import qilish! Hech qanday C1 caption trek ochilmaydi!
                var newTrackItem = seq.importMGT(currentMogrtFile.fsName, timeTicks, targetTrackIndex, 0);
                if (newTrackItem) {
                    var outTicks = new Time();
                    outTicks.seconds = actualEnd;
                    newTrackItem.end = outTicks;

                    var animTag = seg.styleName || "";
                    if (!animTag && currentMogrtFile) {
                        animTag = decodeURIComponent(currentMogrtFile.name).replace(/\.mogrt$/i, "").replace(/[_-]/g, " ");
                    }
                    if (!animTag) animTag = "Subtitr " + (i + 1);

                    var shortText = segText.length > 25 ? (segText.substring(0, 22) + "...") : segText;
                    newTrackItem.name = "[" + animTag + "] " + shortText;
                    lastTrackItem = newTrackItem;
                    lastActualStart = actualStart;

                    var mgtComp = newTrackItem.getMGTComponent();
                    if (mgtComp && mgtComp.properties) {
                        var textSet = false;

                        for (var p = 0; p < mgtComp.properties.numItems; p++) {
                            var prop = mgtComp.properties[p];
                            var pName = (prop.displayName || prop.name || "").toLowerCase();

                            // Matn parametrlari ro'yxati (barcha 26 ta MOGRT dagi text control nomlari)
                            var isLikelyTextName = (
                                pName.indexOf("hello_box") !== -1 ||
                                pName.indexOf("zoomin") !== -1 ||
                                pName.indexOf("butter up") !== -1 ||
                                pName.indexOf("butter") !== -1 ||
                                pName.indexOf("txt") !== -1 ||
                                pName.indexOf("text") !== -1 ||
                                pName.indexOf("source") !== -1 ||
                                pName.indexOf("caption") !== -1 ||
                                pName.indexOf("title") !== -1 ||
                                pName.indexOf("matn") !== -1 ||
                                pName.indexOf("line") !== -1 ||
                                pName.indexOf("bhanu") !== -1 ||
                                pName.indexOf("prakash") !== -1 ||
                                pName.indexOf("rock") !== -1 ||
                                pName.indexOf("solidance") !== -1 ||
                                pName.indexOf("santhosham") !== -1 ||
                                pName.indexOf("slide") !== -1 ||
                                pName.indexOf("collide") !== -1 ||
                                pName.indexOf("asosiy son") !== -1 ||
                                pName.indexOf("birinichisi") !== -1 ||
                                pName.indexOf("coolvetica") !== -1 ||
                                pName.indexOf("wavingof") !== -1
                            );

                            try {
                                var val = prop.getValue();
                                if (typeof val === "string") {
                                    if (val.indexOf("textEditValue") !== -1 || isLikelyTextName) {
                                        try {
                                            var textObj = JSON.parse(val);
                                            if (textObj && typeof textObj === "object") {
                                                textObj.textEditValue = segText;
                                                textObj.fontTextRunLength = [segText.length];
                                                prop.setValue(JSON.stringify(textObj), true);
                                                textSet = true;
                                            } else {
                                                prop.setValue(segText, true);
                                                textSet = true;
                                            }
                                        } catch (jErr) {
                                            prop.setValue(segText, true);
                                            textSet = true;
                                        }
                                    }
                                } else if (isLikelyTextName) {
                                    try {
                                        prop.setValue(segText, true);
                                        textSet = true;
                                    } catch (sErr) {
                                        try { prop.setValue(segText); textSet = true; } catch (sErr2) {}
                                    }
                                }
                            } catch (propErr) {}

                            // Karaoke so'zma-so'z vaqt slayderlarini o'rnatish (Word Start Time 1..12)
                            if (pName.indexOf("word start time") !== -1 && seg.words && seg.words.length > 0) {
                                var wordMatch = pName.match(/\\d+/);
                                if (wordMatch) {
                                    var wIdx = parseInt(wordMatch[0], 10) - 1;
                                    if (wIdx >= 0 && wIdx < seg.words.length) {
                                        var wordObj = seg.words[wIdx];
                                        var wordRelStart = Math.max(0, parseFloat(wordObj.start) - sStart);
                                        try {
                                            prop.setValue(wordRelStart, true);
                                        } catch (wErr) {
                                            try { prop.setValue(wordRelStart); } catch (wErr2) {}
                                        }
                                    }
                                }
                            }

                            // Real Time / Highlight checkbox
                            if (pName.indexOf("real time") !== -1) {
                                try { prop.setValue(1, true); } catch (rtErr) {}
                            }
                        }

                        // Agar yuqorida aniqlanmagan bo'lsa, qolgan string xususiyatlarni tekshirish
                        if (!textSet) {
                            for (var p2 = 0; p2 < mgtComp.properties.numItems; p2++) {
                                var prop2 = mgtComp.properties[p2];
                                try {
                                    var val2 = prop2.getValue();
                                    if (typeof val2 === "string" && val2.length > 0) {
                                        if (val2.indexOf("textEditValue") !== -1) {
                                            var tObj2 = JSON.parse(val2);
                                            tObj2.textEditValue = segText;
                                            tObj2.fontTextRunLength = [segText.length];
                                            prop2.setValue(JSON.stringify(tObj2), true);
                                            textSet = true;
                                            break;
                                        } else {
                                            prop2.setValue(segText, true);
                                            textSet = true;
                                            break;
                                        }
                                    }
                                } catch (valErr) {}
                            }
                        }
                    }
                    insertedCount++;
                }
            } catch (mgtErr) {}
        }

        return JSON.stringify({
            ok: true,
            success: true,
            count: insertedCount,
            trackIndex: targetTrackIndex,
            message: insertedCount + " ta subtitr videoning tepasidagi V" + (targetTrackIndex + 1) + " trekka muvaffaqiyatli joylashtirildi (eski subtitrlar tozalandi)!"
        });

    } catch (e) {
        return JSON.stringify({ ok: false, success: false, error: e.toString(), line: e.line || 0 });
    }
}'''

new_ae = '''function ae_createSubtitles(payloadJson) {
    try {
        if (!app.project || !app.project.activeItem || !(app.project.activeItem instanceof CompItem)) {
            return JSON.stringify({ ok: false, success: false, message: "Aktiv kompozitsiya topilmadi!" });
        }

        var comp = app.project.activeItem;
        var dataStr = payloadJson;

        // Agar URI encoded bo'lsa decode qilish (UTF-8 xavfsizligi)
        try {
            if (dataStr.indexOf("%7B") !== -1 || dataStr.indexOf("%22") !== -1) {
                dataStr = decodeURIComponent(dataStr);
            }
        } catch (decErr) {}

        var data = JSON.parse(dataStr);
        var segments = data.segments || [];
        var style = data.style || {};

        if (segments.length === 0) {
            return JSON.stringify({ ok: false, success: false, message: "Joylashtirish uchun subtitrlar topilmadi!" });
        }

        app.beginUndoGroup("O'zbekcha AI Subtitr Joylash");

        try {
            // Oldingi mavjud bo'lgan AI subtitr qatlamlarini tozalash (ustma-ust minmasligi uchun)
            for (var l = comp.numLayers; l >= 1; l--) {
                var curL = comp.layer(l);
                if (curL && (curL.comment === "UZ_AI_SUBTITLE" || curL.name.indexOf("Subtitr ") === 0 || curL.name.indexOf("[AI Subtitr]") === 0 || curL.name.indexOf("[") === 0)) {
                    try {
                        curL.remove();
                    } catch (remErr) {}
                }
            }

            var createdLayers = [];
            var compW = comp.width;
            var compH = comp.height;
            var compDisplayOffset = (typeof comp.displayStartTime === "number") ? comp.displayStartTime : 0;
            var origCompTime = comp.time;

            var fontSize = style.fontSize || Math.round(compH * 0.055);
            var fontName = style.fontName || "Arial-BoldMT";
            var fillRGB = style.fillColor || [1, 1, 1];
            var strokeRGB = style.strokeColor || [0, 0, 0];
            var strokeW = style.strokeWidth !== undefined ? style.strokeWidth : 3;
            var posYPercent = style.positionYPercent || 85;
            var isKaraoke = style.isKaraoke || false;
            var highlightRGB = style.highlightColor || [1, 0.84, 0];
            var ffxPath = style.ffxPresetPath || "";
            var animType = (style.animType || "pop").toLowerCase();
            var leadInSec = (typeof data.leadIn === "number") ? data.leadIn : 0.0;

            var posY = (compH * posYPercent) / 100;
            var posX = compW / 2;

            for (var i = 0; i < segments.length; i++) {
                var seg = segments[i];
                var segText = seg.text || "";
                if (!segText.replace(/\\s/g, "")) continue;

                var textLayer = comp.layers.addText(segText);
                textLayer.comment = "UZ_AI_SUBTITLE";
                var animTag = seg.styleName || (seg.animType ? seg.animType.toUpperCase() : (style.animType ? style.animType.toUpperCase() : "POP"));
                var shortText = segText.length > 22 ? (segText.substring(0, 20) + "...") : segText;
                textLayer.name = "[" + animTag + "] " + shortText;

                var sStart = parseFloat(seg.start) + compDisplayOffset;
                var sEnd = parseFloat(seg.end) + compDisplayOffset;
                if (seg.words && seg.words.length > 0) {
                    var fStart = parseFloat(seg.words[0].start) + compDisplayOffset;
                    if (!isNaN(fStart) && fStart >= compDisplayOffset) sStart = fStart;
                    var lEnd = parseFloat(seg.words[seg.words.length - 1].end) + compDisplayOffset;
                    if (!isNaN(lEnd) && lEnd > sStart) sEnd = lEnd;
                }
                if (sEnd <= sStart) sEnd = sStart + 0.35;

                // Animatsiya lead-in vaqtini hisobga olish
                var animIn = Math.max(compDisplayOffset, sStart - leadInSec);

                textLayer.startTime = animIn;
                textLayer.inPoint = animIn;
                textLayer.outPoint = sEnd;

                var textProp = textLayer.property("Source Text");
                var textDoc = textProp.value;

                textDoc.fontSize = fontSize;
                try {
                    textDoc.font = fontName;
                } catch (fontErr) {
                    try { textDoc.font = "ArialMT"; } catch (fErr2) {}
                }

                textDoc.fillColor = fillRGB;
                textDoc.applyFill = true;

                if (strokeW > 0) {
                    textDoc.applyStroke = true;
                    textDoc.strokeColor = strokeRGB;
                    textDoc.strokeWidth = strokeW;
                    textDoc.strokeOverFill = false;
                } else {
                    textDoc.applyStroke = false;
                }

                textDoc.justification = ParagraphJustification.CENTER_JUSTIFY;
                textProp.setValue(textDoc);

                textLayer.property("Transform").property("Position").setValue([posX, posY]);

                // Karaoke highlight animatori (so'zma-so'z rang va kattalashish)
                if (isKaraoke && seg.words && seg.words.length > 0) {
                    try {
                        var animators = textLayer.property("Text").property("Animators");
                        var animator = animators.addProperty("ADBE Text Animator");
                        animator.name = "Karaoke Highlight";

                        var animProps = animator.property("ADBE Text Animator Properties");
                        var fillProp = animProps.addProperty("ADBE Text Fill Color");
                        fillProp.setValue(highlightRGB);

                        var selector = animator.property("ADBE Text Selectors").addProperty("ADBE Text Selector");
                        selector.property("ADBE Text Range Advanced").property("ADBE Text Range Units").setValue(2);
                        selector.property("ADBE Text Range Advanced").property("ADBE Text Range Based On").setValue(2);

                        var startProp = selector.property("ADBE Text Index Start");
                        var endProp = selector.property("ADBE Text Index End");

                        for (var w = 0; w < seg.words.length; w++) {
                            var wordObj = seg.words[w];
                            var wStart = Math.max(textLayer.inPoint, parseFloat(wordObj.start) + compDisplayOffset);
                            var wEnd = Math.min(textLayer.outPoint, parseFloat(wordObj.end) + compDisplayOffset);

                            startProp.setValueAtTime(wStart, w);
                            endProp.setValueAtTime(wStart, w + 1);

                            startProp.setValueAtTime(wEnd, w + 1);
                            endProp.setValueAtTime(wEnd, w + 1);
                        }
                    } catch (karaokeErr) {}
                }

                var segFfxPath = seg.ffxPresetPath || ffxPath;
                var segAnimType = (seg.animType || animType || "pop").toLowerCase();

                // FFX animatsiya preseti (agar .ffx tanlangan bo'lsa)
                if (segFfxPath) {
                    try {
                        var ffxFile = new File(segFfxPath);
                        if (ffxFile.exists) {
                            comp.time = textLayer.inPoint;
                            textLayer.applyPreset(ffxFile);
                        }
                    } catch (presetErr) {}
                } else {
                    // ASOSIY NATIV ANIMATSIYALAR (Pop, Zoom, Bounce, Slide, Blur, Fade):
                    // Foydalanuvchi tanlagan animatsiya aslidek dinamik chiqishi uchun
                    var t0 = textLayer.inPoint;
                    var tEnd = textLayer.outPoint;
                    var animDur = Math.min(0.22, (tEnd - t0) * 0.45);

                    if (segAnimType.indexOf("pop") !== -1 || segAnimType.indexOf("zoom") !== -1 || segAnimType.indexOf("beast") !== -1) {
                        try {
                            var transformScale = textLayer.property("Transform").property("Scale");
                            transformScale.setValueAtTime(t0, [0, 0, 100]);
                            transformScale.setValueAtTime(t0 + animDur * 0.6, [118, 118, 100]);
                            transformScale.setValueAtTime(t0 + animDur, [100, 100, 100]);
                        } catch (popErr) {}
                    } else if (segAnimType.indexOf("bounce") !== -1) {
                        try {
                            var transformPos = textLayer.property("Transform").property("Position");
                            transformPos.setValueAtTime(t0, [posX, posY - 70]);
                            transformPos.setValueAtTime(t0 + animDur * 0.6, [posX, posY + 15]);
                            transformPos.setValueAtTime(t0 + animDur, [posX, posY]);
                        } catch (bncErr) {}
                    } else if (segAnimType.indexOf("slide") !== -1 || segAnimType.indexOf("butter") !== -1) {
                        try {
                            var transformPosS = textLayer.property("Transform").property("Position");
                            var transformOpS = textLayer.property("Transform").property("Opacity");
                            transformPosS.setValueAtTime(t0, [posX - 100, posY]);
                            transformPosS.setValueAtTime(t0 + animDur, [posX, posY]);
                            transformOpS.setValueAtTime(t0, 0);
                            transformOpS.setValueAtTime(t0 + animDur * 0.7, 100);
                        } catch (sldErr) {}
                    } else if (segAnimType.indexOf("blur") !== -1 || segAnimType.indexOf("fade") !== -1) {
                        try {
                            var transformOpF = textLayer.property("Transform").property("Opacity");
                            transformOpF.setValueAtTime(t0, 0);
                            transformOpF.setValueAtTime(t0 + animDur, 100);
                        } catch (fdeErr) {}
                    } else {
                        // Standart pop animatsiya
                        try {
                            var defScale = textLayer.property("Transform").property("Scale");
                            defScale.setValueAtTime(t0, [20, 20, 100]);
                            defScale.setValueAtTime(t0 + animDur * 0.65, [112, 112, 100]);
                            defScale.setValueAtTime(t0 + animDur, [100, 100, 100]);
                        } catch (defErr) {}
                    }
                }

                createdLayers.push(textLayer.index);
            }

            try {
                comp.time = origCompTime;
            } catch (tRestErr) {}

            app.endUndoGroup();

            return JSON.stringify({
                ok: true,
                success: true,
                count: createdLayers.length,
                layerIndices: createdLayers,
                message: createdLayers.length + " ta subtitr qatlami After Effects timeline'iga muvaffaqiyatli joylashtirildi!"
            });

        } catch (innerErr) {
            app.endUndoGroup();
            return JSON.stringify({ ok: false, success: false, error: innerErr.toString(), line: innerErr.line || 0 });
        }

    } catch (e) {
        return JSON.stringify({ ok: false, success: false, error: e.toString(), line: e.line || 0 });
    }
}'''

with open('host/premiere.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace ppro_insertMogrtSubtitles
p_pattern = re.compile(r'function ppro_insertMogrtSubtitles\(payloadJson\) \{.*?\n\}\n\n// ==================== AFTER EFFECTS', re.DOTALL)
assert p_pattern.search(content), 'ppro_insertMogrtSubtitles pattern not found'
content = p_pattern.sub(lambda m: new_ppro + '\n\n// ==================== AFTER EFFECTS', content)

# Replace ae_createSubtitles
ae_pattern = re.compile(r'function ae_createSubtitles\(payloadJson\) \{.*?\n\}\n\nfunction ae_extractSelectedTextStyle', re.DOTALL)
assert ae_pattern.search(content), 'ae_createSubtitles pattern not found'
content = ae_pattern.sub(lambda m: new_ae + '\n\nfunction ae_extractSelectedTextStyle', content)

# Clean pattern for premiere cleanup
clean_pattern = re.compile(r'if \(cName\.indexOf\("subtitr"\) !== -1.*?\)')
content = clean_pattern.sub('if (cName.indexOf("subtitr") !== -1 || cName.indexOf("mogrt") !== -1 || cName.indexOf("caption") !== -1 || cName.indexOf("uz_") !== -1 || cName.indexOf("temp_uz_") !== -1 || cName.indexOf("[") === 0)', content)

for target_file in ['host/premiere.jsx', 'host/aftereffects.jsx', 'host/shared.jsx']:
    with open(target_file, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f'Successfully updated {target_file}')
    print(f'Successfully updated {target_file}')
