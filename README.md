# O‘zbekcha AI Subtitr (Adobe After Effects & Premiere Pro)

Adobe After Effects va Adobe Premiere Pro dasturlari uchun sun’iy intellekt (AI) asosida to‘liq **O‘zbek tilida** ishlaydigan professional avtomatik subtitr va animatsiya plagini (panel).

---

## 📌 1. Arxitektura va Texnologiya Asosi (CEP vs UXP)

Adobe rasmiy hujjatlari va yo‘l xaritasi (Roadmap) asosida:
- **Premiere Pro:** UXP qo‘llab-quvvatlashni boshladi, biroq CEP 2029-yil oxirigacha to‘liq qo‘llab-quvvatlanadi.
- **After Effects:** Hozirgi kunda CEP asosiy barqaror muhit hisoblanadi (After Effects uchun UXP 2026-yil oxirida ommaviy beta bosqichiga chiqishi rejalashtirilgan).
- **Xulosa va To‘g‘ri Tanlov:** Har ikki dasturda (AE va Premiere Pro) **yagona umumiy kod bazasi va bitta panel** orqali ishlash uchun **CEP (Common Extensibility Platform) 11/12 + ExtendScript (.jsx)** arxitekturasi yagona to‘g‘ri va barqaror tanlovdir.
- **Modulli Arxitektura:** Panel frontend qismi (HTML5/CSS3/ES6) va Backend (FastAPI) qat'iy ajratilgan bo‘lib, `HostBridge` adapteri orqali ExtendScript bilan gaplashadi. Kelajakda After Effects UXP to‘liq tayyor bo‘lganda, faqat bridge qismini almashtirish kifoya qiladi.

---

## 📁 2. Loyiha Tuzilishi

```text
plogin/
├── CSXS/
│   └── manifest.xml             # Adobe CEP 11/12 manifesti (AEFT va PPRO)
├── client/                      # Panelning vizual interfeysi (UI)
│   ├── index.html               # Asosiy panel oynasi (O'zbek tilida)
│   ├── css/
│   │   └── style.css            # Adobe Dark Theme dizayni
│   └── js/
│       ├── CSInterface.js       # Adobe CEP bilan aloqa kutubxonasi
│       ├── app.js               # Boshqaruvchi va hodisalar
│       ├── api.js               # Python FastAPI bilan HTTP aloqa
│       ├── editor.js            # Subtitr tahrirlash (bo'lish, birlashtirish, vaqtlar)
│       ├── beats.js             # CapCut uslubidagi Beat & Ritm (Match Cut / Marker)
│       ├── hostBridge.js        # AE va Premiere Pro ExtendScript ko'prigi
│       ├── presetManager.js     # Stillar, .ffx, .mogrt va JSON kutubxonasi
│       └── uzbekUtils.js        # O'zbek tili NLP va vaqt yordamchilari
├── host/                        # ExtendScript (.jsx) skriptlari
│   ├── shared.jsx               # Dasturni aniqlash, JSON polyfill va Beat markerlari
│   ├── aftereffects.jsx         # AE: Text layerlar, .ffx preset, Beat markerlar
│   └── premiere.jsx             # PPro: Audio olish, SRT/Captions, MOGRT, Auto Razor Cut
├── presets/                     # Subtitr stillari va shablonlar
│   ├── builtin_presets.json     # Standart stillar (TikTok, Neon, Minimalist va h.k.)
│   ├── ffx/                     # .ffx animatsiya presetlari
│   └── mogrt/                   # .mogrt shablonlari
├── backend/                     # Python STT Backend serveri
│   ├── main.py                  # FastAPI REST API (localhost:8765)
│   ├── config.py                # Sozlamalar va shifrlangan API kalitlar
│   ├── requirements.txt         # Kerakli Python kutubxonalari
│   ├── providers/               # STT Provayderlari (Adapter Pattern)
│   │   ├── base.py              # Asosiy BaseSTTProvider interfeysi
│   │   ├── local_whisper.py     # faster-whisper (so'zma-so'z vaqtlar, GPU/CPU)
│   │   ├── google_stt.py        # Google Cloud Speech-to-Text
│   │   ├── azure_stt.py         # Microsoft Azure Speech
│   │   └── custom_stt.py        # Maxsus REST API (OpenAI / Mohirdev)
│   └── utils/
│       ├── audio.py             # 16kHz mono WAV konvertatsiya (FFmpeg)
│       └── uzbek_nlp.py         # Lotin<->Kirill, sonlar, shaxsiy lug'at
├── scripts/                     # Avtomatlashtirilgan o'rnatish va ishga tushirish
│   ├── install_windows.bat      # Windows uchun bitta bosishda o'rnatuvchi
│   ├── install_windows.ps1      # PowerShell o'rnatuvchi skript
│   ├── install_mac.sh           # macOS uchun o'rnatuvchi skript
│   ├── start_backend.bat        # Backendni ishga tushirish (Windows)
│   └── start_backend.sh         # Backendni ishga tushirish (macOS)
├── .debug                       # CEP Remote Debugging portlari (8088, 8089)
└── README.md                    # To'liq foydalanish qo'llanmasi
```

---

## 🚀 3. O‘rnatish va Ishga Tushirish

### 1-qadam: Plaginni Adobe tizimiga o‘rnatish
#### Windows:
1. `scripts/install_windows.bat` faylini sichqonchaning o‘ng tugmasi bilan bosib, **Administrator sifatida ishga tushiring** (yoki PowerShell'da `scripts/install_windows.ps1` ni bajaring).
2. Ushbu skript:
   - Adobe CEP `PlayerDebugMode` registr kalitlarini avtomatik yoqadi;
   - Plagin papkasini `%APPDATA%\Adobe\CEP\extensions\com.uzbek.subtitles` manziliga bog‘laydi (Junction);
   - Python virtual muhitini (`venv`) yaratadi va kerakli paketlarni o‘rnatadi.

#### macOS:
Terminalni oching va quyidagi buyruqni bering:
```bash
chmod +x scripts/install_mac.sh scripts/start_backend.sh
./scripts/install_mac.sh
```

---

### 2-qadam: Backend Serverni Ishga Tushirish
Har doim montaj qilishdan oldin backend serverni fonda ishga tushirib qo‘ying:
- **Windows:** `scripts/start_backend.bat` ni bosing.
- **macOS:** `./scripts/start_backend.sh` ni ishga tushiring.

Server `http://127.0.0.1:8765` manzilida ishlaydi va plagin panelidagi indikator yashil yonadi.

---

### 3-qadam: Adobe Dasturlarida Panelni Ochish
1. **Adobe After Effects** yoki **Adobe Premiere Pro** dasturini oching.
2. Yuqori menyudan:
   **Window ➔ Extensions ➔ O‘zbekcha AI Subtitr** menyusini bosing.
3. Chiroyli o‘zbek tilidagi panel ochiladi!

---

## 🛠️ 4. Asosiy Imkoniyatlar va Qo‘llanma

### A. Transkripsiya (Nutqni Matnga Aylantirish)
1. Timeline'da ovozi bor videoni yoki audio klipni tanlang va panelda **"🎯 Tanlash"** tugmasini bosing (yoki to‘g‘ridan-to‘g‘ri kompyuterdan fayl yuklang).
2. STT provayderini tanlang:
   - **Lokal Faster-Whisper:** Internet talab qilmaydi, GPU yoki CPU da ishlaydi, so‘zma-so‘z aniq vaqtlarni beradi.
   - **Google Cloud / Azure Speech / Maxsus API:** Bulutli tezkor STT xizmatlari.
3. Yozuv turini tanlang: **O‘zbekcha Lotin** (to‘g‘ri `o‘`, `g‘`, `sh`, `ch` belgilari bilan) yoki **Kirill**.
4. Xohlasangiz *"Raqamlarni so‘z ko‘rinishida yozish"* opsiyasini yoqing (masalan: `2026` ➔ `ikki ming yigirma olti`).
5. **"🚀 O‘zbekcha Nutqni Matnga Aylantirish"** tugmasini bosing.

---

### B. Subtitr Tahrirlash Oynasi
- **Vaqtni sozlash:** Har bir jumlaning boshlanish va tugash vaqtini tahrirlash mumkin.
- **⏱️ Shu joyga o'tish:** Soat belgisini bossangiz, After Effects yoki Premiere Pro playhead'i to‘g‘ridan-to‘g‘ri o‘sha daqiqaga sakraydi.
- **So‘zma-so‘z vaqtlar (Word Pills):** Har bir so‘z ustiga bossangiz, aynan shu so‘z aytilgan lahzaga o‘tadi.
- **Bo‘lish (Split):** Jumlani ikkiga ajratadi va vaqtlarni aniq taqsimlaydi.
- **Birlashtirish (Merge):** Keyingi jumla bilan bitta qilib birlashtiradi.
- **Qidirish va Almashtirish:** Sheva yoki noto‘g‘ri tanilgan so‘zlarni bir zumda almashtiradi. *"Lug‘atga saqlash"* belgisi qo‘yilsa, keyingi barcha videolarda avtomatik to‘g‘rilanadi.
- **Import va Eksport:** Subtitrlarni `.srt`, `.vtt` yoki so‘zma-so‘z vaqtlar saqlangan `.json` formatida saqlash yoki yuklash.

---

### C. Timeline'ga Joylash (AE va Premiere Pro)
Tahrirlash tugagach, **"🎬 Timeline'ga Joylash"** tugmasini bosing:
- **After Effects'da:**
  - Barcha amallar bitta **Undo guruhi** ichida bajariladi (`Ctrl+Z` bosilsa, bir zumda tozalanadi).
  - Har bir jumla markazlashtirilgan chiroyli matn qatlami bo‘lib tushadi.
  - Agar Karaoke rejimi yoqilgan bo‘lsa, har bir so‘z o‘z vaqtida rangini o‘zgartirib (highlight) yonib o‘tadi.
  - Agar `.ffx` animatsiya preseti tanlangan bo‘lsa, qatlamlarga bir zumda o‘sha animatsiya qo‘llaniladi.
- **Premiere Pro'da:**
  - Avtomatik ravishda ketma-ketlikning **Captions** trekiga SRT asosida joylanadi yoki tanlangan **MOGRT** shabloniga matnlar uzatiladi.

---

### D. Stil va Animatsiya Kutubxonasi (.ffx, .mogrt, Shaxsiy Stil)
1. **🎨 Qatlamdan Stilni Saqlash:**
   - After Effects'da o‘zingiz yoqtirgan matn qatlamini yarating (shrift, o‘lcham, stroke, soya, rang, pozitsiyani sozlang).
   - Panelda *"Tanlangan Text Qatlamidan Stilni Saqlash"* tugmasini bosing.
   - Plagin ushbu barcha dizayn parametrlarini o‘qib oladi va yangi preset sifatida saqlaydi!
2. **✨ .ffx Animatsiya Preseti Import:**
   - Istalgan `.ffx` faylini panelga yuklang. Keyingi subtitrlar yaratilishida qatlamlarga ushbu animatsiya avtomatik beriladi.
3. **🎞️ .mogrt Shablon Import:**
   - Premiere Pro uchun tayyor harakatli shablonlarni yuklang va subtitr matnini shablonga bog‘lang.
4. **📦 Stil To‘plamini Eksport / Import Qilish:**
   - Yaratgan stillaringizni `.uzsubpack` fayli ko‘rinishida eksport qilib, hamkasblaringizga yoki do‘stlaringizga yuborishingiz mumkin.

---

## 🔍 5. Ishlab Chiqish va Debugging (Nosozliklarni Tekshirish)

Panel Chrome Developer Tools orqali jonli tekshirishni qo‘llab-quvvatlaydi:
1. Google Chrome brauzerini oching.
2. Manzil satriga yozing:
   - Premiere Pro uchun: `http://localhost:8088`
   - After Effects uchun: `http://localhost:8089`
3. Konsol (`Console`), Tarmoq so‘rovlari (`Network`) va Elementlar (`Elements`) ni bevosita ko‘rishingiz mumkin.

---

## 🛡️ 6. Xavfsizlik va Maxfiylik
- API kalitlar ochiq matn ko‘rinishida saqlanmaydi (`~/.uz_subtitles/config.json` ichida shifrlangan holda joylashadi).
- Lokal Whisper rejimidan foydalanganda hech qanday audio internetga chiqmaydi, 100% kompyuteringizning o‘zida ishlaydi.
