"""
O'zbekcha AI Subtitr - Google Gemini AI Provayderi (Google One / AI Studio)
Google'ning eng so'nggi Gemini 3.5 Flash va 3 Flash Preview modellari orqali
yuqori aniqlikdagi o'zbekcha avtomatik subtitrlarni yaratadi.
Avtomatik 503/429 qayta urinish (retry) va model zaxirasi (fallback) bilan ta'minlangan.
"""

import os
import json
import base64
import re
import tempfile
import asyncio
import httpx
from typing import List
from .base import BaseSTTProvider, TranscriptionResult, SegmentItem, WordItem
from ..utils.audio import convert_to_optimized_mp3, get_audio_duration, split_audio_into_chunks

# Eng barqaror va tezkor modellar ro'yxati (eng tez va xatosiz ishlaydigan lite modellari birinchi)
GEMINI_MODELS_PRIORITY = [
    "gemini-flash-lite-latest",
    "gemini-3.1-flash-lite",
    "gemini-3.5-flash-lite",
    "gemini-flash-latest",
    "gemini-3.8-flash",
    "gemini-3.5-flash",
    "gemini-3-flash-preview"
]


class GeminiSTTProvider(BaseSTTProvider):
    def __init__(self, api_key: str = "", model_name: str = "gemini-flash-lite-latest"):
        super().__init__(name="gemini")
        self.api_key = api_key.strip()
        self.model_name = model_name

    def is_available(self) -> bool:
        return bool(self.api_key and len(self.api_key) > 20)

    async def transcribe(self, audio_path: str, language: str = "uz", **kwargs) -> TranscriptionResult:
        if not self.is_available():
            raise ValueError(
                "Google Gemini API kaliti kiritilmagan!\n"
                "Iltimos, Sozlamalar bo'limidan kalitni tekshiring."
            )

        if not os.path.exists(audio_path):
            raise FileNotFoundError(f"Audio fayl topilmadi: {audio_path}")

        temp_cleanup = []
        work_audio = audio_path

        # 1. Audioni 16kHz mono MP3 ga o'tkazish (kesilgan qismini tezkor ajratish)
        start_sec = kwargs.get("start_sec") or kwargs.get("in_point")
        duration_sec = kwargs.get("duration_sec") or kwargs.get("duration")

        if not audio_path.lower().endswith(".mp3") or start_sec is not None or duration_sec is not None:
            temp_mp3 = tempfile.NamedTemporaryFile(delete=False, suffix=".mp3")
            temp_cleanup.append(temp_mp3.name)
            work_audio = convert_to_optimized_mp3(
                audio_path,
                temp_mp3.name,
                start_sec=start_sec,
                duration_sec=duration_sec
            )

        try:
            duration = get_audio_duration(work_audio)

            # 2. Uzoq audio uchun (6 daqiqadan ortiq) xavfsiz bo'laklar va nazoratli parallelizm
            if duration > 360:
                print(f"[Gemini] Audio ({duration:.1f}s) 300 soniyalik bo'laklarga ajratilib yuborilmoqda...")
                chunks_dir = tempfile.mkdtemp(prefix="gemini_chunks_")
                chunks = split_audio_into_chunks(work_audio, chunk_duration_sec=300, output_dir=chunks_dir)

                semaphore = asyncio.Semaphore(3)

                async def sem_task(chunk_file):
                    async with semaphore:
                        return await self._transcribe_single_audio(chunk_file)

                tasks = [sem_task(chunk_file) for chunk_file, _ in chunks]
                chunk_results = await asyncio.gather(*tasks)

                all_segments: List[SegmentItem] = []
                full_texts = []
                seg_global_id = 1

                for idx, chunk_res in enumerate(chunk_results):
                    offset_sec = chunks[idx][1]
                    for seg in chunk_res.segments:
                        s_start = round(seg.start + offset_sec, 3)
                        s_end = round(seg.end + offset_sec, 3)

                        shifted_words = []
                        for w in seg.words:
                            shifted_words.append(
                                WordItem(
                                    word=w.word,
                                    start=round(w.start + offset_sec, 3),
                                    end=round(w.end + offset_sec, 3),
                                    score=w.score
                                )
                            )

                        all_segments.append(
                            SegmentItem(
                                id=seg_global_id,
                                start=s_start,
                                end=s_end,
                                text=seg.text,
                                words=shifted_words
                            )
                        )
                        seg_global_id += 1

                    full_texts.append(chunk_res.text)

                return TranscriptionResult(
                    text=" ".join(full_texts),
                    language="uz",
                    duration=duration,
                    segments=all_segments
                )
            else:
                # 75 soniyagacha bo'lgan qisqa audio bitta so'rovda yuboriladi
                print(f"[Gemini] Qisqa audio ({duration:.1f}s) to'g'ridan-to'g'ri yuborilmoqda...")
                return await self._transcribe_single_audio(work_audio)

        finally:
            for tmp in temp_cleanup:
                try:
                    if os.path.exists(tmp):
                        os.remove(tmp)
                except Exception:
                    pass

    async def _transcribe_single_audio(self, audio_file_path: str) -> TranscriptionResult:
        """Bitta bo'lak audioni Gemini API orqali chaqirish (avtomatik retry va model fallback bilan)"""
        with open(audio_file_path, "rb") as f:
            b64_audio = base64.b64encode(f.read()).decode("utf-8")

        prompt = (
            "Sen professional o'zbek tili subtitr mutaxassisissan. "
            "Ushbu audio yozuvdagi o'zbekcha nutqni tinglab, to'liq va tabiiy subtitrlarni yarat. "
            "Qoidalar:\n"
            "1. Yozuv: To'g'ri o'zbekcha lotin yozuvi (o‘, g‘, sh, ch, tutuq belgilari to'g'ri bo'lsin).\n"
            "2. MAKSIMAL 1 YOKI 2 QATOR (QAT'IY TALAB): Subtitrlar videoda (ayniqsa Reels, Shorts, TikTok va montajda) ko'pi bilan 1 yoki 2 qator bo'lishi shart! Hech qachon 3 yoki 4 qatorli qilib yuborma! Har bir segmentda ko'pi bilan 3-6 ta so'z (15-32 ta belgi, 1.5 - 2.5 soniya) bo'lsin. Uzun gaplarni mantiqan ketma-ket qisqa segmentlarga bo'lib ber!\n"
            "3. OVOZ VA VAQTNING ANIQ MOSLIGI (O'TA MUHIM): Har bir so'z va jumlada start va end vaqtlari soniyalarda (masalan 1.45) aniq ko'rsatilsin. Boshlanish (start) vaqti aynan shu so'zning birinchi tovushi eshitilishi boshlangan lahza bo'lishi shart! So'z aytilib bo'lgandan keyin kechikib chiqishiga mutlaqo yo'l qo'yilmasin.\n"
            "4. Faqat sof JSON formatida javob ber:\n"
            "{\n"
            '  "full_text": "...",\n'
            '  "segments": [\n'
            '    {\n'
            '      "id": 1,\n'
            '      "start": 0.0,\n'
            '      "end": 1.6,\n'
            '      "text": "Anima. Endi o\'zbek tilida",\n'
            '      "words": [\n'
            '        {"word": "Anima.", "start": 0.0, "end": 0.8},\n'
            '        {"word": "Endi", "start": 0.9, "end": 1.2},\n'
            '        {"word": "o\'zbek", "start": 1.3, "end": 1.5},\n'
            '        {"word": "tilida", "start": 1.5, "end": 1.6}\n'
            '      ]\n'
            '    },\n'
            '    {\n'
            '      "id": 2,\n'
            '      "start": 1.7,\n'
            '      "end": 3.0,\n'
            '      "text": "tomosha qiling!",\n'
            '      "words": [\n'
            '        {"word": "tomosha", "start": 1.7, "end": 2.2},\n'
            '        {"word": "qiling!", "start": 2.3, "end": 3.0}\n'
            '      ]\n'
            '    }\n'
            '  ]\n'
            "}"
        )

        payload = {
            "contents": [
                {
                    "parts": [
                        {"text": prompt},
                        {
                            "inline_data": {
                                "mime_type": "audio/mp3",
                                "data": b64_audio
                            }
                        }
                    ]
                }
            ],
            "generationConfig": {
                "temperature": 0.1,
                "response_mime_type": "application/json"
            }
        }

        # Modellar bo'ylab aylanish (agar 503 yoki xatolik bo'lsa, keyingisiga o'tadi)
        last_error = ""
        async with httpx.AsyncClient(timeout=180.0) as client:
            for model_candidate in GEMINI_MODELS_PRIORITY:
                url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_candidate}:generateContent?key={self.api_key}"

                for attempt in range(3):  # Har bir model uchun 3 martagacha urinish
                    try:
                        response = await client.post(url, json=payload)
                        if response.status_code == 200:
                            data = response.json()
                            candidates = data.get("candidates", [])
                            if candidates:
                                raw_text = candidates[0]["content"]["parts"][0]["text"].strip()
                                raw_text = re.sub(r"^```json\s*", "", raw_text)
                                raw_text = re.sub(r"\s*```$", "", raw_text)

                                parsed = json.loads(raw_text)

                                segments = []
                                for idx, s in enumerate(parsed.get("segments", [])):
                                    words_list = []
                                    for w in s.get("words", []):
                                        words_list.append(
                                            WordItem(
                                                word=str(w.get("word", "")).strip(),
                                                start=round(float(w.get("start", 0)), 3),
                                                end=round(float(w.get("end", 0)), 3),
                                                score=1.0
                                            )
                                        )

                                    seg_start = round(float(s.get("start", 0)), 3)
                                    seg_end = round(float(s.get("end", 0)), 3)
                                    if words_list:
                                        first_w_start = words_list[0].start
                                        last_w_end = words_list[-1].end
                                        if first_w_start >= 0:
                                            seg_start = min(seg_start, first_w_start) if seg_start > 0 else first_w_start
                                        if last_w_end > seg_start:
                                            seg_end = max(seg_end, last_w_end)
                                    elif s.get("text"):
                                        rws = str(s.get("text", "")).strip().split()
                                        if rws:
                                            s_dur = max(0.2, seg_end - seg_start)
                                            w_dur = s_dur / len(rws)
                                            for w_i, rw in enumerate(rws):
                                                words_list.append(
                                                    WordItem(
                                                        word=rw,
                                                        start=round(seg_start + w_i * w_dur, 3),
                                                        end=round(seg_start + (w_i + 1) * w_dur, 3),
                                                        score=0.95
                                                    )
                                                )

                                    segments.append(
                                        SegmentItem(
                                            id=idx + 1,
                                            start=seg_start,
                                            end=seg_end,
                                            text=str(s.get("text", "")).strip(),
                                            words=words_list
                                        )
                                    )

                                full_text = parsed.get("full_text", " ".join([seg.text for seg in segments]))
                                duration = segments[-1].end if segments else 0.0

                                return TranscriptionResult(
                                    text=full_text,
                                    language="uz",
                                    duration=duration,
                                    segments=segments
                                )

                        elif response.status_code in (503, 429, 500):
                            wait_sec = 2.0 * (attempt + 1)
                            print(f"[Gemini] {model_candidate} ({response.status_code}) berdi, {wait_sec}s kutilmoqda (urinish {attempt+1}/3)...")
                            await asyncio.sleep(wait_sec)
                            continue
                        else:
                            last_error = f"{model_candidate} ({response.status_code}): {response.text[:200]}"
                            print(f"[Gemini] {last_error}")
                            break

                    except Exception as reqErr:
                        last_error = str(reqErr)
                        print(f"[Gemini] So'rov xatosi ({model_candidate}): {reqErr}")
                        await asyncio.sleep(1.5)

        raise RuntimeError(f"Google Gemini serverida vaqtinchalik yuklama mavjud. Xatolik: {last_error}")
