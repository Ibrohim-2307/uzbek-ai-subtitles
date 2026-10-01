"""
O'zbekcha AI Subtitr - O'zbek Tili NLP va Matn Qayta Ishlash Moduli
- Belgilar standarti: oʻ va gʻ uchun U+02BB, Ayn (tutuq belgisi) uchun U+02BC
- Lug'at orqali tushib qolgan oʻ, gʻ va ayn belgilarini aniq tiklash
- Lotin <-> Kirill yo'qotishsiz (lossless) transliteratsiyasi (Yo'q -> Йўқ)
- O'zbekcha sonlarni so'zga aylantirish (100 -> yuz, 1000 -> ming, 3.5 -> uch butun oʻndan besh)
- Subtitr satrlarini qat'iy chegaralash (split_into_lines: max 42 belgi, max 2 qator)
- Kadr aniqligidagi vaqt funksiyalari (snap_to_frame, format_srt_time, format_frame_time, parse_timecode)
"""

import re
from typing import Any, Dict, List, Optional, Set, Tuple

# Belgilar standarti
APOS_OFFICIAL_OG = "\u02bb"   # ʻ (Modifier Letter Turned Comma)
APOS_OFFICIAL_AYN = "\u02bc"  # ʼ (Modifier Letter Apostrophe)
APOS_TYPO_OG = "\u2018"       # ‘
APOS_TYPO_AYN = "\u2019"      # ’
APOS_ASCII = "'"              # ' (U+0027)

ALL_APOSTROPHES = "['`´‘’ʻʼ′]"

# Ayn deb hisoblanmaydigan inglizcha va boshqa so'zlar / qisqartmalar
NOT_AYN_WORDS = {
    "don't", "doesn't", "didn't", "isn't", "aren't", "wasn't", "weren't",
    "can't", "couldn't", "won't", "wouldn't", "shouldn't", "hasn't",
    "haven't", "hadn't", "it's", "that's", "there's", "here's", "what's",
    "who's", "where's", "how's", "let's", "i'm", "you're", "we're",
    "they're", "i've", "you've", "we've", "they've", "i'll", "you'll",
    "he'll", "she'll", "we'll", "they'll", "o'clock", "ma'am", "y'all"
}

# Ruxsat etilgan qo'shimchalar (uzunligiga ko'ra kamayuvchi tartibda)
VALID_SUFFIXES = [
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
]

# 2. AYN LUG'ATI (STT apostrofni tashlab yuborganda tiklash)
# XAVFLI so'zlar ("alo", "sher", "os", "ot", "on") KIRMAYDI!
AYN_WORDS: Dict[str, str] = {
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
}

# 3. oʻ / gʻ SO'ZLARINI TIKLASH
# Istisnolar (avval qo'llanadi: yolgon -> yolgʻon, yolgonchi -> yolgʻonchi)
OG_EXCEPTIONS: Dict[str, str] = {
    "yolgon": "yolgʻon",
    "yolgonchi": "yolgʻonchi",
    "yolgonchilik": "yolgʻonchilik",
    "yolgonchilar": "yolgʻonchilar"
}

# Tiklash ro'yxati (oʻ va gʻ tushib qolganda)
# "oz", "on", "ot", "ol", "och" KIRMAYDI!
OG_WORDS: Dict[str, str] = {
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
}


# ==================== 1. BELGILAR STANDARTI FUNKSIYALARI ====================

def fix_og(text: str, apos: str = APOS_OFFICIAL_OG) -> str:
    """
    o va g harflaridan keyingi barcha apostrof variantlarini belgilangan standartga (standart: U+02BB) o'tkazadi.
    Regex: ([oOgG])\\s*['`´‘’ʻʼ′] -> $1 + apos
    """
    if not text:
        return ""

    def repl(m: re.Match) -> str:
        letter = m.group(1)
        return letter + apos

    return re.sub(r"([oOgG])\s*['`´‘’ʻʼ′]", repl, text)


def fix_ayn(text: str, ayn: str = APOS_OFFICIAL_AYN) -> str:
    """
    Ayn (tutuq) belgisini to'g'rilaydi.
    o/g bo'lmagan harfdan keyin kelgan apostrof deyarli har doim ayn (U+02BC):
    ([^\W\d_ogOG])['`´‘’ʻʼ]([^\W\d_]) -> $1 + ayn + $2
    NOT_AYN_WORDS istisnolari tegilmaydi.
    """
    if not text:
        return ""

    def process_token(token: str) -> str:
        # Punctuation ajratish
        m_parts = re.match(r"^(\W*)([\w'`´‘’ʻʼ′]+)(\W*)$", token)
        if not m_parts:
            return token
        pfx, body, sfx = m_parts.groups()

        # Istisno tekshiruvi (masalan don't, it's, let's)
        norm_ascii = re.sub(r"['`´‘’ʻʼ′]", "'", body.lower())
        if norm_ascii in NOT_AYN_WORDS:
            return token

        # Ayn qoidasi: o/g bo'lmagan harfdan keyin kelgan apostrof
        def repl(m: re.Match) -> str:
            return m.group(1) + ayn + m.group(2)

        new_body = re.sub(r"([^\W\d_ogOG])['`´‘’ʻʼ′]([^\W\d_])", repl, body)
        return pfx + new_body + sfx

    # Matnni so'zlarga bo'lib qayta ishlash
    tokens = re.split(r"(\s+)", text)
    return "".join(process_token(t) if not t.isspace() else t for t in tokens)


def _match_case(orig: str, target: str) -> str:
    """Asl so'zning katta-kichik harf holatini maqsadli so'zga ko'chiradi"""
    if orig.isupper():
        return target.upper()
    if orig and orig[0].isupper():
        if target:
            return target[0].upper() + target[1:]
    return target.lower()


def _replace_word_from_dict(
    token: str,
    dictionary: Dict[str, str],
    exceptions: Optional[Dict[str, str]] = None
) -> str:
    """So'zni lug'atdan va ruxsat etilgan qo'shimchalari bilan qidirib almashtiradi"""
    m = re.match(r"^(\W*)([a-zA-Z\u02bb\u02bc'`´‘’ʻʼ′]+)(\W*)$", token)
    if not m:
        return token
    prefix, body, suffix = m.groups()
    body_low = body.lower()

    # 1. Istisnolar tekshiruvi
    if exceptions and body_low in exceptions:
        return prefix + _match_case(body, exceptions[body_low]) + suffix

    # 2. To'g'ridan-to'g'ri moslik
    if body_low in dictionary:
        return prefix + _match_case(body, dictionary[body_low]) + suffix

    # 3. Qo'shimchalar bilan tekshirish
    for sfx in VALID_SUFFIXES:
        if body_low.endswith(sfx):
            stem = body_low[:-len(sfx)]
            if exceptions and stem in exceptions:
                target = exceptions[stem] + sfx
                return prefix + _match_case(body, target) + suffix
            if stem in dictionary:
                target = dictionary[stem] + sfx
                return prefix + _match_case(body, target) + suffix

    return token


def fix_og_words(text: str) -> str:
    """Apostrofi umuman yo'qolgan oʻ va gʻ so'zlarini (ozbek -> oʻzbek, togri -> toʻgʻri) tiklaydi"""
    if not text:
        return ""
    tokens = re.split(r"(\s+)", text)
    res = []
    for t in tokens:
        if t.isspace() or not t:
            res.append(t)
        else:
            res.append(_replace_word_from_dict(t, OG_WORDS, OG_EXCEPTIONS))
    return "".join(res)


def fix_ayn_words(text: str) -> str:
    """STT da apostrofi tushib qolgan ayn so'zlarini (malumot -> maʼlumot, suniy -> sunʼiy) tiklaydi"""
    if not text:
        return ""
    tokens = re.split(r"(\s+)", text)
    res = []
    for t in tokens:
        if t.isspace() or not t:
            res.append(t)
        else:
            res.append(_replace_word_from_dict(t, AYN_WORDS, None))
    return "".join(res)


def normalize_uzbek_text(text: str) -> str:
    """
    Butun loyiha bo'ylab o'zbekcha matnni yagona rasmiy standartga (U+02BB va U+02BC) keltiradi.
    Idempotent: bir necha marta chaqirilsa ham natija o'zgarmaydi.
    """
    if not text:
        return ""

    t = fix_og(text, APOS_OFFICIAL_OG)
    t = fix_ayn(t, APOS_OFFICIAL_AYN)
    t = fix_og_words(t)
    t = fix_ayn_words(t)
    t = fix_og(t, APOS_OFFICIAL_OG)
    t = fix_ayn(t, APOS_OFFICIAL_AYN)
    return t


def normalize_to_style(text: str, style: str = "official") -> str:
    """
    Matnni tanlangan stilga moslashtiradi:
    - 'official': oʻ, gʻ uchun U+02BB; ayn uchun U+02BC (Rasmiy standart)
    - 'typographic': o‘, g‘ uchun U+2018; ayn uchun U+2019 (Tipografik)
    - 'ascii': o', g' va ayn uchun U+0027 (Oddiy ASCII apostrof)
    """
    base = normalize_uzbek_text(text)
    if style == "official":
        return base
    elif style == "typographic":
        # oʻ -> o‘, gʻ -> g‘; ayn -> ’
        t = re.sub(r"([oOgG])\u02bb", r"\1" + APOS_TYPO_OG, base)
        t = t.replace("\u02bc", APOS_TYPO_AYN)
        return t
    elif style == "ascii":
        t = re.sub(r"([oOgG])\u02bb", r"\1" + APOS_ASCII, base)
        t = t.replace("\u02bc", APOS_ASCII)
        return t
    return base


# ==================== 4. LOTIN <-> KIRILL (Lossless) ====================

CYR_TO_LAT_MAP = {
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
}


def kirill_to_lotin(text: str) -> str:
    """Kirill yozuvidagi matnni rasmiy lotin yozuviga yo'qotishsiz o'giradi"""
    if not text:
        return ""

    res = text

    # Maxsus birikmalar: Йў -> Yoʻ, йў -> yoʻ (ruscha "ё" emas!)
    res = re.sub(r'ЙЎ', 'YOʻ', res)
    res = re.sub(r'Йў', 'Yoʻ', res)
    res = re.sub(r'йў', 'yoʻ', res)

    # So'z boshidagi yoki unlidan keyingi Е/е -> Ye/ye
    def replace_e(match: re.Match) -> str:
        prefix = match.group(1)
        e_char = match.group(2)
        if e_char == 'Е':
            return prefix + ('YE' if match.group(0).isupper() else 'Ye')
        return prefix + 'ye'

    res = re.sub(r'(^|[\s\(\[\{\<\.,:;!?\n\r"«\'\-])([Ее])', replace_e, res)
    res = re.sub(r'([АаОоУуИиЭэЎўЁёЮюЯя])([Ее])', replace_e, res)

    out = []
    for ch in res:
        out.append(CYR_TO_LAT_MAP.get(ch, ch))

    return normalize_uzbek_text("".join(out))


def lotin_to_kirill(text: str) -> str:
    """Lotin yozuvidagi matnni kirill yozuviga o'giradi"""
    if not text:
        return ""

    normalized = normalize_uzbek_text(text)

    # 1. So'z boshidagi E/e -> Э/э
    def replace_word_e(m: re.Match) -> str:
        e = m.group(2)
        return m.group(1) + ('Э' if e == 'E' else 'э')

    res = re.sub(r'(^|[\s\(\[\{\<\.,:;!?\n\r"«\'\-])([Ee])', replace_word_e, normalized)

    # 2. Maxsus 3 va 2 harfli birikmalar (tartib juda muhim!)
    compound_rules = [
        # Y + Oʻ birikmasi: ruscha "ё" EMAS, balki "йў"!
        ("YOʻ", "ЙЎ"), ("Yoʻ", "Йў"), ("yoʻ", "йў"),
        ("YO'", "ЙЎ"), ("Yo'", "Йў"), ("yo'", "йў"),
        ("YO`", "ЙЎ"), ("Yo`", "Йў"), ("yo`", "йў"),
        ("YO‘", "ЙЎ"), ("Yo‘", "Йў"), ("yo‘", "йў"),
        ("Oʻ", "Ў"), ("oʻ", "ў"),
        ("Gʻ", "Ғ"), ("gʻ", "ғ"),
        ("O'", "Ў"), ("o'", "ў"),
        ("G'", "Ғ"), ("g'", "ғ"),
        ("O`", "Ў"), ("o`", "ў"),
        ("G`", "Ғ"), ("g`", "ғ"),
        ("O‘", "Ў"), ("o‘", "ў"),
        ("G‘", "Ғ"), ("g‘", "ғ"),
        ("CH", "Ч"), ("Ch", "Ч"), ("ch", "ч"),
        ("SH", "Ш"), ("Sh", "Ш"), ("sh", "ш"),
        ("YO", "Ё"), ("Yo", "Ё"), ("yo", "ё"),
        ("YU", "Ю"), ("Yu", "Ю"), ("yu", "ю"),
        ("YA", "Я"), ("Ya", "Я"), ("ya", "я"),
        ("YE", "Е"), ("Ye", "Е"), ("ye", "е"),
        ("TS", "Ц"), ("Ts", "Ц"), ("ts", "ц")
    ]

    for lat_c, cyr_c in compound_rules:
        res = res.replace(lat_c, cyr_c)

    # 3. Yagona harflar xaritasi
    single_lat_cyr = {
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
        APOS_OFFICIAL_AYN: 'ъ',
        "'": 'ъ', "’": 'ъ', "‘": 'ъ', "`": 'ъ'
    }

    out = []
    for ch in res:
        out.append(single_lat_cyr.get(ch, ch))

    return "".join(out)


# ==================== 5. O'ZBEKCHA SONLAR ====================

UZ_ONES = ["", "bir", "ikki", "uch", "toʻrt", "besh", "olti", "yetti", "sakkiz", "toʻqqiz"]
UZ_TENS = ["", "oʻn", "yigirma", "oʻttiz", "qirq", "ellik", "oltmish", "yetmish", "sakson", "toʻqson"]

# O'nli kasrlar uchun o'zbekcha darajalar (10 -> o'ndan, 100 -> yuzdan, va h.k.)
DECIMAL_NAMES = {
    1: "oʻndan",
    2: "yuzdan",
    3: "mingdan",
    4: "oʻn mingdan",
    5: "yuz mingdan",
    6: "milliondan"
}


def number_to_uzbek_words(n: int) -> str:
    """
    Butun sonni o'zbek tilidagi so'z ko'rinishiga aylantiradi.
    100 -> "yuz" ("bir yuz" EMAS)
    1000 -> "ming" ("bir ming" EMAS)
    1 000 000 -> "bir million"
    2000 -> "ikki ming"
    """
    if n == 0:
        return "nol"
    if n < 0:
        return "minus " + number_to_uzbek_words(abs(n))

    words = []

    # Milliard
    if n >= 1_000_000_000:
        billions = n // 1_000_000_000
        n %= 1_000_000_000
        words.append(number_to_uzbek_words(billions) + " milliard")

    # Million
    if n >= 1_000_000:
        millions = n // 1_000_000
        n %= 1_000_000
        words.append(number_to_uzbek_words(millions) + " million")

    # Ming (1000 -> "ming", 2000 -> "ikki ming")
    if n >= 1_000:
        thousands = n // 1_000
        n %= 1_000
        if thousands == 1:
            words.append("ming")
        else:
            words.append(number_to_uzbek_words(thousands) + " ming")

    # Yuz (100 -> "yuz", 200 -> "ikki yuz")
    if n >= 100:
        hundreds = n // 100
        n %= 100
        if hundreds == 1:
            words.append("yuz")
        else:
            words.append(UZ_ONES[hundreds] + " yuz")

    # O'nliklar
    if n >= 10:
        tens = n // 10
        n %= 10
        words.append(UZ_TENS[tens])

    # Birlar
    if n > 0:
        words.append(UZ_ONES[n])

    return " ".join([w for w in words if w]).strip()


def replace_numbers_with_words(text: str) -> str:
    """
    Matn ichidagi sonlarni o'zbekcha so'zlarga almashtiradi.
    Tegilmasin: 12:30 (vaqt), 90-90-123 (telefon), v1.5 (versiya), 5-6 (diapazon), 50% (foiz).
    """
    if not text:
        return ""

    # Tegilmasligi kerak bo'lgan holatlarni maskalash
    protected: List[str] = []

    def save_protected(m: re.Match) -> str:
        protected.append(m.group(0))
        return f"__PROT_{len(protected) - 1}__"

    # 1. Vaqt (12:30)
    res = re.sub(r'\b\d{1,2}:\d{2}(?::\d{2})?\b', save_protected, text)
    # 2. Foiz (50%)
    res = re.sub(r'\b\d+(?:[\.,]\d+)?%', save_protected, res)
    # 3. Versiya (v1.5, V2.0, 1.2.3)
    res = re.sub(r'\b[vV]\d+(?:\.\d+)*\b', save_protected, res)
    res = re.sub(r'\b\d+\.\d+\.\d+\b', save_protected, res)
    # 4. Diapazon va Telefon raqamlari (5-6, 90-90-123, 90-123-4567, +998901234567)
    res = re.sub(r'\b\d+(?:-\d+)+\b', save_protected, res)
    res = re.sub(r'\+\d{7,15}\b', save_protected, res)

    # 6. Bo'shliq bilan yozilgan sonlar (1 000 000 -> 1000000)
    res = re.sub(r'\b(\d{1,3}(?:\s+\d{3})+)\b', lambda m: m.group(0).replace(" ", ""), res)

    # Kasr sonlar (masalan: 3.5 -> uch butun oʻndan besh)
    def repl_decimal(m: re.Match) -> str:
        sign = m.group(1) or ""
        whole_str = m.group(2)
        frac_str = m.group(3)
        try:
            whole_val = int(whole_str)
            frac_val = int(frac_str)
            frac_len = len(frac_str)
            dec_name = DECIMAL_NAMES.get(frac_len, f"10^{frac_len}-dan")
            prefix = "minus " if sign == "-" else ""
            whole_words = number_to_uzbek_words(whole_val)
            frac_words = number_to_uzbek_words(frac_val)
            return f"{prefix}{whole_words} butun {dec_name} {frac_words}"
        except Exception:
            return m.group(0)

    res = re.sub(r'(?<!\w)([-+]?)(\d+)[\.,](\d+)(?!\w)', repl_decimal, res)

    # Butun sonlar (manfiy va musbat)
    def repl_integer(m: re.Match) -> str:
        sign = m.group(1) or ""
        num_str = m.group(2)
        try:
            val = int(num_str)
            if 0 <= val <= 999_999_999_999:
                prefix = "minus " if sign == "-" else ""
                return prefix + number_to_uzbek_words(val)
        except Exception:
            pass
        return m.group(0)

    res = re.sub(r'(?<!\w)([-+]?)(\d+)(?!\w)', repl_integer, res)

    # Himoyalangan qismlarni qaytarish
    for idx, orig_val in enumerate(protected):
        res = res.replace(f"__PROT_{idx}__", orig_val)

    return res


# ==================== SHAXSIY LUG'AT ====================

def apply_custom_dictionary(text: str, dictionary: Dict[str, str]) -> str:
    """Shaxsiy lug'atdagi so'zlarni to'g'risiga almashtiradi"""
    if not text or not dictionary:
        return text

    for wrong, right in dictionary.items():
        pattern = re.compile(rf'\b{re.escape(wrong)}\b', re.IGNORECASE)

        def make_replacement(m: re.Match) -> str:
            matched = m.group(0)
            if matched.isupper():
                return right.upper()
            elif matched[0].isupper():
                return right.capitalize()
            return right.lower()

        text = pattern.sub(make_replacement, text)

    return text


# ==================== 6. SUBTITR SATRLARI (QAT'IY CHEGARA) ====================

def split_into_lines(text: str, max_chars: int = 42, max_lines: int = 2) -> List[str]:
    """
    Matnni qat'iy ravishda ko'pi bilan max_chars (standart: 42) belgi va
    max_lines (standart: 2) qatorga taqsimlaydi.
    - Hech bir qator max_chars dan oshmaydi (bitta so'zning o'zi uzun bo'lsa - istisno)
    - So'zlar bo'linmaydi
    - Agar sig'sa - muvozanatli (simmetrik) bo'linadi
    - Agar 2 qatorga sig'masa - ko'proq qator qaytaradi (chaqiruvchi blokni 2 ga bo'ladi)
    - Yetim so'z jarimasi (+250)
    - Tinish belgisi boshlanish jarimasi (+500), '…' bilan tugash jarimasi (+120)
    """
    clean = " ".join((text or "").strip().split())
    if not clean:
        return []

    words = clean.split()
    if not words:
        return []

    # 1 qatorga to'liq sig'sa
    if len(clean) <= max_chars and len(words) <= 5:
        return [clean]

    # Agar 2 qatorga sig'ish imkoniyati tekshirilsa
    if max_lines == 2:
        best_split = None
        best_penalty = float('inf')

        for i in range(1, len(words)):
            line1 = " ".join(words[:i])
            line2 = " ".join(words[i:])

            # Qat'iy chegara tekshiruvi: bitta so'zdan tashqari hech bir qator oshmasin
            if len(words[:i]) > 1 and len(line1) > max_chars:
                continue
            if len(words[i:]) > 1 and len(line2) > max_chars:
                continue

            # Agar ikkala qator ham qat'iy chegaraga sig'sa: jarimalar hisobi
            if len(line1) <= max_chars and len(line2) <= max_chars:
                penalty = abs(len(line1) - len(line2)) * 10

                # Oxirgi qator yetim bitta so'z bo'lsa (+250)
                if len(words[i:]) == 1:
                    penalty += 250

                # Birinchi qator yetim bitta so'z bo'lsa (+150)
                if len(words[:i]) == 1:
                    penalty += 150

                # 2-qator tinish belgisi bilan boshlansa (+500)
                if line2 and line2[0] in ",.?!;:-—":
                    penalty += 500

                # 1-qator ko'p nuqta yoki '…' bilan tugasa (+120)
                if line1.endswith("…") or line1.endswith("..."):
                    penalty += 120

                if penalty < best_penalty:
                    best_penalty = penalty
                    best_split = (line1, line2)

        if best_split is not None:
            return [best_split[0], best_split[1]]

    # Agar 2 qatorga sig'masa: so'zlarni max_chars chegarasidan oshirmasdan ochko'z taqsimlash
    lines: List[str] = []
    current_words: List[str] = []
    current_len = 0

    for w in words:
        w_len = len(w)
        added_len = w_len if not current_words else current_len + 1 + w_len
        if current_words and added_len > max_chars:
            lines.append(" ".join(current_words))
            current_words = [w]
            current_len = w_len
        else:
            current_words.append(w)
            current_len = added_len

    if current_words:
        lines.append(" ".join(current_words))

    return lines


def split_long_segment(text: str, max_chars: int = 42, max_lines: int = 2) -> List[str]:
    """
    Uzun matnni har biri max_lines qatordan oshmaydigan mustaqil subtitr bloklariga bo'ladi.
    Har bir blok qator chegarasini (max_chars) aniq tekshiradi.
    """
    lines = split_into_lines(text, max_chars=max_chars, max_lines=max_lines)
    if not lines:
        return []

    blocks: List[str] = []
    for i in range(0, len(lines), max_lines):
        chunk = lines[i:i + max_lines]
        blocks.append("\n".join(chunk))

    return blocks


def split_subtitle_text(text: str, max_chars: int = 42, max_lines: int = 2) -> str:
    """Orqaga moslik uchun: qatorlarni \\n bilan ajratilgan bitta matn sifatida qaytaradi"""
    lines = split_into_lines(text, max_chars=max_chars, max_lines=max_lines)
    return "\n".join(lines)


SENTENCE_END_CHARS: Set[str] = {".", "!", "?", "…"}
CLAUSE_END_CHARS: Set[str] = {",", ";", ":", "—", "-"}


def _get_w_prop(w: Any, prop: str, default: Any = None) -> Any:
    """So'z obyekti yoki lug'atidan xossani xavfsiz o'qish"""
    if hasattr(w, prop):
        val = getattr(w, prop)
        return val if val is not None else default
    if isinstance(w, dict):
        val = w.get(prop)
        return val if val is not None else default
    return default


def chunk_words_by_pause(
    words: List[Any],
    max_chars_line: int = 28,
    max_lines: int = 2,
    max_words: int = 7,
    min_chunk_chars: int = 12,
    pause_threshold: float = 0.35,
) -> List[List[Any]]:
    """
    So'zlarni nutqdagi tabiiy pauzalar, intonatsiya va qat'iy o'lcham bo'yicha bo'laklaydi.
    Qoidalar:
    - Majburiy bo'lish: 2 qatorga (max_chars_line * max_lines, masalan 28*2=56) sig'masa yoki max_words (7) dan oshsa
    - Ixtiyoriy (tabiiy) bo'lish: joriy bo'lak matni >= min_chunk_chars (12) bo'lsa va:
        oxirgi so'z . ! ? … bilan tugasa; yoki , ; : — - bilan tugasa; yoki keyingi so'zgacha pauza >= pause_threshold (0.35s)
    - Yetim so'z (orphan merge): oxirgi bo'lak < min_chunk_chars (12) belgi bo'lsa va sig'sa - oldingi bo'lakka qo'shiladi.
    """
    if not words:
        return []

    chunks: List[List[Any]] = []
    curr_chunk: List[Any] = []
    max_total_chars = max_chars_line * max_lines

    def chunk_char_len(chunk: List[Any]) -> int:
        if not chunk:
            return 0
        texts = [str(_get_w_prop(w, "word", "") or "") for w in chunk]
        return len(" ".join(texts))

    for i, w in enumerate(words):
        w_text = str(_get_w_prop(w, "word", "") or "").strip()
        w_len = len(w_text)

        if not curr_chunk:
            curr_chunk.append(w)
            continue

        proposed_len = chunk_char_len(curr_chunk) + 1 + w_len
        proposed_word_count = len(curr_chunk) + 1

        # Majburiy bo'lish sharti:
        forced_split = (proposed_word_count > max_words) or (proposed_len > max_total_chars)

        if forced_split:
            chunks.append(curr_chunk)
            curr_chunk = [w]
            continue

        # Tabiiy bo'lish shartlari:
        prev_w = curr_chunk[-1]
        prev_text = str(_get_w_prop(prev_w, "word", "") or "").strip()
        curr_chars = chunk_char_len(curr_chunk)

        # 1) Tinish belgilari
        last_char = prev_text[-1] if prev_text else ""
        has_sentence_end = (last_char in SENTENCE_END_CHARS) or prev_text.endswith("...")
        has_clause_end = (last_char in CLAUSE_END_CHARS)

        # 2) Pauza tekshiruvi
        prev_end = float(_get_w_prop(prev_w, "end", 0.0) or 0.0)
        curr_start = float(_get_w_prop(w, "start", 0.0) or 0.0)
        pause_sec = curr_start - prev_end
        has_pause = pause_sec >= pause_threshold

        natural_split = (curr_chars >= min_chunk_chars) and (has_sentence_end or has_clause_end or has_pause)

        if natural_split:
            chunks.append(curr_chunk)
            curr_chunk = [w]
        else:
            curr_chunk.append(w)

    if curr_chunk:
        chunks.append(curr_chunk)

    # Yetim so'z (orphan chunk) birlashtirish:
    if len(chunks) >= 2:
        last_c = chunks[-1]
        last_len = chunk_char_len(last_c)
        if last_len < min_chunk_chars:
            prev_c = chunks[-2]
            combined_len = chunk_char_len(prev_c) + 1 + last_len
            if combined_len <= max_total_chars:
                chunks[-2] = prev_c + last_c
                chunks.pop()

    return chunks


# ==================== 7. VAQT — KADR ANIQLIGI ====================

def snap_to_frame(t: float, fps: float = 25.0) -> float:
    """Vaqtni (soniya) tanlangan kadr tezligidagi eng yaqin kadr vaqtiga tortadi (snap)"""
    if fps <= 0:
        fps = 25.0
    return round(round(t * fps) / fps, 6)


def is_on_frame(t: float, fps: float = 25.0) -> bool:
    """Vaqt aynan kadr chegarasida turganligini tekshiradi (|t*fps - round(t*fps)| < 1e-6)"""
    if fps <= 0:
        fps = 25.0
    return abs(t * fps - round(t * fps)) < 1e-6


def format_srt_time(t: float) -> str:
    """00:00:03,200 (SRT standarti bo'yicha VERGUL bilan formatlaydi)"""
    if t < 0:
        t = 0.0
    hrs = int(t // 3600)
    mins = int((t % 3600) // 60)
    secs = int(t % 60)
    millis = int(round((t - int(t)) * 1000))
    if millis >= 1000:
        secs += 1
        millis -= 1000
    if secs >= 60:
        mins += 1
        secs -= 60
    if mins >= 60:
        hrs += 1
        mins -= 60
    return f"{hrs:02d}:{mins:02d}:{secs:02d},{millis:03d}"


def format_frame_time(t: float, fps: float = 25.0) -> str:
    """00:00:03:05 (Non-drop frame timecode formati: HH:MM:SS:FF)"""
    if fps <= 0:
        fps = 25.0
    if t < 0:
        t = 0.0
    total_frames = int(round(t * fps))
    fps_int = int(round(fps))
    if fps_int <= 0:
        fps_int = 25

    ff = total_frames % fps_int
    total_secs = total_frames // fps_int
    ss = total_secs % 60
    mm = (total_secs // 60) % 60
    hh = total_secs // 3600

    return f"{hh:02d}:{mm:02d}:{ss:02d}:{ff:02d}"


def parse_timecode(s: str, fps: float = 25.0) -> float:
    """
    Turli formatdagi vaqt kodlarini soniyaga o'tkazadi:
    - 00:00:03,200 (SRT)
    - 00:00:03.200 (VTT)
    - 00:00:03:05 (Kadr timecode HH:MM:SS:FF)
    - 03:20 (MM:SS)
    - 12.5 yoki 3 (soniya)
    """
    if fps <= 0:
        fps = 25.0
    if not s:
        return 0.0
    clean = str(s).strip()

    # 1. SRT: HH:MM:SS,mmm
    if "," in clean:
        clean = clean.replace(",", ".")

    # 2. Kadr timecode: HH:MM:SS:FF
    parts_colon = clean.split(":")
    if len(parts_colon) == 4:
        try:
            hh = int(parts_colon[0])
            mm = int(parts_colon[1])
            ss = int(parts_colon[2])
            ff = int(parts_colon[3])
            total_frames = (hh * 3600 + mm * 60 + ss) * fps + ff
            return round(total_frames / fps, 6)
        except Exception:
            pass

    # 3. HH:MM:SS.mmm
    if len(parts_colon) == 3:
        try:
            hh = float(parts_colon[0])
            mm = float(parts_colon[1])
            ss = float(parts_colon[2])
            return round(hh * 3600 + mm * 60 + ss, 6)
        except Exception:
            pass

    # 4. MM:SS.mmm
    if len(parts_colon) == 2:
        try:
            mm = float(parts_colon[0])
            ss = float(parts_colon[1])
            return round(mm * 60 + ss, 6)
        except Exception:
            pass

    # 5. Oddiy soniya
    try:
        return round(float(clean), 6)
    except Exception:
        return 0.0
