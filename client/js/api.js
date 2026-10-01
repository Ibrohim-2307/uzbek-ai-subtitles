/**
 * O'zbekcha AI Subtitr - Python Backend API Moduli (api.js)
 * Localhost FastAPI serveri bilan muloqot qiladi.
 */

const API_BASE_URL = "http://127.0.0.1:8765";

const SubtitleAPI = {
    /**
     * Backend server holatini tekshirish
     */
    async checkHealth() {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000);
            const response = await fetch(`${API_BASE_URL}/health`, { signal: controller.signal });
            clearTimeout(timeoutId);
            if (!response.ok) return { online: false, message: "Server javob bermadi" };
            const data = await response.json();
            return { online: true, ...data };
        } catch (err) {
            return {
                online: false,
                message: "Backend server bilan aloqa yo'q. Iltimos, Python backendni ishga tushiring."
            };
        }
    },

    /**
     * STT provayderlari ro'yxatini olish
     */
    async getProviders() {
        try {
            const res = await fetch(`${API_BASE_URL}/providers`);
            return await res.json();
        } catch (e) {
            console.error("Provayderlarni olishda xatolik:", e);
            return [];
        }
    },

    /**
     * Sozlamalarni olish
     */
    async getConfig() {
        try {
            const res = await fetch(`${API_BASE_URL}/config`);
            return await res.json();
        } catch (e) {
            console.error("Sozlamalarni olishda xatolik:", e);
            return null;
        }
    },

    /**
     * Sozlamalarni saqlash
     */
    async saveConfig(config) {
        try {
            const res = await fetch(`${API_BASE_URL}/config`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(config)
            });
            return await res.json();
        } catch (e) {
            console.error("Sozlamalarni saqlashda xatolik:", e);
            throw e;
        }
    },

    /**
     * Shaxsiy lug'atni olish
     */
    async getDictionary() {
        try {
            const res = await fetch(`${API_BASE_URL}/dictionary`);
            return await res.json();
        } catch (e) {
            console.error("Lug'atni olishda xatolik:", e);
            return {};
        }
    },

    /**
     * Shaxsiy lug'atni saqlash
     */
    async saveDictionary(dictionary) {
        try {
            const res = await fetch(`${API_BASE_URL}/dictionary`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(dictionary)
            });
            return await res.json();
        } catch (e) {
            console.error("Lug'atni saqlashda xatolik:", e);
            throw e;
        }
    },

    /**
     * Audioni matnga aylantirish (Transcribe)
     * @param {Object} options: { filePath, file, provider, language, script, convertNumbers, maxLineLength, maxLines }
     */
    async transcribe(options) {
        const formData = new FormData();

        if (options.filePath) {
            formData.append("file_path", options.filePath);
        }
        if (options.file) {
            formData.append("file", options.file);
        }
        if (options.provider) formData.append("provider", options.provider);
        if (options.language) formData.append("language", options.language);
        if (options.script) formData.append("script", options.script);
        if (options.convertNumbers !== undefined) formData.append("convert_numbers", options.convertNumbers);
        if (options.maxLineLength) formData.append("max_line_length", options.maxLineLength);
        if (options.maxLines) formData.append("max_lines", options.maxLines);
        if (options.inPoint !== undefined && options.inPoint !== null) formData.append("in_point", options.inPoint);
        if (options.outPoint !== undefined && options.outPoint !== null) formData.append("out_point", options.outPoint);
        if (options.duration !== undefined && options.duration !== null) formData.append("duration", options.duration);
        if (options.fps !== undefined && options.fps !== null) formData.append("fps", options.fps);
        if (options.syncOffsetMs !== undefined && options.syncOffsetMs !== null) formData.append("sync_offset_ms", options.syncOffsetMs);
        if (options.clipStart !== undefined && options.clipStart !== null) formData.append("clip_start", options.clipStart);
        if (options.clipEnd !== undefined && options.clipEnd !== null) formData.append("clip_end", options.clipEnd);
        if (options.clipSpeed !== undefined && options.clipSpeed !== null) formData.append("clip_speed", options.clipSpeed);
        if (options.timelineOffsetMs !== undefined && options.timelineOffsetMs !== null) formData.append("timeline_offset_ms", options.timelineOffsetMs);
        if (options.modelSize) formData.append("model_size", options.modelSize);
        if (options.forcedAlignment !== undefined) formData.append("forced_alignment", options.forcedAlignment);
        if (options.audioEnergySnap !== undefined) formData.append("audio_energy_snap", options.audioEnergySnap);
        if (options.pauseHideText !== undefined) formData.append("pause_hide_text", options.pauseHideText);
        if (options.pauseHideThresholdMs !== undefined) formData.append("pause_hide_threshold_ms", options.pauseHideThresholdMs);
        if (options.charReveal !== undefined) formData.append("char_reveal", options.charReveal);

        const response = await fetch(`${API_BASE_URL}/transcribe`, {
            method: "POST",
            body: formData
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({ detail: "Noma'lum xatolik" }));
            throw new Error(errData.detail || "Transkripsiyada xatolik yuz berdi");
        }

        return await response.json();
    },

    /**
     * SRT formatida eksport qilish
     */
    async exportSRT(segments, outputPath = null, wordMode = null, highlightColor = "#ffe600", pauseHideText = false, pauseHideThresholdMs = 800) {
        const res = await fetch(`${API_BASE_URL}/export/srt`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                segments,
                output_path: outputPath,
                word_mode: wordMode,
                highlight_color: highlightColor,
                pause_hide_text: pauseHideText,
                pause_hide_threshold_ms: pauseHideThresholdMs
            })
        });
        return await res.json();
    },

    /**
     * So'z vaqtlarini audio energiyasi va pauzalar bo'yicha qayta tekislash
     */
    async realignWords(words, wavPath = null, minPauseMs = 200.0, fps = null) {
        const res = await fetch(`${API_BASE_URL}/realign_words`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                words,
                wav_path: wavPath,
                min_pause_ms: minPauseMs,
                fps: fps
            })
        });
        if (!res.ok) throw new Error("Qayta tekislashda xatolik");
        return await res.json();
    },

    /**
     * Forced alignment va audio tahlil holatini olish
     */
    async getAlignmentStatus() {
        try {
            const res = await fetch(`${API_BASE_URL}/status/alignment`);
            return await res.json();
        } catch (e) {
            return { available: false, message: "Serverdan holat olinmadi" };
        }
    },

    /**
     * VTT formatida eksport qilish
     */
    async exportVTT(segments) {
        const res = await fetch(`${API_BASE_URL}/export/vtt`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ segments })
        });
        return await res.json();
    },

    /**
     * Lotin <-> Kirill o'girish
     */
    async transliterate(text, targetScript = "cyrillic") {
        const res = await fetch(`${API_BASE_URL}/nlp/transliterate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text, target: targetScript })
        });
        return await res.json();
    },

    /**
     * C: va D: disklardagi mahalliy MOGRT, FFX va AEP shablon/animatsiyalar ro'yxatini olish
     */
    async getLocalTemplates() {
        try {
            const res = await fetch(`${API_BASE_URL}/presets/local_templates`);
            if (res.ok) {
                const data = await res.json();
                return data.templates || [];
            }
            return [];
        } catch (e) {
            console.error("Mahalliy shablonlarni olishda xatolik:", e);
            return [];
        }
    },

    /**
     * CapCut uslubida musiqa ritmini, bitlarini va kadr o'tish nuqtalarini aniqlash
     */
    async detectBeats(options) {
        const formData = new FormData();
        if (options.filePath) formData.append("file_path", options.filePath);
        if (options.file) formData.append("file", options.file);
        if (options.sensitivity !== undefined) formData.append("sensitivity", options.sensitivity);
        if (options.mode) formData.append("mode", options.mode);
        if (options.inPoint !== undefined && options.inPoint !== null) formData.append("in_point", options.inPoint);
        if (options.outPoint !== undefined && options.outPoint !== null) formData.append("out_point", options.outPoint);
        if (options.duration !== undefined && options.duration !== null) formData.append("duration", options.duration);

        const response = await fetch(`${API_BASE_URL}/detect-beats`, {
            method: "POST",
            body: formData
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({ detail: "Ritm aniqlashda xatolik" }));
            throw new Error(errData.detail || "Ritm aniqlashda xatolik yuz berdi");
        }

        return await response.json();
    }
};

window.SubtitleAPI = SubtitleAPI;

