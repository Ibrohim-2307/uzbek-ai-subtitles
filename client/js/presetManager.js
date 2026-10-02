/**
 * O'zbekcha AI Subtitr - Stil va Animatsiya Kutubxonasi Moduli (presetManager.js)
 * .ffx (Animation Preset), .mogrt (Motion Graphics Template) import qilish,
 * After Effects qatlamidan stil o'qib olish va eksport/import qilish amallari.
 */

const PresetManager = {
    presets: [],
    activePresetId: "tiktok_reels_karaoke",

    localTemplates: [],
    activeCategory: "all",
    searchQuery: "",

    async init() {
        await this.loadBuiltinPresets();
        this.loadCustomPresets();
        await this.loadLocalTemplates();
    },

    /**
     * C: va D: disklardagi mahalliy MOGRT va FFX shablonlarni yuklash
     */
    async loadLocalTemplates() {
        try {
            if (window.SubtitleAPI && typeof window.SubtitleAPI.getLocalTemplates === "function") {
                const templates = await window.SubtitleAPI.getLocalTemplates();
                if (templates && templates.length > 0) {
                    this.localTemplates = templates;
                    const existingPaths = new Set(this.presets.map(p => (p.mogrtPath || p.ffxPresetPath || "").toLowerCase()).filter(Boolean));
                    const existingNames = new Set(this.presets.map(p => (p.name || "").toLowerCase()).filter(Boolean));
                    for (const tpl of templates) {
                        const isMogrt = tpl.ext === "mogrt";
                        const isFFX = tpl.ext === "ffx";
                        // Faqat haqiqiy MOGRT va FFX fayllarni qabul qilamiz (.aep kabi keraksiz fayllarni o'tkazib yuboramiz)
                        if (!isMogrt && !isFFX) continue;
                        const lowPath = (tpl.path || "").toLowerCase();
                        const lowName = (tpl.name || "").toLowerCase();
                        if (lowPath && existingPaths.has(lowPath)) continue;
                        if (lowName && existingNames.has(lowName)) continue;
                        existingPaths.add(lowPath);
                        existingNames.add(lowName);

                        this.presets.push({
                            id: tpl.id,
                            name: tpl.name,
                            category: tpl.category,
                            mogrtPath: isMogrt ? tpl.path : "",
                            ffxPresetPath: isFFX ? tpl.path : "",
                            isLocalTemplate: true,
                            templateType: tpl.ext.toUpperCase(),
                            description: `${tpl.name} (${tpl.ext.toUpperCase()})`,
                            fillColor: [1, 1, 1],
                            strokeColor: [0, 0, 0],
                            strokeWidth: 2,
                            fontSize: 44,
                            fontName: "Arial-BoldMT",
                            isKaraoke: tpl.name.toLowerCase().includes("line by line") || tpl.name.toLowerCase().includes("hormozi") || tpl.name.toLowerCase().includes("beast"),
                            hasVideo: !!tpl.hasVideo,
                            hasThumb: !!tpl.hasThumb,
                            animType: tpl.animType || "pop"
                        });
                    }
                }
            }
        } catch (e) {
            console.warn("Mahalliy shablonlarni yuklashda xatolik:", e);
        }
    },

    /**
     * Kategoriya va qidiruv bo'yicha filtrlangan ro'yxatni olish
     */
    getFilteredPresets() {
        let list = this.presets;
        if (this.activeCategory && this.activeCategory !== "all") {
            const cat = this.activeCategory.toLowerCase();
            if (cat === "aejuice") {
                list = list.filter(p => {
                    const n = (p.name || "").toLowerCase();
                    const path = (p.mogrtPath || "").toLowerCase();
                    const c = (p.category || "").toLowerCase();
                    return path.includes("aejuice") || c.includes("aejuice") || n.includes("hormozi") || n.includes("smooth captions") || n.includes("luke") || n.includes("dina") || n.includes("elly") || n.includes("beast");
                });
            } else if (cat === "captioneer") {
                list = list.filter(p => {
                    const path = (p.mogrtPath || "").toLowerCase();
                    const n = (p.name || "").toLowerCase();
                    return path.includes("captioneer") || n.includes("9•16") || n.includes("9:16") || n.includes("9 16") || n.includes("glitch") || n.includes("motion blur") || n.includes("comic") || n.includes("slant");
                });
            } else if (cat === "hormozi") {
                list = list.filter(p => {
                    const n = (p.name || "").toLowerCase();
                    const c = (p.category || "").toLowerCase();
                    return n.includes("hormozi") || n.includes("beast") || n.includes("karaoke") || c.includes("hormozi") || p.isKaraoke;
                });
            } else if (cat === "dynamic") {
                list = list.filter(p => {
                    const n = (p.name || "").toLowerCase();
                    const a = (p.animType || "").toLowerCase();
                    return n.includes("zoom") || n.includes("butter") || n.includes("spin") || n.includes("slide") || n.includes("wave") || n.includes("cracked") || a.includes("zoom") || a.includes("wave") || a.includes("slide") || a.includes("3d");
                });
            } else if (cat === "titles") {
                list = list.filter(p => {
                    const n = (p.name || "").toLowerCase();
                    const c = (p.category || "").toLowerCase();
                    return n.includes("titl") || n.includes("fon") || n.includes("caption") || n.includes("gpt") || c.includes("titl") || c.includes("broadcast") || c.includes("lower thirds") || p.animType === "title";
                });
            } else if (cat === "mogrt") {
                list = list.filter(p => !!p.mogrtPath || p.templateType === "MOGRT");
            } else {
                list = list.filter(p => (p.category || "").toLowerCase().includes(cat));
            }
        }
        if (this.searchQuery && this.searchQuery.trim()) {
            const q = this.searchQuery.toLowerCase().trim();
            list = list.filter(p => (p.name && p.name.toLowerCase().includes(q)) || (p.category && p.category.toLowerCase().includes(q)));
        }
        return list;
    },

    /**
     * O'rnatilgan standart stillarni yuklash (har biriga o'zining haqiqiy MOGRT animatsiyasi biriktirilgan)
     */
    async loadBuiltinPresets() {
        const defaultBuiltins = [
            {
                id: "tiktok_reels_karaoke",
                name: "TikTok & Reels (Karaoke Sariq)",
                category: "Reels / Shorts (Hormozi & Beast)",
                fontSize: 48,
                fontName: "Arial-BoldMT",
                fillColor: [1.0, 1.0, 1.0],
                strokeColor: [0.0, 0.0, 0.0],
                strokeWidth: 4,
                positionYPercent: 75,
                isKaraoke: true,
                highlightColor: [1.0, 0.88, 0.0],
                animType: "hormozi",
                templateType: "MOGRT",
                mogrtPath: "D:/plaginlar/05_MOGRT_va_Titlar (Essential Graphics)/Line by line Hormozi 02.mogrt",
                description: "Ijtimoiy tarmoqlar uchun dinamik so'zma-so'z sariq rangda yonib o'tuvchi zamonaviy subtitr."
            },
            {
                id: "tiktok_reels_1line",
                name: "TikTok & Reels (Faqat 1-Qator)",
                category: "Reels / Shorts (Hormozi & Beast)",
                fontSize: 48,
                fontName: "Arial-BoldMT",
                fillColor: [1.0, 1.0, 1.0],
                strokeColor: [0.0, 0.0, 0.0],
                strokeWidth: 4,
                positionYPercent: 75,
                maxLines: 1,
                maxWordsPerLine: 4,
                isKaraoke: true,
                highlightColor: [1.0, 0.88, 0.0],
                animType: "hormozi",
                templateType: "MOGRT",
                mogrtPath: "D:/plaginlar/05_MOGRT_va_Titlar (Essential Graphics)/Line by line Hormozi 02.mogrt",
                description: "Reels va Shorts uchun qat'iy 1 qatorli ixcham so'zma-so'z karaoke subtitr."
            },
            {
                id: "clean_minimalist",
                name: "Minimalist Oq (Box Title)",
                category: "Titllar & Lower Thirds",
                fontSize: 38,
                fontName: "ArialMT",
                fillColor: [1.0, 1.0, 1.0],
                strokeColor: [0.0, 0.0, 0.0],
                strokeWidth: 2,
                positionYPercent: 85,
                isKaraoke: false,
                highlightColor: [1.0, 1.0, 1.0],
                animType: "blur",
                templateType: "MOGRT",
                mogrtPath: "D:/plaginlar/05_MOGRT_va_Titlar (Essential Graphics)/CaptionPremiereGPT.mogrt",
                description: "Barcha turdagi intervyu, darslik va ta'limiy videolar uchun sokin va o'qishga juda qulay stil."
            },
            {
                id: "neon_cyber",
                name: "Neon Cyber (Waving VFX)",
                category: "Dinamik & Trendy Animatsiya",
                fontSize: 44,
                fontName: "Arial-BoldMT",
                fillColor: [0.15, 1.0, 0.6],
                strokeColor: [0.05, 0.05, 0.15],
                strokeWidth: 5,
                positionYPercent: 80,
                isKaraoke: true,
                highlightColor: [0.0, 0.85, 1.0],
                animType: "neon",
                templateType: "MOGRT",
                mogrtPath: "D:/plaginlar/05_MOGRT_va_Titlar (Essential Graphics)/Coovetica Waving of.mogrt",
                description: "Texnologiya, o'yin va yoshlar kontenti uchun yorqin neon uslubi."
            },
            {
                id: "cinematic_gold",
                name: "Kinematik Oltin (Fon Animatsiya)",
                category: "Titllar & Lower Thirds",
                fontSize: 36,
                fontName: "Georgia-Bold",
                fillColor: [1.0, 0.82, 0.35],
                strokeColor: [0.0, 0.0, 0.0],
                strokeWidth: 2,
                positionYPercent: 88,
                isKaraoke: false,
                highlightColor: [1.0, 0.9, 0.5],
                animType: "title",
                templateType: "MOGRT",
                mogrtPath: "D:/plaginlar/05_MOGRT_va_Titlar (Essential Graphics)/Text Fon Animation.mogrt",
                description: "Klassik filmlar va hujjatli loyihalar uchun qadimiy nafis oltin yozuv."
            },
            {
                id: "youtube_bouncy",
                name: "YouTube Dinamik (MrBeast 01)",
                category: "Reels / Shorts (Hormozi & Beast)",
                fontSize: 52,
                fontName: "Impact",
                fillColor: [1.0, 1.0, 1.0],
                strokeColor: [0.8, 0.0, 0.1],
                strokeWidth: 6,
                positionYPercent: 70,
                isKaraoke: true,
                highlightColor: [1.0, 0.2, 0.2],
                animType: "beast",
                templateType: "MOGRT",
                mogrtPath: "D:/plaginlar/05_MOGRT_va_Titlar (Essential Graphics)/Beast 01.mogrt",
                description: "Tomoshabin e'tiborini bir zumda tortadigan katta va qalin blogerlar stili."
            }
        ];

        try {
            if (typeof require !== "undefined") {
                const fs = require('fs');
                const path = require('path');
                const p = 'd:/anti garavity loyhalar/plogin/presets/builtin_presets.json';
                if (fs.existsSync(p)) {
                    this.presets = JSON.parse(fs.readFileSync(p, 'utf8'));
                    return;
                }
            }
            const res = await fetch("../presets/builtin_presets.json");
            if (res.ok) {
                const builtins = await res.json();
                this.presets = [...builtins];
                return;
            } else {
                this.presets = [...defaultBuiltins];
            }
        } catch (e) {
            this.presets = [...defaultBuiltins];
        }
    },

    /**
     * Foydalanuvchi saqlagan maxsus presetlarni yuklash
     */
    loadCustomPresets() {
        try {
            const saved = localStorage.getItem("uz_custom_sub_presets");
            if (saved) {
                const customList = JSON.parse(saved);
                this.presets = [...this.presets, ...customList];
            }
        } catch (e) {
            console.error("Maxsus presetlarni o'qishda xatolik:", e);
        }
    },

    /**
     * Maxsus presetlarni localStorage'ga saqlash
     */
    saveCustomPresets() {
        try {
            const customList = this.presets.filter(p => p.isCustom);
            localStorage.setItem("uz_custom_sub_presets", JSON.stringify(customList));
        } catch (e) {
            console.error("Presetlarni saqlashda xatolik:", e);
        }
    },

    /**
     * Yangi maxsus preset qo'shish
     */
    addPreset(presetData) {
        const newPreset = {
            id: "custom_" + Date.now(),
            name: presetData.name || "Yangi Stil",
            category: presetData.category || "Mening Stillarim",
            fontSize: presetData.fontSize || 42,
            fontName: presetData.fontName || "Arial-BoldMT",
            fillColor: presetData.fillColor || [1, 1, 1],
            strokeColor: presetData.strokeColor || [0, 0, 0],
            strokeWidth: presetData.strokeWidth !== undefined ? presetData.strokeWidth : 3,
            positionYPercent: presetData.positionYPercent || 80,
            isKaraoke: presetData.isKaraoke || false,
            highlightColor: presetData.highlightColor || [1, 0.88, 0],
            ffxPresetPath: presetData.ffxPresetPath || "",
            mogrtPath: presetData.mogrtPath || "",
            description: presetData.description || "Foydalanuvchi tomonidan yaratilgan maxsus subtitr uslubi.",
            isCustom: true
        };

        this.presets.unshift(newPreset);
        this.saveCustomPresets();
        this.activePresetId = newPreset.id;
        return newPreset;
    },

    /**
     * Tanlangan After Effects qatlamidan stil o'qib olib saqlash ("Stilni Saqlash")
     */
    async saveStyleFromSelectedLayer(presetName, category = "Qatlamdan Olingan") {
        const result = await window.HostBridge.extractSelectedTextStyle();
        if (!result.success) {
            throw new Error(result.message || result.error || "Qatlamdan stil o'qib bo'lmadi");
        }

        const s = result.style;
        const newPreset = this.addPreset({
            name: presetName || s.layerName || "Yangi Saqlangan Stil",
            category: category,
            fontSize: s.fontSize,
            fontName: s.fontName,
            fillColor: s.fillColor,
            strokeColor: s.strokeColor,
            strokeWidth: s.strokeWidth,
            positionYPercent: s.positionYPercent,
            isKaraoke: false,
            highlightColor: [1, 0.88, 0],
            description: `${s.layerName} qatlamidan o'qib olingan parametrlar.`
        });

        return newPreset;
    },

    /**
     * .ffx faylini kutubxonaga qo'shish
     */
    importFFXPreset(filePath, presetName) {
        if (!filePath) return null;
        const cleanName = presetName || filePath.split(/[\/\\]/).pop().replace(/\.ffx$/i, '');
        return this.addPreset({
            name: cleanName + " (.ffx)",
            category: "FFX Animatsiyalar",
            ffxPresetPath: filePath,
            description: `Import qilingan After Effects animatsiya preseti: ${filePath}`
        });
    },

    /**
     * .mogrt faylini kutubxonaga qo'shish
     */
    importMogrtPreset(filePath, presetName) {
        if (!filePath) return null;
        const cleanName = presetName || filePath.split(/[\/\\]/).pop().replace(/\.mogrt$/i, '');
        return this.addPreset({
            name: cleanName + " (.mogrt)",
            category: "MOGRT Shablonlar",
            mogrtPath: filePath,
            description: `Import qilingan Premiere Pro MOGRT shabloni: ${filePath}`
        });
    },

    /**
     * Joriy faol preset parametrlarini olish
     */
    getActivePreset() {
        return this.presets.find(p => p.id === this.activePresetId) || this.presets[0];
    },

    /**
     * Presetlar to'plamini (.uzsubpack) faylga eksport qilish (do'stlarga yuborish uchun)
     */
    exportPresetsPack() {
        const packData = {
            version: "1.0",
            exportDate: new Date().toISOString(),
            author: "O'zbekcha AI Subtitr Plagini",
            presets: this.presets.filter(p => p.isCustom)
        };
        const jsonStr = JSON.stringify(packData, null, 2);
        window.UzbekUtils.downloadFile("mening_subtitr_stillari.uzsubpack", jsonStr, "application/json");
    },

    /**
     * .uzsubpack yoki JSON formatidagi presetlar paketini import qilish
     */
    importPresetsPack(jsonContent) {
        try {
            const data = JSON.parse(jsonContent);
            const importedList = data.presets || (Array.isArray(data) ? data : []);
            let count = 0;
            for (const item of importedList) {
                if (item.name) {
                    item.isCustom = true;
                    item.id = "custom_imported_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5);
                    this.presets.unshift(item);
                    count++;
                }
            }
            this.saveCustomPresets();
            return count;
        } catch (e) {
            throw new Error("Faylni o'qishda xatolik yuz berdi. To'g'ri .uzsubpack yoki JSON fayl tanlang.");
        }
    }
};

window.PresetManager = PresetManager;
