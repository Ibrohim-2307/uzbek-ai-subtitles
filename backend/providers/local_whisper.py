"""
O'zbekcha AI Subtitr - Lokal Faster-Whisper Provayderi
Kompyuterning o'zida (offline) CUDA (Nvidia GPU) yoki CPU yordamida
tezkor va aniq so'zma-so'z transkripsiya bajaradi.
"""

import os
import asyncio
from typing import Optional
from .base import BaseSTTProvider, TranscriptionResult, SegmentItem, WordItem

try:
    from faster_whisper import WhisperModel
    FASTER_WHISPER_INSTALLED = True
except ImportError:
    FASTER_WHISPER_INSTALLED = False


class LocalWhisperProvider(BaseSTTProvider):
    def __init__(self, model_size: str = "small", device: str = "auto", compute_type: str = "auto"):
        super().__init__(name="local_whisper")
        self.model_size = model_size
        self.device = device
        self.compute_type = compute_type
        self._model: Optional[Any] = None
        self._current_loaded_size = None

    def is_available(self) -> bool:
        return FASTER_WHISPER_INSTALLED

    def _determine_device_and_compute(self):
        """Mavjud apparat ta'minotiga (GPU/CPU) mos optimal rejimni tanlaydi"""
        device = self.device
        compute = self.compute_type

        if device == "auto":
            is_cuda = False
            try:
                from ..utils.timing_aligner import is_cuda_working
                is_cuda = is_cuda_working()
            except Exception:
                pass

            if is_cuda:
                device = "cuda"
                compute = "float16" if compute == "auto" else compute
            else:
                device = "cpu"
                compute = "int8" if compute == "auto" else compute

        if compute == "auto":
            compute = "float16" if device == "cuda" else "int8"

        return device, compute

    def _load_model(self):
        """Whisper modelini xotiraga yuklaydi (agar yuklanmagan bo'lsa)"""
        if not FASTER_WHISPER_INSTALLED:
            raise RuntimeError("faster-whisper kutubxonasi o'rnatilmagan! Iltimos, 'pip install faster-whisper' buyrug'ini bajaring.")

        device, compute = self._determine_device_and_compute()

        if self._model is None or self._current_loaded_size != self.model_size:
            print(f"[Whisper] Model yuklanmoqda: {self.model_size} ({device}, {compute})...")
            self._model = WhisperModel(
                self.model_size,
                device=device,
                compute_type=compute
            )
            self._current_loaded_size = self.model_size
            print("[Whisper] Model muvaffaqiyatli yuklandi!")

        return self._model

    async def transcribe(self, audio_path: str, language: str = "uz", **kwargs) -> TranscriptionResult:
        """Audioni asinxron tarzda matnga aylantiradi"""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, self._sync_transcribe, audio_path, language, kwargs)

    def _sync_transcribe(self, audio_path: str, language: str, kwargs: dict) -> TranscriptionResult:
        if not os.path.exists(audio_path):
            raise FileNotFoundError(f"Audio fayl topilmadi: {audio_path}")

        model = self._load_model()

        # Whisper parametrlarini sozlash:
        # word_timestamps=True - har bir so'zning aniq vaqtini olish
        # vad_filter=True - sukut va nafas olish vaqtlarini so'zga qo'shib yubormaslik
        # condition_on_previous_text=False - vaqt siljishini kamaytirish uchun
        segments_generator, info = model.transcribe(
            audio_path,
            language=language if language != "auto" else None,
            task="transcribe",
            word_timestamps=True,
            condition_on_previous_text=False,
            vad_filter=kwargs.get("vad_filter", True),
            vad_parameters=dict(
                threshold=0.22,
                min_speech_duration_ms=100,
                min_silence_duration_ms=300,
                speech_pad_ms=400
            ),
            beam_size=kwargs.get("beam_size", 5),
            temperature=kwargs.get("temperature", 0.0)
        )

        segments_list = []
        full_text_parts = []
        segment_id = 0

        for seg in segments_generator:
            segment_id += 1
            seg_text = seg.text.strip()
            if not seg_text:
                continue
            full_text_parts.append(seg_text)

            word_items = []
            if seg.words:
                for w in seg.words:
                    clean_w = w.word.strip()
                    if clean_w:
                        prob = round(w.probability, 3) if hasattr(w, "probability") else 1.0
                        w_start = round(w.start, 3)
                        w_end = round(w.end, 3)
                        word_items.append(
                            WordItem(
                                word=clean_w,
                                start=w_start,
                                end=w_end,
                                score=prob,
                                confidence=prob,
                                original_start=w_start,
                                aligned_start=w_start,
                                raw_start=w_start,
                                raw_end=w_end,
                                timing_source="whisper",
                                timing_confidence=prob,
                                pause_after_ms=0.0
                            )
                        )

            # Agar seg.words bo'lmasa, matndan har bir so'zga proporsional vaqt ajratamiz
            if not word_items:
                raw_words = seg_text.split()
                if raw_words:
                    s_dur = max(0.2, seg.end - seg.start)
                    w_dur = s_dur / len(raw_words)
                    for idx, rw in enumerate(raw_words):
                        cw_start = round(seg.start + idx * w_dur, 3)
                        cw_end = round(seg.start + (idx + 1) * w_dur, 3)
                        word_items.append(
                            WordItem(
                                word=rw,
                                start=cw_start,
                                end=cw_end,
                                score=0.6,
                                confidence=0.6,
                                original_start=cw_start,
                                aligned_start=cw_start,
                                raw_start=cw_start,
                                raw_end=cw_end,
                                timing_source="interpolated",
                                timing_confidence=0.5,
                                pause_after_ms=0.0
                            )
                        )

            s_start = word_items[0].start if word_items else round(seg.start, 3)
            s_end = word_items[-1].end if word_items else round(seg.end, 3)

            segments_list.append(
                SegmentItem(
                    id=segment_id,
                    start=s_start,
                    end=s_end,
                    text=seg_text,
                    words=word_items
                )
            )

        return TranscriptionResult(
            text=" ".join(full_text_parts),
            language=info.language if hasattr(info, "language") else language,
            duration=round(info.duration, 3) if hasattr(info, "duration") else 0.0,
            segments=segments_list,
            timestamp_origin="audio_local"
        )
