"""
O'zbekcha AI Subtitr - STT Provayderlar uchun Asosiy Interfeys (Base STT Provider)
Adapter pattern asosida yaratilgan bo'lib, har qanday STT xizmatini yagona
standartga moslashtirish imkonini beradi.
"""

from abc import ABC, abstractmethod
from typing import List, Optional
from pydantic import BaseModel, Field


class WordItem(BaseModel):
    """Alohida bitta so'z va uning vaqt belgilari"""
    word: str
    start: float = Field(..., description="So'z boshlanish vaqti (soniyalarda)")
    end: float = Field(..., description="So'z tugash vaqti (soniyalarda)")
    score: Optional[float] = Field(default=1.0, description="Ishonchlilik darajasi (0.0 - 1.0)")
    confidence: Optional[float] = Field(default=1.0, description="Ishonch darajasi (0.0 - 1.0)")
    pause_after_ms: Optional[float] = Field(default=0.0, description="Keyingi so'zgacha bo'lgan sukut (ms)")
    raw_start: Optional[float] = Field(default=None, description="STT original boshlanish vaqti (soniya)")
    raw_end: Optional[float] = Field(default=None, description="STT original tugash vaqti (soniya)")
    original_start: Optional[float] = Field(default=None, description="STT boshlang'ich vaqti (audio_local)")
    aligned_start: Optional[float] = Field(default=None, description="Alignmentdan keyingi vaqt (audio_local)")
    final_start: Optional[float] = Field(default=None, description="Yakuniy timeline vaqti")
    timing_source: Optional[str] = Field(default="whisper", description="Vaqt manbasi: 'mms_fa', 'whisper', 'whisper_measured', 'energy_snap', 'interpolated'")
    timing_confidence: Optional[float] = Field(default=1.0, description="Vaqt aniqligi ishonchi (0.0 - 1.0)")
    snap_shift_ms: Optional[float] = Field(default=0.0, description="Audio energy snap siljishi ms")
    clamped: Optional[bool] = Field(default=False, description="Klip chegarasida qirqilganmi")


class SegmentItem(BaseModel):
    """Subtitr jumlasi / qatori va uning ichidagi so'zlar"""
    id: int
    start: float = Field(..., description="Jumla boshlanish vaqti (soniyalarda)")
    end: float = Field(..., description="Jumla tugash vaqti (soniyalarda)")
    text: str = Field(..., description="Jumla matni")
    words: List[WordItem] = Field(default_factory=list, description="Jumladagi so'zlar ro'yxati")


class TranscriptionResult(BaseModel):
    """Umumiy transkripsiya natijasi modeli"""
    text: str = Field(..., description="To'liq matn")
    language: str = Field(default="uz", description="Til kodi (uz)")
    duration: float = Field(default=0.0, description="Audio davomiyligi (soniya)")
    segments: List[SegmentItem] = Field(default_factory=list, description="Subtitr qismlari")
    timestamp_origin: str = Field(default="audio_local", description="Timestamp koordinata asosi ('audio_local' yoki 'source')")


class BaseSTTProvider(ABC):
    """Barcha STT provayderlar voris olishi kerak bo'lgan asosiy sinf"""

    def __init__(self, name: str):
        self.name = name

    @abstractmethod
    def is_available(self) -> bool:
        """Provayder ishlashga tayyormi yoki qo'shimcha sozlash kerakmi?"""
        pass

    @abstractmethod
    async def transcribe(self, audio_path: str, language: str = "uz", **kwargs) -> TranscriptionResult:
        """
        Audioni matnga aylantirish funksiyasi.
        
        Parametrlar:
            audio_path: 16kHz mono WAV faylga to'liq yo'l
            language: Til kodi (standart: "uz")
            kwargs: Qo'shimcha parametrlar (model, harorat va h.k.)
            
        Qaytaradi:
            TranscriptionResult (so'zma-so'z vaqt belgilari bilan)
        """
        pass
