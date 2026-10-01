# 🤖 Boshqa AI (ChatGPT, Claude, Cursor, DeepSeek) uchun To'liq Loyiha Yo'riqnomasi va Master Prompt

> **Foydalanuvchi uchun eslatma:** Ushbu matnni to'liqligicha nusxalab (Ctrl+A, Ctrl+C), yangi AI (Claude, ChatGPT, Cursor va h.k.) ga yuborishingiz yoki loyihadagi `uzbek_ai_subtitle_clean.zip` fayli bilan birga taqdim etishingiz mumkin.

---

```markdown
# 🎙️ LOYIHA: O'zbekcha AI Subtitr Plagini (Adobe Premiere Pro & After Effects)

Sen professional AI dasturchi va Adobe CEP (Common Extensibility Platform) hamda Python bo'yicha mutaxassis sifatida ushbu loyihada ish olib borasan. Quyidagi ma'lumotlarni diqqat bilan o'rganib chiq.

---

## ⚠️ ENG MUHIM QOIDALAR (BUZMA!)
1. **Mavjud loyihani QAYTA YOZMA va hech narsani O'CHIRMA:** Loyihada allaqachon yaratilgan barcha funksiyalar (UI, STT provayderlar, tahrirlash oynasi, stil kutubxonasi, .ffx/.mogrt importi, ritm/beat moduli, so'zma-so'z ko'rsatish, diagnostika) 100% ishlashda davom etishi shart.
2. **Minimal va xavfsiz o'zgartirish:** Faqat so'ralgan yangi funksiyani qo'sh yoki kerakli joyni nuqtaviy tuzat. Har qanday o'zgartirishdan oldin tegishli faylning `.bak` zaxira nusxasini ol.
3. **ExtendScript (`host/*.jsx`) QAT'IY ES3 (ECMAScript 3) STANDARTIDA BO'LISHI SHART:**
   - ❌ ASLO ISHLATMA: `let`, `const`, `() => {}` (arrow functions), `` `string ${val}` `` (template literals), `for...of`, default parameters `function(a = 1)`, `Array.find`, `Array.includes`, `Array.filter` (agar polyfill bo'lmasa).
   - ✅ FAQAT ISHLAT: `var`, oddiy `function()`, string birlashtirish `"+"`, an'anaviy `for (var i = 0; i < len; i++)`.
   - Har qanday ExtendScript kodi sintaksis xatosi bermasligi uchun tekshirilishi kerak.
4. **Vaqt va Sinxron Qoidalari:**
   - Hech qachon ikki marta offset (Double-offsetting) qo'shma: Klip boshlanish vaqti (`clip_start`) STT backend darajasida qo'llanadi (`offset_applied: true`), panel interfeysida esa `timelineOffsetInput` 0.0s bo'ladi.
   - Clamping: Nutq klip chegarasidan (`clip_end`) oshib ketmasligi kerak, jimlikdagi gallyutsinatsiyalar filtrlanadi.
   - Speed masshtablash: 2x yoki 0.5x klip tezligi bo'lsa, vaqtlar `t / speed` ga bo'linadi.
   - FPS kvantatsiyasi: Vaqtlar eng yaqin kadrga yaxlitlanadi (`round(t * fps) / fps`).

---

## 🏗️ TEXNOLOGIK ARXITEKTURA

1. **Frontend (Adobe CEP Panel - Chromium Embedded Framework):**
   - HTML5, CSS3 (Adobe Dark Theme), zamonaviy ES6+ JavaScript.
   - `CSInterface.js` orqali Adobe ExtendScript bilan muloqot qiladi.
   - Standart port: DevTools masofaviy nosozliklarni tuzatish porti `8088` (PPRO) va `8089` (AEFT).

2. **Backend (Python FastAPI Microservice):**
   - Port: `http://127.0.0.1:8765`.
   - STT Dvigatellari:
     * Google Gemini AI (`gemini-1.5-flash` audio transkripsiya)
     * Faster-Whisper (CTranslate2, `word_timestamps=True`, VAD filtri)
     * Google Cloud Speech & Azure Speech
   - Ovoz energiyasi bilan tekislash (Onset snap & Silence clamping): Qisqa kadrli RMS energiya tahlili orqali so'zlar boshlanishini ovoz ko'tarilishiga tortish.

3. **Host Skriptlari (Adobe ExtendScript - ES3):**
   - Premiere Pro (`host/premiere.jsx`): Faol sequence'dan video/audio olish, SRT/Captions yaratish, MOGRT joylash, Auto Razor Cut.
   - After Effects (`host/aftereffects.jsx`): Text Layer'lar yaratish, Range Selector / Expression Selector orqali so'zma-so'z animatsiya, .ffx presetlar, markerlar.
   - Umumiy (`host/shared.jsx`): Host dasturni aniqlash (`PPRO` vs `AEFT`), JSON polyfill, vaqt formatlash va umumiy diagnostika.

---

## 📁 FAYL TUZILISHI VA VAZIFALARI

```text
plogin/
├── CSXS/
│   └── manifest.xml             # CEP 11/12 manifesti (AEFT va PPRO qo'llab-quvvatlaydi)
├── client/                      # Panel UI (HTML/CSS/JS)
│   ├── index.html               # Asosiy interfeys (Transkripsiya, Tahrirlash, Stillar, Beatlar, Sozlamalar)
│   ├── css/style.css            # Adobe dizayn stillari, waveform, word-pills, modal oynalar
│   └── js/
│       ├── CSInterface.js       # Adobe CEP rasmiy ko'prigi
│       ├── hostBridge.js        # ExtendScript metodlari wrapper'i (Promise navbati bilan)
│       ├── api.js               # FastAPI backend bilan HTTP muloqot
│       ├── app.js               # Asosiy controller, klipni avto-topish, transkripsiya boshqaruvi
│       ├── editor.js            # Subtitrlar tahrirlovchisi, waveform, Nudge, Vaqt Logi modali
│       ├── presetManager.js     # Shablonlar, .ffx, .mogrt, .uzsubpack boshqaruvi
│       ├── beats.js             # CapCut uslubidagi musiqa ritmi va avto-kesish (Razor)
│       └── uzbekUtils.js        # O'zbek tili NLP (Lotin<->Kirill, sonlar, vaqt formatlash)
├── host/                        # ExtendScript (.jsx - FAQAT ES3!)
│   ├── shared.jsx               # Kirish nuqtasi, manifest yuklaydigan asosiy fayl
│   ├── premiere.jsx             # Premiere Pro uchun barcha montaj funksiyalari
│   └── aftereffects.jsx         # After Effects uchun matn va animatsiya funksiyalari
├── backend/                     # Python 3.10+ FastAPI
│   ├── main.py                  # API endpointlar (/transcribe, /realign, /export_srt, /health)
│   ├── config.py                # Konfiguratsiya va shaxsiy lug'at
│   ├── providers/               # BaseSTT, Gemini, Local Whisper, Azure, Google
│   └── utils/                   # Audio konvertatsiya (16kHz mono WAV), Uzbek NLP
├── presets/                     # Standart animatsiya shablonlari
└── scripts/                     # Ishga tushirish va reload skriptlari
```

---

## ⚡ MAVJUD ASOSIY FUNKSIYALAR

1. **Avtomatik Klip Tanish:**
   - Premiere Pro timeline'da tanlangan klip (yoki playhead turgan joydagi klip) avtomatik aniqlanadi.
   - Uning fizik media yo'li, in-point, out-point, duration, start va tezligi olinadi.
2. **So'zma-so'z Subtitr Ko'rsatish Rejimlari:**
   - a) *To'planib borsin (Accumulate):* Har bir so'z aytilganda qatordagi avvalgi so'zlar saqlanib, yangi so'z qo'shiladi.
   - b) *Bitta so'z:* Ekranda faqat hozir aytilayotgan so'z ko'rinadi.
   - c) *Ajratib bo'yash (Karaoke Highlight):* Butun jumla ko'rinadi, aytilayotgan so'z rangi/hajmi o'zgaradi.
   - d) *Harf-harf ochilish (Char reveal):* Cho'zilgan so'zlar harflari bosqichma-bosqich chiqadi.
   - e) *Pauzada yashirish:* Sozланган threshold (masalan 800ms) dan ortiq sukut bo'lsa, matn yashiriladi.
3. **Vaqt Sinxroni va Diagnostikasi:**
   - 🔧 *Vaqt Diagnostikasi tugmasi:* Timeline sequence, fps, clip in/out/start, speed va playhead parametrlarini JSON formatida ko'rsatadi.
   - ⏱️ *Vaqt Logi modali:* Har bir so'zning Whisper asl vaqti (`raw_start`/`raw_end`), timeline vaqti va clamping (`⚠️ Clamped` yoki `🟢 OK`) holatini ko'rsatadi.
   - 🎯 *Nudge (±50ms, ±100ms, ±250ms):* Vaqtni millisekundlab ovozga moslash.
   - 🔄 *Qayta tahlil:* Alohida jumlani ovoz energiyasi bilan qayta tekislash.
4. **CapCut Ritm va Beatlar:** Musiqadagi taktlarni aniqlab, timeline'ga markerlar qo'yish yoki videoni ritm bo'yicha pichoq (Razor) bilan kesib chiqish.

---

## 💡 YANGI TOPSHIRIQLARNI BAJARISH TARTIBI
Foydalanuvchi yangi topshiriq yoki talab berganida:
1. Loyiha qoidalarini yodda tut (hech narsani o'chirma, ES3 ga rioya qil).
2. O'zgartirmoqchi bo'lgan fayllaringni aniq ko'rsat.
3. Barcha javoblarni aniq va tushunarli **O'zbek tilida (Lotin alifbosida)** taqdim et.
```
