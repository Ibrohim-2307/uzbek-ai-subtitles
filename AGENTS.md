# QAT'IY QOIDALAR VA TAQIQLAR (AGENTS.md)

Loyiha: **O'zbekcha AI Subtitr** (Adobe After Effects & Premiere Pro CEP paneli + FastAPI backend)

Ushbu qoidalar har qanday agent, dasturchi yoki avtomatlashtirilgan vosita uchun **majburiy** hisoblanadi.

---

## 1. REGRESSIYA HIMOYASI VA TEST ETALONI
- **Test etaloni: 9 ta to'plam, 411 ta tekshiruv, 100% yashil (0 yiqilgan).**
  Har qanday kod o'zgarishidan keyin:
  - Windows: `scripts\run_all_tests.bat`
  - Linux / Git Bash: `bash scripts/run_all_tests.sh`
- Hech qachon mavjud testlarni o'chirmang, kamaytirmang yoki "soddalashtirmang". Test soni kamayishi regressiya hisoblanadi.
- Fayllarni butunlay qayta yozish taqiqlanadi — faqat kerakli qismlarni nuqtali tahrir (patch) qiling.

---

## 2. HOST JSX FAYLLARI (EXTENDSCRIPT)
1. **Uch fayl bir xilligi:**
   `host/shared.jsx`, `host/aftereffects.jsx`, `host/premiere.jsx` fayllari **bayt-baytga 100% bir xil** (md5 checksum mos) bo'lishi shart.
   Birortasiga o'zgartirish kiritilsa, darhol qolgan ikkitasiga ham nusxalanishi kerak.
2. **ES3 standarti:**
   Adobe ExtendScript faqat ECMAScript 3 ni qo'llab-quvvatlaydi.
   - `let`, `const`, strelka funksiyalar (`=>`), `class`, shablon satrlar (backtick \`\`), spread (`...`), trailing comma **MUTLAQO TAQIQLANADI**.
   - Faqat `var`, `function`, va klassik `for` tsikllari ishlatiladi.
3. **`openSequence()` taqiqlangan:**
   Premiere Pro'da hech qachon `app.project.openSequence()` chaqirilmasin. Subtitr faqat foydalanuvchi faollashtirgan timeline'ga yoziladi.
4. **`startTime = 0` (After Effects):**
   AE da matn va so'z qatlamlarida `startTime = 0` bo'lishi shart. Vaqt faqat `inPoint` va `outPoint` bilan belgilanadi.
5. **Xavfsiz tozalash:**
   Foydalanuvchining shaxsiy qatlamlarini o'chirib yubormaslik uchun tozalash sikllarida faqat `comment === "UZ_AI_SUBTITLE"` yoki `[UZ_WORD]`, `[UZ-...]` prefiksiga ega bo'lgan panel qatlamlarigina o'chiriladi.

---

## 3. SINXRONIZATSIYA VA BO'LAKLASH
- **Bo'laklash qoidasi:**
  Subtitr bo'laklash so'zlar soni bo'yicha EMAS, balki nutqdagi tabiiy pauzalar va intonatsiya bo'yicha amalga oshiriladi:
  - Majburiy bo'lish: 2 qatorga (28×2 belgi) sig'masa yoki 7 so'zdan oshsa.
  - Tabiiy bo'lish: bo'lak ≥ 12 belgi bo'lsa va: oxirgi so'z `. ! ? …` bilan tugasa; yoki `; : — -` bilan tugasa; yoki keyingi so'zgacha pauza ≥ 0.35 s bo'lsa.
  - Yetim so'z: oxirgi bo'lak < 12 belgi bo'lsa va sig'sa — oldingisiga qo'shiladi.
- **Word start binding:**
  Subtitr boshlanishi qat'iy ravishda uning birinchi so'zi boshlanish vaqtiga bog'lanadi (frameFloor yaxlitlash bilan).
- **FPS aniqligi:**
  Subtitr joylashdan oldin hostdan amaldagi sequence / comp fps qiymati qayta o'qiladi va barcha vaqtlar shu fps panjarasiga moslanadi.
