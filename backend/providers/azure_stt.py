"""
O'zbekcha AI Subtitr - Azure Speech to Text Provayderi
Microsoft Azure Cognitive Services Speech API adapteri.
"""

import os
import httpx
from .base import BaseSTTProvider, TranscriptionResult, SegmentItem, WordItem


class AzureSTTProvider(BaseSTTProvider):
    def __init__(self, api_key: str = "", region: str = "eastus"):
        super().__init__(name="azure")
        self.api_key = api_key
        self.region = region

    def is_available(self) -> bool:
        return bool(self.api_key and len(self.api_key.strip()) > 10)

    async def transcribe(self, audio_path: str, language: str = "uz-UZ", **kwargs) -> TranscriptionResult:
        if not self.is_available():
            raise ValueError("Azure Speech API kaliti kiritilmagan! Sozlamalar bo'limidan kalitni kiriting.")

        if not os.path.exists(audio_path):
            raise FileNotFoundError(f"Audio fayl topilmadi: {audio_path}")

        # Azure Fast Transcription API yoki Short Audio API
        url = f"https://{self.region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=uz-UZ&format=detailed"

        headers = {
            "Ocp-Apim-Subscription-Key": self.api_key,
            "Content-Type": "audio/wav; codecs=audio/pcm; samplerate=16000",
            "Accept": "application/json"
        }

        with open(audio_path, "rb") as f:
            audio_bytes = f.read()

        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(url, headers=headers, content=audio_bytes)
            if response.status_code != 200:
                raise RuntimeError(f"Azure Speech xatosi ({response.status_code}): {response.text}")
            data = response.json()

        recognition_status = data.get("RecognitionStatus", "")
        if recognition_status != "Success":
            raise RuntimeError(f"Azure transkripsiya holati: {recognition_status}")

        n_best = data.get("NBest", [{}])[0]
        display_text = n_best.get("Display", "")
        words_data = n_best.get("Words", [])

        words_list = []
        seg_start = float(data.get("Offset", 0)) / 10_000_000.0  # Azure 100ns birlikda
        duration = float(data.get("Duration", 0)) / 10_000_000.0
        seg_end = seg_start + duration

        for w in words_data:
            w_offset = float(w.get("Offset", 0)) / 10_000_000.0
            w_dur = float(w.get("Duration", 0)) / 10_000_000.0
            words_list.append(
                WordItem(
                    word=w.get("Word", ""),
                    start=round(w_offset, 3),
                    end=round(w_offset + w_dur, 3),
                    score=float(w.get("Confidence", 1.0))
                )
            )

        segment = SegmentItem(
            id=1,
            start=round(seg_start, 3),
            end=round(seg_end, 3),
            text=display_text,
            words=words_list
        )

        return TranscriptionResult(
            text=display_text,
            language="uz",
            duration=round(seg_end, 3),
            segments=[segment]
        )
