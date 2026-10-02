/**
 * O'zbekcha AI Subtitr - Subtitr Tahrirlash Oynasi Moduli (editor.js)
 * Matnlarni tahrirlash, jumlalarni bo'lish/birlashtirish, vaqtni sinxronlash,
 * qidirish/almashtirish va fayllarni import/eksport qilish amallarini bajaradi.
 */

const SubtitleEditor = {
    segments: [],
    containerId: "subtitleListContainer",

    /**
     * Yangi segmentlar ro'yxatini yuklash va chizish
     */
    setSegments(newSegments) {
        this.segments = JSON.parse(JSON.stringify(newSegments || []));
        try {
            localStorage.setItem("uz_subtitles_cached_segments", JSON.stringify(this.segments));
        } catch (e) {}
        this.render();
    },

    loadCachedSegments() {
        try {
            const cached = localStorage.getItem("uz_subtitles_cached_segments");
            if (cached) {
                const parsed = JSON.parse(cached);
                if (parsed && parsed.length > 0 && this.segments.length === 0) {
                    this.segments = parsed;
                    this.render();
                }
            }
        } catch (e) {}
    },

    /**
     * Barcha subtitrlarni tozalash (xotira va ekranni bo'shatish)
     */
    clear(confirmPrompt = true) {
        if (confirmPrompt && this.segments.length > 0) {
            if (!confirm("Haqiqatan ham tahrirlash oynasidagi barcha subtitrlarni tozalamoqchimisiz?")) {
                return;
            }
        }
        this.segments = [];
        try {
            localStorage.removeItem("uz_subtitles_cached_segments");
        } catch (e) {}
        this.render();
    },

    /**
     * Subtitr qatorlarini HTML ko'rinishida chiqarish
     */
    render() {
        const container = document.getElementById(this.containerId);
        if (!container) return;

        if (this.segments.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📝</div>
                    <p>Subtitrlar mavjud emas</p>
                    <small>Audio tanlang yoki SRT/JSON fayl yuklang</small>
                </div>
            `;
            this.updateCounter();
            return;
        }

        let html = "";
        for (let i = 0; i < this.segments.length; i++) {
            const seg = this.segments[i];
            const startTimeStr = window.UzbekUtils.formatTime(seg.start);
            const endTimeStr = window.UzbekUtils.formatTime(seg.end);

            // So'zma-so'z vaqt nishonlari (word pills)
            let wordsHtml = "";
            if (seg.words && seg.words.length > 0) {
                wordsHtml = `<div class="word-pills" style="margin-top: 6px; display: flex; flex-wrap: wrap; gap: 4px;">`;
                for (let w = 0; w < seg.words.length; w++) {
                    const wordObj = seg.words[w];
                    const wStart = (typeof wordObj.start === "number") ? wordObj.start.toFixed(2) : "0.00";
                    const wEnd = (typeof wordObj.end === "number") ? wordObj.end.toFixed(2) : "0.00";
                    const conf = (typeof wordObj.confidence === "number") ? wordObj.confidence : ((typeof wordObj.score === "number") ? wordObj.score : 1.0);
                    const isLowConf = conf < 0.7;
                    const pauseMs = (typeof wordObj.pause_after_ms === "number") ? wordObj.pause_after_ms : 0;
                    const pauseBadge = pauseMs >= 200 ? `<span style="font-size: 8px; color: #facc15; margin-left: 2px;" title="Nutq to'xtashi (pauza): ${Math.round(pauseMs)}ms">⏸️ ${Math.round(pauseMs)}ms</span>` : "";
                    const warningIcon = isLowConf ? `<span style="color: #ef4444; font-size: 9px;" title="Past ishonchlilik (${Math.round(conf * 100)}%) - vaqtni tekshiring">⚠️</span>` : "";

                    wordsHtml += `
                        <span class="word-pill ${isLowConf ? 'low-confidence' : ''}" title="Playhead'ni ${wStart}s ga o'tkazish (${wStart}s - ${wEnd}s, ishonch: ${Math.round(conf * 100)}%)" onclick="SubtitleEditor.jumpToTime(${wordObj.start})">
                            ${warningIcon}
                            <span class="word-text" style="font-weight: 500;">${window.UzbekUtils.escapeHtml(wordObj.word)}</span>
                            <span class="word-time-badge" title="Vaqti: ${wStart}s dan ${wEnd}s gacha">${wStart}s</span>
                            ${pauseBadge}
                            <button type="button" class="word-time-edit-btn" title="So'z vaqtini tahrirlash (${wStart}s - ${wEnd}s)" onclick="event.stopPropagation(); SubtitleEditor.editWordTimingPrompt(${i}, ${w})">✏️</button>
                            <button type="button" class="word-style-btn" title="Aynan shu '${window.UzbekUtils.escapeHtml(wordObj.word)}' so'ziga animatsiya berish" onclick="event.stopPropagation(); SubtitleEditor.pickStyleForWord(${i}, ${w})">🎨</button>
                        </span>
                    `;
                }
                wordsHtml += `</div>`;
            }

            const styleBadge = seg.styleName ? 
                `<span style="font-size: 10px; background: rgba(96,165,250,0.2); color: #60a5fa; border: 1px solid rgba(96,165,250,0.4); padding: 1px 6px; border-radius: 3px; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;" title="Stilni almashtirish uchun bosing" onclick="SubtitleEditor.pickStyleForSegment(${i})">
                    🎨 <b>${window.UzbekUtils.escapeHtml(seg.styleName)}</b>
                    <span style="color: #f87171; font-weight: bold; margin-left: 2px; padding: 0 2px;" title="Stilni tozalash (umumiy stilga qaytish)" onclick="event.stopPropagation(); SubtitleEditor.resetStyleForSegment(${i});">✕</span>
                </span>` : 
                `<button class="btn-action" style="font-size: 10px; padding: 2px 7px; background: rgba(96,165,250,0.15); border-color: rgba(96,165,250,0.4); color: #93c5fd;" title="Shu so'z/jumla uchun alohida animatsiya tanlash" onclick="SubtitleEditor.pickStyleForSegment(${i})">🎨 Stil</button>`;

            html += `
                <div class="subtitle-card" id="seg_card_${i}" onclick="SubtitleEditor.activeSegmentIndex = ${i}">
                    <div class="card-header">
                        <span class="seg-number">#${i + 1}</span>
                        <div class="time-controls">
                            <button class="btn-icon" title="Timeline'da shu vaqtga o'tish" onclick="SubtitleEditor.jumpToTime(${seg.start}, ${i})">
                                ⏱️
                            </button>
                            <input type="text" class="time-input" value="${startTimeStr}" onchange="SubtitleEditor.updateStartTime(${i}, this.value)" title="Boshlanish vaqti">
                            <span>➔</span>
                            <input type="text" class="time-input" value="${endTimeStr}" onchange="SubtitleEditor.updateEndTime(${i}, this.value)" title="Tugash vaqti">
                        </div>
                        <div class="card-actions">
                            ${styleBadge}
                            <button class="btn-action" title="Jumlani ikkiga bo'lish" onclick="SubtitleEditor.splitSegment(${i})">✂️ Bo'lish</button>
                            ${i < this.segments.length - 1 ? `<button class="btn-action" title="Keyingi jumla bilan birlashtirish" onclick="SubtitleEditor.mergeWithNext(${i})">🔗 Qo'shish</button>` : ''}
                            <button class="btn-action delete" title="O'chirish" onclick="SubtitleEditor.deleteSegment(${i})">🗑️</button>
                        </div>
                    </div>
                    <div class="card-body">
                        <textarea class="seg-textarea" rows="2" oninput="SubtitleEditor.updateText(${i}, this.value)" onchange="SubtitleEditor.onTextChange(${i}, this.value)">${window.UzbekUtils.escapeHtml(seg.text)}</textarea>
                        ${wordsHtml}
                    </div>
                </div>
            `;
        }

        container.innerHTML = html;
        this.updateCounter();
        this.renderWaveformView();
    },

    updateCounter() {
        const counterEl = document.getElementById("subtitleCountText");
        if (counterEl) {
            counterEl.textContent = `${this.segments.length} ta jumla`;
        }
    },

    /**
     * Timeline playhead'ini belgilangan vaqtga o'tkazish
     */
    async jumpToTime(seconds, segIdx) {
        if (segIdx !== undefined) {
            this.activeSegmentIndex = segIdx;
        }
        if (window.HostBridge) {
            await window.HostBridge.setPlayhead(seconds);
        }
    },

    /**
     * Alohida bitta qatorga maxsus stil/animatsiyani tanlash uchun Stillar bo'limiga o'tish
     */
    pickStyleForSegment(index) {
        const seg = this.segments[index];
        if (!seg) return;

        this.targetSegmentIndex = index;
        this.targetWordInfo = null;
        if (typeof window.updateSegmentTargetBanner === "function") {
            window.updateSegmentTargetBanner(index, `🎯 #${index + 1}: "${(seg.text || '').substring(0, 35)}..."`);
        }
        if (typeof window.switchTab === "function") {
            window.switchTab("tab-presets");
        }
    },

    /**
     * Aynan bitta so'zga alohida animatsiya/stil tanlash
     */
    pickStyleForWord(segIndex, wordIndex) {
        const seg = this.segments[segIndex];
        if (!seg || !seg.words || !seg.words[wordIndex]) return;
        const wordObj = seg.words[wordIndex];

        this.targetWordInfo = {
            segIndex: segIndex,
            wordIndex: wordIndex,
            word: wordObj.word,
            start: wordObj.start,
            end: wordObj.end
        };
        this.targetSegmentIndex = segIndex;

        if (typeof window.updateSegmentTargetBanner === "function") {
            window.updateSegmentTargetBanner(segIndex, `🎯 So'z: "${wordObj.word}" (${wordObj.start.toFixed(2)}s - ${wordObj.end.toFixed(2)}s)`);
        }
        if (typeof window.switchTab === "function") {
            window.switchTab("tab-presets");
        }
    },

    /**
     * Tanlangan so'zga animatsiya biriktirish (zarurat bo'lsa uni mustaqil klipga aylantiradi)
     */
    applyStyleToWord(segIndex, wordIndex, preset) {
        const seg = this.segments[segIndex];
        if (!seg) return;

        if (!seg.words || seg.words.length <= 1) {
            seg.mogrtPath = preset.mogrtPath || "";
            seg.ffxPresetPath = preset.ffxPresetPath || "";
            seg.animType = preset.animType || "";
            seg.styleName = preset.name;
            seg.templateType = preset.templateType || "";
            this.render();
            return;
        }

        const wObj = seg.words[wordIndex];
        const beforeWords = seg.words.slice(0, wordIndex);
        const afterWords = seg.words.slice(wordIndex + 1);

        const newItems = [];

        if (beforeWords.length > 0) {
            newItems.push({
                id: Date.now() + Math.random(),
                start: beforeWords[0].start,
                end: beforeWords[beforeWords.length - 1].end,
                text: beforeWords.map(w => w.word).join(" "),
                words: beforeWords,
                mogrtPath: seg.mogrtPath || "",
                ffxPresetPath: seg.ffxPresetPath || "",
                styleName: seg.styleName || "",
                animType: seg.animType || ""
            });
        }

        newItems.push({
            id: Date.now() + Math.random() + 1,
            start: wObj.start,
            end: wObj.end,
            text: wObj.word,
            words: [wObj],
            mogrtPath: preset.mogrtPath || "",
            ffxPresetPath: preset.ffxPresetPath || "",
            styleName: preset.name,
            animType: preset.animType || "",
            templateType: preset.templateType || ""
        });

        if (afterWords.length > 0) {
            newItems.push({
                id: Date.now() + Math.random() + 2,
                start: afterWords[0].start,
                end: afterWords[afterWords.length - 1].end,
                text: afterWords.map(w => w.word).join(" "),
                words: afterWords,
                mogrtPath: seg.mogrtPath || "",
                ffxPresetPath: seg.ffxPresetPath || "",
                styleName: seg.styleName || "",
                animType: seg.animType || ""
            });
        }

        this.segments.splice(segIndex, 1, ...newItems);
        this.render();
    },

    /**
     * Alohida qator yoki so'z uchun stil tanlashni bekor qilish
     */
    cancelPickStyle() {
        this.targetSegmentIndex = null;
        this.targetWordInfo = null;
        if (typeof window.updateSegmentTargetBanner === "function") {
            window.updateSegmentTargetBanner(null);
        }
        if (typeof window.switchTab === "function") {
            window.switchTab("tab-editor");
        }
    },

    /**
     * Qatorga biriktirilgan maxsus stilni bekor qilish (umumiy stilga qaytish)
     */
    resetStyleForSegment(index) {
        const seg = this.segments[index];
        if (seg) {
            delete seg.mogrtPath;
            delete seg.ffxPresetPath;
            delete seg.animType;
            delete seg.styleName;
            delete seg.templateType;
            this.render();
        }
    },

    /**
     * Boshlanish vaqtini o'zgartirish
     */
    updateStartTime(index, timeStr) {
        const sec = window.UzbekUtils.parseTime(timeStr);
        this.segments[index].start = sec;
        if (this.segments[index].end < sec) {
            this.segments[index].end = sec + 1.0;
        }
    },

    /**
     * Tugash vaqtini o'zgartirish
     */
    updateEndTime(index, timeStr) {
        const sec = window.UzbekUtils.parseTime(timeStr);
        this.segments[index].end = Math.max(sec, this.segments[index].start + 0.1);
    },

    /**
     * Matnni yangilash va so'z vaqtlarini intellektual moslash
     */
    updateText(index, newText) {
        const seg = this.segments[index];
        if (!seg) return;
        seg.text = newText;
        this.alignWordsWithText(seg, newText);
    },

    onTextChange(index, newText) {
        this.updateText(index, newText);
        try {
            localStorage.setItem("uz_subtitles_cached_segments", JSON.stringify(this.segments));
        } catch (e) {}
        this.render();
    },

    /**
     * Matn o'zgarganda so'zlar vaqtini buzmasdan proporsional moslash
     */
    alignWordsWithText(seg, text) {
        const newWords = (text || "").replace(/[\r\n]+/g, " ").trim().split(/\s+/).filter(Boolean);
        const oldWords = seg.words || [];

        if (newWords.length === 0) {
            seg.words = [];
            return;
        }

        const updatedWords = [];
        const segDur = Math.max(0.3, (seg.end || (seg.start + 1.0)) - seg.start);

        for (let i = 0; i < newWords.length; i++) {
            const nw = newWords[i];
            const matchedOld = oldWords[i];
            if (matchedOld && matchedOld.word.toLowerCase() === nw.toLowerCase()) {
                updatedWords.push({
                    word: nw,
                    start: matchedOld.start,
                    end: matchedOld.end,
                    score: matchedOld.score || 1.0
                });
            } else {
                let prevEnd = (i > 0 && updatedWords[i - 1]) ? updatedWords[i - 1].end : seg.start;
                let nextStart = seg.end;
                for (let j = i + 1; j < oldWords.length; j++) {
                    if (oldWords[j] && oldWords[j].start > prevEnd) {
                        nextStart = oldWords[j].start;
                        break;
                    }
                }
                const remaining = Math.max(1, newWords.length - i);
                const slotDur = Math.max(0.12, (nextStart - prevEnd) / remaining);
                const wStart = Number(prevEnd.toFixed(3));
                const wEnd = Number(Math.min(nextStart, prevEnd + slotDur).toFixed(3));
                updatedWords.push({
                    word: nw,
                    start: wStart,
                    end: wEnd,
                    score: 0.95
                });
            }
        }
        seg.words = updatedWords;
    },

    /**
     * Bitta so'zning boshlanish va tugash vaqtini tahrirlash (modal / prompt)
     */
    editWordTimingPrompt(segIdx, wordIdx) {
        const seg = this.segments[segIdx];
        if (!seg || !seg.words || !seg.words[wordIdx]) return;
        const w = seg.words[wordIdx];
        const curStart = (typeof w.start === "number") ? w.start.toFixed(2) : "0.00";
        const curEnd = (typeof w.end === "number") ? w.end.toFixed(2) : "0.00";

        const input = prompt(
            `"${w.word}" so'zining vaqtini tahrirlash (soniyalarda):\nFormat: BOSHLANISH - TUGASH`,
            `${curStart} - ${curEnd}`
        );
        if (!input) return;

        const parts = input.split(/[-–—]/).map(s => parseFloat(s.trim()));
        if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1]) && parts[1] > parts[0]) {
            w.start = Number(parts[0].toFixed(3));
            w.end = Number(parts[1].toFixed(3));
            if (w.start < seg.start) seg.start = w.start;
            if (w.end > seg.end) seg.end = w.end;
            try {
                localStorage.setItem("uz_subtitles_cached_segments", JSON.stringify(this.segments));
            } catch (e) {}
            this.render();
            this.jumpToTime(w.start);
        } else {
            alert("Vaqt noto'g'ri kiritildi! Masalan: 1.25 - 1.60");
        }
    },

    /**
     * Jumlani ikkiga bo'lish (Split)
     */
    splitSegment(index) {
        const seg = this.segments[index];
        const text = seg.text.trim();
        const words = text.split(/\s+/);

        if (words.length <= 1) {
            alert("Bo'lish uchun kamida 2 ta so'z bo'lishi kerak!");
            return;
        }

        const mid = Math.ceil(words.length / 2);
        const part1Words = words.slice(0, mid);
        const part2Words = words.slice(mid);

        const midTime = Number(((seg.start + seg.end) / 2).toFixed(3));

        // So'zlar ob'ektini taqsimlash
        let segWords1 = [];
        let segWords2 = [];
        if (seg.words && seg.words.length > 0) {
            segWords1 = seg.words.slice(0, mid);
            segWords2 = seg.words.slice(mid);
        }

        const seg1 = {
            id: seg.id,
            start: seg.start,
            end: midTime,
            text: part1Words.join(" "),
            words: segWords1
        };

        const seg2 = {
            id: Date.now(),
            start: midTime,
            end: seg.end,
            text: part2Words.join(" "),
            words: segWords2
        };

        this.segments.splice(index, 1, seg1, seg2);
        this.render();
    },

    /**
     * Keyingi jumla bilan birlashtirish (Merge)
     */
    mergeWithNext(index) {
        if (index >= this.segments.length - 1) return;

        const current = this.segments[index];
        const next = this.segments[index + 1];

        const mergedSeg = {
            id: current.id,
            start: current.start,
            end: next.end,
            text: current.text.trim() + " " + next.text.trim(),
            words: [...(current.words || []), ...(next.words || [])]
        };

        this.segments.splice(index, 2, mergedSeg);
        this.render();
    },

    /**
     * Segmentni o'chirish
     */
    deleteSegment(index) {
        this.segments.splice(index, 1);
        this.render();
    },

    /**
     * Yangi bo'sh segment qo'shish
     */
    addEmptySegment() {
        const lastSeg = this.segments[this.segments.length - 1];
        const newStart = lastSeg ? lastSeg.end + 0.1 : 0.0;
        const newEnd = newStart + 2.0;

        this.segments.push({
            id: Date.now(),
            start: Number(newStart.toFixed(3)),
            end: Number(newEnd.toFixed(3)),
            text: "Yangi subtitr",
            words: []
        });
        this.render();
    },

    /**
     * Qidirish va almashtirish (Search and Replace)
     */
    searchAndReplace(searchStr, replaceStr, addToDictionary = false) {
        if (!searchStr) return 0;
        let count = 0;
        const regex = new RegExp(searchStr, "gi");

        for (const seg of this.segments) {
            if (regex.test(seg.text)) {
                seg.text = seg.text.replace(regex, replaceStr);
                count++;
            }
            if (seg.words) {
                for (const w of seg.words) {
                    if (regex.test(w.word)) {
                        w.word = w.word.replace(regex, replaceStr);
                    }
                }
            }
        }

        if (count > 0) {
            this.render();
        }

        // Agar foydalanuvchi "Shaxsiy lug'atga saqlash"ni belgilagan bo'lsa
        if (addToDictionary && window.SubtitleAPI) {
            window.SubtitleAPI.getDictionary().then(dict => {
                dict[searchStr.toLowerCase()] = replaceStr;
                window.SubtitleAPI.saveDictionary(dict);
            });
        }

        return count;
    },

    /**
     * SRT fayl matnini o'qib, segmentlarga aylantirish (Import)
     */
    parseSRT(srtText) {
        const parsed = [];
        const blocks = srtText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n\n');

        for (const block of blocks) {
            const lines = block.trim().split('\n');
            if (lines.length >= 2) {
                const timeLine = lines[1].indexOf('-->') !== -1 ? lines[1] : lines[0];
                const textLines = lines.slice(lines[1].indexOf('-->') !== -1 ? 2 : 1);

                if (timeLine.indexOf('-->') !== -1) {
                    const [sStr, eStr] = timeLine.split('-->');
                    parsed.push({
                        id: parsed.length + 1,
                        start: window.UzbekUtils.parseTime(sStr.trim()),
                        end: window.UzbekUtils.parseTime(eStr.trim()),
                        text: textLines.join('\n').trim(),
                        words: []
                    });
                }
            }
        }
        return parsed;
    },

    /**
     * Mavjud subtitrlarni tinish belgilari bo'yicha (., !, ?, ,, ;) kichik jumlalarga ajratish
     */
    splitAllByPunctuation() {
        if (!this.segments || this.segments.length === 0) return;
        const newSegments = [];
        let globalId = 1;

        for (const seg of this.segments) {
            if (!seg.words || seg.words.length <= 1) {
                newSegments.push({ ...seg, id: globalId++ });
                continue;
            }

            let currentWords = [];
            for (let i = 0; i < seg.words.length; i++) {
                const w = seg.words[i];
                currentWords.push(w);

                const endsWithPunct = /[.!?,\-;:]$/.test(w.word.trim()) || i === seg.words.length - 1;
                if (endsWithPunct && currentWords.length > 0) {
                    const text = currentWords.map(item => item.word).join(" ");
                    newSegments.push({
                        id: globalId++,
                        start: currentWords[0].start,
                        end: currentWords[currentWords.length - 1].end,
                        text: text,
                        words: [...currentWords]
                    });
                    currentWords = [];
                }
            }
            if (currentWords.length > 0) {
                const text = currentWords.map(item => item.word).join(" ");
                newSegments.push({
                    id: globalId++,
                    start: currentWords[0].start,
                    end: currentWords[currentWords.length - 1].end,
                    text: text,
                    words: [...currentWords]
                });
            }
        }

        this.setSegments(newSegments);
    },

    /**
     * So'zlar soni bo'yicha bo'lish (masalan: 1 ta so'zdan yoki 2-3 ta so'zdan - Shorts/Reels uslubi)
     */
    splitByWordCount(count = 1) {
        if (!this.segments || this.segments.length === 0) return;
        const newSegments = [];
        let globalId = 1;

        for (const seg of this.segments) {
            let words = (seg.words && seg.words.length > 0) ? [...seg.words] : [];

            // Agar seg.words bo'lmasa, matndan so'zlarni vaqtini teng taqsimlab yaratamiz
            if (words.length === 0) {
                const rawWords = (seg.text || "").trim().split(/\s+/).filter(Boolean);
                if (rawWords.length === 0) continue;
                const totalDur = Math.max(0.5, seg.end - seg.start);
                const durPerWord = totalDur / rawWords.length;
                words = rawWords.map((w, idx) => ({
                    word: w,
                    start: Number((seg.start + idx * durPerWord).toFixed(3)),
                    end: Number((seg.start + (idx + 1) * durPerWord).toFixed(3)),
                    score: 1.0
                }));
            }

            // count bo'yicha bo'laklash
            for (let i = 0; i < words.length; i += count) {
                const chunk = words.slice(i, i + count);
                const text = chunk.map(item => item.word).join(" ").trim();
                if (!text) continue;

                const cStart = chunk[0].start;
                const rawEnd = chunk[chunk.length - 1].end;
                let cEnd = rawEnd;
                const nextWord = words[i + count];
                if (nextWord && nextWord.start > cStart) {
                    // Agar keyingi so'z bilan oraliqda pauza bo'lsa (0.25s dan ko'p jimlik),
                    // oldingi so'z nutq tugashi bilan tabiiy yakunlanadi (ekran bo'sh qoladi).
                    // Gapirish boshlangandagina keyingi so'z animatsiya bilan chiqadi!
                    const gap = nextWord.start - rawEnd;
                    if (gap > 0.25) {
                        cEnd = Number((rawEnd + 0.10).toFixed(3));
                    } else {
                        cEnd = nextWord.start;
                    }
                } else if (cEnd <= cStart) {
                    cEnd = Number((cStart + 0.30).toFixed(3));
                }

                // Minimal ko'rinish davomiyligi (eng kamida 0.20 soniya)
                if (cEnd - cStart < 0.20) {
                    cEnd = Number((cStart + 0.20).toFixed(3));
                }

                newSegments.push({
                    id: globalId++,
                    start: Number(cStart.toFixed(3)),
                    end: Number(cEnd.toFixed(3)),
                    text: text,
                    words: chunk
                });
            }
        }

        this.setSegments(newSegments);
    },

    /**
     * Barcha subtitrlarni qat'iy 1 qatorli ixcham formatga keltirish (Shorts/Reels/TikTok).
     * Hech qachon yangi satr (\n) bo'lmaydi, har bir segmentda ko'pi bilan 3-4 ta so'z (28 belgi).
     */
    enforceMaxOneLine(maxWords = 4, maxChars = 28) {
        if (!this.segments || this.segments.length === 0) return;
        const newSegments = [];
        let globalId = 1;

        for (const seg of this.segments) {
            let words = (seg.words && seg.words.length > 0) ? [...seg.words] : [];
            if (words.length === 0) {
                const rawWords = (seg.text || "").replace(/[\r\n]+/g, " ").trim().split(/\s+/).filter(Boolean);
                if (rawWords.length === 0) continue;
                const totalDur = Math.max(0.4, seg.end - seg.start);
                const durPerWord = totalDur / rawWords.length;
                words = rawWords.map((w, idx) => ({
                    word: w,
                    start: Number((seg.start + idx * durPerWord).toFixed(3)),
                    end: Number((seg.start + (idx + 1) * durPerWord).toFixed(3)),
                    score: 1.0
                }));
            }

            const cleanText = words.map(w => w.word).join(" ");
            const hasInternalPause = words.some((w, idx) => idx > 0 && (w.start - words[idx - 1].end) >= 0.25);
            if (words.length <= maxWords && cleanText.length <= maxChars && !hasInternalPause) {
                newSegments.push({
                    id: globalId++,
                    start: words[0].start,
                    end: words[words.length - 1].end,
                    text: cleanText,
                    words: words,
                    mogrtPath: seg.mogrtPath || "",
                    styleName: seg.styleName || ""
                });
                continue;
            }

            const chunks = [];
            let currChunk = [];
            let currLen = 0;

            for (const w of words) {
                const wLen = (w.word || "").length;
                const prevW = currChunk.length > 0 ? currChunk[currChunk.length - 1] : null;
                const gap = prevW ? (w.start - prevW.end) : 0;
                const pauseSplit = (gap >= 0.25);

                if (currChunk.length > 0 && (pauseSplit || currChunk.length >= maxWords || currLen + 1 + wLen > maxChars)) {
                    chunks.push(currChunk);
                    currChunk = [w];
                    currLen = wLen;
                } else {
                    currChunk.push(w);
                    currLen += (currChunk.length > 1 ? 1 : 0) + wLen;
                }
            }
            if (currChunk.length > 0) chunks.push(currChunk);

            for (const c of chunks) {
                if (!c || c.length === 0) continue;
                const cText = c.map(w => w.word).join(" ");
                let cStart = c[0].start;
                let cEnd = c[c.length - 1].end;
                if (cEnd <= cStart) cEnd = Number((cStart + 0.35).toFixed(3));

                newSegments.push({
                    id: globalId++,
                    start: Number(cStart.toFixed(3)),
                    end: Number(cEnd.toFixed(3)),
                    text: cText,
                    words: c,
                    mogrtPath: seg.mogrtPath || "",
                    styleName: seg.styleName || ""
                });
            }
        }

        this.setSegments(newSegments);
    },

    /**
     * Barcha subtitrlarni qat'iy ko'pi bilan 1 yoki 2 qatorli qilib formatlash
     * Hech qachon 3 yoki 4 qator bo'lib ketmasligini ta'minlaydi
     */
    enforceMaxTwoLines(maxWords = 4, maxChars = 28) {
        if (!this.segments || this.segments.length === 0) return;
        const newSegments = [];
        let globalId = 1;

        for (const seg of this.segments) {
            let words = (seg.words && seg.words.length > 0) ? [...seg.words] : [];
            if (words.length === 0) {
                const rawWords = (seg.text || "").replace(/[\r\n]+/g, " ").trim().split(/\s+/).filter(Boolean);
                if (rawWords.length === 0) continue;
                const totalDur = Math.max(0.4, seg.end - seg.start);
                const durPerWord = totalDur / rawWords.length;
                words = rawWords.map((w, idx) => ({
                    word: w,
                    start: Number((seg.start + idx * durPerWord).toFixed(3)),
                    end: Number((seg.start + (idx + 1) * durPerWord).toFixed(3)),
                    score: 1.0
                }));
            }

            const cleanText = words.map(w => w.word).join(" ");
            const hasInternalPause = words.some((w, idx) => idx > 0 && (w.start - words[idx - 1].end) >= 0.25);
            // Agar so'zlar 4 tagacha bo'lsa va 28 belgidan oshmasa hamda oraliqda pauza bo'lmasa
            if (words.length <= maxWords && cleanText.length <= maxChars && !hasInternalPause) {
                const fmt = this.formatTwoLines(cleanText, 24);
                newSegments.push({
                    id: globalId++,
                    start: words[0].start,
                    end: words[words.length - 1].end,
                    text: fmt,
                    words: words,
                    mogrtPath: seg.mogrtPath || "",
                    styleName: seg.styleName || ""
                });
                continue;
            }

            // Aks holda kichik 1-2 qatorli segmentlarga bo'lamiz
            const chunks = [];
            let currChunk = [];
            let currLen = 0;

            for (const w of words) {
                const wLen = (w.word || "").length;
                const prevW = currChunk.length > 0 ? currChunk[currChunk.length - 1] : null;
                const gap = prevW ? (w.start - prevW.end) : 0;
                const pauseSplit = (gap >= 0.25);

                if (currChunk.length > 0 && (pauseSplit || currChunk.length >= maxWords || currLen + 1 + wLen > maxChars)) {
                    chunks.push(currChunk);
                    currChunk = [w];
                    currLen = wLen;
                } else {
                    currChunk.push(w);
                    currLen += (currChunk.length > 1 ? 1 : 0) + wLen;
                }
            }
            if (currChunk.length > 0) chunks.push(currChunk);

            for (const c of chunks) {
                if (!c || c.length === 0) continue;
                const cText = c.map(w => w.word).join(" ");
                const fmtText = this.formatTwoLines(cText, 22);
                let cStart = c[0].start;
                let cEnd = c[c.length - 1].end;
                if (cEnd <= cStart) cEnd = Number((cStart + 0.35).toFixed(3));

                newSegments.push({
                    id: globalId++,
                    start: Number(cStart.toFixed(3)),
                    end: Number(cEnd.toFixed(3)),
                    text: fmtText,
                    words: c,
                    mogrtPath: seg.mogrtPath || "",
                    styleName: seg.styleName || ""
                });
            }
        }

        this.setSegments(newSegments);
    },

    /**
     * Matnni ko'pi bilan 2 ta muvozanatli qatorga ajratish
     */
    formatTwoLines(text, maxLineChars = 24) {
        const words = (text || "").replace(/[\r\n]+/g, " ").trim().split(/\s+/).filter(Boolean);
        if (words.length <= 1) return words.join(" ");
        if (words.length <= 3 && text.length <= maxLineChars) {
            return words.join(" ");
        }
        let bestSplit = Math.floor(words.length / 2);
        let minDiff = 9999;
        for (let i = 1; i < words.length; i++) {
            const l1 = words.slice(0, i).join(" ");
            const l2 = words.slice(i).join(" ");
            const diff = Math.abs(l1.length - l2.length);
            if (diff < minDiff) {
                minDiff = diff;
                bestSplit = i;
            }
        }
        const line1 = words.slice(0, bestSplit).join(" ");
        const line2 = words.slice(bestSplit).join(" ");
        return `${line1}\n${line2}`;
    },

    /**
     * Mayda, qisqa bo'laklarni tabiiy gaplarga birlashtirish (maksimal 2 qator va 5 so'zdan oshmagan holda)
     */
    mergeToNaturalSentences(minDuration = 2.0, maxWords = 5) {
        if (!this.segments || this.segments.length <= 1) return;
        const newSegments = [];
        let curr = null;

        for (let i = 0; i < this.segments.length; i++) {
            const seg = this.segments[i];
            const segText = (seg.text || "").replace(/[\r\n]+/g, " ").trim();
            if (!segText) continue;

            if (!curr) {
                curr = {
                    id: newSegments.length + 1,
                    start: seg.start,
                    end: seg.end,
                    text: segText,
                    words: seg.words ? [...seg.words] : []
                };
                continue;
            }

            const currWordsCount = curr.text.split(/\s+/).filter(Boolean).length;
            const segWordsCount = segText.split(/\s+/).filter(Boolean).length;
            const duration = seg.end - curr.start;
            const endsWithSentencePunct = /[.!?]$/.test(curr.text);
            const timeGap = seg.start - curr.end;

            // Agar oldingi jumla tugagan bo'lsa va vaqt yetarli bo'lsa,
            // yoki so'zlar soni limitga (5 so'z) yetsa, yoki 1.2s dan ko'p pauza bo'lsa:
            if ((endsWithSentencePunct && duration >= minDuration) || (currWordsCount + segWordsCount > maxWords) || timeGap > 1.2) {
                curr.text = this.formatTwoLines(curr.text, 24);
                newSegments.push(curr);
                curr = {
                    id: newSegments.length + 1,
                    start: seg.start,
                    end: seg.end,
                    text: segText,
                    words: seg.words ? [...seg.words] : []
                };
            } else {
                // Birlashtirish
                curr.end = seg.end;
                curr.text = curr.text + " " + segText;
                if (seg.words && seg.words.length > 0) {
                    curr.words.push(...seg.words);
                }
            }
        }

        if (curr) {
            curr.text = this.formatTwoLines(curr.text, 24);
            newSegments.push(curr);
        }

        newSegments.forEach((s, idx) => s.id = idx + 1);
        this.setSegments(newSegments);
    },

    /**
     * Interaktiv to'lqin shakli va so'z vaqti bloklarini chizish
     */
    renderWaveformView() {
        const canvas = document.getElementById("waveformCanvas");
        const blocksLayer = document.getElementById("waveformWordBlocksLayer");
        const statsBadge = document.getElementById("waveformStatsBadge");
        if (!canvas || !blocksLayer) return;

        // Barcha so'zlarni yig'ish
        const allWords = [];
        for (let sIdx = 0; sIdx < this.segments.length; sIdx++) {
            const seg = this.segments[sIdx];
            if (seg.words && seg.words.length > 0) {
                for (let wIdx = 0; wIdx < seg.words.length; wIdx++) {
                    allWords.push({
                        segIdx: sIdx,
                        wordIdx: wIdx,
                        ...seg.words[wIdx]
                    });
                }
            }
        }

        if (allWords.length === 0) {
            blocksLayer.innerHTML = "";
            const ctx = canvas.getContext("2d");
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            if (statsBadge) statsBadge.textContent = "0 ta so'z";
            return;
        }

        const minTime = Math.max(0, allWords[0].start - 0.2);
        const maxTime = allWords[allWords.length - 1].end + 0.5;
        const totalDur = Math.max(2.0, maxTime - minTime);

        // Canvas va konteyner kengligini vaqtga proporsional qilish (har soniya uchun ~90px)
        const container = document.getElementById("waveformTimelineContainer");
        const containerWidth = container ? container.clientWidth : 800;
        const targetWidth = Math.max(containerWidth, Math.round(totalDur * 90));

        canvas.width = targetWidth;
        canvas.height = 75;
        canvas.style.width = targetWidth + "px";
        blocksLayer.style.width = targetWidth + "px";

        // To'lqin shakli va vaqt shkalasini Canvas'ga chizish
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#13171f";
        ctx.fillRect(0, 0, targetWidth, 75);

        // Vaqt chiziqlari (Har 1 soniya)
        ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
        ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
        ctx.font = "9px monospace";

        const startSec = Math.floor(minTime);
        const endSec = Math.ceil(maxTime);
        for (let sec = startSec; sec <= endSec; sec++) {
            const x = Math.round(((sec - minTime) / totalDur) * targetWidth);
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, 75);
            ctx.stroke();
            ctx.fillText(sec + "s", x + 3, 70);
        }

        // Sintetik/audio amplituda simulyatsiyasi
        ctx.fillStyle = "rgba(56, 189, 248, 0.18)";
        const midY = 32;
        for (let i = 0; i < allWords.length; i++) {
            const w = allWords[i];
            const wx1 = Math.round(((w.start - minTime) / totalDur) * targetWidth);
            const wx2 = Math.round(((w.end - minTime) / totalDur) * targetWidth);
            for (let bx = wx1; bx < wx2; bx += 3) {
                const amp = 6 + Math.sin(bx * 0.4) * 8 + Math.random() * 8;
                ctx.fillRect(bx, midY - amp, 2, amp * 2);
            }
        }

        // So'z bloklari va pauza belgilarini HTML sifatida joylashtirish
        let blocksHtml = "";
        let lowConfCount = 0;
        let pausesCount = 0;

        for (let i = 0; i < allWords.length; i++) {
            const w = allWords[i];
            const left = Math.round(((w.start - minTime) / totalDur) * targetWidth);
            const right = Math.round(((w.end - minTime) / totalDur) * targetWidth);
            const width = Math.max(34, right - left);

            const conf = (typeof w.confidence === "number") ? w.confidence : ((typeof w.score === "number") ? w.score : 1.0);
            let chipClass = "chip-high";
            if (conf < 0.7) {
                chipClass = "chip-low";
                lowConfCount++;
            } else if (conf < 0.85) {
                chipClass = "chip-med";
            }

            const pauseAfter = (typeof w.pause_after_ms === "number") ? w.pause_after_ms : 0;
            if (pauseAfter >= 200) pausesCount++;

            blocksHtml += `
                <div class="word-timeline-chip ${chipClass}" 
                     style="left: ${left}px; width: ${width}px;" 
                     title="${window.UzbekUtils.escapeHtml(w.word)} (${w.start.toFixed(2)}s - ${w.end.toFixed(2)}s, ishonch: ${Math.round(conf * 100)}%)"
                     onclick="SubtitleEditor.jumpToTime(${w.start})">
                    <div class="word-drag-handle handle-start" 
                         onmousedown="event.stopPropagation(); SubtitleEditor.startWordDrag(event, ${w.segIdx}, ${w.wordIdx}, 'start', ${minTime}, ${totalDur}, ${targetWidth})"></div>
                    <div class="word-chip-text">${conf < 0.7 ? '⚠️ ' : ''}${window.UzbekUtils.escapeHtml(w.word)}</div>
                    <div class="word-chip-time">${w.start.toFixed(2)}s</div>
                    <div class="word-drag-handle handle-end" 
                         onmousedown="event.stopPropagation(); SubtitleEditor.startWordDrag(event, ${w.segIdx}, ${w.wordIdx}, 'end', ${minTime}, ${totalDur}, ${targetWidth})"></div>
                </div>
            `;

            // Pauza belgisi (agar keyingi so'zgacha >= 200ms sukut bo'lsa)
            if (pauseAfter >= 200 && i < allWords.length - 1) {
                const nextW = allWords[i + 1];
                const pauseLeft = right;
                const pauseRight = Math.round(((nextW.start - minTime) / totalDur) * targetWidth);
                const pauseWidth = Math.max(15, pauseRight - pauseLeft);
                if (pauseWidth > 12) {
                    blocksHtml += `
                        <div class="pause-silence-marker" style="left: ${pauseLeft}px; width: ${pauseWidth}px;" title="Sukut / Pauza: ${Math.round(pauseAfter)}ms">
                            ⏸️ ${Math.round(pauseAfter)}ms
                        </div>
                    `;
                }
            }
        }

        blocksLayer.innerHTML = blocksHtml;
        if (statsBadge) {
            statsBadge.textContent = `${allWords.length} ta so'z | ${pausesCount} ta pauza` + (lowConfCount > 0 ? ` | ⚠️ ${lowConfCount} ta past ishonch` : "");
        }
    },

    /**
     * So'z blokining chegarasini sichqoncha bilan tortib vaqtni to'g'rilash (Drag handle)
     */
    startWordDrag(e, segIdx, wordIdx, handleType, minTime, totalDur, targetWidth) {
        e.preventDefault();
        const startMouseX = e.clientX;
        const seg = this.segments[segIdx];
        if (!seg || !seg.words || !seg.words[wordIdx]) return;
        const wordObj = seg.words[wordIdx];
        const origVal = (handleType === "start") ? wordObj.start : wordObj.end;

        const onMouseMove = (moveEv) => {
            const dx = moveEv.clientX - startMouseX;
            const dt = (dx / targetWidth) * totalDur;
            let newVal = Number(Math.max(0, origVal + dt).toFixed(3));

            if (handleType === "start") {
                if (newVal >= wordObj.end - 0.05) newVal = Number((wordObj.end - 0.05).toFixed(3));
                wordObj.start = newVal;
                if (wordIdx === 0) seg.start = newVal;
            } else {
                if (newVal <= wordObj.start + 0.05) newVal = Number((wordObj.start + 0.05).toFixed(3));
                wordObj.end = newVal;
                if (wordIdx === seg.words.length - 1) seg.end = newVal;
            }

            // Pauzani qayta hisoblash
            if (wordIdx < seg.words.length - 1) {
                const nextW = seg.words[wordIdx + 1];
                wordObj.pause_after_ms = Math.max(0, Math.round((nextW.start - wordObj.end) * 1000));
            }
            if (wordIdx > 0) {
                const prevW = seg.words[wordIdx - 1];
                prevW.pause_after_ms = Math.max(0, Math.round((wordObj.start - prevW.end) * 1000));
            }

            this.renderWaveformView();
        };

        const onMouseUp = () => {
            window.removeEventListener("mousemove", onMouseMove);
            window.removeEventListener("mouseup", onMouseUp);
            try {
                localStorage.setItem("uz_subtitles_cached_segments", JSON.stringify(this.segments));
            } catch (err) {}
            this.render();
        };

        window.addEventListener("mousemove", onMouseMove);
        window.addEventListener("mouseup", onMouseUp);
    },

    /**
     * Tanlangan so'zlarni audio energiyasi bo'yicha qayta tekislash
     */
    async realignWithAudioEnergy() {
        if (!this.segments || this.segments.length === 0) {
            alert("Qayta tekislash uchun avval subtitrlar yuklangan bo'lishi kerak!");
            return;
        }

        const allWords = [];
        for (const s of this.segments) {
            if (s.words) allWords.push(...s.words);
        }

        if (allWords.length === 0) {
            alert("So'zlar ro'yxati topilmadi!");
            return;
        }

        let mediaPath = null;
        if (window.HostBridge) {
            const mediaRes = await window.HostBridge.getSelectedMediaSource();
            if (mediaRes && mediaRes.filePath) mediaPath = mediaRes.filePath;
        }

        const btn = document.getElementById("btnRealignSelected");
        if (btn) btn.textContent = "⏳ Tekislanmoqda...";

        try {
            const res = await window.SubtitleAPI.realignWords(allWords, mediaPath, 200.0);
            if (res && res.words && res.words.length > 0) {
                let wIdx = 0;
                for (const s of this.segments) {
                    if (s.words) {
                        const count = s.words.length;
                        s.words = res.words.slice(wIdx, wIdx + count);
                        wIdx += count;
                        if (s.words.length > 0) {
                            s.start = s.words[0].start;
                            s.end = s.words[s.words.length - 1].end;
                        }
                    }
                }
                this.render();
                const st = res.stats || {};
                alert(`✅ Muvaffaqiyatli tekislandi!\n- Aniqlangan so'zlar: ${st.total_words || allWords.length}\n- Tortilgan (snapped) so'zlar: ${st.snapped_count || 0}\n- Topilgan sukut/pauzalar: ${st.pauses_found || 0}\n- O'rtacha siljish: ${st.avg_shift_ms || 0} ms`);
            }
        } catch (e) {
            alert("Qayta tekislashda xatolik: " + e.message);
        } finally {
            if (btn) btn.textContent = "⚡ Qayta tekislash";
        }
    },

    /**
     * Tap-Sinxron rejimi: Space tugmasini bosib so'zlarni jonli belgilash
     */
    toggleTapSync() {
        this.isTapSyncActive = !this.isTapSyncActive;
        const btn = document.getElementById("btnToggleTapSync");

        if (this.isTapSyncActive) {
            if (btn) {
                btn.textContent = "🔴 To'xtatish";
                btn.classList.add("tap-sync-active");
            }
            this.tapWordIndex = 0;
            this.allTapWords = [];
            for (let sIdx = 0; sIdx < this.segments.length; sIdx++) {
                const s = this.segments[sIdx];
                if (s.words) {
                    for (let wIdx = 0; wIdx < s.words.length; wIdx++) {
                        this.allTapWords.push({ segIdx: sIdx, wordIdx: wIdx, word: s.words[wIdx] });
                    }
                }
            }

            const infoEl = document.getElementById("waveformTimeInfo");
            if (infoEl) {
                infoEl.innerHTML = `<b style="color: #fbbf24;">🔴 Tap-Sinxron faol!</b> Audio tinglab, har bir so'z aytilganda <b>[SPACE]</b> (bo'sh joy) tugmasini bosing! (Navbatdagi so'z: "${this.allTapWords[0] ? this.allTapWords[0].word.word : ''}")`;
            }

            this.tapKeyHandler = async (e) => {
                if (e.code === "Space" && this.isTapSyncActive && this.allTapWords && this.tapWordIndex < this.allTapWords.length) {
                    e.preventDefault();
                    let curTime = 0;
                    if (window.HostBridge) {
                        const seqInfo = await window.HostBridge.getSequenceInfo();
                        if (seqInfo && typeof seqInfo.time === "number") curTime = seqInfo.time;
                    }
                    if (curTime <= 0) curTime = (this.allTapWords[this.tapWordIndex].word.start || 0) + 0.1;

                    const curItem = this.allTapWords[this.tapWordIndex];
                    curItem.word.start = Number(curTime.toFixed(3));
                    if (this.tapWordIndex > 0) {
                        const prevItem = this.allTapWords[this.tapWordIndex - 1];
                        prevItem.word.end = Number(curTime.toFixed(3));
                        prevItem.word.pause_after_ms = 0;
                    }

                    this.tapWordIndex++;
                    if (this.tapWordIndex < this.allTapWords.length) {
                        const nextWord = this.allTapWords[this.tapWordIndex].word.word;
                        if (infoEl) infoEl.innerHTML = `<b style="color: #fbbf24;">🔴 Tap-Sinxron faol!</b> Keyingi so'z: <b style="color: #4ade80;">"${nextWord}"</b> (${this.tapWordIndex + 1}/${this.allTapWords.length})`;
                    } else {
                        this.toggleTapSync();
                    }
                    this.renderWaveformView();
                }
            };

            window.addEventListener("keydown", this.tapKeyHandler);
        } else {
            if (btn) {
                btn.textContent = "🎙️ Tap-Sinxron";
                btn.classList.remove("tap-sync-active");
            }
            if (this.tapKeyHandler) {
                window.removeEventListener("keydown", this.tapKeyHandler);
                this.tapKeyHandler = null;
            }
            const infoEl = document.getElementById("waveformTimeInfo");
            if (infoEl) {
                infoEl.textContent = "💡 Maslahat: So‘z blokini bosib playhead'ni sakratishingiz yoki chegarasini tortishingiz mumkin.";
            }
            this.render();
        }
    },

    /**
     * So'zlar vaqt logi oynasini ochish (STT raw vaqtlari vs Timeline offset)
     */
    openTimeLogModal() {
        const modal = document.getElementById("timeLogModal");
        const container = document.getElementById("timeLogTableContainer");
        const summaryText = document.getElementById("timeLogSummaryText");
        if (!modal || !container) return;

        if (!this.segments || this.segments.length === 0) {
            alert("Vaqt logini ko'rish uchun avval subtitrlar yuklangan bo'lishi kerak!");
            return;
        }

        const rows = [];
        let totalWords = 0;
        let clampedCount = 0;

        for (let sIdx = 0; sIdx < this.segments.length; sIdx++) {
            const seg = this.segments[sIdx];
            const words = seg.words || [];
            for (let wIdx = 0; wIdx < words.length; wIdx++) {
                totalWords++;
                const w = words[wIdx];
                const rawStart = (typeof w.raw_start === "number") ? w.raw_start : w.start;
                const rawEnd = (typeof w.raw_end === "number") ? w.raw_end : w.end;
                const tlStart = (typeof w.start === "number") ? w.start : 0;
                const tlEnd = (typeof w.end === "number") ? w.end : 0;
                const durMs = Math.max(0, Math.round((tlEnd - tlStart) * 1000));
                const isClamped = w.clamped === true;
                if (isClamped) clampedCount++;

                rows.push({
                    idx: totalWords,
                    segId: seg.id || (sIdx + 1),
                    word: w.word,
                    rawStart: (typeof rawStart === "number") ? rawStart.toFixed(3) : "0.000",
                    rawEnd: (typeof rawEnd === "number") ? rawEnd.toFixed(3) : "0.000",
                    tlStart: (typeof tlStart === "number") ? tlStart.toFixed(3) : "0.000",
                    tlEnd: (typeof tlEnd === "number") ? tlEnd.toFixed(3) : "0.000",
                    durMs: durMs,
                    clamped: isClamped
                });
            }
        }

        if (summaryText) {
            summaryText.textContent = `Jami so'zlar: ${totalWords} ta | Klip chegarasiga qirqilgan: ${clampedCount} ta`;
        }

        let tableHtml = `
            <table style="width: 100%; border-collapse: collapse; text-align: left;">
                <thead>
                    <tr style="background: rgba(255,255,255,0.06); color: #94a3b8; font-size: 10px; border-bottom: 1px solid var(--border-color);">
                        <th style="padding: 6px 8px;">#</th>
                        <th style="padding: 6px 8px;">So'z</th>
                        <th style="padding: 6px 8px;">STT Asl Vaqt</th>
                        <th style="padding: 6px 8px;">Timeline Vaqti</th>
                        <th style="padding: 6px 8px;">Davomiylik</th>
                        <th style="padding: 6px 8px;">Holati</th>
                    </tr>
                </thead>
                <tbody>
        `;

        let plainTextLog = "№\tSo'z\tSTT Asl Vaqt\tTimeline Vaqti\tDavomiylik\tHolat\n";

        for (let r = 0; r < rows.length; r++) {
            const item = rows[r];
            const badge = item.clamped 
                ? `<span style="background: rgba(239, 68, 68, 0.2); color: #f87171; padding: 2px 5px; border-radius: 3px; font-size: 9px; font-weight: bold;">⚠️ Clamped</span>`
                : `<span style="background: rgba(34, 197, 94, 0.2); color: #4ade80; padding: 2px 5px; border-radius: 3px; font-size: 9px;">🟢 OK</span>`;
            
            const trBg = (r % 2 === 0) ? "transparent" : "rgba(255,255,255,0.02)";

            tableHtml += `
                <tr style="background: ${trBg}; border-bottom: 1px solid rgba(255,255,255,0.04);">
                    <td style="padding: 4px 8px; color: #64748b;">${item.idx}</td>
                    <td style="padding: 4px 8px; color: #f1f5f9; font-weight: 600;">${window.UzbekUtils.escapeHtml(item.word)}</td>
                    <td style="padding: 4px 8px; color: #38bdf8;">${item.rawStart}s - ${item.rawEnd}s</td>
                    <td style="padding: 4px 8px; color: #a78bfa; font-weight: 500;">${item.tlStart}s - ${item.tlEnd}s</td>
                    <td style="padding: 4px 8px; color: #94a3b8;">${item.durMs} ms</td>
                    <td style="padding: 4px 8px;">${badge}</td>
                </tr>
            `;

            plainTextLog += `${item.idx}\t${item.word}\t${item.rawStart}s - ${item.rawEnd}s\t${item.tlStart}s - ${item.tlEnd}s\t${item.durMs}ms\t${item.clamped ? "Clamped" : "OK"}\n`;
        }

        tableHtml += `</tbody></table>`;
        container.innerHTML = tableHtml;

        this._lastTimeLogText = plainTextLog;
        modal.style.display = "flex";

        const btnClose = document.getElementById("btnCloseTimeLogModal");
        const btnCloseBottom = document.getElementById("btnCloseTimeLogModalBottom");
        const btnCopy = document.getElementById("btnCopyTimeLogTable");

        const closeModal = () => { modal.style.display = "none"; };
        if (btnClose) btnClose.onclick = closeModal;
        if (btnCloseBottom) btnCloseBottom.onclick = closeModal;

        if (btnCopy) {
            btnCopy.onclick = () => {
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(this._lastTimeLogText).then(() => {
                        alert("✅ Vaqt logi jadvali buferga (clipboard) nusxalandi!");
                    }).catch(() => {
                        prompt("Logni nusxalang (Ctrl+C):", this._lastTimeLogText);
                    });
                } else {
                    prompt("Logni nusxalang (Ctrl+C):", this._lastTimeLogText);
                }
            };
        }
    },

    /**
     * Aktiv yoki tanlangan segmentni ovoz energiyasi bilan qayta tahlil qilish
     */
    async reanalyzeCurrentSegment() {
        if (!this.segments || this.segments.length === 0) {
            alert("Subtitrlar mavjud emas!");
            return;
        }

        let targetIdx = 0;
        if (this.activeSegmentIndex !== undefined && this.activeSegmentIndex >= 0 && this.activeSegmentIndex < this.segments.length) {
            targetIdx = this.activeSegmentIndex;
        } else if (window.HostBridge) {
            try {
                const sInfo = await window.HostBridge.getSequenceInfo();
                if (sInfo && typeof sInfo.time === "number") {
                    const found = this.segments.findIndex(s => sInfo.time >= s.start && sInfo.time <= s.end);
                    if (found !== -1) targetIdx = found;
                }
            } catch (eSeq) {}
        }

        const seg = this.segments[targetIdx];
        if (!seg || !seg.words || seg.words.length === 0) {
            alert("Segmentda so'zlar topilmadi!");
            return;
        }

        let mediaPath = null;
        if (window.HostBridge) {
            const mediaRes = await window.HostBridge.getSelectedMediaSource();
            if (mediaRes && mediaRes.filePath) mediaPath = mediaRes.filePath;
        }

        const btn = document.getElementById("btnReanalyzeSegment");
        if (btn) btn.textContent = "⏳ Tahlil...";

        try {
            const res = await window.SubtitleAPI.realignWords(seg.words, mediaPath, 200.0);
            if (res && res.words && res.words.length > 0) {
                seg.words = res.words;
                seg.start = seg.words[0].start;
                seg.end = seg.words[seg.words.length - 1].end;
                this.render();
                alert(`✅ #${targetIdx + 1}-segment (${seg.text}) qayta tahlil qilindi va vaqtlari tekislandi!`);
            }
        } catch (e) {
            alert("Segmentni qayta tahlil qilishda xatolik: " + e.message);
        } finally {
            if (btn) btn.textContent = "🔄 Qayta tahlil";
        }
    }
};

if (typeof document !== "undefined") {
    const attachTimeLogBtn = () => {
        const btnOpen = document.getElementById("btnOpenTimeLog");
        if (btnOpen) {
            btnOpen.onclick = () => {
                SubtitleEditor.openTimeLogModal();
            };
        }
    };
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", attachTimeLogBtn);
    } else {
        attachTimeLogBtn();
    }
}

window.SubtitleEditor = SubtitleEditor;
