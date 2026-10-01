/**
 * O'zbekcha AI Subtitr - O'zbek Tili NLP va Vaqt Yordamchilari (uzbekUtils.js)
 * Python (backend/utils/uzbek_nlp.py) bilan 100% bir xil qoidalar:
 * - oʻ va gʻ uchun U+02BB, Ayn uchun U+02BC
 * - Ayn va oʻ/gʻ lug'ati bilan to'g'rilash
 * - Lotin <-> Kirill yo'qotishsiz transliteratsiyasi (Yo'q -> Йўқ)
 * - Sonlarni so'zga aylantirish (100 -> yuz, 1000 -> ming, 3.5 -> uch butun oʻndan besh)
 * - Qat'iy satr chegarasi (splitIntoLines, max 42 belgi, max 2 qator)
 * - Kadr aniqligidagi vaqt (snapToFrame, formatSrtTime, formatFrameTime, parseTimecode)
 * - rechunkSegments: karaoke so'z vaqtlarini saqlagan holda kadrga tekislash
 */

const APOS_OFFICIAL_OG = "\u02bb";   // ʻ
const APOS_OFFICIAL_AYN = "\u02bc";  // ʼ
const APOS_TYPO_OG = "\u2018";       // ‘
const APOS_TYPO_AYN = "\u2019";      // ’
const APOS_ASCII = "'";

const NOT_AYN_WORDS = new Set([
    "don't", "doesn't", "didn't", "isn't", "aren't", "wasn't", "weren't",
    "can't", "couldn't", "won't", "wouldn't", "shouldn't", "hasn't",
    "haven't", "hadn't", "it's", "that's", "there's", "here's", "what's",
    "who's", "where's", "how's", "let's", "i'm", "you're", "we're",
    "they're", "i've", "you've", "we've", "they've", "i'll", "you'll",
    "he'll", "she'll", "we'll", "they'll", "o'clock", "ma'am", "y'all"
]);

const SENTENCE_END_CHARS = [".", "!", "?", "…"];
const CLAUSE_END_CHARS = [",", ";", ":", "—", "-"];

const VALID_SUFFIXES = [
    "larimizning", "laringizning",
    "larimizdan", "laringizdan",
    "larimizga", "larimizda", "larimizni",
    "laringizga", "laringizda", "laringizni",
    "larimiz", "laringiz",
    "larning", "lardan", "larga", "larda", "larni", "lari", "lar",
    "imizning", "ingizning",
    "imizdan", "ingizdan",
    "imizga", "imizda", "imizni",
    "ingizga", "ingizda", "ingizni",
    "imiz", "ingiz",
    "dagi", "ning", "dan", "ga", "da", "ni", "ka", "qa",
    "sizlar", "lik", "siz", "dek", "day", "cha", "dir", "miz",
    "im", "ing", "si", "i"
];

const AYN_WORDS = {
    "malumot": "maʼlumot",
    "suniy": "sunʼiy",
    "talim": "taʼlim",
    "sanat": "sanʼat",
    "qatiy": "qatʼiy",
    "etibor": "eʼtibor",
    "azo": "aʼzo",
    "davo": "daʼvo",
    "elon": "eʼlon",
    "mujiza": "muʼjiza",
    "mano": "maʼno",
    "maruza": "maʼruza",
    "masul": "masʼul",
    "masuliyat": "masʼuliyat",
    "sheriyat": "sheʼriyat",
    "juziy": "juzʼiy",
    "tasir": "taʼsir",
    "tasis": "taʼsis",
    "tamin": "taʼmin",
    "taminot": "taʼminot",
    "tamir": "taʼmir",
    "taziya": "taʼziya",
    "tazim": "taʼzim",
    "taqib": "taʼqib",
    "tajjub": "taajjub",
    "etirof": "eʼtirof",
    "etiqod": "eʼtiqod",
    "etiroz": "eʼtiroz",
    "istemol": "isteʼmol",
    "istidod": "isteʼdod",
    "istefo": "isteʼfo",
    "istezo": "isteʼzo",
    "jurat": "jurʼat",
    "vada": "vaʼda",
    "qita": "qitʼa",
    "inom": "inʼom",
    "hayat": "hayʼat",
    "mashal": "mashʼal",
    "shula": "shuʼla",
    "mamur": "maʼmur",
    "mamuriy": "maʼmuriy",
    "mamuriyat": "maʼmuriyat",
    "manaviy": "maʼnaviy",
    "manaviyat": "maʼnaviyat",
    "marifat": "maʼrifat",
    "marifiy": "maʼrifiy",
    "bidat": "bidʼat",
    "taluf": "taʼluf",
    "masum": "maʼsum",
    "masuma": "maʼsuma",
    "mashum": "mashʼum",
    "malun": "malʼun",
    "maruf": "maʼruf",
    "mutadil": "muʼtadil",
    "mutabar": "muʼtabar",
    "shuba": "shuʼba",
    "tabiya": "taʼbiya",
    "taviz": "taʼviz",
    "tazid": "taʼzid",
    "mavo": "maʼvo",
    "taluqli": "taalluqli",
    "talassuf": "taʼassuf",
    "taassurot": "taassurot",
    "badia": "baʼdia",
    "shulaning": "shuʼlaning"
};

const OG_EXCEPTIONS = {
    "yolgon": "yolgʻon",
    "yolgonchi": "yolgʻonchi",
    "yolgonchilik": "yolgʻonchilik",
    "yolgonchilar": "yolgʻonchilar"
};

const OG_WORDS = {
    "ozbek": "oʻzbek",
    "ozbekiston": "oʻzbekiston",
    "ozbekcha": "oʻzbekcha",
    "ozbeklar": "oʻzbeklar",
    "togri": "toʻgʻri",
    "togrilik": "toʻgʻrilik",
    "togrida": "toʻgʻrida",
    "yol": "yoʻl",
    "yoq": "yoʻq",
    "kop": "koʻp",
    "kocha": "koʻcha",
    "boyicha": "boʻyicha",
    "organish": "oʻrganish",
    "orgatish": "oʻrgatish",
    "ozgarish": "oʻzgarish",
    "ozgaradi": "oʻzgaradi",
    "galla": "gʻalla",
    "gisht": "gʻisht",
    "goya": "gʻoya",
    "osha": "oʻsha",
    "golib": "gʻolib",
    "golibiyat": "gʻolibiyat",
    "gor": "gʻor",
    "goz": "gʻoz",
    "qongiz": "qoʻngʻiz",
    "yomgir": "yomgʻir",
    "bogiq": "bogʻiq",
    "tog": "togʻ",
    "bog": "bogʻ",
    "yogi": "yogʻi",
    "bolishi": "boʻlishi",
    "boladi": "boʻladi",
    "boldi": "boʻldi",
    "bolgan": "boʻlgan",
    "bolsa": "boʻlsa",
    "bolmoq": "boʻlmoq",
    "kora": "koʻra",
    "korish": "koʻrish",
    "kordim": "koʻrdim",
    "kordi": "koʻrdi",
    "korik": "koʻrik",
    "kongil": "koʻngil",
    "goncha": "gʻuncha",
    "gildirak": "gʻildirak",
    "togon": "toʻgʻon",
    "dog": "dogʻ",
    "chog": "chogʻ",
    "yorgak": "yoʻrgak",
    "yorgalash": "yoʻrgalash",
    "yolbars": "yoʻlbars",
    "yolchi": "yoʻlchi",
    "bolim": "boʻlim",
    "boyi": "boʻyi",
    "orinda": "oʻrinda",
    "orin": "oʻrin"
};

const CYR_TO_LAT_MAP = {
    'А': 'A', 'а': 'a',
    'Б': 'B', 'б': 'b',
    'В': 'V', 'в': 'v',
    'Г': 'G', 'г': 'g',
    'Д': 'D', 'д': 'd',
    'Е': 'E', 'е': 'e',
    'Ж': 'J', 'ж': 'j',
    'З': 'Z', 'з': 'z',
    'И': 'I', 'и': 'i',
    'Й': 'Y', 'й': 'y',
    'К': 'K', 'к': 'k',
    'Л': 'L', 'л': 'l',
    'М': 'M', 'м': 'm',
    'Н': 'N', 'н': 'n',
    'О': 'O', 'о': 'o',
    'П': 'P', 'п': 'p',
    'Р': 'R', 'р': 'r',
    'С': 'S', 'с': 's',
    'Т': 'T', 'т': 't',
    'У': 'U', 'у': 'u',
    'Ф': 'F', 'ф': 'f',
    'Х': 'X', 'х': 'x',
    'Ҳ': 'H', 'ҳ': 'h',
    'Қ': 'Q', 'қ': 'q',
    'Ғ': 'Gʻ', 'ғ': 'gʻ',
    'Ў': 'Oʻ', 'ў': 'oʻ',
    'Ч': 'Ch', 'ч': 'ch',
    'Ш': 'Sh', 'ш': 'sh',
    'Щ': 'Sh', 'щ': 'sh',
    'Ъ': APOS_OFFICIAL_AYN, 'ъ': APOS_OFFICIAL_AYN,
    'Ь': '', 'ь': '',
    'Э': 'E', 'э': 'e',
    'Ю': 'Yu', 'ю': 'yu',
    'Я': 'Ya', 'я': 'ya',
    'Ё': 'Yo', 'ё': 'yo',
    'Ц': 'Ts', 'ц': 'ts'
};

const LAT_TO_CYR_SINGLE = {
    'A': 'А', 'a': 'а',
    'B': 'Б', 'b': 'б',
    'D': 'Д', 'd': 'д',
    'E': 'Е', 'e': 'е',
    'F': 'Ф', 'f': 'ф',
    'G': 'Г', 'g': 'г',
    'H': 'Ҳ', 'h': 'ҳ',
    'I': 'И', 'i': 'и',
    'J': 'Ж', 'j': 'ж',
    'K': 'К', 'k': 'к',
    'L': 'Л', 'l': 'л',
    'M': 'М', 'm': 'м',
    'N': 'Н', 'n': 'н',
    'O': 'О', 'o': 'о',
    'P': 'П', 'p': 'п',
    'Q': 'Қ', 'q': 'қ',
    'R': 'Р', 'r': 'р',
    'S': 'С', 's': 'с',
    'T': 'Т', 't': 'т',
    'U': 'У', 'u': 'у',
    'V': 'В', 'v': 'в',
    'X': 'Х', 'x': 'х',
    'Y': 'Й', 'y': 'й',
    'Z': 'З', 'z': 'з',
    [APOS_OFFICIAL_AYN]: 'ъ',
    "'": 'ъ', "’": 'ъ', "‘": 'ъ', "`": 'ъ'
};

const UZ_ONES = ["", "bir", "ikki", "uch", "toʻrt", "besh", "olti", "yetti", "sakkiz", "toʻqqiz"];
const UZ_TENS = ["", "oʻn", "yigirma", "oʻttiz", "qirq", "ellik", "oltmish", "yetmish", "sakson", "toʻqson"];
const DECIMAL_NAMES = {
    1: "oʻndan",
    2: "yuzdan",
    3: "mingdan",
    4: "oʻn mingdan",
    5: "yuz mingdan",
    6: "milliondan"
};

function matchCase(orig, target) {
    if (!orig || !target) return target || "";
    if (orig === orig.toUpperCase() && orig.length > 1) {
        return target.toUpperCase();
    }
    if (orig[0] === orig[0].toUpperCase()) {
        return target[0].toUpperCase() + target.slice(1);
    }
    return target.toLowerCase();
}

function replaceWordFromDict(token, dict, exceptions) {
    const m = token.match(/^(\W*)([a-zA-Z\u02bb\u02bc'`´‘’ʻʼ′]+)(\W*)$/);
    if (!m) return token;
    const prefix = m[1];
    const body = m[2];
    const suffix = m[3];
    const bodyLow = body.toLowerCase();

    if (exceptions && exceptions[bodyLow]) {
        return prefix + matchCase(body, exceptions[bodyLow]) + suffix;
    }
    if (dict && dict[bodyLow]) {
        return prefix + matchCase(body, dict[bodyLow]) + suffix;
    }

    for (let i = 0; i < VALID_SUFFIXES.length; i++) {
        const sfx = VALID_SUFFIXES[i];
        if (bodyLow.endsWith(sfx)) {
            const stem = bodyLow.slice(0, -sfx.length);
            if (exceptions && exceptions[stem]) {
                const target = exceptions[stem] + sfx;
                return prefix + matchCase(body, target) + suffix;
            }
            if (dict && dict[stem]) {
                const target = dict[stem] + sfx;
                return prefix + matchCase(body, target) + suffix;
            }
        }
    }
    return token;
}

const UzbekUtils = {
    _hostFps: 25.0,

    setHostFps(fps) {
        const val = parseFloat(fps);
        if (!isNaN(val) && val > 0) {
            this._hostFps = val;
        }
    },

    getHostFps() {
        return this._hostFps || 25.0;
    },

    // ==================== 1. BELGILAR STANDARTI ====================

    fixOg(text, apos = APOS_OFFICIAL_OG) {
        if (!text) return "";
        return text.replace(/([oOgG])\s*['`´‘’ʻʼ′]/g, (match, p1) => p1 + apos);
    },

    fixAyn(text, ayn = APOS_OFFICIAL_AYN) {
        if (!text) return "";
        const tokens = text.split(/(\s+)/);
        const res = tokens.map(token => {
            if (!token || /^\s+$/.test(token)) return token;
            const m = token.match(/^(\W*)([\w'`´‘’ʻʼ′]+)(\W*)$/);
            if (!m) return token;
            const pfx = m[1];
            const body = m[2];
            const sfx = m[3];

            const normAscii = body.toLowerCase().replace(/['`´‘’ʻʼ′]/g, "'");
            if (NOT_AYN_WORDS.has(normAscii)) return token;

            const newBody = body.replace(/([^\W\d_ogOG])['`´‘’ʻʼ′]([^\W\d_])/g, `$1${ayn}$2`);
            return pfx + newBody + sfx;
        });
        return res.join("");
    },

    fixOgWords(text) {
        if (!text) return "";
        const tokens = text.split(/(\s+)/);
        return tokens.map(t => {
            if (!t || /^\s+$/.test(t)) return t;
            return replaceWordFromDict(t, OG_WORDS, OG_EXCEPTIONS);
        }).join("");
    },

    fixAynWords(text) {
        if (!text) return "";
        const tokens = text.split(/(\s+)/);
        return tokens.map(t => {
            if (!t || /^\s+$/.test(t)) return t;
            return replaceWordFromDict(t, AYN_WORDS, null);
        }).join("");
    },

    normalizeUzbekText(text) {
        if (!text) return "";
        let t = this.fixOg(text, APOS_OFFICIAL_OG);
        t = this.fixAyn(t, APOS_OFFICIAL_AYN);
        t = this.fixOgWords(t);
        t = this.fixAynWords(t);
        t = this.fixOg(t, APOS_OFFICIAL_OG);
        t = this.fixAyn(t, APOS_OFFICIAL_AYN);
        return t;
    },

    normalizeUzbek(text) {
        return this.normalizeUzbekText(text);
    },

    normalizeToStyle(text, style = "official") {
        const base = this.normalizeUzbekText(text);
        if (style === "official") return base;
        if (style === "typographic") {
            return base.replace(/([oOgG])\u02bb/g, `$1${APOS_TYPO_OG}`).replace(/\u02bc/g, APOS_TYPO_AYN);
        }
        if (style === "ascii") {
            return base.replace(/([oOgG])\u02bb/g, `$1${APOS_ASCII}`).replace(/\u02bc/g, APOS_ASCII);
        }
        return base;
    },

    // ==================== 4. LOTIN <-> KIRILL ====================

    kirillToLotin(text) {
        if (!text) return "";
        let res = text;
        res = res.replace(/ЙЎ/g, 'YOʻ');
        res = res.replace(/Йў/g, 'Yoʻ');
        res = res.replace(/йў/g, 'yoʻ');

        res = res.replace(/(^|[\s\(\[\{\<\.,:;!?\n\r"«\'\-])([Ее])/g, (m, p1, p2) => {
            const isUp = (p2 === 'Е');
            return p1 + (isUp ? (m.toUpperCase() === m ? 'YE' : 'Ye') : 'ye');
        });
        res = res.replace(/([АаОоУуИиЭэЎўЁёЮюЯя])([Ее])/g, (m, p1, p2) => {
            const isUp = (p2 === 'Е');
            return p1 + (isUp ? 'Ye' : 'ye');
        });

        const out = [];
        for (let i = 0; i < res.length; i++) {
            const ch = res[i];
            out.push(CYR_TO_LAT_MAP[ch] !== undefined ? CYR_TO_LAT_MAP[ch] : ch);
        }
        return this.normalizeUzbekText(out.join(""));
    },

    lotinToKirill(text) {
        if (!text) return "";
        const normalized = this.normalizeUzbekText(text);

        let res = normalized.replace(/(^|[\s\(\[\{\<\.,:;!?\n\r"«\'\-])([Ee])/g, (m, p1, p2) => {
            return p1 + (p2 === 'E' ? 'Э' : 'э');
        });

        const compoundRules = [
            ["YOʻ", "ЙЎ"], ["Yoʻ", "Йў"], ["yoʻ", "йў"],
            ["YO'", "ЙЎ"], ["Yo'", "Йў"], ["yo'", "йў"],
            ["YO`", "ЙЎ"], ["Yo`", "Йў"], ["yo`", "йў"],
            ["YO‘", "ЙЎ"], ["Yo‘", "Йў"], ["yo‘", "йў"],
            ["Oʻ", "Ў"], ["oʻ", "ў"],
            ["Gʻ", "Ғ"], ["gʻ", "ғ"],
            ["O'", "Ў"], ["o'", "ў"],
            ["G'", "Ғ"], ["g'", "ғ"],
            ["O`", "Ў"], ["o`", "ў"],
            ["G`", "Ғ"], ["g`", "ғ"],
            ["O‘", "Ў"], ["o‘", "ў"],
            ["G‘", "Ғ"], ["g‘", "ғ"],
            ["CH", "Ч"], ["Ch", "Ч"], ["ch", "ч"],
            ["SH", "Ш"], ["Sh", "Ш"], ["sh", "ш"],
            ["YO", "Ё"], ["Yo", "Ё"], ["yo", "ё"],
            ["YU", "Ю"], ["Yu", "Ю"], ["yu", "ю"],
            ["YA", "Я"], ["Ya", "Я"], ["ya", "я"],
            ["YE", "Е"], ["Ye", "Е"], ["ye", "е"],
            ["TS", "Ц"], ["Ts", "Ц"], ["ts", "ц"]
        ];

        for (let i = 0; i < compoundRules.length; i++) {
            const pair = compoundRules[i];
            res = res.split(pair[0]).join(pair[1]);
        }

        const out = [];
        for (let i = 0; i < res.length; i++) {
            const ch = res[i];
            out.push(LAT_TO_CYR_SINGLE[ch] !== undefined ? LAT_TO_CYR_SINGLE[ch] : ch);
        }
        return out.join("");
    },

    // ==================== 5. O'ZBEKCHA SONLAR ====================

    numberToUzbekWords(n) {
        if (n === 0) return "nol";
        if (n < 0) return "minus " + this.numberToUzbekWords(Math.abs(n));

        const words = [];
        let num = Math.floor(n);

        if (num >= 1000000000) {
            const bil = Math.floor(num / 1000000000);
            num %= 1000000000;
            words.push(this.numberToUzbekWords(bil) + " milliard");
        }

        if (num >= 1000000) {
            const mil = Math.floor(num / 1000000);
            num %= 1000000;
            words.push(this.numberToUzbekWords(mil) + " million");
        }

        if (num >= 1000) {
            const th = Math.floor(num / 1000);
            num %= 1000;
            if (th === 1) {
                words.push("ming");
            } else {
                words.push(this.numberToUzbekWords(th) + " ming");
            }
        }

        if (num >= 100) {
            const h = Math.floor(num / 100);
            num %= 100;
            if (h === 1) {
                words.push("yuz");
            } else {
                words.push(UZ_ONES[h] + " yuz");
            }
        }

        if (num >= 10) {
            const t = Math.floor(num / 10);
            num %= 10;
            words.push(UZ_TENS[t]);
        }

        if (num > 0) {
            words.push(UZ_ONES[num]);
        }

        return words.filter(Boolean).join(" ").trim();
    },

    replaceNumbersWithWords(text) {
        if (!text) return "";
        const protectedItems = [];

        function saveProt(m) {
            protectedItems.push(m);
            return `__PROT_${protectedItems.length - 1}__`;
        }

        let res = text.replace(/\b\d{1,2}:\d{2}(?::\d{2})?\b/g, saveProt);
        res = res.replace(/\b\d+(?:[\.,]\d+)?%/g, saveProt);
        res = res.replace(/\b[vV]\d+(?:\.\d+)*\b/g, saveProt);
        res = res.replace(/\b\d+(?:-\d+)+\b/g, saveProt);
        res = res.replace(/\+\d{7,15}\b/g, saveProt);

        // Bo'shliq bilan yozilgan sonlar (1 000 000 -> 1000000)
        res = res.replace(/\b(\d{1,3}(?:\s+\d{3})+)\b/g, m => m.replace(/\s+/g, ''));

        // Kasr sonlar (3.5 -> uch butun oʻndan besh)
        res = res.replace(/(?<!\w)([-+]?)(\d+)[\.,](\d+)(?!\w)/g, (match, sign, whole, frac) => {
            const wholeVal = parseInt(whole, 10);
            const fracVal = parseInt(frac, 10);
            const fracLen = frac.length;
            const decName = DECIMAL_NAMES[fracLen] || `10^${fracLen}-dan`;
            const prefix = (sign === "-") ? "minus " : "";
            const wholeW = this.numberToUzbekWords(wholeVal);
            const fracW = this.numberToUzbekWords(fracVal);
            return `${prefix}${wholeW} butun ${decName} ${fracW}`;
        });

        // Butun sonlar
        res = res.replace(/(?<!\w)([-+]?)(\d+)(?!\w)/g, (match, sign, numStr) => {
            const val = parseInt(numStr, 10);
            if (val >= 0 && val <= 999999999999) {
                const prefix = (sign === "-") ? "minus " : "";
                return prefix + this.numberToUzbekWords(val);
            }
            return match;
        });

        for (let i = 0; i < protectedItems.length; i++) {
            res = res.replace(`__PROT_${i}__`, protectedItems[i]);
        }
        return res;
    },

    // ==================== 6. SUBTITR SATRLARI ====================

    splitIntoLines(text, maxChars = 42, maxLines = 2) {
        const clean = (text || "").trim().replace(/\s+/g, " ");
        if (!clean) return [];
        const words = clean.split(" ").filter(Boolean);
        if (words.length === 0) return [];

        if (clean.length <= maxChars && words.length <= 5) {
            return [clean];
        }

        if (maxLines === 2) {
            let bestSplit = null;
            let bestPenalty = Infinity;

            for (let i = 1; i < words.length; i++) {
                const line1 = words.slice(0, i).join(" ");
                const line2 = words.slice(i).join(" ");

                if (words.slice(0, i).length > 1 && line1.length > maxChars) continue;
                if (words.slice(i).length > 1 && line2.length > maxChars) continue;

                if (line1.length <= maxChars && line2.length <= maxChars) {
                    let penalty = Math.abs(line1.length - line2.length) * 10;
                    if (words.slice(i).length === 1) penalty += 250;
                    if (words.slice(0, i).length === 1) penalty += 150;
                    if (line2 && /^[,\.?!;:\-—]/.test(line2)) penalty += 500;
                    if (line1.endsWith("…") || line1.endsWith("...")) penalty += 120;

                    if (penalty < bestPenalty) {
                        bestPenalty = penalty;
                        bestSplit = [line1, line2];
                    }
                }
            }
            if (bestSplit) return bestSplit;
        }

        const lines = [];
        let curWords = [];
        let curLen = 0;

        for (let i = 0; i < words.length; i++) {
            const w = words[i];
            const added = curWords.length === 0 ? w.length : curLen + 1 + w.length;
            if (curWords.length > 0 && added > maxChars) {
                lines.push(curWords.join(" "));
                curWords = [w];
                curLen = w.length;
            } else {
                curWords.push(w);
                curLen = added;
            }
        }
        if (curWords.length > 0) lines.push(curWords.join(" "));
        return lines;
    },

    splitLongSegment(text, maxChars = 42, maxLines = 2) {
        const lines = this.splitIntoLines(text, maxChars, maxLines);
        if (lines.length === 0) return [];
        const blocks = [];
        for (let i = 0; i < lines.length; i += maxLines) {
            blocks.push(lines.slice(i, i + maxLines).join("\n"));
        }
        return blocks;
    },

    // ==================== 7. VAQT — KADR ANIQLIGI ====================

    snapToFrame(t, fps) {
        // DIQQAT: 6 o'nlik kasr 30/60 fps da kadrni buzadi (3.016667*60 = 181.00002)
        const f = (fps && fps > 0) ? fps : (this.getHostFps ? this.getHostFps() : 25.0);
        return Number((Math.round(t * f) / f).toFixed(9));
    },

    isOnFrame(t, fps) {
        const f = (fps && fps > 0) ? fps : (this.getHostFps ? this.getHostFps() : 25.0);
        return Math.abs(t * f - Math.round(t * f)) < 1e-6;
    },

    frameFloor(t, fps) {
        const f = (fps && fps > 0) ? fps : (this.getHostFps ? this.getHostFps() : 25.0);
        return Number((Math.floor(Number((t * f).toFixed(6))) / f).toFixed(9));
    },

    frameCeil(t, fps) {
        const f = (fps && fps > 0) ? fps : (this.getHostFps ? this.getHostFps() : 25.0);
        return Number((Math.ceil(Number((t * f).toFixed(6))) / f).toFixed(9));
    },

    snapBeats(beats, fps) {        // har bir beatni kadrga moslaydi + frame raqami
        const f = parseFloat(fps) || (this.getHostFps ? this.getHostFps() : 25.0);
        if (!f || f <= 0) return beats;
        return (beats || []).map(b => Object.assign({}, b, {
            time: this.snapToFrame(parseFloat(b.time) || 0, f),
            frame: Math.round((parseFloat(b.time) || 0) * f)
        }));
    },

    dedupeBeats(beats, fps) {      // bir kadrga tushganlarni birlashtiradi (kuchlirog'i qoladi)
        const f = parseFloat(fps) || 0;
        const minGap = f > 0 ? 1 / f : 0.02;
        const out = [];
        (beats || []).slice().sort((a, b) => (parseFloat(a.time) || 0) - (parseFloat(b.time) || 0)).forEach(b => {
            const bTime = parseFloat(b.time) || 0;
            if (out.length && Math.abs(bTime - (parseFloat(out[out.length - 1].time) || 0)) < minGap - 1e-9) {
                if ((parseFloat(b.strength) || 0) > (parseFloat(out[out.length - 1].strength) || 0)) {
                    out[out.length - 1] = b;
                }
                return;
            }
            out.push(b);
        });
        return out;
    },

    beatTolerance(fps, frames) {   // 2 kadr (0.12 s QAT'IY EMAS — 60 fps da bu 7 kadr!)
        const f = parseFloat(fps) || (this.getHostFps ? this.getHostFps() : 25.0);
        return (f > 0) ? ((frames || 2) / f) : 0.08;
    },

    beatToTimelineTime(tAudio, clip) {           // clip = {start, inPoint, speed, fps}
        const start   = parseFloat(clip.start) || 0;
        const inPoint = parseFloat(clip.inPoint) || 0;
        const speed   = (parseFloat(clip.speed) > 0) ? parseFloat(clip.speed) : 1;
        let t = start + (tAudio - inPoint) / speed;
        if (t < 0) t = 0;
        const fps = parseFloat(clip.fps);
        return fps > 0 ? this.snapToFrame(t, fps) : t;   // KADRGA MOSLASH shart
    },

    beatsToTimeline(beats, clip) {               // audio vaqtni ham saqlaydi
        const fps = parseFloat(clip.fps) || 0;
        return (beats || []).map((b, i) => {
            const tAudio = parseFloat(b.time) || 0;
            const t = this.beatToTimelineTime(tAudio, clip);
            const out = Object.assign({}, b, {
                index: b.index || (i + 1),
                audio_time: Number(tAudio.toFixed(4)),   // waveform uchun
                time: Number(t.toFixed(6))               // host uchun (timeline vaqti)
            });
            if (fps > 0) out.frame = Math.round(t * fps);
            return out;
        });
    },

    formatSrtTime(t) {
        const secVal = Math.max(0, parseFloat(t) || 0);
        let hrs = Math.floor(secVal / 3600);
        let mins = Math.floor((secVal % 3600) / 60);
        let secs = Math.floor(secVal % 60);
        let ms = Math.round((secVal - Math.floor(secVal)) * 1000);
        if (ms >= 1000) { secs++; ms -= 1000; }
        if (secs >= 60) { mins++; secs -= 60; }
        if (mins >= 60) { hrs++; mins -= 60; }

        return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
    },

    formatFrameTime(t, fps = 25.0) {
        const f = (fps && fps > 0) ? fps : 25.0;
        const secVal = Math.max(0, parseFloat(t) || 0);
        const totalFrames = Math.round(secVal * f);
        const fpsInt = Math.max(1, Math.round(f));

        const ff = totalFrames % fpsInt;
        const totalSecs = Math.floor(totalFrames / fpsInt);
        const ss = totalSecs % 60;
        const mm = Math.floor(totalSecs / 60) % 60;
        const hh = Math.floor(totalSecs / 3600);

        return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}:${String(ff).padStart(2, '0')}`;
    },

    parseTimecode(s, fps = 25.0) {
        if (!s) return 0;
        const f = (fps && fps > 0) ? fps : 25.0;
        let clean = String(s).trim().replace(',', '.');

        const parts = clean.split(':');
        if (parts.length === 4) {
            const hh = parseInt(parts[0], 10) || 0;
            const mm = parseInt(parts[1], 10) || 0;
            const ss = parseInt(parts[2], 10) || 0;
            const ff = parseInt(parts[3], 10) || 0;
            const total = (hh * 3600 + mm * 60 + ss) * f + ff;
            return Number((total / f).toFixed(6));
        }
        if (parts.length === 3) {
            const hh = parseFloat(parts[0]) || 0;
            const mm = parseFloat(parts[1]) || 0;
            const ss = parseFloat(parts[2]) || 0;
            return Number((hh * 3600 + mm * 60 + ss).toFixed(6));
        }
        if (parts.length === 2) {
            const mm = parseFloat(parts[0]) || 0;
            const ss = parseFloat(parts[1]) || 0;
            return Number((mm * 60 + ss).toFixed(6));
        }
        return Number((parseFloat(clean) || 0).toFixed(6));
    },

    formatTime(seconds) {
        return this.formatSrtTime(seconds).replace(',', '.');
    },

    parseTime(timeStr) {
        return this.parseTimecode(timeStr, this.getHostFps());
    },

    // ==================== 8. SO'ZLARNI BO'LAKLASH (SMART CHUNKING) ====================

    chunkWordsSmart(words, options = {}) {
        const maxCharsLine = (options && options.maxCharsLine) || 28;
        const maxLines = (options && options.maxLines) || 2;
        const maxWords = (options && options.maxWords) || 7;
        const minChunkChars = (options && options.minChunkChars) || 12;
        const pauseThreshold = (options && options.pauseThreshold !== undefined) ? options.pauseThreshold : 0.35;
        const maxTotalChars = maxCharsLine * maxLines;

        if (!words || words.length === 0) return [];

        function chunkCharLen(chunk) {
            if (!chunk || chunk.length === 0) return 0;
            return chunk.map(w => (w.word || "").trim()).join(" ").length;
        }

        const chunks = [];
        let currChunk = [];

        for (let i = 0; i < words.length; i++) {
            const w = words[i];
            const wText = (w.word || "").trim();
            const wLen = wText.length;

            if (currChunk.length === 0) {
                currChunk.push(w);
                continue;
            }

            const proposedLen = chunkCharLen(currChunk) + 1 + wLen;
            const proposedWordCount = currChunk.length + 1;

            const forcedSplit = (proposedWordCount > maxWords) || (proposedLen > maxTotalChars);

            if (forcedSplit) {
                chunks.push(currChunk);
                currChunk = [w];
                continue;
            }

            const prevW = currChunk[currChunk.length - 1];
            const prevText = (prevW.word || "").trim();
            const currChars = chunkCharLen(currChunk);

            const lastChar = prevText.length > 0 ? prevText.slice(-1) : "";
            const hasSentenceEnd = SENTENCE_END_CHARS.indexOf(lastChar) !== -1 || prevText.endsWith("...");
            const hasClauseEnd = CLAUSE_END_CHARS.indexOf(lastChar) !== -1;

            const prevEnd = parseFloat(prevW.end) || 0.0;
            const currStart = parseFloat(w.start) || 0.0;
            const pauseSec = currStart - prevEnd;
            const hasPause = pauseSec >= pauseThreshold;

            const naturalSplit = (currChars >= minChunkChars) && (hasSentenceEnd || hasClauseEnd || hasPause);

            if (naturalSplit) {
                chunks.push(currChunk);
                currChunk = [w];
            } else {
                currChunk.push(w);
            }
        }

        if (currChunk.length > 0) {
            chunks.push(currChunk);
        }

        // Yetim so'z (orphan merge)
        if (chunks.length >= 2) {
            const lastC = chunks[chunks.length - 1];
            const lastLen = chunkCharLen(lastC);
            if (lastLen < minChunkChars) {
                const prevC = chunks[chunks.length - 2];
                const combinedLen = chunkCharLen(prevC) + 1 + lastLen;
                if (combinedLen <= maxTotalChars) {
                    chunks[chunks.length - 2] = prevC.concat(lastC);
                    chunks.pop();
                }
            }
        }

        return chunks;
    },

    // ==================== 9. RECHUNK SEGMENTS ====================

    rechunkSegments(segments, options = {}) {
        const fps = options.fps || this.getHostFps() || 25.0;
        const maxChars = options.maxChars || 28;
        const maxLines = options.maxLines || 2;
        const normalize = options.normalize !== false;
        const oneFrameSec = Number((1.0 / fps).toFixed(6));

        if (!segments || segments.length === 0) return [];
        const result = [];
        let globalId = 1;

        for (let sIdx = 0; sIdx < segments.length; sIdx++) {
            const seg = segments[sIdx];
            let rawWords = (seg.words && seg.words.length > 0) ? seg.words : null;

            if (rawWords && rawWords.length > 0) {
                const wordsList = rawWords.map(w => ({
                    ...w,
                    word: normalize ? this.normalizeUzbekText(w.word) : w.word,
                    start: this.snapToFrame(w.start, fps),
                    end: this.snapToFrame(w.end, fps)
                }));

                const chunks = this.chunkWordsSmart(wordsList, {
                    maxCharsLine: maxChars,
                    maxLines: maxLines,
                    maxWords: 7,
                    minChunkChars: 12,
                    pauseThreshold: 0.35
                });

                for (let c = 0; c < chunks.length; c++) {
                    const ch = chunks[c];
                    // Word start binding: birinchi so'zning kadrga tushgan vaqtiga qat'iy bog'lash
                    let cStart = this.snapToFrame(ch[0].start, fps);
                    let cEnd = this.snapToFrame(ch[ch.length - 1].end, fps);
                    if (cEnd <= cStart) {
                        cEnd = this.snapToFrame(cStart + oneFrameSec, fps);
                    }
                    const chText = this.splitIntoLines(ch.map(x => x.word).join(" "), maxChars, maxLines).join("\n");

                    result.push({
                        ...seg,
                        id: globalId++,
                        start: cStart,
                        end: cEnd,
                        text: chText,
                        words: ch
                    });
                }
            } else {
                let segText = normalize ? this.normalizeUzbekText(seg.text || "") : (seg.text || "");
                const blocks = this.splitLongSegment(segText, maxChars, maxLines);
                if (blocks.length <= 1) {
                    const cStart = this.snapToFrame(seg.start, fps);
                    let cEnd = this.snapToFrame(seg.end, fps);
                    if (cEnd <= cStart) cEnd = this.snapToFrame(cStart + oneFrameSec, fps);
                    result.push({
                        ...seg,
                        id: globalId++,
                        start: cStart,
                        end: cEnd,
                        text: blocks[0] || segText
                    });
                } else {
                    const totalDur = Math.max(oneFrameSec * blocks.length, (seg.end - seg.start));
                    const durPerBlock = totalDur / blocks.length;
                    for (let b = 0; b < blocks.length; b++) {
                        const cStart = this.snapToFrame(seg.start + b * durPerBlock, fps);
                        let cEnd = this.snapToFrame(seg.start + (b + 1) * durPerBlock, fps);
                        if (cEnd <= cStart) cEnd = this.snapToFrame(cStart + oneFrameSec, fps);
                        result.push({
                            ...seg,
                            id: globalId++,
                            start: cStart,
                            end: cEnd,
                            text: blocks[b]
                        });
                    }
                }
            }
        }
        return result;
    },

    // ==================== 10. SO'ZMA-SO'Z KASKAD REJASI (WORD PLAN) ====================

    buildWordPlan(segments, options = {}) {
        const fps = (options && options.fps > 0) ? options.fps : (this.getHostFps ? this.getHostFps() : 25.0);
        const maxLines = (options && options.maxLines > 0) ? Math.min(Math.max(1, parseInt(options.maxLines, 10)), 5) : 2;
        const pauseHold = options && options.pauseHold !== undefined ? !!options.pauseHold : true;
        const pauseThresholdSec = options && options.pauseThresholdSec !== undefined ? parseFloat(options.pauseThresholdSec) : 0.8;
        const inAnimDuration = options && options.inAnimDuration !== undefined ? parseFloat(options.inAnimDuration) : 0.12;
        const closeAnimDuration = options && options.closeAnimDuration !== undefined ? parseFloat(options.closeAnimDuration) : 0.10;
        const minWordDur = Math.max(1 / fps, options.minWordDuration || 0.08);
        const charRevealOpt = !!(options && options.charReveal);

        const rawList = [];
        const segList = Array.isArray(segments) ? segments : (segments ? [segments] : []);

        for (let sIdx = 0; sIdx < segList.length; sIdx++) {
            const seg = segList[sIdx];
            if (!seg) continue;
            if (Array.isArray(seg.words) && seg.words.length > 0) {
                for (let wIdx = 0; wIdx < seg.words.length; wIdx++) {
                    const w = seg.words[wIdx];
                    if (!w) continue;
                    const wText = this.normalizeUzbekText ? this.normalizeUzbekText(w.word || w.text || "") : (w.word || w.text || "");
                    const clean = wText.trim();
                    if (!clean) continue;
                    rawList.push({
                        segIdx: sIdx,
                        wordIdx: wIdx,
                        word: clean,
                        start: parseFloat(w.start) || 0,
                        end: parseFloat(w.end) || 0,
                        confidence: (w.confidence !== undefined) ? parseFloat(w.confidence) : 1.0,
                        pauseAfterMs: (typeof w.pause_after_ms === "number") ? w.pause_after_ms : null
                    });
                }
            } else if (seg.word || seg.text) {
                const segText = this.normalizeUzbekText ? this.normalizeUzbekText(seg.word || seg.text || "") : (seg.word || seg.text || "");
                const wordsSplit = segText.trim().split(/\s+/).filter(Boolean);
                const sStart = parseFloat(seg.start) || 0;
                const sEnd = parseFloat(seg.end) || (sStart + 0.5);
                const dur = Math.max(minWordDur * wordsSplit.length, sEnd - sStart);
                const step = dur / Math.max(1, wordsSplit.length);
                for (let wIdx = 0; wIdx < wordsSplit.length; wIdx++) {
                    rawList.push({
                        segIdx: sIdx,
                        wordIdx: wIdx,
                        word: wordsSplit[wIdx],
                        start: sStart + wIdx * step,
                        end: sStart + (wIdx + 1) * step,
                        confidence: 1.0,
                        pauseAfterMs: null
                    });
                }
            }
        }

        if (rawList.length === 0) {
            return {
                words: [],
                stats: { totalWords: 0, maxLines: maxLines, maxLinesUsed: 0, pauseCount: 0, lineShiftCount: 0, fps: fps }
            };
        }

        // Vaqt bo'yicha saralash
        rawList.sort((a, b) => a.start - b.start);

        const plannedWords = [];
        const activeSlots = new Array(maxLines).fill(null);
        let maxLinesUsed = 0;
        let lineShiftCount = 0;
        let pauseCount = 0;

        for (let i = 0; i < rawList.length; i++) {
            const cur = rawList[i];

            // 1. inPoint kadrga pastga (hech qachon kechikmaslik uchun)
            const inPoint = this.frameFloor(cur.start, fps);

            // inAnimEnd kadrga tekislangan
            let inAnimEnd = this.snapToFrame(inPoint + inAnimDuration, fps);
            if (inAnimEnd <= inPoint) inAnimEnd = this.snapToFrame(inPoint + (1 / fps), fps);

            // wordEnd nutqning tabiiy yakuni
            let rawEnd = Math.max(cur.start + minWordDur, cur.end);
            let wordEnd = this.snapToFrame(rawEnd, fps);
            if (wordEnd <= inPoint) wordEnd = this.snapToFrame(inPoint + minWordDur, fps);

            // Pauza tekshiruvi (oldingi so'z bilan oraliq)
            const prev = (i > 0) ? rawList[i - 1] : null;
            let hadPauseBefore = false;
            if (prev) {
                const gap = cur.start - prev.end;
                if (gap >= pauseThresholdSec || (prev.pauseAfterMs && prev.pauseAfterMs >= pauseThresholdSec * 1000)) {
                    hadPauseBefore = true;
                    pauseCount++;
                }
            }

            // Agar pauza bo'lgan bo'lsa:
            if (hadPauseBefore) {
                for (let l = 0; l < maxLines; l++) {
                    const slot = activeSlots[l];
                    if (slot) {
                        if (pauseHold) {
                            // Pauza davomida ekranda qotib turadi, yangi so'z kelishi bilan yopiladi
                            slot.closeStart = this.frameFloor(Math.max(slot.inPoint, inPoint - closeAnimDuration), fps);
                            slot.outPoint = this.frameCeil(inPoint, fps);
                        } else {
                            // Pauza chegarasidan keyin darhol yopiladi
                            const pEnd = Math.max(slot.inPoint + minWordDur, prev.end);
                            slot.closeStart = this.frameFloor(pEnd, fps);
                            slot.outPoint = this.frameCeil(pEnd + closeAnimDuration, fps);
                        }
                        activeSlots[l] = null;
                    }
                }
            }

            // O'z vaqtida tugagan slotlarni bo'shatish
            for (let l = 0; l < maxLines; l++) {
                const slot = activeSlots[l];
                if (slot && slot.outPoint && slot.outPoint <= inPoint) {
                    activeSlots[l] = null;
                }
            }

            // Qator tanlash:
            let assignedLine = -1;
            for (let l = 0; l < maxLines; l++) {
                if (!activeSlots[l]) {
                    assignedLine = l;
                    break;
                }
            }

            // Qatorlar to'lgan bo'lsa -> Kaskad: 0-qator yopiladi, qolganlar tepaga suriladi
            if (assignedLine === -1) {
                const oldest = activeSlots[0];
                if (oldest) {
                    oldest.closeStart = this.frameFloor(Math.max(oldest.inPoint, inPoint - closeAnimDuration), fps);
                    oldest.outPoint = this.frameCeil(inPoint, fps);
                }

                for (let l = 1; l < maxLines; l++) {
                    const shifting = activeSlots[l];
                    if (shifting) {
                        shifting.lineChanges.push({
                            time: inPoint,
                            fromLine: l,
                            toLine: l - 1
                        });
                        shifting.line = l - 1;
                        activeSlots[l - 1] = shifting;
                        lineShiftCount++;
                    } else {
                        activeSlots[l - 1] = null;
                    }
                }

                assignedLine = maxLines - 1;
                activeSlots[assignedLine] = null;
            }

            if (assignedLine + 1 > maxLinesUsed) {
                maxLinesUsed = assignedLine + 1;
            }

            const wordDuration = wordEnd - inPoint;
            const useCharReveal = charRevealOpt || (wordDuration >= 0.6 && cur.word.length >= 6);

            const planItem = {
                word: cur.word,
                segIdx: cur.segIdx,
                wordIdx: cur.wordIdx,
                globalIdx: i,
                inPoint: inPoint,
                inAnimEnd: inAnimEnd,
                wordEnd: wordEnd,
                closeStart: wordEnd,
                outPoint: this.frameCeil(wordEnd + closeAnimDuration, fps),
                initialLine: assignedLine,
                line: assignedLine,
                lineChanges: [],
                charReveal: useCharReveal,
                confidence: cur.confidence,
                pauseAfterMs: cur.pauseAfterMs
            };

            // Agar o'sha qatorda avvalgi so'z bo'lsa, uni hozir yopamiz
            if (activeSlots[assignedLine]) {
                const prevOnLine = activeSlots[assignedLine];
                prevOnLine.closeStart = this.frameFloor(Math.max(prevOnLine.inPoint, inPoint - closeAnimDuration), fps);
                prevOnLine.outPoint = this.frameCeil(inPoint, fps);
            }

            activeSlots[assignedLine] = planItem;
            plannedWords.push(planItem);
        }

        // Oxirgi qolgan so'zlarni yopish
        for (let l = 0; l < maxLines; l++) {
            const slot = activeSlots[l];
            if (slot) {
                const holdEnd = slot.wordEnd + (pauseHold ? 0.8 : closeAnimDuration);
                slot.closeStart = this.frameFloor(Math.max(slot.inPoint, slot.wordEnd), fps);
                slot.outPoint = this.frameCeil(holdEnd, fps);
                activeSlots[l] = null;
            }
        }

        // Qat'iy sanitizatsiya va chegaralarni kafolatlash
        for (let i = 0; i < plannedWords.length; i++) {
            const item = plannedWords[i];
            if (item.outPoint <= item.inPoint) {
                item.outPoint = this.frameCeil(item.inPoint + minWordDur, fps);
            }
            if (item.inAnimEnd > item.outPoint) {
                item.inAnimEnd = item.outPoint;
            }
            if (item.closeStart < item.inPoint) {
                item.closeStart = item.inPoint;
            }
            if (item.closeStart > item.outPoint) {
                item.closeStart = item.outPoint;
            }
            if (item.wordEnd < item.inPoint) {
                item.wordEnd = item.inPoint;
            }
        }

        const stats = {
            totalWords: plannedWords.length,
            maxLines: maxLines,
            maxLinesUsed: maxLinesUsed,
            pauseCount: pauseCount,
            lineShiftCount: lineShiftCount,
            fps: fps
        };

        return {
            words: plannedWords,
            stats: stats
        };
    },

    auditWordPlan(plan) {
        const errors = [];
        if (!plan) {
            return { valid: false, errors: ["Plan obyekti mavjud emas"], count: 0 };
        }
        const words = Array.isArray(plan) ? plan : (plan.words || []);
        if (!Array.isArray(words)) {
            return { valid: false, errors: ["words massiv emas"], count: 0 };
        }

        for (let i = 0; i < words.length; i++) {
            const w = words[i];
            const pfx = `So'z [${i}]: "${w.word || ''}" -> `;
            if (isNaN(w.inPoint)) errors.push(pfx + "inPoint NaN");
            if (isNaN(w.outPoint)) errors.push(pfx + "outPoint NaN");
            if (isNaN(w.wordEnd)) errors.push(pfx + "wordEnd NaN");
            if (w.inPoint < 0) errors.push(pfx + "inPoint manfiy: " + w.inPoint);
            if (w.outPoint <= w.inPoint) errors.push(pfx + `outPoint (${w.outPoint}) <= inPoint (${w.inPoint})`);
            if (w.inAnimEnd < w.inPoint) errors.push(pfx + `inAnimEnd (${w.inAnimEnd}) < inPoint (${w.inPoint})`);
            if (w.closeStart > w.outPoint) errors.push(pfx + `closeStart (${w.closeStart}) > outPoint (${w.outPoint})`);
            if (w.initialLine < 0) errors.push(pfx + "initialLine manfiy");
            if (i > 0 && w.inPoint < words[i - 1].inPoint) {
                errors.push(pfx + `inPoint tartibi buzilgan (${w.inPoint} < ${words[i - 1].inPoint})`);
            }
        }

        return {
            valid: errors.length === 0,
            errors: errors,
            count: words.length,
            stats: plan.stats || null
        };
    },

    downloadFile(filename, content, mimeType = "text/plain;charset=utf-8") {
        let savedPath = null;
        if (typeof require !== "undefined") {
            try {
                const fs = require('fs');
                const os = require('os');
                const path = require('path');
                const targetDir = path.join(os.homedir(), "Downloads");
                savedPath = path.join(targetDir, filename);
                fs.writeFileSync(savedPath, content, 'utf-8');
            } catch (e) {
                console.warn("[UzbekUtils] Diskka yozishda:", e);
            }
        }

        try {
            const blob = new Blob([content], { type: mimeType });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (e) {}

        return savedPath;
    },

    escapeHtml(text) {
        if (!text) return "";
        return text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
};

UzbekUtils.SENTENCE_END_CHARS = SENTENCE_END_CHARS;
UzbekUtils.CLAUSE_END_CHARS = CLAUSE_END_CHARS;

if (typeof window !== "undefined") {
    window.UzbekUtils = UzbekUtils;
}
if (typeof module !== "undefined" && module.exports) {
    module.exports = UzbekUtils;
}
