/**
 * O'zbekcha AI Subtitr - ExtendScript Asosiy Bog'lovchi (shared.jsx)
 * After Effects va Premiere Pro host dasturlari uchun barcha ExtendScript
 * funksiyalarini o'z ichiga olgan mustaqil modul.
 */

function jsxLog(msg) {
    try {
        var f = new File("d:/anti garavity loyhalar/plogin/extension_debug.log");
        f.open("a");
        f.writeln("[JSX " + new Date().toString() + "] " + msg);
        f.close();
    } catch (e) {}
}
jsxLog("host/shared.jsx yuklandi!");

// ExtendScript muhiti uchun JSON polyfill (agar mavjud bo'lmasa)
var JSON = (typeof JSON === "object" && JSON) ? JSON : {};

(function () {
    'use strict';
    var rx_one = /^[\],:{}\s]*$/;
    var rx_two = /\\(?:["\\\/bfnrt]|u[0-9a-fA-F]{4})/g;
    var rx_three = '"[^"\\\\\n\r]*"|true|false|null|-?\\d+(?:\\.\\d*)?(?:[eE][+\\-]?\\d+)?';
    var rx_four = /(?:^|:|,)(?:\s*\[)+/g;
    var rx_escapable = /[\\\"\u0000-\u001f\u007f-\u009f\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g;
    var meta = {'\b': '\\b', '\t': '\\t', '\n': '\\n', '\f': '\\f', '\r': '\\r', '"': '\\"', '\\': '\\\\'};

    function quote(string) {
        rx_escapable.lastIndex = 0;
        return rx_escapable.test(string) ? '"' + string.replace(rx_escapable, function (a) {
            var c = meta[a];
            return typeof c === 'string' ? c : '\\u' + ('0000' + a.charCodeAt(0).toString(16)).slice(-4);
        }) + '"' : '"' + string + '"';
    }

    function str(key, holder) {
        var i, k, v, length, mind = "", partial, value = holder[key];
        if (value && typeof value === 'object' && typeof value.toJSON === 'function') {
            value = value.toJSON(key);
        }
        switch (typeof value) {
            case 'string': return quote(value);
            case 'number': return isFinite(value) ? String(value) : 'null';
            case 'boolean':
            case 'null': return String(value);
            case 'object':
                if (!value) return 'null';
                partial = [];
                if (Object.prototype.toString.apply(value) === '[object Array]') {
                    length = value.length;
                    for (i = 0; i < length; i += 1) {
                        partial[i] = str(i, value) || 'null';
                    }
                    return partial.length === 0 ? '[]' : '[' + partial.join(',') + ']';
                }
                for (k in value) {
                    if (Object.prototype.hasOwnProperty.call(value, k)) {
                        v = str(k, value);
                        if (v) partial.push(quote(k) + ':' + v);
                    }
                }
                return partial.length === 0 ? '{}' : '{' + partial.join(',') + '}';
        }
    }

    if (typeof JSON.stringify !== 'function') {
        JSON.stringify = function (value) {
            return str('', {'': value});
        };
    }

    JSON.parse = function (text) {
        text = String(text);
        try {
            return eval('(' + text + ')');
        } catch (e) {
            throw new SyntaxError('JSON.parse xatosi: ' + e.message);
        }
    };
}());

// ==================== EXTENDSCRIPT ES3 POLIFILLAR ====================

if (!Array.prototype.indexOf) {
    Array.prototype.indexOf = function (searchElement, fromIndex) {
        var k;
        if (this == null) throw new TypeError('"this" is null or not defined');
        var o = Object(this);
        var len = o.length >>> 0;
        if (len === 0) return -1;
        var n = fromIndex | 0;
        if (n >= len) return -1;
        k = Math.max(n >= 0 ? n : len - Math.abs(n), 0);
        while (k < len) {
            if (k in o && o[k] === searchElement) return k;
            k++;
        }
        return -1;
    };
}

if (!Array.prototype.forEach) {
    Array.prototype.forEach = function (callback, thisArg) {
        if (this == null) throw new TypeError('Array.prototype.forEach called on null or undefined');
        var T, k;
        var O = Object(this);
        var len = O.length >>> 0;
        if (typeof callback !== "function") throw new TypeError(callback + ' is not a function');
        if (arguments.length > 1) T = thisArg;
        k = 0;
        while (k < len) {
            var kValue;
            if (k in O) {
                kValue = O[k];
                callback.call(T, kValue, k, O);
            }
            k++;
        }
    };
}

if (!Array.prototype.map) {
    Array.prototype.map = function (callback, thisArg) {
        if (this == null) throw new TypeError('Array.prototype.map called on null or undefined');
        var T, A, k;
        var O = Object(this);
        var len = O.length >>> 0;
        if (typeof callback !== 'function') throw new TypeError(callback + ' is not a function');
        if (arguments.length > 1) T = thisArg;
        A = new Array(len);
        k = 0;
        while (k < len) {
            var kValue, mappedValue;
            if (k in O) {
                kValue = O[k];
                mappedValue = callback.call(T, kValue, k, O);
                A[k] = mappedValue;
            }
            k++;
        }
        return A;
    };
}

if (!Array.prototype.filter) {
    Array.prototype.filter = function (func, thisArg) {
        if (this == null) throw new TypeError('Array.prototype.filter called on null or undefined');
        var O = Object(this);
        var len = O.length >>> 0;
        if (typeof func !== 'function') throw new TypeError(func + ' is not a function');
        var res = [];
        var thisp = arguments[1];
        for (var i = 0; i < len; i++) {
            if (i in O) {
                var val = O[i];
                if (func.call(thisp, val, i, O)) {
                    res.push(val);
                }
            }
        }
        return res;
    };
}

if (!String.prototype.trim) {
    String.prototype.trim = function () {
        return this.replace(/^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g, '');
    };
}

// Host dasturni aniqlash (After Effects yoki Premiere Pro)
function getHostAppName() {
    var appName = (BridgeTalk.appName || "").toLowerCase();
    if (appName.indexOf("aftereffects") !== -1) {
        return "AEFT";
    } else if (appName.indexOf("premiere") !== -1) {
        return "PPRO";
    }
    if (typeof CompItem !== "undefined") return "AEFT";
    return "PPRO";
}

// ==================== TIZIM DIAGNOSTIKASI ====================

function host_runDiagnostics() {
    try {
        var hostName = getHostAppName();
        var appTitle = (BridgeTalk && BridgeTalk.appName) ? BridgeTalk.appName : ((hostName === "AEFT") ? "After Effects" : "Premiere Pro");
        var appVer = (typeof app !== "undefined" && app.version) ? String(app.version) : "Noma'lum";

        var diag = {
            ok: true,
            success: true,
            hostId: hostName,
            appName: appTitle,
            appVersion: appVer,
            extendScriptConnected: true,
            timeline: {
                exists: false,
                name: "",
                type: (hostName === "AEFT") ? "Composition" : "Sequence",
                fps: 0,
                duration: 0,
                time: 0
            },
            selection: {
                count: 0,
                items: []
            },
            fileWritePermission: true,
            details: []
        };

        // Fayl yozish ruxsatini tekshirish
        try {
            var tempTestFile = new File(Folder.temp.fsName + "/uz_diag_test_" + (new Date().getTime()) + ".tmp");
            if (tempTestFile.open("w")) {
                tempTestFile.write("ok");
                tempTestFile.close();
                tempTestFile.remove();
                diag.fileWritePermission = true;
            } else {
                diag.fileWritePermission = false;
            }
        } catch (fErr) {
            diag.fileWritePermission = false;
        }

        if (hostName === "AEFT") {
            // After Effects
            if (app.project && app.project.activeItem && (app.project.activeItem instanceof CompItem)) {
                var comp = app.project.activeItem;
                diag.timeline.exists = true;
                diag.timeline.name = comp.name;
                diag.timeline.fps = comp.frameRate;
                diag.timeline.duration = comp.duration;
                diag.timeline.time = comp.time;
                diag.details.push("Aktiv composition: " + comp.name + " (" + comp.width + "x" + comp.height + ", " + comp.frameRate + " fps)");

                var selLayers = comp.selectedLayers;
                diag.selection.count = selLayers ? selLayers.length : 0;
                if (selLayers && selLayers.length > 0) {
                    for (var i = 0; i < selLayers.length; i++) {
                        var l = selLayers[i];
                        var lType = "Qatlam";
                        if (l.source instanceof CompItem) lType = "Precomp";
                        else if ((typeof TextLayer !== "undefined" && l instanceof TextLayer) || (l.property && l.property("Source Text") !== null)) lType = "Matn (Text)";
                        else if (l.adjustmentLayer) lType = "Adjustment";
                        else if (l.source && l.source.mainSource && l.source.mainSource instanceof SolidSource) lType = "Solid";
                        else if (l.source && l.source.file) lType = "Footage (" + (l.hasAudio ? "Audio+Video" : "Video") + ")";
                        else if (l.hasAudio) lType = "Audio";
                        diag.selection.items.push(l.name + " [" + lType + "]");
                    }
                }
            } else {
                diag.details.push("After Effects'da aktiv kompozitsiya ochilmagan");
            }
        } else if (hostName === "PPRO") {
            // Premiere Pro
            var seq = ppro_getSeq();
            if (seq) {
                var curTicks = seq.getPlayerPosition();
                var curSec = parseFloat(curTicks.seconds) || (parseFloat(curTicks.ticks) / 254016000000) || 0;
                var endSec = parseFloat(seq.end) / 254016000000;
                diag.timeline.exists = true;
                diag.timeline.name = seq.name;
                diag.timeline.fps = seq.framerate;
                diag.timeline.duration = endSec > 0 ? endSec : 0;
                diag.timeline.time = curSec;
                diag.details.push("Aktiv sequence: " + seq.name + " (" + (seq.framerate ? seq.framerate.toFixed(2) : 25) + " fps)");

                var selectedClips = [];
                try {
                    if (typeof seq.getSelection === "function") {
                        selectedClips = seq.getSelection();
                    }
                } catch (selErr) {}

                if (!selectedClips || selectedClips.length === 0) {
                    for (var vt = 0; vt < seq.videoTracks.numTracks; vt++) {
                        var vtClips = seq.videoTracks[vt].clips;
                        for (var vc = 0; vc < vtClips.numItems; vc++) {
                            if (isClipSelected(vtClips[vc])) selectedClips.push(vtClips[vc]);
                        }
                    }
                    for (var at = 0; at < seq.audioTracks.numTracks; at++) {
                        var atClips = seq.audioTracks[at].clips;
                        for (var ac = 0; ac < atClips.numItems; ac++) {
                            if (isClipSelected(atClips[ac])) selectedClips.push(atClips[ac]);
                        }
                    }
                }

                diag.selection.count = selectedClips.length;
                for (var s = 0; s < selectedClips.length; s++) {
                    var clip = selectedClips[s];
                    var cName = clip.name || "Klip";
                    var cPath = getClipPathOrName(clip);
                    diag.selection.items.push(cName + (cPath ? " (" + cPath.split("/").pop().split("\\").pop() + ")" : ""));
                }
            } else {
                diag.details.push("Premiere Pro'da aktiv sequence ochilmagan");
            }
        }

        return JSON.stringify(diag);
    } catch (e) {
        return JSON.stringify({
            ok: false,
            success: false,
            error: e.toString(),
            line: e.line || 0
        });
    }
}

// ==================== PREMIERE PRO YORDAMCHI VA ASOSIY FUNKSIYALARI ====================

function ppro_getSeq() {
    if (!app.project) return null;
    if (app.project.activeSequence) return app.project.activeSequence;
    try {
        if (app.project.sequences) {
            var nSeq = app.project.sequences.numSequences || app.project.sequences.length || 0;
            // 1. Kliplari bor bo'lgan haqiqiy montaj sequence'ni topish
            for (var s = 0; s < nSeq; s++) {
                var sq = app.project.sequences[s];
                if (sq && sq.videoTracks && sq.videoTracks.numTracks > 0) {
                    for (var t = 0; t < sq.videoTracks.numTracks; t++) {
                        if (sq.videoTracks[t].clips && sq.videoTracks[t].clips.numItems > 0) {
                            return sq;
                        }
                    }
                }
            }
            if (nSeq > 0 && app.project.sequences[0]) return app.project.sequences[0];
        }
    } catch (eSeq) {}
    try {
        if (app.project.rootItem && app.project.rootItem.children) {
            for (var i = 0; i < app.project.rootItem.children.numItems; i++) {
                var it = app.project.rootItem.children[i];
                if (it && typeof it.isSequence === "function" && it.isSequence()) {
                    try {
                        if (typeof app.project.openSequence === "function") {
                            app.project.openSequence(it.sequenceID);
                        }
                    } catch (osErr) {}
                    if (app.project.activeSequence) return app.project.activeSequence;
                }
            }
        }
    } catch (rErr) {}
    return null;
}

function isClipSelected(clip) {
    if (!clip) return false;
    try {
        if (typeof clip.isSelected === "function") return clip.isSelected();
        if (typeof clip.isSelected === "boolean") return clip.isSelected;
    } catch (e) {}
    return false;
}

function findMediaByNameInBin(bin, targetName, depth) {
    if (!bin || !bin.children) return "";
    if (depth === undefined) depth = 0;
    if (depth > 4) return ""; // Max 4 level chuqurlik, cheksiz rekursiyani oldini olish
    var tLow = targetName.toLowerCase();
    for (var i = 0; i < bin.children.numItems; i++) {
        var item = bin.children[i];
        if (!item) continue;
        var iName = (item.name || "").toLowerCase();
        if (iName === tLow || iName.indexOf(tLow) !== -1 || tLow.indexOf(iName) !== -1) {
            var mPath = "";
            try {
                if (typeof item.getMediaPath === "function") mPath = item.getMediaPath();
            } catch (mErr) {}
            if (mPath) {
                mPath = String(mPath).replace(/\\/g, "/");
                if (new File(mPath).exists) return mPath;
            }
        }
        try {
            if (item.type === 2 && item.children && item.children.numItems > 0) {
                var sub = findMediaByNameInBin(item, targetName, depth + 1);
                if (sub) return sub;
            }
        } catch (subErr) {}
    }
    return "";
}

function getClipPathOrName(clip) {
    if (!clip) return "";
    var p = "";
    try {
        if (clip.projectItem) {
            if (typeof clip.projectItem.getMediaPath === "function") {
                p = clip.projectItem.getMediaPath();
            }
            if (!p && clip.projectItem.treePath) {
                p = clip.projectItem.treePath;
            }
            if (!p && clip.projectItem.mediaPath) {
                p = clip.projectItem.mediaPath;
            }
        }
    } catch (e1) {}

    if (p) {
        p = String(p).replace(/\\/g, "/");
        if (p.length > 3) {
            return p;
        }
    }

    var rawName = "";
    try {
        if (clip.projectItem && clip.projectItem.name) {
            rawName = clip.projectItem.name;
        } else if (clip.name) {
            rawName = clip.name;
        }
    } catch (nErr) {}

    // Kliplar nomidan ' [V]', ' [A1]', ' [V1]' kabi belgilarni tozalash
    var cleanName = rawName ? String(rawName).replace(/\s*\[[VA0-9\s]+\]\s*$/i, "").replace(/^\s+|\s+$/g, "") : "";
    return cleanName || rawName || "";
}

function ppro_getSequenceInfo() {
    try {
        var seq = ppro_getSeq();
        if (!seq) {
            return JSON.stringify({
                ok: false,
                exists: false,
                message: "Aktiv ketma-ketlik (sequence) topilmadi! Iltimos, Premiere Pro'da videoni oching."
            });
        }
        var curSec = 0;
        try {
            var curTicks = seq.getPlayerPosition();
            if (curTicks) {
                curSec = parseFloat(curTicks.seconds) || (parseFloat(curTicks.ticks) / 254016000000) || 0;
            }
        } catch (posErr) {}

        var fps = 25;
        try {
            if (seq.framerate) {
                fps = parseFloat(seq.framerate) || 25;
            }
        } catch (fpsErr) {}

        var durationSec = 0;
        try {
            if (seq.end) {
                durationSec = parseFloat(seq.end) / 254016000000 || 0;
            }
        } catch (durErr) {}

        return JSON.stringify({
            ok: true,
            exists: true,
            name: String(seq.name || "Aktiv Sequence"),
            frameRate: fps,
            time: curSec,
            duration: durationSec > 0 ? durationSec : 0
        });
    } catch (e) {
        return JSON.stringify({ ok: false, exists: false, error: e.toString(), line: e.line || 0 });
    }
}

function ppro_setPlayhead(timeSec) {
    try {
        var seq = ppro_getSeq();
        if (!seq) {
            return JSON.stringify({ ok: false, status: "error", message: "Aktiv sequence ochilmagan" });
        }
        var t = new Time();
        t.seconds = parseFloat(timeSec);
        seq.setPlayerPosition(t.ticks);
        return JSON.stringify({ ok: true, status: "ok" });
    } catch (e) {
        return JSON.stringify({ ok: false, status: "error", error: e.toString(), line: e.line || 0 });
    }
}

function isMediaClip(clip) {
    if (!clip) return false;
    var cName = (clip.name || "").toLowerCase();
    // Subtitr, mogrt yoki matn qatlamlarini tashlab ketish
    if (cName.indexOf(".mogrt") !== -1) return false;
    if (cName.indexOf("subtitr") !== -1) return false;
    if (cName.indexOf("subtitle") !== -1) return false;
    if (cName.indexOf("captioneer") !== -1) return false;
    if (cName.indexOf("adjustment layer") !== -1) return false;
    return true;
}

function extractClipInfo(clip) {
    if (!clip) return null;
    var p = getClipPathOrName(clip);
    if (!p) return null;

    var inSec = 0;
    var outSec = 0;
    var startSec = 0;
    var endSec = 0;

    try {
        if (clip.inPoint) inSec = parseFloat(clip.inPoint.seconds) || (parseFloat(clip.inPoint.ticks) / 254016000000) || 0;
        if (clip.outPoint) outSec = parseFloat(clip.outPoint.seconds) || (parseFloat(clip.outPoint.ticks) / 254016000000) || 0;
        if (clip.start) startSec = parseFloat(clip.start.seconds) || (parseFloat(clip.start.ticks) / 254016000000) || 0;
        if (clip.end) endSec = parseFloat(clip.end.seconds) || (parseFloat(clip.end.ticks) / 254016000000) || 0;
    } catch (timeErr) {}

    var dur = (outSec > inSec) ? (outSec - inSec) : (endSec - startSec);
    if (dur <= 0) dur = 1.0;

    var clipSpeed = 1.0;
    var mediaDur = (outSec > inSec) ? (outSec - inSec) : 0;
    var tlDur = (endSec > startSec) ? (endSec - startSec) : 0;
    if (mediaDur > 0 && tlDur > 0) {
        clipSpeed = Math.round((mediaDur / tlDur) * 1000) / 1000;
    }
    try {
        if (typeof clip.getSpeed === "function") {
            var sp = clip.getSpeed();
            if (sp && sp > 0) clipSpeed = sp;
        }
    } catch (spErr) {}
    if (isNaN(clipSpeed) || clipSpeed <= 0) clipSpeed = 1.0;

    var cleanP = String(p).replace(/\\/g, "/");
    var cleanN = clip.name ? String(clip.name).replace(/\s*\[[VA0-9\s]+\]\s*$/i, "").replace(/^\s+|\s+$/g, "") : cleanP.split("/").pop();

    return {
        ok: true,
        success: true,
        filePath: cleanP,
        name: cleanN,
        inPoint: inSec,
        outPoint: outSec,
        start: startSec,
        end: endSec,
        duration: dur,
        speed: clipSpeed,
        offset: startSec - inSec
    };
}

function ppro_getSelectedClipAudioPath() {
    jsxLog("ppro_getSelectedClipAudioPath chaqirildi! app.project=" + (!!app.project));
    try {
        if (!app.project) {
            jsxLog("app.project topilmadi");
            return JSON.stringify({ ok: false, success: false, message: "Premiere Pro'da loyiha ochilmagan" });
        }

        var seq = ppro_getSeq();
        jsxLog("ppro_getSeq natijasi: " + (seq ? seq.name : "null"));
        if (!seq) {
            return JSON.stringify({
                ok: false,
                success: false,
                message: "Aktiv sequence topilmadi! Iltimos, Premiere Pro'da videoni oching."
            });
        }

        function returnSingleClip(info) {
            if (!info) return null;
            return JSON.stringify({
                ok: true,
                success: true,
                multiple: false,
                clips: [info],
                count: 1,
                filePath: info.filePath,
                name: info.name,
                inPoint: info.inPoint,
                outPoint: info.outPoint,
                start: info.start,
                end: info.end,
                duration: info.duration,
                speed: info.speed || 1.0,
                offset: info.offset
            });
        }

        var selectedClipsList = [];
        var processedKeys = {};

        // A) seq.getSelection() orqali tanlangan barcha media klip(lar)
        try {
            if (typeof seq.getSelection === "function") {
                var selection = seq.getSelection();
                if (selection && selection.length > 0) {
                    for (var s = 0; s < selection.length; s++) {
                        if (!isMediaClip(selection[s])) continue;
                        var infoSel = extractClipInfo(selection[s]);
                        if (infoSel) {
                            var keyS = infoSel.filePath + "_" + infoSel.start + "_" + infoSel.inPoint;
                            if (!processedKeys[keyS]) {
                                processedKeys[keyS] = true;
                                selectedClipsList.push(infoSel);
                            }
                        }
                    }
                }
            }
        } catch (selErr) {}

        // B) Agar selection bo'sh bo'lsa, treklar bo'yicha tanlangan media kliplarni izlash
        if (selectedClipsList.length === 0) {
            for (var vt = 0; vt < seq.videoTracks.numTracks; vt++) {
                var vTrack = seq.videoTracks[vt];
                for (var vc = 0; vc < vTrack.clips.numItems; vc++) {
                    var vClip = vTrack.clips[vc];
                    if (isClipSelected(vClip) && isMediaClip(vClip)) {
                        var vInfo = extractClipInfo(vClip);
                        if (vInfo) {
                            var keyV = vInfo.filePath + "_" + vInfo.start + "_" + vInfo.inPoint;
                            if (!processedKeys[keyV]) {
                                processedKeys[keyV] = true;
                                selectedClipsList.push(vInfo);
                            }
                        }
                    }
                }
            }

            for (var at = 0; at < seq.audioTracks.numTracks; at++) {
                var aTrack = seq.audioTracks[at];
                for (var ac = 0; ac < aTrack.clips.numItems; ac++) {
                    var aClip = aTrack.clips[ac];
                    if (isClipSelected(aClip)) {
                        var aInfo = extractClipInfo(aClip);
                        if (aInfo) {
                            var keyA = aInfo.filePath + "_" + aInfo.start + "_" + aInfo.inPoint;
                            if (!processedKeys[keyA]) {
                                processedKeys[keyA] = true;
                                selectedClipsList.push(aInfo);
                            }
                        }
                    }
                }
            }
        }

        // Agar tanlangan klip(lar) topilgan bo'lsa:
        if (selectedClipsList.length > 0) {
            selectedClipsList.sort(function (a, b) { return a.start - b.start; });
            var firstClip = selectedClipsList[0];
            return JSON.stringify({
                ok: true,
                success: true,
                multiple: selectedClipsList.length > 1,
                clips: selectedClipsList,
                count: selectedClipsList.length,
                filePath: firstClip.filePath,
                name: firstClip.name,
                inPoint: firstClip.inPoint,
                outPoint: firstClip.outPoint,
                start: firstClip.start,
                end: firstClip.end,
                duration: firstClip.duration,
                offset: firstClip.offset
            });
        }

        // C) Playhead (CTI) turgan joydagi klipni avtomatik olish
        try {
            var curTicks = seq.getPlayerPosition();
            var curSec = parseFloat(curTicks.seconds) || (parseFloat(curTicks.ticks) / 254016000000) || 0;

            for (var vtCt = 0; vtCt < seq.videoTracks.numTracks; vtCt++) {
                var vTrackCt = seq.videoTracks[vtCt];
                for (var vcCt = 0; vcCt < vTrackCt.clips.numItems; vcCt++) {
                    var cV = vTrackCt.clips[vcCt];
                    if (!isMediaClip(cV)) continue;
                    var sV = parseFloat(cV.start.seconds) || (parseFloat(cV.start.ticks) / 254016000000) || 0;
                    var eV = parseFloat(cV.end.seconds) || (parseFloat(cV.end.ticks) / 254016000000) || 0;
                    if (curSec >= sV && curSec <= eV) {
                        var cVInfo = extractClipInfo(cV);
                        if (cVInfo) return returnSingleClip(cVInfo);
                    }
                }
            }

            for (var atCt = 0; atCt < seq.audioTracks.numTracks; atCt++) {
                var aTrackCt = seq.audioTracks[atCt];
                for (var acCt = 0; acCt < aTrackCt.clips.numItems; acCt++) {
                    var cA = aTrackCt.clips[acCt];
                    var sA = parseFloat(cA.start.seconds) || (parseFloat(cA.start.ticks) / 254016000000) || 0;
                    var eA = parseFloat(cA.end.seconds) || (parseFloat(cA.end.ticks) / 254016000000) || 0;
                    if (curSec >= sA && curSec <= eA) {
                        var cAInfo = extractClipInfo(cA);
                        if (cAInfo) return returnSingleClip(cAInfo);
                    }
                }
            }
        } catch (ctiErr) {}

        // D) Sequence treklaridagi barcha video yoki audio kliplarni to'plash (foydalanuvchi qo'lda tanlamaganda)
        var allTimelineClips = [];
        for (var vt2 = 0; vt2 < seq.videoTracks.numTracks; vt2++) {
            var vTrack2 = seq.videoTracks[vt2];
            for (var vc2 = 0; vc2 < vTrack2.clips.numItems; vc2++) {
                var clipV2 = vTrack2.clips[vc2];
                if (!isMediaClip(clipV2)) continue;
                var infoV2 = extractClipInfo(clipV2);
                if (infoV2) {
                    var keyAll = infoV2.filePath + "_" + infoV2.start + "_" + infoV2.inPoint;
                    if (!processedKeys[keyAll]) {
                        processedKeys[keyAll] = true;
                        allTimelineClips.push(infoV2);
                    }
                }
            }
            if (allTimelineClips.length > 0) break; // Asosiy trekdan (V1) kliplar olindi
        }

        if (allTimelineClips.length === 0) {
            for (var at2 = 0; at2 < seq.audioTracks.numTracks; at2++) {
                var aTrack2 = seq.audioTracks[at2];
                for (var ac2 = 0; ac2 < aTrack2.clips.numItems; ac2++) {
                    var clipA2 = aTrack2.clips[ac2];
                    var infoA2 = extractClipInfo(clipA2);
                    if (infoA2) {
                        var keyAllA = infoA2.filePath + "_" + infoA2.start + "_" + infoA2.inPoint;
                        if (!processedKeys[keyAllA]) {
                            processedKeys[keyAllA] = true;
                            allTimelineClips.push(infoA2);
                        }
                    }
                }
                if (allTimelineClips.length > 0) break;
            }
        }

        if (allTimelineClips.length > 0) {
            allTimelineClips.sort(function(a, b) { return a.start - b.start; });
            var firstCl = allTimelineClips[0];
            return JSON.stringify({
                ok: true,
                success: true,
                multiple: allTimelineClips.length > 1,
                clips: allTimelineClips,
                count: allTimelineClips.length,
                filePath: firstCl.filePath,
                name: firstCl.name,
                inPoint: firstCl.inPoint,
                outPoint: firstCl.outPoint,
                start: firstCl.start,
                end: firstCl.end,
                duration: firstCl.duration,
                offset: firstCl.offset
            });
        }

        // E) Project bin items (loyiha papkasidagi audio/video)
        function findMediaInBin(parent) {
            if (!parent || !parent.children) return null;
            for (var k = 0; k < parent.children.numItems; k++) {
                var item = parent.children[k];
                var mP = (item.getMediaPath) ? item.getMediaPath() : "";
                if (mP && mP.length > 3) {
                    mP = String(mP).replace(/\\/g, "/");
                    return { ok: true, success: true, filePath: mP, name: item.name };
                }
                var n = (item.name || "").toLowerCase();
                if (n.indexOf(".mp4") !== -1 || n.indexOf(".mov") !== -1 || n.indexOf(".mp3") !== -1 || n.indexOf(".wav") !== -1) {
                    return { ok: true, success: true, filePath: item.name, name: item.name };
                }
                if (item.children && item.children.numItems > 0) {
                    var sub = findMediaInBin(item);
                    if (sub) return sub;
                }
            }
            return null;
        }

        try {
            var rootMedia = findMediaInBin(app.project.rootItem);
            if (rootMedia) {
                var rootClipInfo = {
                    ok: true,
                    success: true,
                    filePath: rootMedia.filePath,
                    name: rootMedia.name,
                    inPoint: 0,
                    outPoint: 3600,
                    start: 0,
                    end: 3600,
                    duration: 3600,
                    offset: 0
                };
                return returnSingleClip(rootClipInfo);
            }
        } catch (rmErr) {}

        // F) Fallback sequence nomi
        if (seq && seq.name) {
            var sName = seq.name;
            var extName = (sName.toLowerCase().indexOf(".mp4") === -1) ? (sName + ".mp4") : sName;
            var seqClipInfo = {
                ok: true,
                success: true,
                filePath: extName,
                name: extName,
                inPoint: 0,
                outPoint: 3600,
                start: 0,
                end: 3600,
                duration: 3600,
                offset: 0
            };
            return returnSingleClip(seqClipInfo);
        }

        return JSON.stringify({
            ok: false,
            success: false,
            message: "Timeline'da yoki loyihada video klip topilmadi. Faylni 'Choose File' orqali yuklang."
        });

    } catch (e) {
        return JSON.stringify({ ok: false, success: false, error: e.toString(), line: e.line || 0 });
    }
}

function ppro_formatTimecode(seconds, fps) {
    if (isNaN(seconds) || seconds < 0) seconds = 0;
    fps = fps || 25.0;
    var totalFrames = Math.floor(seconds * fps + 0.00001);
    var f = totalFrames % Math.round(fps);
    var totalSec = Math.floor(seconds);
    var s = totalSec % 60;
    var m = Math.floor(totalSec / 60) % 60;
    var h = Math.floor(totalSec / 3600);
    function pad(n) { return (n < 10 ? "0" : "") + n; }
    return pad(h) + ":" + pad(m) + ":" + pad(s) + ":" + pad(f);
}

function ppro_getTimeDiagnostics() {
    try {
        var seq = ppro_getSeq();
        if (!seq) {
            return JSON.stringify({
                ok: false,
                success: false,
                message: "Aktiv sequence topilmadi"
            });
        }
        var fps = 25.0;
        try {
            if (seq.framerate) fps = parseFloat(seq.framerate) || 25.0;
        } catch (fErr) {}

        var playheadSec = 0;
        try {
            var curTicks = seq.getPlayerPosition();
            if (curTicks) {
                playheadSec = parseFloat(curTicks.seconds) || (parseFloat(curTicks.ticks) / 254016000000) || 0;
            }
        } catch (pErr) {}

        var selectedClip = null;
        try {
            if (typeof seq.getSelection === "function") {
                var sel = seq.getSelection();
                if (sel && sel.length > 0) {
                    for (var i = 0; i < sel.length; i++) {
                        if (isMediaClip(sel[i])) { selectedClip = sel[i]; break; }
                    }
                }
            }
        } catch (sErr) {}

        if (!selectedClip) {
            for (var vt = 0; vt < seq.videoTracks.numTracks; vt++) {
                var vTr = seq.videoTracks[vt];
                for (var vc = 0; vc < vTr.clips.numItems; vc++) {
                    var c = vTr.clips[vc];
                    if (isClipSelected(c) && isMediaClip(c)) { selectedClip = c; break; }
                }
                if (selectedClip) break;
            }
        }

        if (!selectedClip) {
            for (var at = 0; at < seq.audioTracks.numTracks; at++) {
                var aTr = seq.audioTracks[at];
                for (var ac = 0; ac < aTr.clips.numItems; ac++) {
                    var acClip = aTr.clips[ac];
                    if (isClipSelected(acClip)) { selectedClip = acClip; break; }
                }
                if (selectedClip) break;
            }
        }

        if (!selectedClip) {
            for (var vtp = 0; vtp < seq.videoTracks.numTracks; vtp++) {
                var trP = seq.videoTracks[vtp];
                for (var cp = 0; cp < trP.clips.numItems; cp++) {
                    var clP = trP.clips[cp];
                    if (isMediaClip(clP)) {
                        var stSec = parseFloat(clP.start.seconds) || (parseFloat(clP.start.ticks) / 254016000000) || 0;
                        var enSec = parseFloat(clP.end.seconds) || (parseFloat(clP.end.ticks) / 254016000000) || 0;
                        if (playheadSec >= stSec && playheadSec <= enSec) {
                            selectedClip = clP;
                            break;
                        }
                    }
                }
                if (selectedClip) break;
            }
        }

        var clipInfo = selectedClip ? extractClipInfo(selectedClip) : null;
        var inSec = clipInfo ? clipInfo.inPoint : 0;
        var outSec = clipInfo ? clipInfo.outPoint : 0;
        var startSec = clipInfo ? clipInfo.start : 0;
        var endSec = clipInfo ? clipInfo.end : 0;
        var durSec = clipInfo ? clipInfo.duration : 0;
        var speedVal = clipInfo ? (clipInfo.speed || 1.0) : 1.0;
        var mediaPath = clipInfo ? (clipInfo.filePath || "") : "";

        var diag = {
            ok: true,
            success: true,
            host: "PPRO",
            sequence: String(seq.name || "Aktiv Sequence"),
            timebase: "00:00:00:00 @ " + fps.toFixed(2) + "fps",
            fps: fps,
            selected_clip: selectedClip ? String(selectedClip.name || "Klip") : "yo'q",
            clip_media_path: mediaPath || "yo'q",
            clip_in_point: ppro_formatTimecode(inSec, fps),
            clip_start: ppro_formatTimecode(startSec, fps),
            clip_out_point: ppro_formatTimecode(outSec, fps),
            clip_duration: ppro_formatTimecode(durSec, fps),
            clip_speed: speedVal,
            playhead: ppro_formatTimecode(playheadSec, fps),
            raw_ms: {
                clip_in_point_ms: Math.round(inSec * 1000),
                clip_start_ms: Math.round(startSec * 1000),
                clip_out_point_ms: Math.round(outSec * 1000),
                clip_duration_ms: Math.round(durSec * 1000),
                playhead_ms: Math.round(playheadSec * 1000)
            }
        };
        return JSON.stringify(diag);
    } catch (e) {
        return JSON.stringify({ ok: false, success: false, error: e.toString() });
    }
}

// Premiere Pro video trekini aqlli aniqlash (videoning tepasidagi trek, masalan V2)
function ppro_findTargetVideoTrackIndex(seq) {
    if (!seq || !seq.videoTracks || seq.videoTracks.numTracks === 0) return 0;
    
    var baseTrackIdx = 0;
    try {
        if (typeof seq.getSelection === "function") {
            var sel = seq.getSelection();
            if (sel && sel.length > 0) {
                for (var t = 0; t < seq.videoTracks.numTracks; t++) {
                    var vt = seq.videoTracks[t];
                    for (var c = 0; c < vt.clips.numItems; c++) {
                        if (vt.clips[c] === sel[0]) {
                            baseTrackIdx = t;
                            break;
                        }
                    }
                }
            }
        }
    } catch (e) {}

    // Klip ustidagi birinchi bo'sh yoki navbatdagi trek (V1 -> V2)
    var targetIdx = baseTrackIdx + 1;
    if (targetIdx < seq.videoTracks.numTracks) {
        return targetIdx;
    }

    // Agar bo'sh trek bo'lsa
    for (var v = 0; v < seq.videoTracks.numTracks; v++) {
        if (seq.videoTracks[v].clips.numItems === 0) {
            return v;
        }
    }

    return seq.videoTracks.numTracks - 1;
}

// Oldingi kiritilgan barcha eski subtitrlarni tozalash (ustma-ust tushmasligi va boshqa qatordan yangi ochilmasligi uchun)
function ppro_cleanupOldSubtitles(seq, targetTrackIndex) {
    if (!seq) return;

    // 1. Target trek va boshqa video treklardagi eski subtitrlarni o'chirish
    try {
        if (seq.videoTracks) {
            // Faqat subtitr joylashadigan trek (masalan V2) va qo'shimcha treklarni tekshirish (Track 0 - V1 ga aslo teginilmaydi!)
            var tracksToCheck = (targetTrackIndex !== undefined && targetTrackIndex > 0) ? [targetTrackIndex] : [];
            for (var t = 1; t < seq.videoTracks.numTracks; t++) {
                if (tracksToCheck.indexOf(t) === -1) tracksToCheck.push(t);
            }

            for (var i = 0; i < tracksToCheck.length; i++) {
                var trk = seq.videoTracks[tracksToCheck[i]];
                if (!trk || !trk.clips) continue;
                for (var c = trk.clips.numItems - 1; c >= 0; c--) {
                    var cl = trk.clips[c];
                    var cName = (cl && cl.name) ? cl.name.toLowerCase() : "";
                    if (cName.indexOf("subtitr") !== -1 || cName.indexOf("mogrt") !== -1 || cName.indexOf("caption") !== -1 || cName.indexOf("uz_") !== -1 || cName.indexOf("temp_uz_") !== -1 || cName.indexOf("[") === 0) {
                        try {
                            if (typeof cl.remove === "function") {
                                cl.remove(false, false);
                            }
                        } catch (rErr) {}
                    }
                }
            }
        }
    } catch (vErr) {}

    // 2. Caption treklardagi eski subtitrlarni ham tozalash (C1, C2 larni to'ldirib tashlamaslik uchun)
    try {
        if (seq.captionTracks && seq.captionTracks.numTracks > 0) {
            for (var ct = 0; ct < seq.captionTracks.numTracks; ct++) {
                var capT = seq.captionTracks[ct];
                if (!capT || !capT.clips) continue;
                for (var cc = capT.clips.numItems - 1; cc >= 0; cc--) {
                    var ccl = capT.clips[cc];
                    try {
                        if (typeof ccl.remove === "function") {
                            ccl.remove(false, false);
                        }
                    } catch (ce) {}
                }
            }
        }
    } catch (cErr) {}
}

function ppro_insertSubtitlesViaSRT(srtFilePath, timelineOffset) {
    try {
        if (!app.project) {
            return JSON.stringify({ ok: false, success: false, message: "Loyiha ochilmagan" });
        }

        var offsetSec = parseFloat(timelineOffset) || 0.0;
        var cleanPath = String(srtFilePath).replace(/\\/g, "/");
        var srtFile = new File(cleanPath);
        if (!srtFile.exists) {
            return JSON.stringify({ ok: false, success: false, message: "SRT fayl diskda topilmadi: " + cleanPath });
        }

        var fileList = [srtFile.fsName];
        try {
            app.project.importFiles(fileList, true, app.project.rootItem, false);
        } catch (impErr1) {
            try {
                app.project.importFiles(fileList);
            } catch (impErr2) {}
        }

        var importedItem = null;
        for (var i = app.project.rootItem.children.numItems - 1; i >= 0; i--) {
            var item = app.project.rootItem.children[i];
            var mP = (item.getMediaPath) ? item.getMediaPath() : "";
            if (item.name.indexOf("temp_uz_subtitles") !== -1 || item.name.indexOf("subtitrlar") !== -1 || item.name.indexOf(".srt") !== -1 || mP.indexOf(".srt") !== -1) {
                importedItem = item;
                break;
            }
        }

        var seq = ppro_getSeq();
        var placed = false;

        if (seq && importedItem) {
            var startTime = new Time();
            startTime.seconds = offsetSec;

            // Target Video trekni aniqlash (videoning tepasidagi trek, masalan V2)
            var targetVTrackIdx = ppro_findTargetVideoTrackIndex(seq);

            // Eski barcha subtitrlarni tozalash (yangi qatorlar to'planib ketmasligi uchun)
            ppro_cleanupOldSubtitles(seq, targetVTrackIdx);

            // 1. VIDEO TREKKA JOYLASHTIRISH (Foydalanuvchi talabi: videoning tepasidagi V2/V3 trekka chiqarish)
            if (seq.videoTracks && seq.videoTracks.numTracks > targetVTrackIdx) {
                var targetVTrack = seq.videoTracks[targetVTrackIdx];
                try {
                    targetVTrack.insertClip(importedItem, startTime);
                    placed = true;
                } catch (e1) {
                    try {
                        targetVTrack.overwriteClip(importedItem, startTime);
                        placed = true;
                    } catch (e2) {}
                }
            }

            // 2. Agar video trek qabul qilmasa va caption trek mavjud bo'lsa, yangi trek ochmasdan mavjudiga qo'yish
            if (!placed && seq.captionTracks && seq.captionTracks.numTracks > 0) {
                var capTrack = seq.captionTracks[0];
                try {
                    capTrack.insertClip(importedItem, startTime);
                    placed = true;
                } catch (cInsErr1) {
                    try {
                        capTrack.overwriteClip(importedItem, startTime);
                        placed = true;
                    } catch (cInsErr2) {}
                }
            }

            // 3. Agar hech qaysi bo'lmasa, faqat bitta marta caption trek yaratish
            if (!placed) {
                try {
                    if (typeof seq.createCaptionTrack === "function") {
                        seq.createCaptionTrack(importedItem, offsetSec);
                        placed = true;
                    }
                } catch (cctErr) {}
            }
        }

        if (placed) {
            return JSON.stringify({
                ok: true,
                success: true,
                placed: true,
                message: "O'zbekcha subtitrlar video ustidagi trekka muvaffaqiyatli joylandi!"
            });
        } else if (importedItem) {
            return JSON.stringify({
                ok: true,
                success: true,
                placed: false,
                importedItemName: importedItem.name,
                srtPath: cleanPath,
                message: "Subtitrlar Premiere Pro loyihangizga ('Project' paneliga) import qilindi!\n\nUni Project panelidan sichqoncha bilan Video ustidagi trekka tortib (drag & drop) qo'ying."
            });
        } else {
            return JSON.stringify({
                ok: false,
                success: false,
                message: "SRT faylini Premiere Pro loyihasiga import qilib bo'lmadi: " + cleanPath
            });
        }

    } catch (e) {
        return JSON.stringify({ ok: false, success: false, error: e.toString(), line: e.line || 0 });
    }
}

function ppro_insertMogrtSubtitles(payloadJson) {
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
        if (!mogrtFile || !mogrtFile.exists) {
            var tmpFile = new File("C:/temp/active_subtitle.mogrt");
            if (tmpFile.exists) mogrtFile = tmpFile;
        }
        if (!mogrtFile || !mogrtFile.exists) {
            var tmpFile2 = new File("C:/temp/comic_subtitles.mogrt");
            if (tmpFile2.exists) mogrtFile = tmpFile2;
        }
        if (!mogrtFile || !mogrtFile.exists) {
            var fallbackPath = "D:/plaginlar/05_MOGRT_va_Titlar (Essential Graphics)/Line by line Hormozi 02.mogrt";
            var fbFile = new File(fallbackPath);
            if (fbFile.exists) mogrtFile = fbFile;
        }

        if (!mogrtFile || !mogrtFile.exists) {
            return JSON.stringify({ ok: false, success: false, message: "MOGRT shablon fayli topilmadi: " + mogrtPath });
        }

        // Foydalanuvchi videosi joylashgan trekning bevosita tepasidagi trek (masalan: V1 ustidagi V2)
        var targetTrackIndex = ppro_findTargetVideoTrackIndex(seq);

        // Oldingi joylashtirilgan barcha subtitrlarni tozalash (ustma-ust minmasligi uchun)
        ppro_cleanupOldSubtitles(seq, targetTrackIndex);

        var insertedCount = 0;
        var leadInSec = (typeof data.leadIn === "number") ? data.leadIn : 0.0;
        var prevEnd = 0.0;
        var lastTrackItem = null;
        var lastActualStart = 0.0;

        // TEZKOR KESH: MOGRT xususiyatlari indekslarini birinchi klipda 1 marta aniqlash
        var cachedTextIdx = -1;
        var cachedWordPropIndices = [];
        var cachedRealTimeIdx = -1;
        var propertiesInspected = false;

        for (var i = 0; i < segments.length; i++) {
            var seg = segments[i];
            var segText = (seg.text || "").trim();
            if (!segText) continue;

            // Qat'iy ko'pi bilan 2 qatordan oshmasligini ta'minlash (hech qachon 3 yoki 4 qator bo'lmaydi)
            var rawLines = segText.split(/[\r\n]+/);
            if (rawLines.length > 2) {
                var midLine = Math.ceil(rawLines.length / 2);
                segText = rawLines.slice(0, midLine).join(" ") + "\n" + rawLines.slice(midLine).join(" ");
            }

            var currentMogrtFile = mogrtFile;
            if (seg.mogrtPath) {
                var segMogrt = new File(seg.mogrtPath);
                if (segMogrt.exists) currentMogrtFile = segMogrt;
            }

            var sStart = parseFloat(seg.start) || 0.0;
            var sEnd = parseFloat(seg.end) || (sStart + 1.0);

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
                        // 1-QADAM: Birinchi klipda xususiyatlar indekslarini aniqlash (faqat 1 marta bajariladi)
                        if (!propertiesInspected) {
                            propertiesInspected = true;
                            for (var p = 0; p < mgtComp.properties.numItems; p++) {
                                var prop = mgtComp.properties[p];
                                var pName = (prop.displayName || prop.name || "").toLowerCase();

                                if (cachedTextIdx === -1) {
                                    var val = "";
                                    try { val = prop.getValue(); } catch (vErr) {}

                                    // 1. Eng ishonchli usul: textEditValue bo'lgan xususiyat (bu faqat matn qatlamida bo'ladi)
                                    if (typeof val === "string" && val.indexOf("textEditValue") !== -1) {
                                        cachedTextIdx = p;
                                    } else if (pName.indexOf("spacing") === -1 && pName.indexOf("character") === -1 && pName.indexOf("offset") === -1 && pName.indexOf("align") === -1 && pName.indexOf("color") === -1) {
                                        // 2. Faqat haqiqiy matn boshqaruvchilari (slayder va sozlamalarni chiqarib tashlash)
                                        if (pName === "text" || pName === "source text" || pName === "caption" || pName === "matn" || pName === "title" || pName.indexOf("hello_box") !== -1 || pName.indexOf("zoomin") !== -1 || pName.indexOf("butter") !== -1 || pName.indexOf("wavingof") !== -1) {
                                            cachedTextIdx = p;
                                        }
                                    }
                                }

                                if (pName.indexOf("word start time") !== -1) {
                                    var wMatch = pName.match(/\d+/);
                                    if (wMatch) {
                                        cachedWordPropIndices.push({ wordNum: parseInt(wMatch[0], 10), propIdx: p });
                                    }
                                }

                                if (pName.indexOf("real time") !== -1 && cachedRealTimeIdx === -1) {
                                    cachedRealTimeIdx = p;
                                }
                            }

                            if (cachedTextIdx === -1) {
                                for (var pDef = 0; pDef < mgtComp.properties.numItems; pDef++) {
                                    try {
                                        var pVal = mgtComp.properties[pDef].getValue();
                                        if (typeof pVal === "string" && pVal.length > 0) {
                                            cachedTextIdx = pDef;
                                            break;
                                        }
                                    } catch (dErr) {}
                                }
                            }
                        }

                        // 2-QADAM: Matnni to'g'ridan-to'g'ri o'rnatish (tezkor, barcha kliplar uchun)
                        if (cachedTextIdx >= 0 && cachedTextIdx < mgtComp.properties.numItems) {
                            var tProp = mgtComp.properties[cachedTextIdx];
                            var setSuccess = false;
                            try {
                                tProp.setValue(segText);
                                setSuccess = true;
                            } catch (ePlain) {}
                            if (!setSuccess) {
                                try {
                                    tProp.setValue(segText, true);
                                    setSuccess = true;
                                } catch (ePlain2) {}
                            }
                            if (!setSuccess) {
                                try {
                                    var curV = tProp.getValue();
                                    if (typeof curV === "string" && curV.indexOf("textEditValue") !== -1) {
                                        var curO = JSON.parse(curV);
                                        curO.textEditValue = segText;
                                        curO.fontTextRunLength = [segText.length];
                                        tProp.setValue(JSON.stringify(curO), true);
                                    }
                                } catch (eJson) {}
                            }
                        }

                        // 3-QADAM: Karaoke so'z vaqti slayderlari (agar mavjud bo'lsa)
                        if (cachedWordPropIndices.length > 0 && seg.words && seg.words.length > 0) {
                            for (var w = 0; w < cachedWordPropIndices.length; w++) {
                                var wInfo = cachedWordPropIndices[w];
                                var wIdx = wInfo.wordNum - 1;
                                if (wIdx >= 0 && wIdx < seg.words.length) {
                                    var wRelStart = Math.max(0, parseFloat(seg.words[wIdx].start) - sStart);
                                    try {
                                        mgtComp.properties[wInfo.propIdx].setValue(wRelStart, true);
                                    } catch (wSetErr) {
                                        try { mgtComp.properties[wInfo.propIdx].setValue(wRelStart); } catch (wSetErr2) {}
                                    }
                                }
                            }
                        }

                        // 4-QADAM: Real time yoqish
                        if (cachedRealTimeIdx >= 0 && cachedRealTimeIdx < mgtComp.properties.numItems) {
                            try { mgtComp.properties[cachedRealTimeIdx].setValue(1, true); } catch (rtErr) {}
                        }
                    }
                    insertedCount++;
                }
            } catch (mgtErr) {}
        }

        return JSON.stringify({
            ok: true,
            success: true,
            placed: true,
            count: insertedCount,
            trackIndex: targetTrackIndex,
            message: insertedCount + " ta subtitr videoning tepasidagi V" + (targetTrackIndex + 1) + " trekka muvaffaqiyatli joylashtirildi!"
        });

    } catch (e) {
        return JSON.stringify({ ok: false, success: false, error: e.toString(), line: e.line || 0 });
    }
}

// ==================== AFTER EFFECTS YORDAMCHI VA ASOSIY FUNKSIYALARI ====================

function ae_getCompInfo() {
    try {
        if (!app.project || !app.project.activeItem || !(app.project.activeItem instanceof CompItem)) {
            return JSON.stringify({
                ok: false,
                exists: false,
                message: "Aktiv kompozitsiya topilmadi! Iltimos, After Effects'da kompozitsiyani oching."
            });
        }
        var comp = app.project.activeItem;
        return JSON.stringify({
            ok: true,
            exists: true,
            name: comp.name,
            width: comp.width,
            height: comp.height,
            frameRate: comp.frameRate,
            duration: comp.duration,
            time: comp.time
        });
    } catch (e) {
        return JSON.stringify({ ok: false, exists: false, error: e.toString(), line: e.line || 0 });
    }
}

function ae_setPlayhead(timeSec) {
    try {
        if (app.project && app.project.activeItem && app.project.activeItem instanceof CompItem) {
            app.project.activeItem.time = parseFloat(timeSec);
            return JSON.stringify({ ok: true, status: "ok" });
        }
        return JSON.stringify({ ok: false, status: "error", message: "Kompozitsiya topilmadi" });
    } catch (e) {
        return JSON.stringify({ ok: false, status: "error", error: e.toString(), line: e.line || 0 });
    }
}

function ae_getTimeDiagnostics() {
    try {
        if (!app.project || !app.project.activeItem || !(app.project.activeItem instanceof CompItem)) {
            return JSON.stringify({
                ok: false,
                success: false,
                message: "After Effects'da aktiv kompozitsiya ochilmagan"
            });
        }
        var comp = app.project.activeItem;
        var fps = comp.frameRate || 25.0;
        var compDurMs = Math.round((comp.duration || 0) * 1000);
        var selectedLayer = (comp.selectedLayers && comp.selectedLayers.length > 0) ? comp.selectedLayers[0] : null;

        var layerSourceType = "yo'q";
        var layerInMs = 0;
        var layerStartMs = 0;
        var layerDurMs = 0;
        var layerOutMs = 0;
        var audioPath = "";

        if (selectedLayer) {
            if (selectedLayer.source instanceof CompItem) {
                layerSourceType = "precomp";
            } else if (selectedLayer.source && selectedLayer.source.mainSource instanceof SolidSource) {
                layerSourceType = "solid";
            } else if (selectedLayer.source && selectedLayer.source.mainSource && selectedLayer.source.mainSource.file) {
                layerSourceType = "footage";
                audioPath = selectedLayer.source.mainSource.file.fsName;
            } else if (selectedLayer.source && selectedLayer.source.file) {
                layerSourceType = "footage";
                audioPath = selectedLayer.source.file.fsName;
            } else {
                layerSourceType = "layer";
            }

            layerInMs = Math.round((parseFloat(selectedLayer.inPoint) || 0) * 1000);
            layerStartMs = Math.round((parseFloat(selectedLayer.startTime) || 0) * 1000);
            layerOutMs = Math.round((parseFloat(selectedLayer.outPoint) || 0) * 1000);
            layerDurMs = Math.max(0, layerOutMs - layerInMs);
        }

        var diag = {
            ok: true,
            success: true,
            host: "AEFT",
            composition: String(comp.name || "Kompozitsiya"),
            fps: Math.round(fps * 100) / 100,
            duration: compDurMs,
            selected_layer: selectedLayer ? String(selectedLayer.name) : "yo'q",
            layer_source_type: layerSourceType,
            layer_in_point: layerInMs,
            layer_start: layerStartMs,
            layer_duration: layerDurMs,
            layer_out_point: layerOutMs,
            playhead_ms: Math.round(comp.time * 1000),
            audio_source: {
                path: audioPath ? String(audioPath).replace(/\\/g, "/") : "yo'q",
                duration: layerDurMs,
                sample_rate: 16000
            }
        };
        return JSON.stringify(diag);
    } catch (e) {
        return JSON.stringify({ ok: false, success: false, error: e.toString() });
    }
}

function ae_getSelectedLayerMediaPath() {
    try {
        if (!app.project || !app.project.activeItem || !(app.project.activeItem instanceof CompItem)) {
            return JSON.stringify({
                ok: false,
                success: false,
                message: "After Effects'da aktiv kompozitsiya topilmadi! Iltimos, avval kompozitsiyani oching."
            });
        }
        var comp = app.project.activeItem;

        function findAudioFootageInComp(c, depth) {
            if (!c || depth > 4) return null;
            for (var k = 1; k <= c.numLayers; k++) {
                var l = c.layer(k);
                if (l.adjustmentLayer) continue;
                if (l.source && l.source.mainSource && l.source.mainSource instanceof SolidSource) continue;
                if (l.hasAudio && l.source) {
                    if (l.source.mainSource && l.source.mainSource.file && l.source.mainSource.file.exists) {
                        return { filePath: l.source.mainSource.file.fsName, name: l.name, layer: l };
                    }
                    if (l.source.file && l.source.file.exists) {
                        return { filePath: l.source.file.fsName, name: l.name, layer: l };
                    }
                    if (l.source instanceof CompItem) {
                        var nested = findAudioFootageInComp(l.source, depth + 1);
                        if (nested) return nested;
                    }
                }
            }
            return null;
        }

        // 1. Tanlangan layer'lardan izlash (barcha tanlangan qatlamlarni qo'llab-quvvatlaydi)
        var aeClips = [];
        var selectedLayers = comp.selectedLayers;
        if (selectedLayers && selectedLayers.length > 0) {
            for (var i = 0; i < selectedLayers.length; i++) {
                var layer = selectedLayers[i];
                if (layer.adjustmentLayer) continue;
                if (layer.source && layer.source.mainSource && layer.source.mainSource instanceof SolidSource) continue;

                var foundPath = "";
                if (layer.source instanceof CompItem) {
                    var precompFound = findAudioFootageInComp(layer.source, 1);
                    if (precompFound) foundPath = precompFound.filePath;
                } else if (layer.source) {
                    if (layer.source.mainSource && layer.source.mainSource.file && layer.source.mainSource.file.exists) {
                        foundPath = layer.source.mainSource.file.fsName;
                    } else if (layer.source.file && layer.source.file.exists) {
                        foundPath = layer.source.file.fsName;
                    }
                }

                if (foundPath) {
                    var inSec = parseFloat(layer.inPoint) || 0;
                    var outSec = parseFloat(layer.outPoint) || 0;
                    var startSec = parseFloat(layer.startTime) || 0;
                    var srcIn = Math.max(0, inSec - startSec);
                    var durSec = (outSec > inSec) ? (outSec - inSec) : 1.0;

                    aeClips.push({
                        ok: true,
                        success: true,
                        filePath: foundPath,
                        name: layer.name,
                        inPoint: srcIn,
                        outPoint: srcIn + durSec,
                        start: inSec,
                        end: outSec,
                        duration: durSec,
                        offset: inSec
                    });
                }
            }

            if (aeClips.length > 0) {
                aeClips.sort(function (a, b) { return a.start - b.start; });
                var firstAe = aeClips[0];
                return JSON.stringify({
                    ok: true,
                    success: true,
                    multiple: aeClips.length > 1,
                    clips: aeClips,
                    count: aeClips.length,
                    filePath: firstAe.filePath,
                    name: firstAe.name,
                    inPoint: firstAe.inPoint,
                    outPoint: firstAe.outPoint,
                    start: firstAe.start,
                    end: firstAe.end,
                    duration: firstAe.duration,
                    offset: firstAe.offset
                });
            }
        }

        // 2. Tanlov yo'q bo'lsa, butun kompozitsiyadagi audio qatlamni izlash
        var compFound = findAudioFootageInComp(comp, 0);
        if (compFound) {
            return JSON.stringify({
                ok: true,
                success: true,
                filePath: compFound.filePath,
                layerName: compFound.name,
                inPoint: compFound.layer ? compFound.layer.inPoint : 0,
                outPoint: compFound.layer ? compFound.layer.outPoint : comp.duration,
                startTime: compFound.layer ? compFound.layer.startTime : 0
            });
        }

        // 3. Audio bo'lmagan, lekin video footage fayl bo'lsa ham qidirish
        for (var j = 1; j <= comp.numLayers; j++) {
            var lyr = comp.layer(j);
            if (lyr.adjustmentLayer) continue;
            if (lyr.source && lyr.source.file && lyr.source.file.exists) {
                return JSON.stringify({
                    ok: true,
                    success: true,
                    filePath: lyr.source.file.fsName,
                    layerName: lyr.name,
                    inPoint: lyr.inPoint,
                    outPoint: lyr.outPoint,
                    startTime: lyr.startTime
                });
            }
        }

        return JSON.stringify({
            ok: false,
            success: false,
            message: "Kompozitsiyada audio/video manba fayli topilmadi. Audio faylni 'Choose File' orqali qo'lda tanlang."
        });
    } catch (e) {
        return JSON.stringify({ ok: false, success: false, error: e.toString(), line: e.line || 0 });
    }
}

function ae_writeWordStackLayers(comp, wordPlan, style, data) {
    if (!comp || !wordPlan || !wordPlan.words) {
        return JSON.stringify({ ok: false, success: false, message: "Kompozitsiya yoki so'z rejasi mavjud emas" });
    }

    var words = wordPlan.words;
    if (words.length === 0) {
        return JSON.stringify({ ok: true, success: true, count: 0, message: "So'zlar yo'q" });
    }

    var fps = comp.frameRate || 25.0;
    var compH = comp.height;
    var compW = comp.width;
    var compDisplayOffset = (typeof comp.displayStartTime === "number") ? comp.displayStartTime : 0;
    var clipOffset = (data && typeof data.clipOffset === "number") ? data.clipOffset : 0;
    var totalOffset = compDisplayOffset + clipOffset;

    var targetLayerOut = compDisplayOffset + comp.duration;
    var targetLayerIn = compDisplayOffset;
    try {
        if (comp.selectedLayers && comp.selectedLayers.length > 0) {
            var selLayer = comp.selectedLayers[0];
            if (selLayer.outPoint) targetLayerOut = parseFloat(selLayer.outPoint);
            if (selLayer.inPoint) targetLayerIn = parseFloat(selLayer.inPoint);
        }
    } catch (tlErr) {}

    // Style parametrlarini olish
    var fontSize = (style && style.fontSize) ? style.fontSize : Math.round(compH * 0.055);
    var fontName = (style && style.fontName) ? style.fontName : "Arial-BoldMT";
    var fillRGB = (style && style.fillColor) ? style.fillColor : [1, 1, 1];
    var strokeRGB = (style && style.strokeColor) ? style.strokeColor : [0, 0, 0];
    var strokeW = (style && style.strokeWidth !== undefined) ? style.strokeWidth : 3;
    var posYPercent = (style && style.positionYPercent) ? style.positionYPercent : 85;
    var animType = (style && style.wordAnimation) ? String(style.wordAnimation).toLowerCase() : ((style && style.animType) ? String(style.animType).toLowerCase() : "pop");

    var posX = compW / 2;
    var basePosY = (compH * posYPercent) / 100;
    var lineSpacing = fontSize * 1.35;
    var maxY = compH * 0.96;

    // Andoza qatlam yaratib, stili olinadi va o'chiriladi
    try {
        var tmpl = comp.layers.addText("TEMPLATE");
        var tmplProp = tmpl.property("Source Text");
        var tmplDoc = tmplProp.value;
        tmplDoc.fontSize = fontSize;
        try {
            tmplDoc.font = fontName;
        } catch (fErr) {
            try { tmplDoc.font = "ArialMT"; } catch (fErr2) {}
        }
        tmplDoc.fillColor = fillRGB;
        tmplDoc.applyFill = true;
        if (strokeW > 0) {
            tmplDoc.applyStroke = true;
            tmplDoc.strokeColor = strokeRGB;
            tmplDoc.strokeWidth = strokeW;
            tmplDoc.strokeOverFill = false;
        } else {
            tmplDoc.applyStroke = false;
        }
        tmplDoc.justification = ParagraphJustification.CENTER_JUSTIFY;
        tmplProp.setValue(tmplDoc);
        tmpl.remove();
    } catch (tmplErr) {}

    var createdCount = 0;

    for (var i = 0; i < words.length; i++) {
        var item = words[i];
        if (!item || !item.word) continue;

        // Kadr aniqligida kompozitsiya vaqti (hech qachon kechikmaslik uchun floor)
        var wIn = Math.floor(item.inPoint * fps + 0.000001) / fps + totalOffset;
        var wOut = Math.ceil(item.outPoint * fps - 0.000001) / fps + totalOffset;
        var cClose = Math.floor(item.closeStart * fps + 0.000001) / fps + totalOffset;
        var wEnd = Math.round(item.wordEnd * fps) / fps + totalOffset;

        // Clamping kompozitsiya chegaralariga
        if (wIn >= targetLayerOut) continue;
        if (wOut > targetLayerOut) wOut = targetLayerOut;
        if (wIn < targetLayerIn) wIn = targetLayerIn;
        if (wOut <= wIn) continue;

        var wordLayer = comp.layers.addText(item.word);
        wordLayer.comment = "UZ_AI_SUBTITLE";
        wordLayer.name = "[UZ_WORD] " + item.word;

        wordLayer.startTime = wIn;
        wordLayer.inPoint = wIn;
        wordLayer.outPoint = wOut;

        // Text Document qo'llash
        try {
            var textProp = wordLayer.property("Source Text");
            var textDoc = textProp.value;
            textDoc.fontSize = fontSize;
            try { textDoc.font = fontName; } catch (eF) { try { textDoc.font = "ArialMT"; } catch (eF2) {} }
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
        } catch (tDocErr) {}

        // Boshlang'ich pozitsiya
        var curLine = item.initialLine || 0;
        var curY = basePosY + (curLine * lineSpacing);
        if (curY > maxY) curY = maxY;

        var posProp = wordLayer.property("Position");
        if (posProp) {
            posProp.setValue([posX, curY]);

            // Agar qator almashinuvi (lineChanges) bo'lsa -> Position kalitlari
            if (item.lineChanges && item.lineChanges.length > 0) {
                for (var cIdx = 0; cIdx < item.lineChanges.length; cIdx++) {
                    var chg = item.lineChanges[cIdx];
                    var chgTime = Math.floor(chg.time * fps + 0.000001) / fps + totalOffset;
                    var fromY = basePosY + (chg.fromLine * lineSpacing);
                    var toY = basePosY + (chg.toLine * lineSpacing);
                    if (fromY > maxY) fromY = maxY;
                    if (toY > maxY) toY = maxY;

                    if (chgTime > wIn && chgTime < wOut) {
                        var animLead = Math.max(0.04, 2 / fps);
                        posProp.setValueAtTime(chgTime - animLead, [posX, fromY]);
                        posProp.setValueAtTime(chgTime, [posX, toY]);
                    }
                }
            }
        }

        // Animatsiya: Pop, Fade yoki None
        var scaleProp = wordLayer.property("Scale");
        var opacityProp = wordLayer.property("Opacity");

        if (animType === "pop" && scaleProp) {
            var p1 = wIn;
            var p2 = wIn + (2 / fps);
            var p3 = wIn + (4 / fps);
            if (p3 < wOut) {
                scaleProp.setValueAtTime(p1, [88, 88]);
                scaleProp.setValueAtTime(p2, [112, 112]);
                scaleProp.setValueAtTime(p3, [100, 100]);
            }
        } else if (animType === "fade" && opacityProp) {
            var fEnd = wIn + (3 / fps);
            if (fEnd < wOut) {
                opacityProp.setValueAtTime(wIn, 0);
                opacityProp.setValueAtTime(fEnd, 100);
            }
        }

        // Yopilish animatsiyasi (closeStart dan outPoint gacha)
        if (cClose < wOut && cClose >= wIn) {
            if (opacityProp) {
                opacityProp.setValueAtTime(cClose, 100);
                opacityProp.setValueAtTime(wOut, 0);
            }
            if (animType === "pop" && scaleProp) {
                scaleProp.setValueAtTime(cClose, [100, 100]);
                scaleProp.setValueAtTime(wOut, [92, 92]);
            }
        }

        // Harf-harf ochilish (charReveal)
        if (item.charReveal && wEnd > wIn) {
            try {
                var textGroup = wordLayer.property("Text");
                var textAnimators = textGroup.property("Animators") || textGroup.property("ADBE Text Animators");
                if (textAnimators) {
                    var anim = textAnimators.addProperty("ADBE Text Animator");
                    anim.name = "CharReveal";
                    var animProps = anim.property("ADBE Text Animator Properties");
                    var opProp = animProps.addProperty("ADBE Text Opacity");
                    opProp.setValue(0);
                    var sel = anim.property("ADBE Text Selectors").addProperty("ADBE Text Selector");
                    var startProp = sel.property("ADBE Text Percent Start");
                    startProp.setValueAtTime(wIn, 0);
                    startProp.setValueAtTime(wEnd, 100);
                }
            } catch (crErr) {}
        }

        // MUHIM QOIDA: Hech qachon textDoc.text = "" kaliti qo'yilmaydi!
        // Shunda pauzada matn o'z holida qotib turadi.

        createdCount++;
    }

    return JSON.stringify({
        ok: true,
        success: true,
        count: createdCount,
        stats: wordPlan.stats || {},
        message: createdCount + " ta so'z kaskad qatlamlari joylandi"
    });
}

function ae_createSubtitles(payloadJson) {
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

            // Agar so'zma-so'z Kaskad rejasidagi wordPlan berilgan bo'lsa -> alohida qatlamlar yaratish
            if (data.wordPlan && data.wordPlan.words && data.wordPlan.words.length > 0) {
                var stackRes = ae_writeWordStackLayers(comp, data.wordPlan, style, data);
                app.endUndoGroup();
                return stackRes;
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

            var compEnd = compDisplayOffset + comp.duration;
            var targetLayerOut = compEnd;
            var targetLayerIn = compDisplayOffset;
            try {
                if (comp.selectedLayers && comp.selectedLayers.length > 0) {
                    var selLayer = comp.selectedLayers[0];
                    if (selLayer.outPoint) targetLayerOut = parseFloat(selLayer.outPoint);
                    if (selLayer.inPoint) targetLayerIn = parseFloat(selLayer.inPoint);
                }
            } catch (tlErr) {}

            for (var i = 0; i < segments.length; i++) {
                var seg = segments[i];
                var segText = seg.text || "";
                if (!segText.replace(/\s/g, "")) continue;

                var sStart = parseFloat(seg.start) + compDisplayOffset;
                var sEnd = parseFloat(seg.end) + compDisplayOffset;
                if (seg.words && seg.words.length > 0) {
                    var fStart = parseFloat(seg.words[0].start) + compDisplayOffset;
                    if (!isNaN(fStart) && fStart >= compDisplayOffset) sStart = fStart;
                    var lEnd = parseFloat(seg.words[seg.words.length - 1].end) + compDisplayOffset;
                    if (!isNaN(lEnd) && lEnd > sStart) sEnd = lEnd;
                }
                if (sEnd <= sStart) sEnd = sStart + 0.35;

                // CLAMPING: Agar so'z/segment video tugash chegarasidan keyin bo'lsa -> o'tkazib yuborish
                if (sStart >= targetLayerOut) continue;
                if (sEnd > targetLayerOut) sEnd = targetLayerOut;
                if (sStart < targetLayerIn) sStart = targetLayerIn;
                if (sEnd <= sStart) continue;

                var animIn = Math.max(targetLayerIn, sStart - leadInSec);
                if (animIn >= sEnd) animIn = sStart;

                var textLayer = comp.layers.addText(segText);
                textLayer.comment = "UZ_AI_SUBTITLE";
                var animTag = seg.styleName || (seg.animType ? seg.animType.toUpperCase() : (style.animType ? style.animType.toUpperCase() : "POP"));
                var shortText = segText.length > 22 ? (segText.substring(0, 20) + "...") : segText;
                textLayer.name = "[" + animTag + "] " + shortText;

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

                // SO'ZMA-SO'Z REJIMI (WORD-BY-WORD):
                var isWordByWord = (style && style.wordByWord);
                var wordMode = (style && style.wordMode) || "accumulate";
                var wordAnim = (style && style.wordAnimation) || "pop";
                var pauseHideText = !!(style && style.pauseHideText);
                var pauseThresholdSec = ((style && style.pauseHideThresholdMs) ? style.pauseHideThresholdMs : 800) / 1000.0;
                var charReveal = !!(style && style.charReveal);

                if (isWordByWord && seg.words && seg.words.length > 0) {
                    if (wordMode === "accumulate") {
                        // To'planib borsin: har bir so'z aytilganda qatorga qo'shiladi
                        for (var wIdx = 0; wIdx < seg.words.length; wIdx++) {
                            var wObj = seg.words[wIdx];
                            var wTime = Math.max(textLayer.inPoint, parseFloat(wObj.start) + compDisplayOffset);
                            var wEndTime = Math.max(wTime + 0.1, parseFloat(wObj.end) + compDisplayOffset);
                            var pauseAfter = (typeof wObj.pause_after_ms === "number") ? (wObj.pause_after_ms / 1000.0) : 0.0;

                            var subWords = [];
                            for (var k = 0; k < wIdx; k++) {
                                subWords.push(seg.words[k].word);
                            }
                            var prefix = subWords.join(" ");
                            var currentWordText = wObj.word;

                            if (charReveal && currentWordText.length > 1 && (wEndTime - wTime) >= 0.15) {
                                // Harf-harf ochilish: so'z davomiyligi bo'yicha harflar bosqichma-bosqich chiqadi
                                var cLen = currentWordText.length;
                                var cStep = (wEndTime - wTime) / cLen;
                                for (var ch = 1; ch <= cLen; ch++) {
                                    var sliceText = (prefix ? (prefix + " ") : "") + currentWordText.substring(0, ch);
                                    textDoc.text = sliceText;
                                    textProp.setValueAtTime(wTime + (ch - 1) * cStep, textDoc);
                                }
                            } else {
                                textDoc.text = (prefix ? (prefix + " ") : "") + currentWordText;
                                textProp.setValueAtTime(wTime, textDoc);
                            }

                            // Pauzada matnni yashirish (agar yoqilgan bo'lsa va pauza chegaradan katta bo'lsa)
                            if (pauseHideText && pauseAfter >= pauseThresholdSec) {
                                textDoc.text = "";
                                textProp.setValueAtTime(wEndTime, textDoc);
                            }
                        }
                    } else if (wordMode === "single") {
                        // Bitta so'z: faqat aytilayotgan so'z ko'rinadi
                        for (var sIdx = 0; sIdx < seg.words.length; sIdx++) {
                            var swObj = seg.words[sIdx];
                            var swTime = Math.max(textLayer.inPoint, parseFloat(swObj.start) + compDisplayOffset);
                            var swEndTime = Math.max(swTime + 0.1, parseFloat(swObj.end) + compDisplayOffset);
                            var swPauseAfter = (typeof swObj.pause_after_ms === "number") ? (swObj.pause_after_ms / 1000.0) : 0.0;
                            var sWordText = swObj.word;

                            if (charReveal && sWordText.length > 1 && (swEndTime - swTime) >= 0.15) {
                                var sLen = sWordText.length;
                                var sStep = (swEndTime - swTime) / sLen;
                                for (var sch = 1; sch <= sLen; sch++) {
                                    textDoc.text = sWordText.substring(0, sch);
                                    textProp.setValueAtTime(swTime + (sch - 1) * sStep, textDoc);
                                }
                            } else {
                                textDoc.text = sWordText;
                                textProp.setValueAtTime(swTime, textDoc);
                            }

                            // Pauzada matnni yashirish
                            if (pauseHideText && swPauseAfter >= pauseThresholdSec) {
                                textDoc.text = "";
                                textProp.setValueAtTime(swEndTime, textDoc);
                            }
                        }
                    }

                    // Har bir so'z aytilganda mikro-animatsiya (pop / fade)
                    if (wordAnim === "pop") {
                        try {
                            var tScale = textLayer.property("Transform").property("Scale");
                            for (var pIdx = 0; pIdx < seg.words.length; pIdx++) {
                                var pwTime = Math.max(textLayer.inPoint, parseFloat(seg.words[pIdx].start) + compDisplayOffset);
                                tScale.setValueAtTime(pwTime, [90, 90, 100]);
                                tScale.setValueAtTime(pwTime + 0.08, [110, 110, 100]);
                                tScale.setValueAtTime(pwTime + 0.16, [100, 100, 100]);
                            }
                        } catch (popWErr) {}
                    }
                }

                // Karaoke highlight animatori (so'zma-so'z rang va ajralish)
                if ((isKaraoke || wordMode === "karaoke") && seg.words && seg.words.length > 0) {
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
}

function ae_extractSelectedTextStyle() {
    try {
        if (!app.project || !app.project.activeItem || !(app.project.activeItem instanceof CompItem)) {
            return JSON.stringify({ ok: false, success: false, message: "Aktiv kompozitsiya topilmadi" });
        }

        var comp = app.project.activeItem;
        var selectedLayers = comp.selectedLayers;

        if (!selectedLayers || selectedLayers.length === 0) {
            return JSON.stringify({ ok: false, success: false, message: "Iltimos, avval matn qatlamini tanlang!" });
        }

        var textLayer = null;
        for (var i = 0; i < selectedLayers.length; i++) {
            var lyr = selectedLayers[i];
            if ((typeof TextLayer !== "undefined" && lyr instanceof TextLayer) || (lyr.property && lyr.property("Source Text") !== null)) {
                textLayer = lyr;
                break;
            }
        }

        if (!textLayer) {
            return JSON.stringify({ ok: false, success: false, message: "Tanlangan qatlamlar orasida matn (Text) qatlami topilmadi!" });
        }

        var textProp = textLayer.property("Source Text");
        var textDoc = textProp.value;
        var pos = textLayer.property("Transform").property("Position").value;

        var styleData = {
            fontName: textDoc.font,
            fontSize: Math.round(textDoc.fontSize),
            fillColor: [
                Math.round(textDoc.fillColor[0] * 100) / 100,
                Math.round(textDoc.fillColor[1] * 100) / 100,
                Math.round(textDoc.fillColor[2] * 100) / 100
            ],
            applyFill: textDoc.applyFill,
            strokeColor: textDoc.applyStroke ? [
                Math.round(textDoc.strokeColor[0] * 100) / 100,
                Math.round(textDoc.strokeColor[1] * 100) / 100,
                Math.round(textDoc.strokeColor[2] * 100) / 100
            ] : [0, 0, 0],
            strokeWidth: textDoc.applyStroke ? textDoc.strokeWidth : 0,
            applyStroke: textDoc.applyStroke,
            tracking: textDoc.tracking || 0,
            justification: textDoc.justification,
            positionYPercent: Math.round((pos[1] / comp.height) * 100),
            layerName: textLayer.name
        };

        return JSON.stringify({
            ok: true,
            success: true,
            style: styleData
        });

    } catch (e) {
        return JSON.stringify({ ok: false, success: false, error: e.toString(), line: e.line || 0 });
    }
}

function ae_applyStyleToLayers(styleJson) {
    try {
        if (!app.project || !app.project.activeItem || !(app.project.activeItem instanceof CompItem)) {
            return JSON.stringify({ ok: false, success: false, message: "Aktiv kompozitsiya topilmadi" });
        }

        var comp = app.project.activeItem;
        var selectedLayers = comp.selectedLayers;

        if (!selectedLayers || selectedLayers.length === 0) {
            return JSON.stringify({ ok: false, success: false, message: "Stil qo'llash uchun qatlamlarni tanlang!" });
        }

        var style = JSON.parse(styleJson);

        app.beginUndoGroup("O'zbekcha Subtitr Stilini Qo'llash");

        var appliedCount = 0;
        for (var i = 0; i < selectedLayers.length; i++) {
            var layer = selectedLayers[i];
            var textProp = layer.property("Source Text");
            if (textProp) {
                var textDoc = textProp.value;
                if (style.fontSize) textDoc.fontSize = style.fontSize;
                if (style.fontName) {
                    try { textDoc.font = style.fontName; } catch (fErr) {}
                }
                if (style.fillColor) {
                    textDoc.fillColor = style.fillColor;
                    textDoc.applyFill = true;
                }
                if (style.strokeWidth !== undefined) {
                    if (style.strokeWidth > 0 && style.strokeColor) {
                        textDoc.applyStroke = true;
                        textDoc.strokeColor = style.strokeColor;
                        textDoc.strokeWidth = style.strokeWidth;
                    } else {
                        textDoc.applyStroke = false;
                    }
                }
                textProp.setValue(textDoc);

                if (style.positionYPercent) {
                    var curPos = layer.property("Transform").property("Position").value;
                    var newY = (comp.height * style.positionYPercent) / 100;
                    layer.property("Transform").property("Position").setValue([curPos[0], newY]);
                }

                appliedCount++;
            }
        }

        app.endUndoGroup();

        return JSON.stringify({
            ok: true,
            success: true,
            count: appliedCount,
            message: appliedCount + " ta qatlamga stil muvaffaqiyatli berildi!"
        });
    } catch (e) {
        try { app.endUndoGroup(); } catch (ign) {}
        return JSON.stringify({ ok: false, success: false, error: e.toString(), line: e.line || 0 });
    }
}

function ppro_insertSingleMogrtAtPlayhead(mogrtPath, customText) {
    try {
        var seq = ppro_getSeq();
        if (!seq) {
            return JSON.stringify({ ok: false, success: false, message: "Aktiv sequence topilmadi. Avval Premiere Pro'da ketma-ketlikni oching." });
        }

        var mFile = new File(mogrtPath);
        if (!mFile.exists) {
            return JSON.stringify({ ok: false, success: false, message: "MOGRT fayli diskda topilmadi: " + mogrtPath });
        }

        var curTicks = seq.getPlayerPosition();
        var curTicksStr = curTicks ? String(curTicks.ticks) : "0";
        var curSec = parseFloat(curTicks.seconds) || (parseFloat(curTicksStr) / 254016000000) || 0;

        var targetTrackIndex = ppro_findTargetVideoTrackIndex(seq);
        var newTrackItem = seq.importMGT(mFile.fsName, curTicksStr, targetTrackIndex, 0);

        if (newTrackItem) {
            var durSec = 3.0;
            var endTicks = new Time();
            endTicks.seconds = curSec + durSec;
            try { newTrackItem.end = endTicks; } catch (eT) {}

            var animTag = decodeURIComponent(mFile.name).replace(/\.mogrt$/i, "").replace(/[_-]/g, " ");
            var textToSet = customText || "O'zbekcha AI Subtitr";
            newTrackItem.name = "[" + animTag + "] " + textToSet;

            var mgtComp = newTrackItem.getMGTComponent();
            if (mgtComp && mgtComp.properties) {
                for (var p = 0; p < mgtComp.properties.numItems; p++) {
                    var prop = mgtComp.properties[p];
                    var pName = (prop.displayName || prop.name || "").toLowerCase();
                    if (pName.indexOf("text") !== -1 || pName.indexOf("txt") !== -1 || pName.indexOf("caption") !== -1 || pName.indexOf("source") !== -1 || pName.indexOf("title") !== -1 || pName.indexOf("matn") !== -1 || pName.indexOf("hello_box") !== -1 || pName.indexOf("zoomin") !== -1 || pName.indexOf("butter") !== -1) {
                        try {
                            prop.setValue(textToSet);
                            break;
                        } catch (sErr) {}
                    }
                }
            }
            return JSON.stringify({ ok: true, success: true, message: animTag + " playhead'ga joylashtirildi!" });
        }
        return JSON.stringify({ ok: false, success: false, message: "MOGRT timeline'ga import qilib bo'lmadi" });
    } catch (e) {
        return JSON.stringify({ ok: false, success: false, error: e.toString(), line: e.line || 0 });
    }
}


/**
 * Premiere Pro Sequence'ga CapCut uslubidagi Beat va Ritm markerlarini joylash
 */
function ppro_createBeatMarkers(payloadJson) {
    try {
        var seq = ppro_getSeq();
        if (!seq) return JSON.stringify({ success: false, message: "Aktiv sequence topilmadi! Sequence ochilganligiga ishonch hosil qiling." });

        var data;
        try {
            data = JSON.parse(decodeURIComponent(payloadJson));
        } catch (ex) {
            data = JSON.parse(payloadJson);
        }

        var markers = seq.markers;
        if (!markers) return JSON.stringify({ success: false, message: "Sequence markerlari mavjud emas." });

        if (data.clearExisting) {
            try {
                var cur = markers.getFirstMarker();
                while (cur) {
                    var nextM = markers.getNextMarker(cur);
                    if (cur.name && cur.name.indexOf("Beat") !== -1) {
                        markers.deleteMarker(cur);
                    }
                    cur = nextM;
                }
            } catch (cErr) {}
        }

        var beats = data.beats || [];
        var fps = parseFloat(data.fps) || 25;
        try { if (seq.framerate) { var seqFpsM = parseFloat(seq.framerate); if (seqFpsM > 0) fps = seqFpsM; } } catch (eFps) {}
        if (!(fps > 0)) fps = 25;
        var frameDur = 1.0 / fps;
        var lastFrame = -1;
        var count = 0;
        var skipped = 0;

        for (var i = 0; i < beats.length; i++) {
            var b = beats[i];
            var tSec = parseFloat(b.time);
            if (isNaN(tSec) || tSec < 0) continue;
            var frameNo = (b.frame !== undefined && b.frame !== null)
                            ? Math.round(parseFloat(b.frame)) : Math.round(tSec * fps);
            tSec = frameNo * frameDur;
            if (frameNo === lastFrame) { skipped++; continue; }
            lastFrame = frameNo;

            var marker = markers.createMarker(tSec);
            if (marker) {
                marker.name = b.is_drop ? "DROP" : (b.is_downbeat ? "BEAT" : "Beat " + (b.index || i + 1));
                marker.comments = "CapCut Match Cut | BPM: " + (data.bpm || "") + " | kadr " + frameNo;
                if (b.is_drop) {
                    marker.setColorByIndex(1); // Red
                } else if (b.is_downbeat) {
                    marker.setColorByIndex(4); // Yellow (CapCut oltin rang)
                } else {
                    marker.setColorByIndex(7); // Cyan
                }
                marker.end = tSec + frameDur; // 1 kadr
                count++;
            }
        }

        return JSON.stringify({
            success: true,
            count: count,
            skipped: skipped,
            message: count + " ta CapCut ritm markerlari Sequence timeline'iga muvaffaqiyatli joylashtirildi!"
        });
    } catch (e) {
        return JSON.stringify({ success: false, message: "Marker qo'yishda xatolik: " + e.toString() });
    }
}

function uzPad2(n) {
    var s = String(Math.floor(Math.abs(n)));
    while (s.length < 2) { s = "0" + s; }
    return s;
}

/**
 * Premiere Pro timeline'dagi videoni ritm zarbalarida avtomatik pichoq bilan kesish (Auto Cut / Razor)
 */
function ppro_autoCutAtBeats(payloadJson) {
    try {
        var seq = ppro_getSeq();
        if (!seq) return JSON.stringify({ success: false, message: "Aktiv sequence topilmadi!" });

        var data;
        try {
            data = JSON.parse(decodeURIComponent(payloadJson));
        } catch (ex) {
            data = JSON.parse(payloadJson);
        }

        var beats = data.beats || [];
        if (beats.length === 0) {
            return JSON.stringify({ success: false, message: "Kesish uchun zarbalar ro'yxati bo'sh!" });
        }

        try {
            app.enableQE();
        } catch (qeErr) {}

        var qeSeq = (typeof qe !== "undefined" && qe.project) ? qe.project.getActiveSequence() : null;
        var cutCount = 0;

        if (qeSeq) {
            var targetTrackIdx = data.trackIndex !== undefined ? data.trackIndex : 0;
            var qeTrack = qeSeq.getVideoTrackAt(targetTrackIdx);
            if (qeTrack) {
                var fpsCut = parseFloat(data.fps) || 25;
                try { if (seq.framerate) { var seqFpsC = parseFloat(seq.framerate); if (seqFpsC > 0) fpsCut = seqFpsC; } } catch (eFC) {}
                if (!(fpsCut > 0)) fpsCut = 25;
                var nominalCut = Math.round(fpsCut) || 25;
                var lastCutFrame = -1;

                for (var i = 0; i < beats.length; i++) {
                    var tSec = parseFloat(beats[i].time);
                    if (isNaN(tSec)) continue;
                    var totalFrames = Math.round(tSec * fpsCut);
                    if (totalFrames <= 1) continue;              // eng boshidan kesmaymiz
                    if (totalFrames === lastCutFrame) continue;  // bir kadrda ikki marta kesmaymiz
                    lastCutFrame = totalFrames;
                    tSec = totalFrames / fpsCut;
                    try {
                        var frPart = totalFrames % nominalCut;
                        var totalSec = (totalFrames - frPart) / nominalCut;
                        var tc = uzPad2(Math.floor(totalSec / 3600)) + ":" +
                                 uzPad2(Math.floor((totalSec % 3600) / 60)) + ":" +
                                 uzPad2(totalSec % 60) + ":" + uzPad2(frPart);
                        qeTrack.razor(tc);
                        cutCount++;
                    } catch (rErr) {
                        try {
                            qeTrack.razor(tSec.toFixed(3));
                            cutCount++;
                        } catch (r2) {}
                    }
                }
            }
        }

        if (cutCount > 0) {
            return JSON.stringify({
                success: true,
                count: cutCount,
                message: cutCount + " ta joydan video trek avtomatik musiqaga moslab kesildi (Auto Razor)!"
            });
        } else {
            var markerRes = JSON.parse(ppro_createBeatMarkers(payloadJson));
            return JSON.stringify({
                success: true,
                count: markerRes.count || beats.length,
                message: "Musiqa zarbalari bo'yicha " + (markerRes.count || beats.length) + " ta marker qo'yildi! Premiere Pro'da Shift+M bilan kadrlar orasida o'tishingiz mumkin."
            });
        }
    } catch (e) {
        return JSON.stringify({ success: false, message: "Avtomatik kesishda xatolik: " + e.toString() });
    }
}

/**
 * After Effects Kompozitsiyasiga Beat Markerlar qo'yish
 */
function ae_createBeatMarkers(payloadJson) {
    try {
        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) {
            return JSON.stringify({ success: false, message: "Aktiv kompozitsiya topilmadi!" });
        }

        var data;
        try {
            data = JSON.parse(decodeURIComponent(payloadJson));
        } catch (ex) {
            data = JSON.parse(payloadJson);
        }

        var beats = data.beats || [];
        var fps = parseFloat(data.fps) || comp.frameRate || 25;
        if (!(fps > 0)) fps = 25;
        var frameDur = 1.0 / fps;
        var lastFrame = -1;
        var skipped = 0;
        var count = 0;

        for (var i = 0; i < beats.length; i++) {
            var b = beats[i];
            var tSec = parseFloat(b.time);
            if (isNaN(tSec) || tSec < 0) continue;
            var frameNo = (b.frame !== undefined && b.frame !== null)
                            ? Math.round(parseFloat(b.frame)) : Math.round(tSec * fps);
            tSec = frameNo * frameDur;
            if (frameNo === lastFrame) { skipped++; continue; }   // bir kadrda 2 marker bo'lmasin
            if (tSec > comp.duration) { skipped++; continue; }    // komp tashqarisi
            lastFrame = frameNo;

            try {
                var mv = new MarkerValue(b.is_drop ? "DROP" : (b.is_downbeat ? "BEAT" : "Beat " + (b.index || i + 1)));
                mv.comment = "CapCut Match Cut | BPM: " + (data.bpm || "") + " | kadr " + frameNo;
                mv.duration = frameDur;                                // 1 kadr (0.05 emas!)
                comp.markerProperty.setValueAtTime(tSec, mv);
                count++;
            } catch (mErr) {}
        }

        return JSON.stringify({
            success: true,
            count: count,
            skipped: skipped,
            message: count + " ta CapCut ritm markerlari AE kompozitsiyasiga joylashtirildi!"
        });
    } catch (e) {
        return JSON.stringify({ success: false, message: "AE marker qo'yishda xatolik: " + e.toString() });
    }
}

// Barcha funksiyalarni ExtendScript global muhitiga ($.global) biriktirish
if (typeof $ !== "undefined" && $.global) {
    $.global.JSON = JSON;
    $.global.getHostAppName = getHostAppName;
    $.global.host_runDiagnostics = host_runDiagnostics;
    $.global.ppro_getSeq = ppro_getSeq;
    $.global.ppro_getSequenceInfo = ppro_getSequenceInfo;
    $.global.ppro_setPlayhead = ppro_setPlayhead;
    $.global.ppro_getSelectedClipAudioPath = ppro_getSelectedClipAudioPath;
    $.global.ppro_insertSubtitlesViaSRT = ppro_insertSubtitlesViaSRT;
    $.global.ppro_insertMogrtSubtitles = ppro_insertMogrtSubtitles;
    $.global.ppro_insertSingleMogrtAtPlayhead = ppro_insertSingleMogrtAtPlayhead;
    $.global.ppro_createBeatMarkers = ppro_createBeatMarkers;
    $.global.ppro_autoCutAtBeats = ppro_autoCutAtBeats;
    $.global.ae_getCompInfo = ae_getCompInfo;
    $.global.ae_setPlayhead = ae_setPlayhead;
    $.global.ae_getSelectedLayerMediaPath = ae_getSelectedLayerMediaPath;
    $.global.ae_writeWordStackLayers = ae_writeWordStackLayers;
    $.global.ae_createSubtitles = ae_createSubtitles;
    $.global.ae_extractSelectedTextStyle = ae_extractSelectedTextStyle;
    $.global.ae_applyStyleToLayers = ae_applyStyleToLayers;
    $.global.ae_createBeatMarkers = ae_createBeatMarkers;
    $.global.ppro_getTimeDiagnostics = ppro_getTimeDiagnostics;
    $.global.ae_getTimeDiagnostics = ae_getTimeDiagnostics;
}

