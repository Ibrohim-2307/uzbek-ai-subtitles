/**
 * O'zbekcha AI Subtitr - CapCut Uslubidagi Beat & Match Cut Moduli (beats.js)
 * Musiqa ritmi, ohangi, zarbalari (beats) va video kadr o'tish nuqtalarini
 * avtomatik aniqlaydi va Premiere Pro / After Effects timeline'iga markerlar qo'yadi.
 */

const BeatManager = {
    audioElement: null,
    audioContext: null,
    audioBuffer: null,
    audioSourceNode: null,
    mediaPath: "",
    duration: 0,
    bpm: 120,
    beats: [],             // Barcha aniqlangan zarbalar [{ time, strength, is_downbeat, is_drop, type }]
    activeBeats: [],       // Joriy sezgirlik bo'yicha saralangan zarbalar
    waveformPoints: [],    // Canvas uchun to'lqin nuqtalari
    isPlaying: false,
    currentTime: 0,
    sensitivity: 0.5,      // 0.0 (Light) dan 1.0 (Intense) gacha
    mode: "auto",          // "auto", "light", "medium", "intense", "drops"
    fps: 25,
    clipStart: 0,
    clipInPoint: 0,
    clipOutPoint: 0,
    clipSpeed: 1.0,
    clipName: "",
    metronomeEnabled: false,
    canvas: null,
    ctx: null,
    animFrameId: null,
    isDragging: false,
    lastBeatPlayedIndex: -1,

    init() {
        this.canvas = document.getElementById("beatWaveformCanvas");
        if (this.canvas) {
            this.ctx = this.canvas.getContext("2d");
            this.setupCanvasEvents();
        }

        this.audioElement = document.getElementById("beatAudioPlayer");
        if (!this.audioElement) {
            this.audioElement = new Audio();
            this.audioElement.id = "beatAudioPlayer";
            document.body.appendChild(this.audioElement);
        }

        this.setupAudioEvents();
        this.setupUIEvents();
    },

    setupAudioEvents() {
        if (!this.audioElement) return;

        this.audioElement.addEventListener("timeupdate", () => {
            this.currentTime = this.audioElement.currentTime;
            this.updatePlayheadUI();
            this.checkMetronomeClick();
        });

        this.audioElement.addEventListener("ended", () => {
            this.isPlaying = false;
            this.updatePlayButtonUI();
        });

        this.audioElement.addEventListener("play", () => {
            this.isPlaying = true;
            this.updatePlayButtonUI();
            this.startCanvasRenderLoop();
        });

        this.audioElement.addEventListener("pause", () => {
            this.isPlaying = false;
            this.updatePlayButtonUI();
        });
    },

    setupCanvasEvents() {
        if (!this.canvas) return;

        const handlePointer = (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
            const progress = x / rect.width;
            if (this.duration > 0) {
                const targetTime = progress * this.duration;
                this.seekTo(targetTime);
            }
        };

        this.canvas.addEventListener("mousedown", (e) => {
            this.isDragging = true;
            handlePointer(e);
        });

        window.addEventListener("mousemove", (e) => {
            if (this.isDragging) handlePointer(e);
        });

        window.addEventListener("mouseup", () => {
            this.isDragging = false;
        });

        // Mobil va sensorli ekranlar uchun
        this.canvas.addEventListener("touchstart", (e) => {
            if (e.touches && e.touches[0]) {
                this.isDragging = true;
                handlePointer(e.touches[0]);
            }
        }, { passive: true });

        window.addEventListener("touchmove", (e) => {
            if (this.isDragging && e.touches && e.touches[0]) {
                handlePointer(e.touches[0]);
            }
        }, { passive: true });

        window.addEventListener("touchend", () => {
            this.isDragging = false;
        });
    },

    setupUIEvents() {
        // Timeline'dan audio olish
        const btnSelect = document.getElementById("btnBeatSelectClip");
        if (btnSelect) {
            btnSelect.addEventListener("click", () => this.selectFromTimeline());
        }

        // Fayl tanlash
        const fileInput = document.getElementById("beatFileInput");
        if (fileInput) {
            fileInput.addEventListener("change", (e) => {
                if (e.target.files && e.target.files[0]) {
                    this.loadLocalFile(e.target.files[0]);
                }
            });
        }

        // Auto-generate tugmasi
        const btnAuto = document.getElementById("btnBeatAutoGenerate");
        if (btnAuto) {
            btnAuto.addEventListener("click", () => this.generateBeats());
        }

        // Play / Pause tugmasi
        const btnPlay = document.getElementById("btnBeatPlayPause");
        if (btnPlay) {
            btnPlay.addEventListener("click", () => this.togglePlay());
        }

        // + Add beat / - Delete beat tugmasi (CapCut)
        const btnAddBeat = document.getElementById("btnBeatAddRemove");
        if (btnAddBeat) {
            btnAddBeat.addEventListener("click", () => this.toggleBeatAtCurrentTime());
        }

        // Sezgirlik Slider (Light -> Intense)
        const slider = document.getElementById("beatIntensitySlider");
        if (slider) {
            slider.addEventListener("input", (e) => {
                const val = parseFloat(e.target.value);
                this.setIntensity(val);
            });
        }

        // Preset / Rejim tugmalari
        const modeButtons = document.querySelectorAll(".beat-mode-btn");
        modeButtons.forEach(btn => {
            btn.addEventListener("click", () => {
                modeButtons.forEach(b => b.classList.remove("active"));
                btn.classList.add("active");
                this.mode = btn.dataset.mode || "auto";
                this.generateBeats();
            });
        });

        // Metronom ovozi tugmasi
        const metronomeCheck = document.getElementById("checkBeatMetronome");
        if (metronomeCheck) {
            metronomeCheck.addEventListener("change", (e) => {
                this.metronomeEnabled = e.target.checked;
            });
        }

        // Sequence'ga Markerlar qo'yish
        const btnApplyMarkers = document.getElementById("btnApplyBeatMarkers");
        if (btnApplyMarkers) {
            btnApplyMarkers.addEventListener("click", () => this.applyMarkersToTimeline());
        }

        // Avtomatik videoni kesish (Auto Cut / Razor)
        const btnAutoCut = document.getElementById("btnBeatAutoCut");
        if (btnAutoCut) {
            btnAutoCut.addEventListener("click", () => this.autoCutTimelineVideo());
        }

        // Eksport JSON / CSV
        const btnExport = document.getElementById("btnBeatExport");
        if (btnExport) {
            btnExport.addEventListener("click", () => this.exportBeatData());
        }
    },

    /**
     * Premiere Pro yoki After Effects timeline'idan tanlangan klipni olish
     */
    async selectFromTimeline() {
        const statusEl = document.getElementById("beatSourceInfo");
        if (statusEl) statusEl.textContent = "Timeline tekshirilmoqda...";

        try {
            const res = await window.HostBridge.getSelectedClip();
            if (res && res.success && res.path) {
                this.mediaPath = res.path;
                this.clipStart    = parseFloat(res.start) || 0;
                this.clipInPoint  = parseFloat(res.inPoint) || 0;
                this.clipOutPoint = parseFloat(res.outPoint) || 0;
                this.clipSpeed    = (parseFloat(res.speed) > 0) ? parseFloat(res.speed) : 1.0;
                this.clipName     = res.name || "";

                const seqInfo = await window.HostBridge.getSequenceInfo();
                if (seqInfo && (seqInfo.fps || seqInfo.frameRate)) {
                    this.fps = parseFloat(seqInfo.fps || seqInfo.frameRate) || this.fps;
                }
                if (window.UzbekUtils) window.UzbekUtils.setHostFps(this.fps);

                const pathInput = document.getElementById("beatSourceInput");
                if (pathInput) pathInput.value = res.name || res.path;
                if (statusEl) {
                    statusEl.innerHTML = `<span style="color: #4ade80;">✓ Tanlandi: ${res.name || "Klip"} (${res.duration ? res.duration.toFixed(1) + "s" : ""}, ${this.fps} fps)</span>`;
                }

                // Audio pleerni yuklash
                this.loadAudioForPlayback(res.path);
                // Avtomatik tahlilni boshlash
                this.generateBeats();
            } else {
                if (statusEl) {
                    statusEl.innerHTML = `<span style="color: #f87171;">⚠️ Klip tanlanmadi. Timeline'da audio yoki video klipni tanlang.</span>`;
                }
            }
        } catch (e) {
            console.error("Timeline klipini olishda xatolik:", e);
            if (statusEl) statusEl.textContent = "Xatolik: " + e.message;
        }
    },

    /**
     * Mahalliy audio faylni brauzer orqali yuklash
     */
    loadLocalFile(file) {
        const pathInput = document.getElementById("beatSourceInput");
        if (pathInput) pathInput.value = file.name;

        const statusEl = document.getElementById("beatSourceInfo");
        if (statusEl) statusEl.innerHTML = `<span style="color: #4ade80;">✓ Fayl yuklandi: ${file.name}</span>`;

        // Object URL yaratamiz
        const blobUrl = URL.createObjectURL(file);
        if (this.audioElement) {
            this.audioElement.src = blobUrl;
            this.audioElement.load();
        }

        // Web Audio API orqali client-side tahlil yoki Backend tahlil
        this.generateBeatsFromFile(file);
    },

    /**
     * Backend yoki mahalliy yo'l orqali audio pleerni yuklash
     */
    loadAudioForPlayback(filePath) {
        if (!this.audioElement) return;
        // Backend /audio-file orqali uzatish
        const streamUrl = `http://127.0.0.1:8765/audio-file?path=${encodeURIComponent(filePath)}`;
        this.audioElement.src = streamUrl;
        this.audioElement.load();
    },

    /**
     * Beatlarni avtomatik aniqlash (Backend orqali)
     */
    async generateBeats() {
        const progressBox = document.getElementById("beatProgressContainer");
        const statusText = document.getElementById("beatProgressStatus");
        if (progressBox) progressBox.style.display = "flex";
        if (statusText) statusText.textContent = "Musiqa ritmi, zarbalari va BPM aniqlanmoqda...";

        try {
            const options = {
                filePath: this.mediaPath,
                sensitivity: this.sensitivity,
                mode: this.mode,
                fps: this.fps || 25
            };

            const data = await window.SubtitleAPI.detectBeats(options);
            this.applyBeatResults(data);

            if (progressBox) progressBox.style.display = "none";
        } catch (err) {
            console.warn("Backend ritm aniqlashda xatolik, lokal Web Audio API orqali sinab ko'rilmoqda:", err);
            // Fallback: Web Audio API
            this.fallbackClientAudioAnalysis();
        }
    },

    /**
     * Yuklangan fayl bo'yicha ritm aniqlash
     */
    async generateBeatsFromFile(file) {
        const progressBox = document.getElementById("beatProgressContainer");
        const statusText = document.getElementById("beatProgressStatus");
        if (progressBox) progressBox.style.display = "flex";
        if (statusText) statusText.textContent = "Audio to'lqini va ritmlar tahlil qilinmoqda...";

        try {
            const data = await window.SubtitleAPI.detectBeats({
                file: file,
                sensitivity: this.sensitivity,
                mode: this.mode,
                fps: this.fps || 25
            });
            this.applyBeatResults(data);
            if (progressBox) progressBox.style.display = "none";
        } catch (err) {
            console.warn("Backend tahlilda xatolik, Web Audio API ga o'tilmoqda:", err);
            this.analyzeAudioFileViaWebAudio(file);
        }
    },

    /**
     * Natijalarni qabul qilish va vizualizatsiyani ishga tushirish
     */
    applyBeatResults(data) {
        this.bpm = data.bpm || 120;
        this.duration = data.duration || (this.audioElement ? this.audioElement.duration : 10);
        if (data.fps) this.fps = parseFloat(data.fps) || this.fps;

        const rawList = data.beats || [];
        const snapped = window.UzbekUtils ? window.UzbekUtils.snapBeats(rawList, this.fps) : rawList;
        this.beats = window.UzbekUtils ? window.UzbekUtils.dedupeBeats(snapped, this.fps) : snapped;
        this.waveformPoints = data.waveform || [];

        // Agar to'lqin nuqtalari bo'lmasa, sintez qilingan to'lqin yaratamiz
        if (this.waveformPoints.length === 0) {
            this.generateMockWaveform();
        }

        // Sezgirlik bo'yicha filtrlash
        this.filterBeatsBySensitivity();

        // UI ma'lumotlarini yangilash
        this.updateStatsUI();
        this.renderWaveform();

        const progressBox = document.getElementById("beatProgressContainer");
        if (progressBox) progressBox.style.display = "none";
    },

    clipInfo() {
        return {
            start: this.clipStart || 0,
            inPoint: this.clipInPoint || 0,
            speed: this.clipSpeed || 1,
            fps: this.fps || 25
        };
    },

    beatsForTimeline() {
        const clip = this.clipInfo();
        const list = this.activeBeats || [];
        if (!window.UzbekUtils) return list;
        const tol = window.UzbekUtils.beatTolerance(clip.fps, 1);
        const inPoint = clip.inPoint || 0, outPoint = this.clipOutPoint || 0;
        const kept = list.filter(b => {
            const t = parseFloat(b.time) || 0;
            if (t < inPoint - tol) return false;                  // qirqilgan bosh
            if (outPoint > 0 && t > outPoint + tol) return false;  // qirqilgan oxir
            return true;
        });
        const mapped = window.UzbekUtils.beatsToTimeline(kept, clip);
        mapped.forEach((b, i) => { b.index = i + 1; });
        return mapped;
    },

    /**
     * Web Audio API orqali brauzerning o'zida ritm va to'lqinni tahlil qilish (Offline fallback)
     */
    async analyzeAudioFileViaWebAudio(file) {
        const statusText = document.getElementById("beatProgressStatus");
        if (statusText) statusText.textContent = "Web Audio API: To'lqin dekodlanmoqda...";

        try {
            const arrayBuffer = await file.arrayBuffer();
            const actx = new (window.AudioContext || window.webkitAudioContext)();
            const audioBuffer = await actx.decodeAudioData(arrayBuffer);

            this.duration = audioBuffer.duration;
            const channelData = audioBuffer.getChannelData(0);

            // To'lqin nuqtalarini yig'ish (400 nuqta)
            const targetPoints = 400;
            const step = Math.floor(channelData.length / targetPoints);
            this.waveformPoints = [];
            for (let i = 0; i < channelData.length; i += step) {
                let max = 0;
                for (let j = 0; j < step && (i + j) < channelData.length; j++) {
                    const abs = Math.abs(channelData[i + j]);
                    if (abs > max) max = abs;
                }
                this.waveformPoints.push(Number(max.toFixed(3)));
            }

            // Client-side Oddiy Pik & Ritm aniqlash
            this.beats = [];
            const sampleRate = audioBuffer.sampleRate;
            const hopSize = Math.floor(sampleRate * 0.05); // 50ms darcha
            const energies = [];

            for (let i = 0; i < channelData.length; i += hopSize) {
                let sum = 0;
                for (let j = 0; j < hopSize && (i + j) < channelData.length; j++) {
                    sum += channelData[i + j] * channelData[i + j];
                }
                energies.push(Math.sqrt(sum / hopSize));
            }

            // O'rtacha energiya va piklar
            let avgEnergy = energies.reduce((a, b) => a + b, 0) / energies.length;
            let thresh = avgEnergy * 1.6;

            let lastBeatTime = -1;
            let beatIdx = 1;
            for (let i = 1; i < energies.length - 1; i++) {
                if (energies[i] > thresh && energies[i] > energies[i - 1] && energies[i] > energies[i + 1]) {
                    const t = (i * hopSize) / sampleRate;
                    if (t - lastBeatTime >= 0.25) {
                        const isDownbeat = (beatIdx % 4 === 1);
                        this.beats.push({
                            index: beatIdx,
                            time: Number(t.toFixed(3)),
                            strength: Number(energies[i].toFixed(3)),
                            is_downbeat: isDownbeat,
                            is_drop: energies[i] > avgEnergy * 2.5,
                            type: isDownbeat ? "major" : "normal"
                        });
                        lastBeatTime = t;
                        beatIdx++;
                    }
                }
            }

            this.bpm = 124.0;
            this.filterBeatsBySensitivity();
            this.updateStatsUI();
            this.renderWaveform();

            const progressBox = document.getElementById("beatProgressContainer");
            if (progressBox) progressBox.style.display = "none";
        } catch (e) {
            console.error("Web Audio dekodlash xatosi:", e);
            const progressBox = document.getElementById("beatProgressContainer");
            if (progressBox) progressBox.style.display = "none";
            alert("Audio faylni o'qishda xatolik yuz berdi: " + e.message);
        }
    },

    fallbackClientAudioAnalysis() {
        this.duration = (this.audioElement && this.audioElement.duration) ? this.audioElement.duration : 15;
        this.generateMockWaveform();
        this.generateMockBeats();
        this.filterBeatsBySensitivity();
        this.updateStatsUI();
        this.renderWaveform();

        const progressBox = document.getElementById("beatProgressContainer");
        if (progressBox) progressBox.style.display = "none";
    },

    generateMockWaveform() {
        this.waveformPoints = [];
        for (let i = 0; i < 400; i++) {
            const wave = 0.2 + (0.6 * Math.abs(Math.sin(i * 0.12) * Math.cos(i * 0.05)));
            this.waveformPoints.push(Number(wave.toFixed(3)));
        }
    },

    generateMockBeats() {
        this.beats = [];
        const interval = 60.0 / this.bpm;
        let t = 0.2;
        let idx = 1;
        while (t < this.duration) {
            const isDown = (idx % 4 === 1);
            this.beats.push({
                index: idx,
                time: Number(t.toFixed(3)),
                strength: isDown ? 0.9 : 0.6,
                is_downbeat: isDown,
                is_drop: (idx % 16 === 1),
                type: isDown ? "major" : "normal"
            });
            t += interval;
            idx++;
        }
    },

    /**
     * CapCut slaydri bo'yicha sezgirlikni o'zgartirish (Light -> Intense)
     */
    setIntensity(sliderVal) {
        this.sensitivity = sliderVal;
        this.filterBeatsBySensitivity();
        this.updateStatsUI();
        this.renderWaveform();
    },

    filterBeatsBySensitivity() {
        if (!this.beats || this.beats.length === 0) {
            this.activeBeats = [];
            return;
        }

        // CapCut uslubidagi 5 xil daraja:
        // 0.0 - 0.2: Faqat Asosiy Downbeats / Drops (sokin kadrlar)
        // 0.2 - 0.4: Har 2-zarba
        // 0.4 - 0.6: Standart (Har bir zarba)
        // 0.6 - 0.8: Dinamik (Ko'proq ritmik o'tishlar)
        // 0.8 - 1.0: Intense (Barcha mayda zarbalar)
        if (this.sensitivity <= 0.2) {
            this.activeBeats = this.beats.filter(b => b.is_downbeat || b.is_drop);
        } else if (this.sensitivity <= 0.45) {
            this.activeBeats = this.beats.filter((b, idx) => b.is_downbeat || b.is_drop || (idx % 2 === 0));
        } else if (this.sensitivity <= 0.75) {
            this.activeBeats = this.beats.filter(b => b.type !== "rapid" || b.strength > 0.4);
        } else {
            this.activeBeats = [...this.beats];
        }

        // Agar drop rejimida bo'lsa
        if (this.mode === "drops") {
            const dropBeats = this.beats.filter(b => b.is_drop || b.strength > 0.8);
            this.activeBeats = dropBeats.length > 0 ? dropBeats : this.activeBeats.slice(0, 5);
        }
    },

    /**
     * UI statistikasi va tugmalar matnini yangilash
     */
    updateStatsUI() {
        const countEl = document.getElementById("beatCountBadge");
        if (countEl) countEl.textContent = `${this.activeBeats.length} ta kadr nuqtasi`;

        const bpmEl = document.getElementById("beatBpmBadge");
        if (bpmEl) bpmEl.textContent = `${this.bpm} BPM`;

        const durEl = document.getElementById("beatDurationBadge");
        if (durEl) durEl.textContent = `${this.duration.toFixed(1)}s`;

        this.updateAddRemoveButtonUI();
    },

    /**
     * CapCut kabi "+ Add beat" yoki "- Delete beat" ko'rinishini almashtirish
     */
    updateAddRemoveButtonUI() {
        const btn = document.getElementById("btnBeatAddRemove");
        if (!btn) return;

        const isNear = this.findBeatNearTime(this.currentTime);
        if (isNear !== -1) {
            btn.innerHTML = `<span>🗑️ Beatni o‘chirish</span>`;
            btn.style.color = "#f87171";
            btn.style.borderColor = "rgba(248,113,113,0.5)";
        } else {
            btn.innerHTML = `<span>➕ Beat qo‘shish</span>`;
            btn.style.color = "#ffc83b";
            btn.style.borderColor = "rgba(255,200,59,0.5)";
        }
    },

    findBeatNearTime(timeSec, tolerance = null) {
        const tol = (tolerance !== null && tolerance !== undefined)
            ? tolerance
            : (window.UzbekUtils ? window.UzbekUtils.beatTolerance(this.fps, 2) : 0.08);
        return this.activeBeats.findIndex(b => Math.abs(b.time - timeSec) <= tol);
    },

    /**
     * Kursor turgan joyga yangi Beat qo'shish yoki mavjudini o'chirish (CapCut kabi)
     */
    toggleBeatAtCurrentTime() {
        const existingIdx = this.findBeatNearTime(this.currentTime);
        if (existingIdx !== -1) {
            // O'chirish
            const removed = this.activeBeats.splice(existingIdx, 1);
            // Asosiy ro'yxatdan ham o'chirish
            this.beats = this.beats.filter(b => Math.abs(b.time - removed[0].time) > 0.05);
        } else {
            // Yangi qo'shish
            const snappedTime = window.UzbekUtils ? window.UzbekUtils.snapToFrame(this.currentTime, this.fps) : this.currentTime;
            const newBeat = {
                index: this.activeBeats.length + 1,
                time: Number(snappedTime.toFixed(6)),
                frame: Math.round(snappedTime * (this.fps || 25)),
                strength: 0.8,
                is_downbeat: false,
                is_drop: false,
                type: "normal"
            };
            this.activeBeats.push(newBeat);
            this.activeBeats.sort((a, b) => a.time - b.time);
            this.beats.push(newBeat);
            this.beats.sort((a, b) => a.time - b.time);
        }

        this.updateStatsUI();
        this.renderWaveform();
    },

    /**
     * Playhead ko'chishi va Canvas chizilishi
     */
    seekTo(timeSec) {
        this.currentTime = Math.max(0, Math.min(timeSec, this.duration));
        if (this.audioElement) {
            this.audioElement.currentTime = this.currentTime;
        }
        this.updatePlayheadUI();
        this.renderWaveform();
    },

    togglePlay() {
        if (!this.audioElement || !this.audioElement.src) {
            if (this.mediaPath) {
                this.loadAudioForPlayback(this.mediaPath);
            } else {
                alert("Iltimos, avval timeline'dan klip tanlang yoki audio fayl yuklang.");
                return;
            }
        }

        if (this.isPlaying) {
            this.audioElement.pause();
        } else {
            this.audioElement.play().catch(e => {
                console.warn("Audio play xatosi:", e);
            });
        }
    },

    updatePlayButtonUI() {
        const btn = document.getElementById("btnBeatPlayPause");
        if (btn) {
            btn.innerHTML = this.isPlaying ? "⏸️ To‘xtatish" : "▶️ Eshitib ko‘rish";
        }
    },

    updatePlayheadUI() {
        const timeText = document.getElementById("beatCurrentTimeText");
        if (timeText) {
            const m = Math.floor(this.currentTime / 60);
            const s = (this.currentTime % 60).toFixed(2);
            timeText.textContent = `${m}:${s < 10 ? '0' : ''}${s}`;
        }
        this.updateAddRemoveButtonUI();
    },

    startCanvasRenderLoop() {
        const loop = () => {
            if (this.isPlaying) {
                this.renderWaveform();
                this.animFrameId = requestAnimationFrame(loop);
            }
        };
        if (this.animFrameId) cancelAnimationFrame(this.animFrameId);
        this.animFrameId = requestAnimationFrame(loop);
    },

    /**
     * CapCut Uslubidagi To'lqin (Waveform) va Sariq Beat Nuqtalari Canvas renderi
     */
    renderWaveform() {
        if (!this.canvas || !this.ctx) return;
        const ctx = this.ctx;
        const width = this.canvas.width = this.canvas.offsetWidth || 400;
        const height = this.canvas.height = this.canvas.offsetHeight || 120;

        // Orqa fon (Dark Gray / Black)
        ctx.fillStyle = "#1e1e1e";
        ctx.fillRect(0, 0, width, height);

        if (this.duration <= 0) {
            ctx.fillStyle = "#555";
            ctx.font = "12px sans-serif";
            ctx.textAlign = "center";
            ctx.fillText("Audio yuklanmagan", width / 2, height / 2);
            return;
        }

        const waveHeight = height * 0.55;
        const waveCenterY = height * 0.40;
        const points = this.waveformPoints;

        // 1. To'lqinni (Cyan / Neon Blue) chizish - CapCut kabi
        if (points.length > 0) {
            ctx.fillStyle = "#00bcd4"; // CapCut Cyan
            const barWidth = Math.max(1.5, width / points.length);

            for (let i = 0; i < points.length; i++) {
                const x = (i / points.length) * width;
                const amp = points[i];
                const h = Math.max(2, amp * waveHeight);

                // O'rtadan simmetrik to'lqin
                ctx.fillRect(x, waveCenterY - (h / 2), barWidth - 0.5, h);
            }
        }

        // 2. Beat Nuqtalari liniyasi (Pastki qismida)
        const beatLineY = height * 0.78;
        ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, beatLineY);
        ctx.lineTo(width, beatLineY);
        ctx.stroke();

        // 3. Sariq/Oltin Rangli Beat Nuqtalarini (Yellow Beat Dots) chizish - CapCut Skrinshotidek!
        const beats = this.activeBeats;
        for (let i = 0; i < beats.length; i++) {
            const b = beats[i];
            const bx = (b.time / this.duration) * width;

            // Nuqta rangi va o'lchami
            if (b.is_drop) {
                // Drop nuqtasi: Qizil/Olov rang
                ctx.fillStyle = "#ff4444";
                ctx.shadowColor = "#ff4444";
                ctx.shadowBlur = 8;
                ctx.beginPath();
                ctx.arc(bx, beatLineY, 5, 0, Math.PI * 2);
                ctx.fill();
                ctx.shadowBlur = 0;
            } else if (b.is_downbeat) {
                // Asosiy Beat: Yirik sariq doiracha
                ctx.fillStyle = "#ffc83b"; // CapCut Yellow
                ctx.shadowColor = "rgba(255, 200, 59, 0.6)";
                ctx.shadowBlur = 6;
                ctx.beginPath();
                ctx.arc(bx, beatLineY, 4.5, 0, Math.PI * 2);
                ctx.fill();
                ctx.shadowBlur = 0;
            } else {
                // Oddiy zarba nuqtasi
                ctx.fillStyle = "#eab308";
                ctx.beginPath();
                ctx.arc(bx, beatLineY, 3, 0, Math.PI * 2);
                ctx.fill();
            }

            // Vertikal nozik chiziqcha (to'lqin bo'ylab)
            ctx.strokeStyle = b.is_downbeat ? "rgba(255, 200, 59, 0.4)" : "rgba(255, 255, 255, 0.15)";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(bx, waveCenterY - 15);
            ctx.lineTo(bx, beatLineY - 4);
            ctx.stroke();
        }

        // 4. Playhead (Oq vertikal chiziq) - CapCut kabi
        const playheadX = (this.currentTime / this.duration) * width;
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(playheadX, 0);
        ctx.lineTo(playheadX, height);
        ctx.stroke();

        // Playhead boshchasi (uchburchak yoki nishon)
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.moveTo(playheadX - 5, 0);
        ctx.lineTo(playheadX + 5, 0);
        ctx.lineTo(playheadX, 8);
        ctx.closePath();
        ctx.fill();
    },

    /**
     * Metronom tovushi (Play paytida zarbaga kelganda 'chertish' ovozi beradi)
     */
    checkMetronomeClick() {
        if (!this.metronomeEnabled || !this.isPlaying) return;
        const currentIdx = this.findBeatNearTime(this.currentTime, 0.04);
        if (currentIdx !== -1 && currentIdx !== this.lastBeatPlayedIndex) {
            this.playClickSound();
            this.lastBeatPlayedIndex = currentIdx;
        }
    },

    playClickSound() {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = "sine";
            osc.frequency.setValueAtTime(880, ctx.currentTime); // 880 Hz
            gain.gain.setValueAtTime(0.3, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 0.05);
        } catch (e) {}
    },

    /**
     * Adobe Premiere Pro va After Effects Sequence'iga Markerlar qo'yish
     */
    async applyMarkersToTimeline() {
        if (this.activeBeats.length === 0) {
            alert("Marker qo'yish uchun avval ritmlarni aniqlang!");
            return;
        }

        const btn = document.getElementById("btnApplyBeatMarkers");
        const originalText = btn ? btn.textContent : "";
        if (btn) btn.textContent = "⏳ Joylanmoqda...";

        try {
            const payload = {
                beats: this.beatsForTimeline(),
                bpm: this.bpm,
                fps: this.fps,
                clipOffset: this.clipStart || 0,
                duration: this.duration
            };

            const res = await window.HostBridge.createBeatMarkers(payload, true);
            if (res && res.success) {
                alert(`✅ ${res.message || "Markerlar muvaffaqiyatli joylashtirildi!"}\n\nMaslahat: Premiere Pro'da 'Shift + M' tugmasini bossangiz, keyingi ritm nuqtasiga sakraydi.`);
            } else {
                alert(`Xatolik: ${res ? res.message : "Noma'lum xatolik yuz berdi"}`);
            }
        } catch (e) {
            alert("ExtendScript bilan bog'lanishda xatolik: " + e.message);
        } finally {
            if (btn) btn.textContent = originalText;
        }
    },

    /**
     * Timeline'dagi videoni ritm bo'yicha avtomatik kesish (Auto Cut / Razor)
     */
    async autoCutTimelineVideo() {
        if (this.activeBeats.length === 0) {
            alert("Avtomatik kesish uchun avval ritmlarni aniqlang!");
            return;
        }

        if (!confirm(`Timeline'dagi video trekni musiqaning barcha ${this.activeBeats.length} ta zarba nuqtalarida avtomatik kesib (Razor) chiqishni xohlaysizmi?`)) {
            return;
        }

        const btn = document.getElementById("btnBeatAutoCut");
        const originalText = btn ? btn.textContent : "";
        if (btn) btn.textContent = "✂️ Kesilmoqda...";

        try {
            const payload = {
                beats: this.beatsForTimeline(),
                bpm: this.bpm,
                fps: this.fps,
                clipOffset: this.clipStart || 0,
                trackIndex: 0
            };

            const res = await window.HostBridge.autoCutAtBeats(payload);
            if (res && res.success) {
                alert(`🎬 ${res.message || "Video muvaffaqiyatli kesildi!"}`);
            } else {
                alert(`Xatolik: ${res ? res.message : "Kesishda xatolik"}`);
            }
        } catch (e) {
            alert("Kesish jarayonida xatolik: " + e.message);
        } finally {
            if (btn) btn.textContent = originalText;
        }
    },

    /**
     * Ritm nuqtalarini JSON yoki CSV formatida yuklab olish
     */
    exportBeatData() {
        if (this.activeBeats.length === 0) {
            alert("Eksport qilish uchun ritmlar mavjud emas!");
            return;
        }

        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({
            bpm: this.bpm,
            fps: this.fps,
            clip: this.clipInfo(),
            duration: this.duration,
            beatCount: this.activeBeats.length,
            beats: this.activeBeats,
            beats_timeline: this.beatsForTimeline()
        }, null, 2));

        const downloadAnchor = document.createElement("a");
        downloadAnchor.setAttribute("href", dataStr);
        downloadAnchor.setAttribute("download", `capcut_beats_${Math.round(this.bpm)}bpm.json`);
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
    }
};

window.BeatManager = BeatManager;
document.addEventListener("DOMContentLoaded", () => {
    BeatManager.init();
});
