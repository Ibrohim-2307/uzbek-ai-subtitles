# ANTIGRAVITY — MASTER PROMPT (hammasi bitta faylda)

> **Bu faylni Antigravity'ga to'liq bering va loyiha papkasini ko'rsating.**
> Faylda: (1) regressiya himoyasi qoidalari — eski ishlarni o'chirib tashlamaslik,
> (2) hozirgi loyiha xaritasi, (3) **bajarilgan 4 blok ish** (matn, vaqt, beat,
> so'z kaskadi) va ularning qabul mezonlari, (4) test etaloni (**375**),
> (5) qolgan ishlar ro'yxati, (6) ish uslubi va taqiqlangan yechimlar.

Loyiha: **O'zbekcha AI Subtitr** — Adobe After Effects va Premiere Pro uchun CEP panel
(HTML/JS) + FastAPI backend (Python) + ExtendScript (`.jsx`) host moduli.

---

## 0. ENG MUHIMI: REGRESSIYA HIMOYASI (o'chirib tashlash taqiqlanadi)

Oldingi bosqichlarda qilingan ishlar **saqlanib qolishi shart**. Ya'ni:

1. **Faylni butunlay qayta yozish taqiqlanadi.** Faqat kerakli joyni `patch` qiling
   (aniq matn topib, o'sha joyni almashtirish).
2. **Test fayllarini o'chirmang, kamaytirmang, "soddalashtirmang".**
   Hozir 8 to'plamda **375 ta tekshiruv** bor — u kamaymasligi kerak.
3. **Ishlayotgan funksiyalarni nomini o'zgartirmang.** Panel va host shu nomlarga
   bog'langan (`buildWordPlan`, `rechunkSegments`, `snapToFrame`, `detectBeats`,
   `ae_createSubtitles`, `beatsForTimeline`, `clipInfo`, `getSelectedClip`,
   `getSequenceInfo`, `sec_to_timecode`, `snap_beats_to_frame`, `dedupe_beats`,
   `assign_downbeats`, `stft_fps`, `bpm_raw` va h.k.).
4. **`host/shared.jsx` — panel yuklaydigan ASOSIY fayl.** `host/aftereffects.jsx`
   va `host/premiere.jsx` dagi umumiy funksiyalar u bilan **bayt-baytga bir xil**
   bo'lishi kerak (buni `tests/test_wordstack.js` tekshiradi).
5. **ES3 qoidasi**: `.jsx` fayllarda `let`, `const`, `=>`, `class`, `...spread`,
   template string **ishlatilmaydi** — faqat `var`, `function`, oddiy `for`.
   (Panel JS — `client/js/*.js` — zamonaviy sintaksisdan foydalanishi mumkin.)
6. **Ishni tugatgach testlarni yuritish shart:**
   ```bash
   bash scripts/run_all_tests.sh          # Linux/macOS/Git Bash
   scripts\run_all_tests.bat              # Windows
   ```
   Etalon: **375 ta tekshiruv, hammasi yashil**. Kam chiqsa yoki yiqilsa — siz
   regressiya qildingiz, tuzating.
7. **Fayllarni o'chirmang / ko'chirmang / nomini o'zgartirmang.** Yangi fayl
   qo'shsangiz — sababini hisobotda yozing.
8. Ishlatilmagan, lekin mavjud bo'lgan eski kodni **o'chirmang** (masalan eski
   `enforceTwoLines`, `single_legacy` shoxobchasi — zaxira variant sifatida turadi).

---

## 1. LOYIHA XARITASI

```
backend/
  main.py                      FastAPI: /transcribe, /detect-beats, /export/srt ...
  utils/uzbek_nlp.py           O'zbek matni: ʻ / ʼ, imlo, ayn, raqamlar, satr bo'lish
  utils/beat_detector.py       Beat/BPM/downbeat/drop aniqlash (numpy+scipy)
  utils/audio.py, forced_alignment.py, audio_aligner.py
client/
  index.html                   Panel interfeysi (o'zbek tilida)
  js/app.js                    Boshqaruvchi, sozlamalarni yig'ish (activePreset)
  js/api.js                    Backend bilan HTTP (fps, word_mode yuboradi)
  js/hostBridge.js             AE/PPro ko'prigi: insertSubtitles, buildWordPlans, beat payload
  js/beats.js                  Beat → timeline hisoblari (offset, snap, cut)
  js/uzbekUtils.js             Yagona qoidalar moduli (v2.2): matn, vaqt, beat, SO'Z REJASI
  js/editor.js, presetManager.js, CSInterface.js
host/
  shared.jsx                   ⚠️ PANEL YUKLAYDI (`$.evalFile`) — barcha host funksiyalari
  aftereffects.jsx             AE nusxasi (shared bilan bir xil bo'lishi kerak)
  premiere.jsx                 Pr nusxasi
tests/                         8 to'plam = 375 tekshiruv + brauzer sahifalari
scripts/                       build_preview.py, build_stack_preview.py,
                               run_all_tests.sh/.bat, test_kodlash.jsx, diagnose_uzbek.py
HISOBOT.md                     Bajarilgan ishlar hisoboti (1–10 bo'lim)
ANTIGRAVITY_PROMPT.md          Matn+vaqt topshirig'i (1–12 bo'lim)
ANTIGRAVITY_PROMPT_BEAT.md     Beat topshirig'i (mustaqil)
ANTIGRAVITY_PROMPT_SOZ.md      So'z kaskadi topshirig'i (mustaqil)
ANTIGRAVITY_MASTER_PROMPT.md   ⬅️ SHU FAYL (hammasi birga)
```

**Oqim (data flow):**
```
Audio → backend (STT + uzbek_nlp + beat_detector)
      → panel (editor/uzbekUtils: matn normalizatsiya + kadr aniqligidagi vaqt)
      → hostBridge (payload: segments[], style{}, fps, clipOffset, wordPlan)
      → host/*.jsx (AE: qatlamlar/kalitlar; Pr: SRT/MOGRT/markerlar)
```

---

## 2. BAJARILGAN ISHLAR — 4 BLOK (bularni BUZMANG)

### BLOK A — O'zbek matni (imlo va belgilar)

**Muammo:** subtitrda noto'g'ri belgilar va imlo xatolari.

**Qoidalar (qat'iy):**
- `o'` / `g'` harflari → **U+02BB (ʻ)** — masalan `oʻzbek`, `gʻoz`.
- **Ayn** (tutuq belgisi) → **U+02BC (ʼ)** — masalan `maʼno`, `sanʼat`.
- Apostrofning boshqa variantlari (`'`, `‘`, `’`, `` ` ``) — avtomatik ayn **qilinmaydi**;
  faqat lug'at va imlo qoidalari bo'yicha.
- `Yoʻq` → **`Йўқ`** (kirill), `Yoʻq` emas `Йук`.
- Ishlatiladigan funksiyalar: `normalize_uzbek_text`, `fix_og_wordlist`,
  `fix_ayn_words`, `split_subtitle_text`, `rechunkSegments`, `format_srt_time`.

**Tasdiqlangan natijalar (test dalili):**
```
format_srt_time(3723.004) == "01:02:03,004"
"Yoʻq" → "Йўқ"
snap_to_frame(3.214, 25) == 3.2
```

**Testlar:** `tests/test_uzbek_nlp.py` (83) + `tests/test_uzbek_utils.js` (57).

**Taqiqlangan yechimlar (harakat qilib ko'rilgan, yiqilgan):**
- juda uzun suffiks ro'yxatlari;
- `alo`, `sher` kabi so'zlarni "aynan shu" deb belgilash;
- apostrofli **hamma** tokenni ayn deb hisoblash;
- matnni **majburan** 2+ qatorga bo'lish;
- `OG_WORDS` ga `oz`, `on`, `ot` qo'shish;
- funksiya nomi bilan bir xil parametr nomi (`fix_og_wordlist`) — shadowing xatosi.

---

### BLOK B — Vaqt aniqligi (kadr va timecode)

**Muammo:** subtitr kadrga to'g'ri tushmasligi.

**Qoidalar:**
- Barcha vaqtlar **kadrga snap** qilinadi: `snap_to_frame()` / `snapToFrame()`.
- **Yumaloqlashda 6 kasr YETMAYDI** — `toFixed(9)` ishlatiladi.
  Sabab: 30/60 fps da `3.016667 * 60 = 181.00002` → kadr buziladi.
- Timecode formati: `sec_to_timecode(3.2, 25) == "00:00:03:05"`,
  `(3723.004, 25) == "01:02:03:00"`, `(10.5, 30) == "00:00:10:15"`.
- Beat/drop vaqtlari **loyiha fps** iga mos bo'lishi shart (25/30/60).

**Testlar:** `tests/test_uzbek_utils.js`, `tests/test_beats.py`, `tests/test_beats.js`.

**Hali ochiq (kutilmagan, lekin ma'lum) 2 nuqta:**
- `backend/main.py` dagi `seconds_to_srt_time()` vaqtni `int()` bilan **kesadi**
  (yumaloqlamaydi) — masalan 3.9999 → `00:00:03,999`.
- `ae_createSubtitles()` **so'zma-so'z bo'lmagan** rejimda `inPoint/outPoint` ni
  kadrga yaxlitlamaydi (so'z kaskadi rejimida esa yaxlitlanadi).

---

### BLOK C — "Ritm & Beatlar (CapCut)" bo'limi

**Bajarilganlar:**
- `backend/utils/beat_detector.py`: `stft_fps` **alohida** o'zgaruvchi (avval `fps`
  nomi STFT chastotasi bilan to'qnashib ketgan edi!), `fps` parametri, `bpm` +
  `bpm_raw`, `snap_beats_to_frame`, `dedupe_beats`, `estimate_beat_period`,
  `assign_downbeats`, `sec_to_timecode`.
- Drop chegarasi: `max(o'rtacha + 2.5σ, mediana * 1.6)`.
  **`is_drop` endi `is_downbeat` bayrog'ini buzmaydi** (alohida hisoblanadi).
- `client/js/beats.js`: offset (`clipStart`, `inPoint`, `outPoint`, `speed`),
  `clipInfo()`, `beatsForTimeline()`, kadr toleransi, `filteredOutCount`.
- `client/js/hostBridge.js`: `getSequenceInfo()` va `getSelectedClip()` **umuman
  yo'q edi** — yozildi; payload'ga `fps` va `clipOffset` qo'shildi.
- `host/*.jsx`: beat marker va Match Cut **kadr aniqligida** (`uzPad2`), takroriy
  markerlarni to'sish.
- `backend/main.py`: `/detect-beats` da `fps: Optional[float] = Form(25.0)`.

**Asosiy formula:** `t_timeline = clipStart + (t_audio − inPoint) / speed`, so'ng kadrga snap.
```
beatToTimelineTime(3.0, {start:10, inPoint:2, speed:1, fps:25}) == 11.0
speed: 2 → 10.52        (251/25)
beatTolerance(25, 2) == 0.08
```

**Tasdiqlangan natijalar:** sintez trekda `bpm_raw = 117.5` (haqiqiy 120), davr 0.51 s,
23 beat, downbeat oralig'i 2.0 s.

**Testlar:** `tests/test_beats.py` (33, haqiqiy numpy sintez trek) +
`tests/test_beats.js` (25, statik + offset matematikasi + DOM stub).

**Taqiqlangan yechimlar:**
- `fps` nomini STFT uchun qayta ishlatish (nom to'qnashuvi);
- downbeat uchun `idx % 4 == 0` mantiqi;
- drop aniqlashni sezgir qilib qo'yish (sintez trekda 7/23 bo'lgan edi);
- `round(frame/fps, 6)` bilan kadr yumaloqlash.

---

### BLOK D — So'zma-so'z "KASKAD" (1 ta 1 ta)

**Foydalanuvchi talabi:** so'z aytilishi boshlanishida chiqsin (kech emas),
animatsiya davomiyligi hisobga olinsin, oldingi so'z ulgurmasa keyingisi **tagida**
chiqsin, **1 ta 1 ta**, gapirilmagan gap **oldindan ko'rinmasin**, pauzada matn
**ekranda qolsin**.

**Arxitektura qoidasi (eng muhim):**
> **Vaqt va qatorlar PANELDA hisoblanadi (`buildWordPlan`), host faqat YOZADI.**
> Shunda panel, AE va Premiere qoidalari aynan bir xil bo'lib qoladi.

1. `client/js/uzbekUtils.js → buildWordPlan(segments, options)`:
   - `frameFloor()` — chiqish vaqti kadrga **pastga** (hech qachon kech emas);
   - `frameCeil()` — yopilish kadrga **tepaga** (hech qachon erta emas);
   - maydonlar: `inPoint, inAnimEnd, wordEnd, closeStart, outPoint, initialLine,
     line, lineChanges[]`, `stats{}`;
   - yopilishning **3 holati**: (a) pauza → keyingi so'zgacha turadi;
     (b) o'z vaqtida ulguradi → o'sha qatorda ketma-ket;
     (c) hech sig'maydi → keyingi so'z kelganda yopiladi, yangisi **tagidagi qatorga**;
   - qatorlar tugasa → eng eski so'z **majburan** yopiladi (animatsiya siqiladi),
     qolganlar siljish animatsiyasi bilan tepaga suriladi (kaskad);
   - **stek butun transkript uchun** (jumlalar orasida uzilmaydi!);
   - `auditWordPlan(plan)` — ustma-ust tushish/xato vaqtlarni topadi.
2. `client/js/hostBridge.js → buildWordPlans()` — payloaddan oldin `seg.wordPlan` qo'shadi
   (reja butun transkript uchun **bir marta** quriladi, keyin segmentlarga bo'linadi).
3. `host/shared.jsx` + `host/aftereffects.jsx → ae_writeWordStackLayers()`:
   - **har bir so'z uchun alohida matn qatlami** (`comment = "UZ_AI_SUBTITLE"`,
     `name = "[UZ_WORD] ..."`) — kalitlar to'qnashmaydi;
   - andoza qatlam yaratilib, stili olinadi va **o'chiriladi**, keyin `continue`;
   - kadr kafolati host ichida ham (`comp.frameRate` bo'yicha floor/ceil);
   - `pop` (88→112→100) / `fade` / `none`, yopilish (100→92 + opacity 100→0);
   - `charReveal` — harf-harf ochilish; `lineChanges` — siljish animatsiyasi;
   - **matnni bo'shatadigan kalit umuman yozilmaydi** → pauzada matn qotib turadi;
   - ekran chegarasi (`maxY`) va kompozitsiya chegarasi (`layerIn/layerOut`).
4. Panel: rejim **`stack`** ("🧱 Kaskad — 1 ta 1 ta") — **standart**;
   `inputWordStackLines` (1–3, standart 2), `checkWordPauseHold` (standart belgilangan);
   `app.js` ularni `activePreset` ga qo'shadi (`wordMaxLines`, `wordPauseHold`,
   `wordPauseThresholdSec`).
5. Premiere Pro: kaskad rejasidagi **aniq `inPoint/outPoint`** bo'yicha bo'laklanadi
   (Pr'da qator kaskadi yo'q, lekin vaqtlar AE bilan bir xil).
6. Backend (`/export/srt`): `w_mode in ("single","stack","cascade")` — so'z keyingi so'z
   kelguncha ko'rinadi (SRT'da bo'sh joy qolmaydi).

**Testlar:** `tests/test_wordplan.js` (51), `tests/test_wordstack.js` (50),
`tests/test_wordstack_ae.js` (56 — `.jsx` funksiyasini **soxta AE'da haqiqatda
ishga tushiradi**: qatlamlar, kalitlar, pauza, kaskad pozitsiyalari, 60 fps, offset).
Brauzer oldindan ko'rish: `tests/soz_kaskad_preview.html` (`scripts/build_stack_preview.py`).

**Taqiqlangan yechimlar:**
- `Math.max(layer.inPoint, wordStart)` klampi va `Math.round` bilan kadrga yaxlitlash
  (aynan shu **kechikishga** sabab bo'lgan);
- pauzada `textDoc.text = ""` (matn "lop" etib yo'qoladi);
- so'z kalitlarini **qatlam darajasidagi** `Scale` kalitlari bilan aralashtirish;
- stekni **segment ichida** qurish (jumlalar orasi buziladi);
- `shared.jsx` va `aftereffects.jsx` nusxalarini ajratib yuborish.

---

## 3. TEST ETALONI — 375 (buni saqlang)

| To'plam | Buyruq | Tekshiruv |
|---|---|---|
| `tests/test_uzbek_nlp.py` | `python3 tests/test_uzbek_nlp.py` | 83 ✓ |
| `tests/test_uzbek_utils.js` | `node tests/test_uzbek_utils.js` | 57 ✓ |
| `tests/test_pipeline.js` | `node tests/test_pipeline.js` | 20 ✓ |
| `tests/test_beats.py` | `python3 tests/test_beats.py` | 33 ✓ |
| `tests/test_beats.js` | `node tests/test_beats.js` | 25 ✓ |
| `tests/test_wordplan.js` | `node tests/test_wordplan.js` | 51 ✓ |
| `tests/test_wordstack.js` | `node tests/test_wordstack.js` | 50 ✓ |
| `tests/test_wordstack_ae.js` | `node tests/test_wordstack_ae.js` | 56 ✓ |
| **JAMI** | `bash scripts/run_all_tests.sh` | **375 ta — hammasi yashil** ✅ |

Brauzer sahifalari (AE'siz ko'rish uchun):
`tests/kontent_tekshiruv.html` (matn), `tests/soz_kaskad_preview.html` (so'z kaskadi).

---

## 4. QOLGAN ISHLAR (prioritet bo'yicha)

1. **AE'da qo'lda sinov** (foydalanuvchi bajaradi): `host/shared.jsx` ni
   `.../CEP/extensions/com.uzbek.subtitles/host/shared.jsx` ga ko'chirish → panelni
   qayta yuklash → "So'zma-so'z" → "🧱 Kaskad" → zich aytilgan joyni tekshirish.
2. **`client/index.html` da skript tartibini tekshirish**: `uzbekUtils.js` teglari
   `hostBridge.js` dan **oldin** turishi shart (hostBridge endi `UzbekUtils.buildWordPlan`
   ni chaqiradi). Tartib noto'g'ri bo'lsa — `hostBridge` da himoya (`if (U && U.buildWordPlan)`)
   bor, lekin baribir tartibni to'g'rilash kerak.
3. **Uzun videolar uchun qatlam sonini kamaytirish**: kaskadda har bir so'z — alohida
   qatlam (10 daqiqada ~1000+ qatlam, AE sekinlashadi). Variant: "yig'ish" rejimi
   (bir necha so'z bitta qatlamga, faqat kaskad kerak bo'lganda bo'lish) yoki
   qatlamlarni pre-compose qilish.
4. **`seconds_to_srt_time()`** — `int()` bilan kesish o'rniga **yumaloqlash**
   (testlarni buzmagan holda; `test_uzbek_nlp.py` da SRT vaqtlari tekshiriladi).
5. **`ae_createSubtitles()`** — so'zma-so'z bo'lmagan rejimda ham `inPoint/outPoint` ni
   `comp.frameRate` bo'yicha snap qilish.
6. **`scripts/diagnose_uzbek.py`** ni haqiqiy transkriptda yuritib, hisobotni yangilash.
7. **Karaoke + kaskad** birgalikda ishlashini tekshirish (hozir kaskad rejimida
   karaoke animatori o'tkazib yuboriladi).
8. Har bir tuzatishdan keyin: testlar + `HISOBOT.md` yangilash + zip qayta yasash.

---

## 5. ISH USLUBI (Antigravity qanday ishlashi kerak)

1. **Avval o'qi, keyin yoz.** Faylning kerakli joyini `sed -n 'A,Bp' fayl` bilan ko'ring.
2. **Minimal patch**: aniq matnni topib almashtirish (butun faylni qayta yozmaslik).
3. **Har bir o'zgarishga izoh** yozing: nima uchun o'zgargan (o'zbekcha izoh yaxshi).
4. **Ikki nusxani birga yangilang**: `host/shared.jsx` **va** `host/aftereffects.jsx`
   (umumiy funksiyalar aynan bir xil bo'lishi shart).
5. **Yangi funksiya yozsangiz — testini ham yozing** (test yo'q kod = buziladigan kod).
6. **ES3 tekshiruvi**: `.jsx` fayllarda `grep -nE "\b(let|const)\s|=>"` → bo'sh chiqishi kerak.
7. **Ish oxirida** `bash scripts/run_all_tests.sh` yuritib, **jadval** bilan hisobot bering:
   | Fayl | Nima o'zgardi | Nega | Dalil (test) |
8. **Bilmagan narsani o'ylab topmang** — ExtendScript API'da ishonchingiz komil bo'lmasa,
   izoh bilan `try/catch` ichida yozing va hisobotda "tekshirish kerak" deb belgilang.

---

## 6. YAKUNIY TEKSHIRUV RO'YXATI (topshirishdan oldin)

- [ ] `bash scripts/run_all_tests.sh` → **375+**, yiqilgan to'plam **0**
- [ ] `.jsx` fayllarda ES3 buzilmagan (`let/const/=>` yo'q)
- [ ] `host/shared.jsx` va `host/aftereffects.jsx` umumiy funksiyalari bir xil
- [ ] O'zbek matni: `oʻ/gʻ` = U+02BB, ayn = U+02BC (`Yoʻq` → `Йўқ`)
- [ ] Vaqtlar kadrda (`toFixed(9)`, `snap_to_frame`)
- [ ] Beat vaqtlari loyiha fps iga mos, downbeat/drop buzilmagan
- [ ] So'z kaskadi: kech chiqmaslik, 1 ta 1 ta, tagida chiqish, pauzada qolish,
      gapirilmagan gap ko'rinmasligi
- [ ] Hech bir fayl o'chirilmagan / nomi o'zgartirilmagan
- [ ] `HISOBOT.md` yangilangan, o'zgargan fayllar ro'yxati bor

---

## 7. CHAT UCHUN QISQA VERSIYA (nusxalab olish uchun)

```
Loyiha: O'zbekcha AI Subtitr (Adobe CEP panel + FastAPI + ExtendScript).
Avval `ANTIGRAVITY_MASTER_PROMPT.md` ni TO'LIQ o'qib chiq, keyin ishni boshla.

QAT'IY TAQIQLAR (regressiya himoyasi):
1. Fayllarni butunlay qayta yozma — faqat kerakli joyni patch qil.
2. Test fayllarini o'chirma/kamaytirma: hozir 8 to'plamda 375 ta tekshiruv bor.
3. Funksiya nomlarini o'zgartirma (panel va host ularga bog'langan).
4. host/shared.jsx (panel yuklaydigan fayl) va host/aftereffects.jsx dagi umumiy
   funksiyalar bayt-baytga bir xil bo'lsin.
5. .jsx fayllarda ES3: var/function ishlat, let/const/=>/class TAQIQLANADI.
6. Ish oxirida: bash scripts/run_all_tests.sh → 375+, yiqilgan to'plam 0.
   Kam chiqsa yoki yiqilsa — sen regressiya qilding, tuzat.

QOIDA: matn/vaqt/beat/so'z rejasi bo'yicha YAGONA HAQIQAT — client/js/uzbekUtils.js
(va backend/utils/uzbek_nlp.py, beat_detector.py). Host (.jsx) faqat yozadi.

BAJARILGANLAR (BUZMA):
A) Matn: o'=U+02BB, ayn=U+02BC, Yo'q→Йўқ, normalize_uzbek_text, rechunkSegments.
B) Vaqt: snap_to_frame + toFixed(9); sec_to_timecode; beat vaqtlari loyiha fps iga mos.
C) Beat: stft_fps alohida, bpm_raw, snap_beats_to_frame, dedupe_beats, assign_downbeats,
   drop chegarasi max(mean+2.5σ, median*1.6), is_drop downbeat'ni buzmaydi,
   hostBridge.getSequenceInfo()/getSelectedClip(), clip offset (start/inPoint/outPoint/speed).
D) So'z kaskadi: buildWordPlan() (panelda) → wordPlan payloadda → ae_writeWordStackLayers()
   (har so'z — alohida qatlam, matnni bo'shatadigan kalit YO'Q, pauzada matn qoladi,
   kech chiqmaslik uchun frameFloor, erta yopilmaslik uchun frameCeil, kaskad tagida).

HOZIRGI TOPSHIRIQ: [BU YERGA O'Z VAZIFANGIZNI YOZING]

Hisobot formati: | Fayl | Nima o'zgardi | Nega | Dalil (test) |
```
