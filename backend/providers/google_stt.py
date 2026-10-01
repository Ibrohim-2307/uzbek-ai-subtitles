"""
O'zbekcha AI Subtitr - Google Cloud Speech-to-Text Provayderi
Bulutli STT xizmati orqali audioni yuqori aniqlikda matnga o'giradi.
"""

import os
import base64
import httpx
from .base import BaseSTTProvider, TranscriptionResult, SegmentItem, WordItem


class GoogleSTTProvider(BaseSTTProvider):
    def __init__(self, api_key: str = ""):
        super().__init__(name="google")
        self.api_key = api_key

    def is_available(self) -> bool:
        return bool(self.api_key and len(self.api_key.strip()) > 10)

    async def transcribe(self, audio_path: str, language: str = "uz-UZ", **kwargs) -> TranscriptionResult:
        if not self.is_available():
            raise ValueError("Google Cloud API kaliti kiritilmagan! Sozlamalar bo'limidan kalitni kiriting.")

        if not os.path.exists(audio_path):
            raise FileNotFoundError(f"Audio fayl topilmadi: {audio_path}")

        # Audio faylni base64 ko'rinishida o'qish
        with open(audio_path, "rb") as f:
            audio_content = base64.b64encode(f.read()).decode("utf-8")

        # Google STT REST API so'rovi
        url = f"https://speech.googleapis.com/v1/speech:recognize?key={self.api_key}"
        payload = {
            "config": {
                "encoding": "LINEAR16",
                "sampleRateHertz": 16000,
                "languageCode": "uz-UZ",
                "enableWordTimeOffsets": True,
                "model": "default"
            },
            "audio": {
                "content": audio_content
            }
        }

        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(url, json=payload)
            if response.status_code != 200:
                raise RuntimeError(f"Google STT xatosi ({response.status_code}): {response.text}")
            data = response.json()

        segments = []
        full_text_list = []
        segment_id = 0

        for result in data.get("results", []):
            alternative = result.get("alternatives", [{}])[0]
            transcript = alternative.get("transcript", "").strip()
            if not transcript:
                continue

            full_text_list.append(transcript)
            words_data = alternative.get("words", [])
            words_list = []

            seg_start = 0.0
            seg_end = 0.0

            for idx, w in enumerate(words_data):
                # Google vaqtlarni "1.5s" ko'rinishida qaytaradi
                start_sec = float(w.get("startTime", "0s").replace("s", ""))
                end_sec = float(w.get("endTime", "0s").replace("s", ""))
                if idx == 0:
                    seg_start = start_sec
                seg_end = end_sec

                words_list.append(
                    WordItem(
                        word=w.get("word", ""),
                        start=round(start_sec, 3),
                        end=round(end_sec, 3),
                        score=float(alternative.get("confidence", 1.0))
                    )
                )

            segment_id += 1
            segments.append(
                SegmentItem(
                    id=segment_id,
                    start=round(seg_start, 3),
                    end=round(seg_end, 3),
                    text=transcript,
                    words=words_list
                )
            )

        return TranscriptionResult(
            text=" ".join(full_text_list),
            language="uz",
            duration=segments[-1].end if segments else 0.0,
            segments=segments
        )
