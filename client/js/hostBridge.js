function logDebug(msg) {
    try {
        if (typeof require !== "undefined") {
            const fs = require('fs');
            fs.appendFileSync('d:/anti garavity loyhalar/plogin/extension_debug.log', `[JS ${new Date().toISOString()}] ${msg}\n`, 'utf8');
        }
    } catch (e) {}
    console.log("[HostBridge]", msg);
}

const HostBridge = {
    cs: null,
    hostApp: "UNKNOWN", // "AEFT" yoki "PPRO"
    _scriptLoaded: false,
    _loadingPromise: null,
    _evalQueue: Promise.resolve(),

    init() {
        this.cs = new CSInterface();
        const hostEnv = this.cs.getHostEnvironment();
        if (hostEnv) {
            const appId = hostEnv.appId;
            if (appId.indexOf("AEFT") !== -1) {
                this.hostApp = "AEFT";
            } else if (appId.indexOf("PPRO") !== -1) {
                this.hostApp = "PPRO";
            } else {
                this.hostApp = appId;
            }
        }
        logDebug("Aniqlangan dastur: " + this.hostApp);

        // ExtendScript faylini yuklash
        this.loadExtendScript();
    },

    loadExtendScript() {
        if (this._scriptLoaded) return Promise.resolve(true);
        if (this._loadingPromise) return this._loadingPromise;

        this._loadingPromise = new Promise((resolve) => {
            logDebug("loadExtendScript boshlandi");
            if (!this.cs) this.cs = new CSInterface();

            let timer = setTimeout(() => {
                logDebug("loadExtendScript timeout (1.5s), panel ishlashda davom etadi");
                this._scriptLoaded = true;
                this._loadingPromise = null;
                resolve(true);
            }, 1500);

            const finish = (val) => {
                clearTimeout(timer);
                this._scriptLoaded = true;
                this._loadingPromise = null;
                resolve(val);
            };

            // ExtendScript orqali faylni bevosita $.evalFile(new File(...)) bilan yuklash (har doim eng yangi kodni yuklaydi)
            const candidatePaths = [
                "d:/anti garavity loyhalar/plogin/host/shared.jsx",
                "C:/Users/baxru/AppData/Roaming/Adobe/CEP/extensions/com.uzbek.subtitles/host/shared.jsx"
            ];
            try {
                let extPath = decodeURI(this.cs.getSystemPath("extension") || "");
                extPath = extPath.replace(/^file:\/\/\//i, "").replace(/^file:\/\//i, "").replace(/\\/g, "/");
                if (extPath) {
                    if (!extPath.endsWith("/")) extPath += "/";
                    candidatePaths.unshift(extPath + "host/shared.jsx");
                }
            } catch (pErr) {}

            const pathsJson = JSON.stringify(candidatePaths);
            const loadCode = "(function() { " +
                "var pList = " + pathsJson + "; " +
                "for (var i = 0; i < pList.length; i++) { " +
                "    var f = new File(pList[i]); " +
                "    if (f.exists) { " +
                "        try { " +
                "            $.evalFile(f); " +
                "            return 'LOADED_OK: ' + pList[i]; " +
                "        } catch (eF) { " +
                "            return 'EVALFILE_ERR: ' + eF.toString(); " +
                "        } " +
                "    } " +
                "} " +
                "return 'FILE_NOT_FOUND'; " +
                "})();";

            this.cs.evalScript(loadCode, (evalRes) => {
                logDebug("loadExtendScript natijasi: " + String(evalRes));
                finish(true);
            });
        });

        return this._loadingPromise;
    },

    /**
     * ExtendScript kodini bajarib, natijani Promise ko'rinishida olish (navbat bilan ketma-ket bajariladi)
     */
    async eval(script) {
        if (!this.cs) {
            this.init();
        }

        if (!this._scriptLoaded) {
            await this.loadExtendScript();
        }

        return new Promise((resolve) => {
            this._evalQueue = this._evalQueue.then(() => {
                return new Promise((innerDone) => {
                    logDebug("ExtendScript so'rovi: " + script);

                    // Havfsiz wrapper: ExtendScript'da JSON bo'lmasa yoki xato yuz bersa ham hech qachon EvalScript error bo'lmaydi
                    const wrappedScript = "(function() { try { " +
                        "var _res = " + script + "; " +
                        "if (_res === undefined || _res === null) return '{\"ok\":true,\"success\":true}'; " +
                        "if (typeof _res === 'string') return _res; " +
                        "if (typeof JSON !== 'undefined' && JSON.stringify) return JSON.stringify(_res); " +
                        "return String(_res); " +
                        "} catch (_e) { " +
                        "var _cleanMsg = String(_e.message || _e).replace(/[\\r\\n\\t\\\"\\\\]/g, ' '); " +
                        "return '{\"ok\":false,\"success\":false,\"error\":\"' + _cleanMsg + '\",\"line\":' + (_e.line || 0) + '}'; " +
                        "} })();";

                    let isHeavy = /insertMogrt|autoCut/i.test(script);
                    let timeoutMs = isHeavy ? 300000 : 25000;
                    let finished = false;
                    const timer = setTimeout(() => {
                        if (!finished) {
                            finished = true;
                            logDebug("ExtendScript timeout (" + timeoutMs + "ms): " + script.slice(0, 60));
                            innerDone();
                            resolve({ success: false, timeout: true, error: "ExtendScript javob bermadi (timeout)" });
                        }
                    }, timeoutMs);

                    this.cs.evalScript(wrappedScript, (result) => {
                        if (finished) return;
                        finished = true;
                        clearTimeout(timer);
                        logDebug("ExtendScript javobi: " + String(result));

                        if (result === "EvalScript error." || result === undefined || result === null) {
                            logDebug("EvalScript error qaytdi!");
                            innerDone();
                            resolve({ success: false, error: "ExtendScript bajarilmadi (EvalScript error)" });
                            return;
                        }

                        let resObj = null;
                        try {
                            let parsed = JSON.parse(result);
                            if (typeof parsed === "string") {
                                try { parsed = JSON.parse(parsed); } catch (e2) {}
                            }
                            resObj = parsed;
                        } catch (e) {
                            try {
                                const cleaned = String(result).replace(/[\u0000-\u001f\u007f-\u009f]/g, " ");
                                let parsed2 = JSON.parse(cleaned);
                                if (typeof parsed2 === "string") {
                                    try { parsed2 = JSON.parse(parsed2); } catch (e3) {}
                                }
                                resObj = parsed2;
                            } catch (e4) {
                                logDebug("JSON parse qilib bo'lmadi, xom matn: " + String(result));
                                resObj = { success: false, error: String(result) };
                            }
                        }
                        innerDone();
                        resolve(resObj);
                    });
                });
            }).catch((qErr) => {
                logDebug("Queue xatosi: " + qErr);
                resolve({ success: false, error: String(qErr) });
            });
        });
    },

    async getSequenceInfo() {
        try {
            if (this.hostApp === "PPRO") {
                const info = await this.eval("ppro_getSequenceInfo()");
                if (info && info.ok) {
                    const fps = parseFloat(info.frameRate) || 25;
                    if (window.UzbekUtils) window.UzbekUtils.setHostFps(fps);
                    return { ok: true, success: true, exists: true, name: info.name,
                             fps: fps, frameRate: fps, duration: info.duration, time: info.time };
                }
                return info || { ok: false, exists: false, message: "Sequence topilmadi" };
            }
            if (this.hostApp === "AEFT") {
                const info = await this.eval("ae_getCompInfo()");
                if (info && info.ok) {
                    const fps = parseFloat(info.frameRate) || 25;
                    if (window.UzbekUtils) window.UzbekUtils.setHostFps(fps);
                    return { ok: true, success: true, exists: true, name: info.name,
                             fps: fps, frameRate: fps, width: info.width, height: info.height,
                             duration: info.duration, time: info.time };
                }
                return info || { ok: false, exists: false, message: "Kompozitsiya topilmadi" };
            }
        } catch (e) { logDebug("getSequenceInfo xatosi: " + e.message); }
        return { ok: false, exists: false, message: "Host dastur aniqlanmadi" };
    },

    async getSelectedClip() {
        try {
            let raw = null;
            if (this.hostApp === "PPRO") raw = await this.eval("ppro_getSelectedClipAudioPath()");
            else if (this.hostApp === "AEFT") raw = await this.eval("ae_getSelectedLayerMediaPath()");
            else return { success: false, message: "Host dastur aniqlanmadi (brauzer rejimi)" };
            if (!raw) return { success: false, message: "Klip ma'lumoti olinmadi" };

            // Host turli nomlar bilan qaytaradi: filePath | path | mediaPath
            const path = raw.filePath || raw.path || raw.mediaPath || "";
            if (!raw.success && !raw.ok && !path) return Object.assign({ success: false }, raw);

            const clip = {
                success: true, ok: true, path: path, filePath: path,
                name: raw.name || (path ? String(path).split(/[\\/]/).pop() : "Klip"),
                duration: parseFloat(raw.duration) || 0,
                start:    parseFloat(raw.start) || 0,     // timeline'dagi boshlanish
                end:      parseFloat(raw.end) || 0,
                inPoint:  parseFloat(raw.inPoint) || 0,   // media ichidagi qirqim
                outPoint: parseFloat(raw.outPoint) || 0,
                speed: (parseFloat(raw.speed) > 0) ? parseFloat(raw.speed) : 1,
                offset: parseFloat(raw.offset) || 0
            };
            if (window.UzbekUtils) {
                const fps = window.UzbekUtils.getHostFps();
                if (fps) clip.fps = fps;
            }
            return clip;
        } catch (e) {
            logDebug("getSelectedClip xatosi: " + e.message);
            return { success: false, message: "Klip olishda xatolik: " + e.message };
        }
    },

    /**
     * Aktiv kompozitsiya (AE) yoki ketma-ketlik (PPro) ma'lumotini olish
     */
    async getTimelineInfo() {
        if (this.hostApp === "AEFT") {
            return await this.eval("ae_getCompInfo()");
        } else if (this.hostApp === "PPRO") {
            return await this.eval("ppro_getSequenceInfo()");
        }
        return { exists: false, message: "Dastur aniqlanmadi (Brauzer rejimi)" };
    },

    /**
     * Playhead (CTI) ni ko'rsatilgan vaqtga sakratish
     */
    async setPlayhead(seconds) {
        if (this.hostApp === "AEFT") {
            return await this.eval(`ae_setPlayhead(${seconds})`);
        } else if (this.hostApp === "PPRO") {
            return await this.eval(`ppro_setPlayhead(${seconds})`);
        }
        return { status: "simulated" };
    },

    /**
     * Tanlangan qatlam yoki klipning audio/video manba fayli yo'lini olish
     */
    async getSelectedMediaSource() {
        if (this.hostApp === "AEFT") {
            return await this.eval("ae_getSelectedLayerMediaPath()");
        } else if (this.hostApp === "PPRO") {
            return await this.eval("ppro_getSelectedClipAudioPath()");
        }
        return { success: false, message: "Host dastur aniqlanmadi" };
    },

    /**
     * Vaqt Diagnostikasi (Time Diagnostics)
     * Sequence / Comp, Tanlangan Klip, Media In/Out, Start, Speed, Playhead va Audio manba ma'lumotlarini tekshiradi
     */
    async getTimeDiagnostics() {
        if (this.hostApp === "AEFT") {
            return await this.eval("ae_getTimeDiagnostics()");
        } else if (this.hostApp === "PPRO") {
            return await this.eval("ppro_getTimeDiagnostics()");
        }
        return { ok: false, success: false, message: "Host dastur aniqlanmadi" };
    },

    /**
     * So'zma-so'z kaskad rejasini tuzish (UzbekUtils.buildWordPlan wrapper)
     */
    buildWordPlans(segments, options = {}) {
        if (window.UzbekUtils && window.UzbekUtils.buildWordPlan) {
            return window.UzbekUtils.buildWordPlan(segments, options);
        }
        return null;
    },

    /**
     * Subtitrlarni After Effects yoki Premiere Pro timeline'iga joylashtirish
     */
    async insertSubtitles(segments, styleOptions, timelineOffset = 0.0) {
        const off = parseFloat(timelineOffset) || 0.0;
        const leadIn = (styleOptions && typeof styleOptions.leadIn === "number") ? styleOptions.leadIn : 0.0;

        // Har bir segmentning boshlanish va tugash vaqtlarini aniqlash (faqat qo'shimcha qo'lda kiritilgan offset bo'lsagina siljitamiz)
        let timelineSegments = (off !== 0) ? segments.map((seg, idx) => ({
            ...seg,
            id: idx + 1,
            start: Math.max(0, Number((seg.start + off).toFixed(3))),
            end: Math.max(0.1, Number((seg.end + off).toFixed(3))),
            words: (seg.words || []).map(w => ({
                ...w,
                start: Math.max(0, Number((w.start + off).toFixed(3))),
                end: Math.max(0.1, Number((w.end + off).toFixed(3)))
            }))
        })) : segments;

        // Qat'iy ko'pi bilan 1 yoki 2 qator bo'lishini ta'minlash (hech qachon 3-4 qator bo'lmaydi)
        function enforceTwoLines(segs) {
            const res = [];
            let gId = 1;
            for (let i = 0; i < segs.length; i++) {
                const s = segs[i];
                let ws = (s.words && s.words.length > 0) ? [...s.words] : [];
                if (ws.length === 0) {
                    const raw = (s.text || "").replace(/[\r\n]+/g, " ").trim().split(/\s+/).filter(Boolean);
                    if (raw.length === 0) continue;
                    const d = Math.max(0.4, (s.end || (s.start + 1.0)) - s.start);
                    const dw = d / raw.length;
                    ws = raw.map((w, idx) => ({
                        word: w,
                        start: Number((s.start + idx * dw).toFixed(3)),
                        end: Number((s.start + (idx + 1) * dw).toFixed(3)),
                        score: 1.0
                    }));
                }

                function fmt2Lines(txt) {
                    const words = (txt || "").replace(/[\r\n]+/g, " ").trim().split(/\s+/).filter(Boolean);
                    if (words.length <= 1) return words.join(" ");
                    if (words.length <= 3 && txt.length <= 24) return words.join(" ");
                    const half = Math.floor(words.length / 2);
                    return words.slice(0, half).join(" ") + "\n" + words.slice(half).join(" ");
                }

                const full = ws.map(w => w.word).join(" ");
                if (ws.length <= 4 && full.length <= 28) {
                    res.push({
                        ...s,
                        id: gId++,
                        start: ws[0].start,
                        end: ws[ws.length - 1].end,
                        text: fmt2Lines(full),
                        words: ws
                    });
                    continue;
                }

                const chunks = [];
                let cChunk = [];
                let cLen = 0;
                for (let w = 0; w < ws.length; w++) {
                    const wItem = ws[w];
                    const wLen = (wItem.word || "").length;
                    if (cChunk.length > 0 && (cChunk.length >= 4 || cLen + 1 + wLen > 28)) {
                        chunks.push(cChunk);
                        cChunk = [wItem];
                        cLen = wLen;
                    } else {
                        cChunk.push(wItem);
                        cLen += (cChunk.length > 1 ? 1 : 0) + wLen;
                    }
                }
                if (cChunk.length > 0) chunks.push(cChunk);

                for (let c = 0; c < chunks.length; c++) {
                    const ch = chunks[c];
                    const cTxt = ch.map(item => item.word).join(" ");
                    let cStart = ch[0].start;
                    let cEnd = ch[ch.length - 1].end;
                    if (cEnd <= cStart) cEnd = Number((cStart + 0.35).toFixed(3));
                    res.push({
                        ...s,
                        id: gId++,
                        start: Number(cStart.toFixed(3)),
                        end: Number(cEnd.toFixed(3)),
                        text: fmt2Lines(cTxt),
                        words: ch
                    });
                }
            }
            return res;
        }

        if (window.UzbekUtils && window.UzbekUtils.rechunkSegments) {
            timelineSegments = window.UzbekUtils.rechunkSegments(timelineSegments, {
                fps: window.UzbekUtils.getHostFps(),
                maxChars: 42,
                maxLines: 2,
                normalize: true
            });
        } else {
            timelineSegments = enforceTwoLines(timelineSegments);
        }

        if (this.hostApp === "AEFT") {
            let wordPlan = null;
            if (styleOptions && styleOptions.wordByWord && (styleOptions.wordMode === "stack" || styleOptions.wordMode === "cascade")) {
                const fpsVal = (window.UzbekUtils && window.UzbekUtils.getHostFps) ? window.UzbekUtils.getHostFps() : 25.0;
                wordPlan = this.buildWordPlans(timelineSegments, {
                    fps: fpsVal,
                    maxLines: styleOptions.wordMaxLines || 2,
                    pauseHold: styleOptions.wordPauseHold !== undefined ? styleOptions.wordPauseHold : true,
                    pauseThresholdSec: (styleOptions.pauseHideThresholdMs || 800) / 1000.0,
                    charReveal: !!styleOptions.charReveal
                });
            }

            const payload = JSON.stringify({
                segments: timelineSegments,
                wordPlan: wordPlan,
                style: styleOptions,
                timelineOffset: 0.0,
                leadIn: leadIn,
                fps: (window.UzbekUtils && window.UzbekUtils.getHostFps) ? window.UzbekUtils.getHostFps() : 25.0
            });
            const encoded = encodeURIComponent(payload);
            return await this.eval(`ae_createSubtitles("${encoded}")`);
        } else if (this.hostApp === "PPRO") {
            // Premiere Pro: Agar MOGRT tanlangan bo'lsa yoki mavjud bo'lsa, to'g'ridan-to'g'ri Video Trekka (V2) joylaymiz
            let chosenMogrt = (styleOptions && styleOptions.mogrtPath) ? styleOptions.mogrtPath : "";

            // Agar foydalanuvchi presetlar oynasida MOGRT tanlagan bo'lsa
            if (!chosenMogrt && window.PresetManager) {
                const activeP = window.PresetManager.getActivePreset();
                if (activeP && activeP.mogrtPath) {
                    chosenMogrt = activeP.mogrtPath;
                }
            }

            // SO'ZMA-SO'Z REJIMI (PREMIERE PRO UCHUN BO'LAKLASH):
            if (styleOptions && styleOptions.wordByWord && styleOptions.wordMode) {
                const wMode = styleOptions.wordMode;
                const pauseHide = !!(styleOptions && styleOptions.pauseHideText);
                const pauseThresh = (styleOptions && styleOptions.pauseHideThresholdMs) ? styleOptions.pauseHideThresholdMs : 800;

                if (wMode === "single") {
                    const singleWordSegs = [];
                    let wGlobalId = 1;
                    for (let i = 0; i < timelineSegments.length; i++) {
                        const s = timelineSegments[i];
                        if (s.words && s.words.length > 0) {
                            for (let w = 0; w < s.words.length; w++) {
                                const wo = s.words[w];
                                const nextW = s.words[w + 1];
                                const pauseAfter = (typeof wo.pause_after_ms === "number") ? wo.pause_after_ms : (nextW ? (nextW.start - wo.end) * 1000 : 0);
                                let wEnd = wo.end;
                                if (!pauseHide && nextW) {
                                    wEnd = nextW.start;
                                }
                                singleWordSegs.push({
                                    ...s,
                                    id: wGlobalId++,
                                    start: wo.start,
                                    end: (wEnd > wo.start) ? wEnd : Number((wo.start + 0.3).toFixed(3)),
                                    text: wo.word,
                                    words: [wo]
                                });
                            }
                        } else {
                            singleWordSegs.push(s);
                        }
                    }
                    timelineSegments = singleWordSegs;
                } else if (wMode === "accumulate") {
                    const accumSegs = [];
                    let aGlobalId = 1;
                    for (let i = 0; i < timelineSegments.length; i++) {
                        const s = timelineSegments[i];
                        if (s.words && s.words.length > 0) {
                            for (let w = 0; w < s.words.length; w++) {
                                const wo = s.words[w];
                                const nextW = s.words[w + 1];
                                const aStart = wo.start;
                                const pauseAfter = (typeof wo.pause_after_ms === "number") ? wo.pause_after_ms : (nextW ? (nextW.start - wo.end) * 1000 : 0);
                                let aEnd = nextW ? nextW.start : s.end;
                                if (pauseHide && pauseAfter >= pauseThresh) {
                                    aEnd = wo.end;
                                }
                                const aText = s.words.slice(0, w + 1).map(item => item.word).join(" ");
                                accumSegs.push({
                                    ...s,
                                    id: aGlobalId++,
                                    start: aStart,
                                    end: (aEnd > aStart) ? aEnd : Number((aStart + 0.35).toFixed(3)),
                                    text: aText,
                                    words: s.words.slice(0, w + 1)
                                });
                            }
                        } else {
                            accumSegs.push(s);
                        }
                    }
                    timelineSegments = accumSegs;
                } else if (wMode === "stack" || wMode === "cascade") {
                    const fpsVal = (window.UzbekUtils && window.UzbekUtils.getHostFps) ? window.UzbekUtils.getHostFps() : 25.0;
                    const wp = this.buildWordPlans(timelineSegments, {
                        fps: fpsVal,
                        maxLines: styleOptions.wordMaxLines || 2,
                        pauseHold: styleOptions.wordPauseHold !== undefined ? styleOptions.wordPauseHold : true,
                        pauseThresholdSec: pauseThresh / 1000.0
                    });
                    if (wp && wp.words && wp.words.length > 0) {
                        const stackSegs = [];
                        let sGlobalId = 1;
                        for (let wi = 0; wi < wp.words.length; wi++) {
                            const item = wp.words[wi];
                            const baseSeg = timelineSegments[item.segIdx || 0] || {};
                            stackSegs.push({
                                ...baseSeg,
                                id: sGlobalId++,
                                start: item.inPoint,
                                end: item.outPoint,
                                text: item.word,
                                words: [{ word: item.word, start: item.inPoint, end: item.wordEnd }]
                            });
                        }
                        timelineSegments = stackSegs;
                    }
                }
            }

            // MOGRT faylini ExtendScript ANSI cheklovlaridan (masalan 9•16 dagi bullet belgisi) himoyalash uchun xavfsiz nusxa olish:
            if (chosenMogrt && typeof require !== "undefined") {
                try {
                    const fs = require('fs');
                    const path = require('path');
                    const tmpDir = 'C:/temp';
                    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
                    const safeTmpPath = path.join(tmpDir, 'active_subtitle.mogrt').replace(/\\/g, '/');
                    if (fs.existsSync(chosenMogrt)) {
                        fs.copyFileSync(chosenMogrt, safeTmpPath);
                        chosenMogrt = safeTmpPath;
                    }
                } catch(eCopy) {}
            }

            const hasAnyMogrt = !!chosenMogrt || timelineSegments.some(s => !!s.mogrtPath);

            if (hasAnyMogrt) {
                const payload = JSON.stringify({
                    mogrtPath: chosenMogrt,
                    segments: timelineSegments,
                    timelineOffset: 0.0,
                    leadIn: leadIn
                });
                const encoded = encodeURIComponent(payload);
                return await this.eval(`ppro_insertMogrtSubtitles("${encoded}")`);
            } else {
                // Standart Video Trek / Caption Track (SRT import orqali)
                const wModeArg = (styleOptions && styleOptions.wordByWord) ? styleOptions.wordMode : null;
                const hColorArg = (styleOptions && styleOptions.highlightColor) ? styleOptions.highlightColor : "#ffe600";
                const tempSrtRes = await window.SubtitleAPI.exportSRT(timelineSegments, null, wModeArg, hColorArg);
                let tempFilePath = (tempSrtRes.file_path || "").replace(/\\/g, "/");

                if (!tempFilePath) {
                    const srtContent = tempSrtRes.content;
                    if (window.cep && window.cep.fs) {
                        const tempDir = this.cs.getSystemPath("userData") || "C:/temp";
                        tempFilePath = `${tempDir}/temp_uz_subtitles.srt`.replace(/\\/g, "/");
                        window.cep.fs.writeFile(tempFilePath, srtContent);
                    } else {
                        try {
                            const fs = require('fs');
                            const os = require('os');
                            const path = require('path');
                            tempFilePath = path.join(os.tmpdir(), "temp_uz_subtitles.srt").replace(/\\/g, "/");
                            fs.writeFileSync(tempFilePath, srtContent, 'utf-8');
                        } catch (e) {
                            tempFilePath = "C:/temp/temp_uz_subtitles.srt";
                        }
                    }
                }

                if (typeof require !== "undefined" && tempSrtRes.content) {
                    try {
                        const fs = require('fs');
                        const os = require('os');
                        const path = require('path');
                        const dlPath = path.join(os.homedir(), "Downloads", "subtitrlar.srt");
                        fs.writeFileSync(dlPath, tempSrtRes.content, 'utf-8');
                    } catch (e) {}
                }

                // SRT ichida vaqtlar allaqachon aniq, shuning uchun offset = 0.0 uzatiladi
                return await this.eval(`ppro_insertSubtitlesViaSRT("${tempFilePath}", 0.0)`);
            }
        }

        return { success: false, message: "Host dastur aniqlanmadi" };
    },

    /**
     * Bitta MOGRT animatsiyasini to'g'ridan-to'g'ri playhead (CTI) turgan joyga joylashtirish (AEJuice kabi)
     */
    async insertSingleMogrtAtPlayhead(mogrtPath, customText = "O'zbekcha AI Subtitr") {
        if (!mogrtPath) return { success: false, message: "MOGRT yo'li berilmadi" };
        const cleanPath = mogrtPath.replace(/\\/g, "/");
        const cleanText = String(customText).replace(/["\r\n\t]/g, " ");
        if (this.hostApp === "PPRO") {
            return await this.eval(`ppro_insertSingleMogrtAtPlayhead("${cleanPath}", "${cleanText}")`);
        }
        return { success: false, message: "Bu funksiya faqat Premiere Pro uchun ishlaydi" };
    },

    /**
     * After Effects'da tanlangan matn qatlamidan stil parametrlarini o'qib olish
     */
    async extractSelectedTextStyle() {
        if (this.hostApp === "AEFT") {
            return await this.eval("ae_extractSelectedTextStyle()");
        }
        return { success: false, message: "Bu funksiya faqat After Effects uchun amal qiladi" };
    },

    /**
     * Saqlangan stilni tanlangan qatlamlarga qo'llash
     */
    async applyStyleToLayers(styleObj) {
        if (this.hostApp === "AEFT") {
            const encoded = encodeURIComponent(JSON.stringify(styleObj));
            return await this.eval(`ae_applyStyleToLayers("${encoded}")`);
        }
        return { success: false, message: "Bu funksiya faqat After Effects uchun amal qiladi" };
    },

    /**
     * Tizim to'liq diagnostikasi (Host, ExtendScript, Sequence/Comp, Backend, Ruxsatlar)
     */
    async runDiagnostics() {
        const diagReport = {
            timestamp: new Date().toLocaleString(),
            hostApp: this.hostApp,
            extendScript: null,
            backend: null,
            cep: {
                hasCSInterface: !!this.cs,
                hasNode: typeof require !== "undefined",
                hasCepFs: !!(window.cep && window.cep.fs)
            }
        };

        // 1. ExtendScript tekshiruvi
        try {
            const extRes = await this.eval("host_runDiagnostics()");
            diagReport.extendScript = extRes;
        } catch (e) {
            diagReport.extendScript = { ok: false, error: e.message || String(e) };
        }

        // 2. Backend STT tekshiruvi
        try {
            const backendRes = await window.SubtitleAPI.checkHealth();
            diagReport.backend = backendRes;
        } catch (e) {
            diagReport.backend = { online: false, error: e.message || String(e) };
        }

        return diagReport;
    },

    /**
     * Timeline va Klip vaqtlari diagnostikasi (Vaqt offset, in/out point, playhead va speed)
     */
    async getTimeDiagnostics() {
        if (this.hostApp === "PPRO") {
            return await this.eval("ppro_getTimeDiagnostics()");
        } else if (this.hostApp === "AEFT") {
            return await this.eval("ae_getTimeDiagnostics()");
        } else {
            return {
                ok: false,
                success: false,
                message: "Adobe Premiere Pro yoki After Effects dasturi aniqlanmadi (Web rejimida)."
            };
        }
    },

    /**
     * Timeline'ga CapCut uslubidagi Beat va Ritm markerlarini joylashtirish
     */
    async createBeatMarkers(beatsData, clearExisting = false) {
        const payload = JSON.stringify({
            beats: beatsData.beats || [],
            bpm: beatsData.bpm || 120,
            fps: beatsData.fps || (window.UzbekUtils ? window.UzbekUtils.getHostFps() : null),
            clipOffset: beatsData.clipOffset || 0,
            clearExisting: clearExisting
        });
        const encoded = encodeURIComponent(payload);

        if (this.hostApp === "PPRO") {
            return await this.eval(`ppro_createBeatMarkers("${encoded}")`);
        } else if (this.hostApp === "AEFT") {
            return await this.eval(`ae_createBeatMarkers("${encoded}")`);
        } else {
            return {
                success: false,
                message: "Adobe Premiere Pro yoki After Effects dasturi aniqlanmadi (Web rejimida)."
            };
        }
    },

    /**
     * Timeline'dagi videoni musiqa ritmi zarbalarida avtomatik pichoq bilan kesish (Auto Cut / Razor)
     */
    async autoCutAtBeats(beatsData, trackIndex = 0) {
        const payload = JSON.stringify({
            beats: beatsData.beats || [],
            bpm: beatsData.bpm || 120,
            fps: beatsData.fps || (window.UzbekUtils ? window.UzbekUtils.getHostFps() : null),
            clipOffset: beatsData.clipOffset || 0,
            trackIndex: trackIndex
        });
        const encoded = encodeURIComponent(payload);

        if (this.hostApp === "PPRO") {
            return await this.eval(`ppro_autoCutAtBeats("${encoded}")`);
        } else if (this.hostApp === "AEFT") {
            return await this.eval(`ae_createBeatMarkers("${encoded}")`);
        } else {
            return {
                success: false,
                message: "Adobe Premiere Pro yoki After Effects dasturi aniqlanmadi (Web rejimida)."
            };
        }
    }
};

window.HostBridge = HostBridge;

