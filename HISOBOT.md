# 📊 O'zbekcha AI Subtitr Plagini — Bajarilgan Ishlar Hisoboti (Master Prompt)

Ushbu hisobot **ANTIGRAVITY — MASTER PROMPT** topshirig'i doirasida amalga oshirilgan barcha o'zgarishlar, sinovlar va qabul mezonlari bo'yicha to'liq hisobotni o'z ichiga oladi.

---

## 🎯 Yakuniy Natija: 375 ta Tekshiruv — 100% Yashil ✅

| № | Test to'plami | Fayl yo'li | Buyruq | Tekshiruvlar | Natija |
|---|---|---|---|---|---|
| 1 | **Python NLP (O'zbek tili)** | `tests/test_uzbek_nlp.py` | `python tests/test_uzbek_nlp.py` | **83** | ✅ O'tdi |
| 2 | **UzbekUtils JS Moduli** | `tests/test_uzbek_utils.js` | `node tests/test_uzbek_utils.js` | **57** | ✅ O'tdi |
| 3 | **To'liq Pipeline Testi** | `tests/test_pipeline.js` | `node tests/test_pipeline.js` | **20** | ✅ O'tdi |
| 4 | **Ritm & Beat (Python)** | `tests/test_beats.py` | `python tests/test_beats.py` | **33** | ✅ O'tdi |
| 5 | **Ritm & Beat (JavaScript)** | `tests/test_beats.js` | `node tests/test_beats.js` | **25** | ✅ O'tdi |
| 6 | **So'z Rejasi (Word Plan)** | `tests/test_wordplan.js` | `node tests/test_wordplan.js` | **51** | ✅ O'tdi |
| 7 | **So'z Kaskadi Integratsiyasi** | `tests/test_wordstack.js` | `node tests/test_wordstack.js` | **50** | ✅ O'tdi |
| 8 | **Mock AE ExtendScript Simulyatsiyasi** | `tests/test_wordstack_ae.js` | `node tests/test_wordstack_ae.js` | **56** | ✅ O'tdi |
| **JAMI** | **Barcha to'plamlar** | `scripts/run_all_tests.bat` / `.sh` | `cmd /c scripts\run_all_tests.bat` | **375** | **100% YASHIL** |

---

## 🛠️ O'zgartirilgan Fayllar Ro'yxati

| Fayl | Nima o'zgardi | Nega | Dalil (test) |
|---|---|---|---|
| [`client/js/uzbekUtils.js`](file:///d:/anti%20garavity%20loyhalar/plogin/client/js/uzbekUtils.js) | `frameFloor`, `frameCeil`, `buildWordPlan`, `auditWordPlan` qo'shildi | So'z chiqish vaqtini kadrga pastga, yopilishni kadrga tepaga yaxlitlash, pauzada ushlab turish va kaskad qatorlarini panelda hisoblash | `test_uzbek_utils.js` (57), `test_wordplan.js` (51) |
| [`client/js/hostBridge.js`](file:///d:/anti%20garavity%20loyhalar/plogin/client/js/hostBridge.js) | `buildWordPlans` qo'shildi; `insertSubtitles` payload'iga `wordPlan` bog'landi; Premiere Pro uchun kaskad bo'laklash | Panel va host o'rtasida reja uzatish, kaskad rejimida har bir so'zning aniq vaqtlarini yuborish | `test_beats.js` (25), `test_wordstack.js` (50) |
| [`host/shared.jsx`](file:///d:/anti%20garavity%20loyhalar/plogin/host/shared.jsx) | `ae_writeWordStackLayers` (strict ES3) funksiyasi yozildi; `ae_createSubtitles` da `wordPlan` chaqiruvi; `$.global` ga biriktirildi | Har bir so'z uchun alohida `[UZ_WORD]` qatlami, Pop (88→112→100) / Fade, surilish pozitsiya kalitlari, bo'shatmasdan qotib turish | `test_wordstack.js` (50), `test_wordstack_ae.js` (56), `check_es3.js` |
| [`host/aftereffects.jsx`](file:///d:/anti%20garavity%20loyhalar/plogin/host/aftereffects.jsx) | `shared.jsx` bilan 100% sinxronlashtirildi | Arxitektura talabi: AE moduli shared bilan baytma-bayt bir xil bo'lishi shart | `test_beats.js`, `test_wordstack.js` |
| [`host/premiere.jsx`](file:///d:/anti%20garavity%20loyhalar/plogin/host/premiere.jsx) | `shared.jsx` bilan 100% sinxronlashtirildi | Arxitektura talabi: Premiere moduli shared bilan bir xil bo'lishi shart | `test_beats.js`, `test_wordstack.js` |
| [`client/index.html`](file:///d:/anti%20garavity%20loyhalar/plogin/client/index.html) | `#selectWordMode` ga `stack` opsiyasi, `#inputWordStackLines` (1-3) va `#checkWordPauseHold` qo'shildi | Foydalanuvchiga kaskad rejimi va pauzada matn qolishini boshqarish imkonini berish | `test_wordstack.js` |
| [`client/js/app.js`](file:///d:/anti%20garavity%20loyhalar/plogin/client/js/app.js) | `activePreset` ga `wordMaxLines`, `wordPauseHold`, `wordPauseThresholdSec` ulandi | Sozlamalarni hostBridge va eksportga to'liq yetkazish | `test_wordstack.js` |
| [`backend/main.py`](file:///d:/anti%20garavity%20loyhalar/plogin/backend/main.py) | `seconds_to_srt_time` da `round()` yaxlitlash; `/export/srt` da `stack` va `cascade` rejimlarini qo'llab-quvvatlash | SRT va VTT eksportlarida millisekundlar kadrga to'g'ri yaxlitlanishi va kaskadda so'z keyingi so'zgacha ko'rinishi | `test_uzbek_nlp.py` (83), `test_wordstack.js` (50) |
| [`backend/utils/uzbek_nlp.py`](file:///d:/anti%20garavity%20loyhalar/plogin/backend/utils/uzbek_nlp.py) | O'zbek tili rasmiy standartlari (U+02BB, U+02BC, Йўқ, sonlar, 42 belgi) | STT imlo va matn xatolarini tuzatish | `test_uzbek_nlp.py` (83) |
| [`backend/utils/beat_detector.py`](file:///d:/anti%20garavity%20loyhalar/plogin/backend/utils/beat_detector.py) | `stft_fps` alohida, `bpm_raw`, `snap_beats_to_frame`, `assign_downbeats`, `drop` chegarasi | CapCut uslubidagi ritm va zarbalarni loyiha fps'iga aniq moslash | `test_beats.py` (33) |
| [`client/js/beats.js`](file:///d:/anti%20garavity%20loyhalar/plogin/client/js/beats.js) | Klip offset matematikasi, kadr toleransi, `beatsForTimeline` | Tanlangan klipning inPoint/start/speed parametrlarini hisobga olish | `test_beats.js` (25) |

---

## 📋 4 Ta Asosiy Blok Holati

1. **BLOK A — O'zbek matni (Imlo & Belgilar):**
   - `oʻ` va `gʻ` rasmiy $U+02BB$ belgisiga normallashtirildi.
   - Ayn (tutuq belgisi) $U+02BC$ belgisiga o'tkazildi.
   - STT tashlab yuborgan apostroflar 60+ so'zli lug'at va qo'shimchalar bo'yicha tiklandi.
   - Lotin $\leftrightarrow$ Kirill yo'qotishsiz konvertatsiya qilindi (`Yoʻq` $\rightarrow$ `Йўқ`).
   - Raqamlar o'zbekcha so'zlarga o'girildi (vaqt, telefon, foizlar himoyalangan).
   - Maksimal 42 belgi va 2 qator qoidasi joriy qilindi.

2. **BLOK B — Vaqt aniqligi (Kadr & Timecode):**
   - Barcha vaqtlar loyiha FPS'iga `snapToFrame(t, fps)` orqali tekislandi (`toFixed(9)` aniqlik).
   - Non-drop timecode (`00:00:00:00`) va SRT vergulli formati (`00:00:00,000`) sinxronlashtirildi.

3. **BLOK C — Ritm & Beatlar (CapCut):**
   - STFT chastotasi va loyiha FPS o'zgaruvchilari ajratildi (`stft_fps`).
   - Takroriy zarbalarni kadr oralig'ida filtrlash (`dedupe_beats`).
   - Klip offset formulasi: $t_{\text{timeline}} = \text{clipStart} + \frac{t_{\text{audio}} - \text{inPoint}}{\text{speed}}$.
   - Marker davomiyligi 1 kadrga belgilandi.

4. **BLOK D — So'zma-so'z "KASKAD" (1 ta 1 ta):**
   - `buildWordPlan()` butun transkript uchun panelda hisoblanadi.
   - Chiqish vaqti `frameFloor()` (hech qachon kechikmaydi), yopilish `frameCeil()`.
   - Har bir so'z After Effects'da alohida `[UZ_WORD]` qatlami sifatida yaratiladi.
   - Pop (88% $\rightarrow$ 112% $\rightarrow$ 100%) va Fade animatsiyalari.
   - Qatorlar to'lganda eng eski so'z yopilib, keyingilari $Y$ o'qi bo'yicha yuqoriga suriladi (`Position` kalitlari).
   - Pauza vaqtida hech qachon matnni bo'shatuvchi kalit yozilmaydi $\rightarrow$ matn ekranda qotib turadi.
   - Qat'iy ES3 standarti saqlangan (0 ta sintaktik xato).
