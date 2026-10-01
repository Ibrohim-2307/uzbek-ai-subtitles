"""
O'zbekcha AI Subtitr - Maxsus (Custom / OpenAI / Mohirdev) STT Provayderi
Istalgan tashqi REST API (OpenAI Whisper formati yoki boshqa o'zbekcha STT servislari)
bilan ishlash imkonini beradi.
"""

import os
import httpx
from .base import BaseSTTProvider, TranscriptionResult, SegmentItem, WordItem


class CustomSTTProvider(BaseSTTProvider):
    def __init__(self, api_url: str = "", api_key: str = ""):
        super().__init__(name="custom")
        self.api_url = api_url.strip()
        self.api_key = api_key.strip()

    def is_available(self) -> bool:
        return bool(self.api_url.startswith("http"))

    async def transcribe(self, audio_path: str, language: str = "uz", **kwargs) -> TranscriptionResult:
        if not self.is_available():
            raise ValueError("Maxsus API URL manzili kiritilmagan! Sozlamalar bo'limidan URL kiriting.")

        if not os.path.exists(audio_path):
            raise FileNotFoundError(f"Audio fayl topilmadi: {audio_path}")

        headers = {}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"

        # Standart multipart/form-data so'rovi (OpenAI / Whisper API formati)
        async with httpx.AsyncClient(timeout=180.0) as client:
            with open(audio_path, "rb") as audio_file:
                files = {"file": (os.path.basename(audio_path), audio_file, "audio/wav")}
                data = {
                    "model": "whisper-1",
                    "language": language,
                    "response_format": "verbose_json",
                    "timestamp_granularities[]": ["word", "segment"]
                }
                response = await client.post(self.api_url, headers=headers, data=data, files=files)

            if response.status_code != 200:
                raise RuntimeError(f"Tashqi API xatosi ({response.status_code}): {response.text}")

            result = response.json()

        # Natijani standart formatga o'tkazish
        segments_data = result.get("segments", [])
        segments_list = []
        full_text = result.get("text", "")

        for idx, seg in enumerate(segments_data):
            words_list = []
            for w in seg.get("words", []):
                words_list.append(
                    WordItem(
                        word=w.get("word", "").strip(),
                        start=round(float(w.get("start", 0)), 3),
                        end=round(float(w.get("end", 0)), 3),
                        score=float(w.get("score", 1.0))
                    )
                )

            segments_list.append(
                SegmentItem(
                    id=idx + 1,
                    start=round(float(seg.get("start", 0)), 3),
                    end=round(float(seg.get("end", 0)), 3),
                    text=seg.get("text", "").strip(),
                    words=words_list
                )
            )

        duration = result.get("duration", segments_list[-1].end if segments_list else 0.0)

        return TranscriptionResult(
            text=full_text,
            language=result.get("language", language),
            duration=round(float(duration), 3),
            segments=segments_list
        )
