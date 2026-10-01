"""
O'zbekcha AI Subtitr - O'zbek Tili NLP va Matn Qayta Ishlash Moduli
- Lotin <-> Kirill transliteratsiyasi (o‘, g‘, sh, ch, tutuq belgisi qoidalari bilan)
- O'zbekcha sonlarni so'zga aylantirish (masalan: 2026 -> "ikki ming yigirma olti")
- Shaxsiy lug'at va xatoliklarni avtomatik tuzatish
- Subtitr qatorlarini chiroyli bo'lish (so'zlarni buzmagan holda)
"""

import re
from typing import Dict, List

# To'g'ri o'zbekcha belgilar
APOSTROPHE_VARIANTS = ["'", "`", "‘", "’", "ʻ", "ʼ", "´"]


def normalize_uzbek_text(text: str) -> str:
    """O'zbekcha harflardagi har xil apostroflarni standart ko'rinishga keltiradi"""
    if not text:
        return ""
    # O' va G' harflarini standart o'zbekcha belgisiga keltirish (o‘, g‘ yoki o', g')
    # Standart lotin alifbosida: o‘, g‘
    res = text
    # o` o' oʼ o‘ -> o‘
    res = re.sub(r"[oO]['`‘’ʻʼ´]", lambda m: "O‘" if m.group(0)[0].isupper() else "o‘", res)
    # g` g' gʼ g‘ -> g‘
    res = re.sub(r"[gG]['`‘’ʻʼ´]", lambda m: "G‘" if m.group(0)[0].isupper() else "g‘", res)
    return res


# ==================== LOTIN <-> KIRILL ====================

CYR_TO_LAT_MAP = {
    'А': 'A', 'а': 'a',
    'Б': 'B', 'б': 'b',
    'В': 'V', 'в': 'v',
    'Г': 'G', 'г': 'g',
    'Д': 'D', 'д': 'd',
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
    'Ч': 'Ch', 'ч': 'ch',
    'Ш': 'Sh', 'ш': 'sh',
    'Щ': 'Sh', 'щ': 'sh',
    'Ъ': '’', 'ъ': '’',
    'Ь': '', 'ь': '',
    'Э': 'E', 'э': 'e',
    'Ю': 'Yu', 'ю': 'yu',
    'Я': 'Ya', 'я': 'ya',
    'Ё': 'Yo', 'ё': 'yo',
    'Ў': 'O‘', 'ў': 'o‘',
    'Ғ': 'G‘', 'ғ': 'g‘',
    'Ц': 'Ts', 'ц': 'ts',
}

LAT_TO_CYR_MAP = {
    'ch': 'ч', 'Ch': 'Ч', 'CH': 'Ч',
    'sh': 'ш', 'Sh': 'Ш', 'SH': 'Ш',
    'yo': 'ё', 'Yo': 'Ё', 'YO': 'Ё',
    'yu': 'ю', 'Yu': 'Ю', 'YU': 'Ю',
    'ya': 'я', 'Ya': 'Я', 'YA': 'Я',
    'ye': 'е', 'Ye': 'Е', 'YE': 'Е',
    'ts': 'ц', 'Ts': 'Ц', 'TS': 'Ц',
    "o‘": 'ў', "O‘": 'Ў', "o'": 'ў', "O'": 'Ў', "o`": 'ў', "O`": 'Ў', "oʼ": 'ў', "Oʼ": 'Ў',
    "g‘": 'ғ', "G‘": 'Ғ', "g'": 'ғ', "G'": 'Ғ', "g`": 'ғ', "G`": 'Ғ', "gʼ": 'ғ', "Gʼ": 'Ғ',
    'a': 'а', 'A': 'А',
    'b': 'б', 'B': 'Б',
    'd': 'д', 'D': 'Д',
    'e': 'э', 'E': 'Э',
    'f': 'ф', 'F': 'Ф',
    'g': 'г', 'G': 'Г',
    'h': 'ҳ', 'H': 'Ҳ',
    'i': 'и', 'I': 'И',
    'j': 'ж', 'J': 'Ж',
    'k': 'к', 'K': 'К',
    'l': 'л', 'L': 'Л',
    'm': 'м', 'M': 'М',
    'n': 'н', 'N': 'Н',
    'o': 'о', 'O': 'О',
    'p': 'п', 'P': 'П',
    'q': 'қ', 'Q': 'Қ',
    'r': 'р', 'R': 'Р',
    's': 'с', 'S': 'С',
    't': 'т', 'T': 'Т',
    'u': 'у', 'U': 'У',
    'v': 'в', 'V': 'В',
    'x': 'х', 'X': 'Х',
    'y': 'й', 'Y': 'Й',
    'z': 'з', 'Z': 'З',
    '’': 'ъ', "'": 'ъ'
}


def kirill_to_lotin(text: str) -> str:
    """Kirill yozuvidagi matnni lotin yozuviga o'giradi"""
    if not text:
        return ""

    # So'z boshidagi 'Е/е' -> 'Ye/ye' qoidasi
    def replace_e(match):
        prefix = match.group(1)
        e_char = match.group(2)
        if e_char == 'Е':
            return prefix + ('YE' if match.group(0).isupper() else 'Ye')
        return prefix + 'ye'

    # Unli harflardan keyin kelgan 'е' -> 'ye'
    text = re.sub(r'(^|[\s\(\[\{\<\.,:;!?\n\r])([Ее])', replace_e, text)
    text = re.sub(r'([АаОоУуИиЭэЎўЁёЮюЯя])([Ее])', replace_e, text)

    result = []
    for char in text:
        result.append(CYR_TO_LAT_MAP.get(char, char))

    return "".join(result)


def lotin_to_kirill(text: str) -> str:
    """Lotin yozuvidagi matnni kirill yozuviga o'giradi"""
    if not text:
        return ""

    normalized = normalize_uzbek_text(text)

    # 2 harfli birikmalarni almashtirish
    # So'z boshidagi 'E/e' -> 'Э/э'
    def replace_word_e(m):
        e = m.group(2)
        return m.group(1) + ('Э' if e == 'E' else 'э')

    normalized = re.sub(r'(^|[\s\(\[\{\<\.,:;!?\n\r])([Ee])', replace_word_e, normalized)

    # Murakkab birikmalarni tartib bilan almashtirish
    compound_keys = sorted([k for k in LAT_TO_CYR_MAP.keys() if len(k) > 1], key=lambda x: -len(x))
    for k in compound_keys:
        normalized = normalized.replace(k, LAT_TO_CYR_MAP[k])

    # Yagona harflarni almashtirish
    result = []
    for char in normalized:
        result.append(LAT_TO_CYR_MAP.get(char, char))

    return "".join(result)


# ==================== O'ZBEKCHA SONLAR ====================

UZ_ONES = ["", "bir", "ikki", "uch", "to‘rt", "besh", "olti", "yetti", "sakkiz", "to‘qqiz"]
UZ_TENS = ["", "o‘n", "yigirma", "o‘ttiz", "qirq", "ellik", "oltmish", "yetmish", "sakson", "to‘qson"]
UZ_SCALES = [
    (1_000_000_000, "milliard"),
    (1_000_000, "million"),
    (1_000, "ming"),
    (100, "yuz")
]


def number_to_uzbek_words(n: int) -> str:
    """Butun sonni o'zbek tilidagi so'z ko'rinishiga aylantiradi (masalan: 1991 -> bir ming to‘qqiz yuz to‘qson bir)"""
    if n == 0:
        return "nol"
    if n < 0:
        return "minus " + number_to_uzbek_words(abs(n))

    words = []

    for scale, scale_name in UZ_SCALES:
        if n >= scale:
            count = n // scale
            n %= scale
            if scale == 100:
                if count == 1:
                    words.append("bir yuz")
                else:
                    words.append(UZ_ONES[count] + " yuz")
            else:
                words.append(number_to_uzbek_words(count) + " " + scale_name)

    if n >= 10:
        tens_val = n // 10
        n %= 10
        words.append(UZ_TENS[tens_val])

    if n > 0:
        words.append(UZ_ONES[n])

    return " ".join([w for w in words if w]).strip()


def replace_numbers_with_words(text: str) -> str:
    """Matn ichidagi barcha arab raqamlarini o'zbekcha so'zlarga almashtiradi"""
    def repl(m):
        num_str = m.group(0)
        try:
            val = int(num_str)
            # Maksimal 999 milliardgacha
            if 0 <= val <= 999_999_999_999:
                return number_to_uzbek_words(val)
        except ValueError:
            pass
        return num_str

    return re.sub(r'\b\d+\b', repl, text)


# ==================== SHAXSIY LUG'AT VA TO'G'RILASH ====================

def apply_custom_dictionary(text: str, dictionary: Dict[str, str]) -> str:
    """
    Shaxsiy lug'atdagi xato so'zlarni to'g'risiga almashtiradi (katta-kichik harflarni saqlagan holda).
    """
    if not text or not dictionary:
        return text

    for wrong, right in dictionary.items():
        # Case-insensitive but word boundary replace
        pattern = re.compile(rf'\b{re.escape(wrong)}\b', re.IGNORECASE)

        def make_replacement(m):
            matched = m.group(0)
            if matched.isupper():
                return right.upper()
            elif matched[0].isupper():
                return right.capitalize()
            return right.lower()

        text = pattern.sub(make_replacement, text)

    return text


# ==================== SUBTITR SATRLARINI BO'LISH ====================

def split_subtitle_text(text: str, max_chars: int = 28, max_lines: int = 2) -> str:
    """
    Subtitr matnini ekran o'lchamiga mos qilib, so'zlarni buzmagan holda
    qat'iy 1 yoki ko'pi bilan 2 qatorga taqsimlaydi (hech qachon 3 yoki 4 qator bo'lmaydi).
    """
    text = " ".join((text or "").strip().split())
    if not text:
        return ""

    words = text.split()
    if len(words) <= 1:
        return text

    # Agar matn bitta qatorga sig'sa (masalan 24-28 belgidan kam)
    if len(text) <= max_chars and len(words) <= 3:
        return text

    # Aks holda matnni 2 ta muvozanatli (simmetrik) qatorga taqsimlaymiz
    best_split = len(words) // 2
    min_diff = 999999

    for i in range(1, len(words)):
        l1 = " ".join(words[:i])
        l2 = " ".join(words[i:])
        diff = abs(len(l1) - len(l2))
        if diff < min_diff:
            min_diff = diff
            best_split = i

    line1 = " ".join(words[:best_split])
    line2 = " ".join(words[best_split:])

    return f"{line1}\n{line2}"
