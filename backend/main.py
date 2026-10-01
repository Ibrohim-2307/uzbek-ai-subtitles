"""
O'zbekcha AI Subtitr - FastAPI Asosiy Backend Serveri
Adobe After Effects va Premiere Pro panellari bilan localhost orqali muloqot qiladi.
"""

import os
import zipfile
import shutil
import tempfile
from typing import Optional, Dict, Any, List
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, BackgroundTasks, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from .config import config_manager
from .providers.base import BaseSTTProvider, TranscriptionResult, SegmentItem, WordItem
from .providers.local_whisper import LocalWhisperProvider
from .providers.gemini_stt import GeminiSTTProvider
from .providers.google_stt import GoogleSTTProvider
from .providers.azure_stt import AzureSTTProvider
from .providers.custom_stt import CustomSTTProvider
from .utils.audio import convert_to_16k_mono_wav, check_ffmpeg
from .utils.uzbek_nlp import (
    normalize_uzbek_text,
    lotin_to_kirill,
    kirill_to_lotin,
    replace_numbers_with_words,
    apply_custom_dictionary,
    split_subtitle_text,
    chunk_words_by_pause
)
from .utils.beat_detector import detect_tempo_and_beats
from .utils.audio_aligner import snap_word_timestamps_to_audio
from .utils.forced_alignment import align_with_mms, check_forced_alignment_status

app = FastAPI(
    title="O'zbekcha AI Subtitr Backend",
    version="1.0.0",
    description="Adobe Premiere Pro va After Effects uchun O'zbekcha AI Subtitr REST API"
)

# CORS sozlamalari (Adobe CEP va brauzer ulanishi uchun)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_stt_provider(provider_name: Optional[str] = None, model_size: Optional[str] = None) -> BaseSTTProvider:
    """Belgilangan yoki joriy sozlangan STT provayderini tayyorlaydi"""
    cfg = config_manager.config
    name = provider_name or cfg.get("provider", "local_whisper")
    m_size = model_size or cfg.get("model_size", "small")

    if name == "local_whisper":
        return LocalWhisperProvider(
            model_size=m_size,
            device=cfg.get("device", "auto"),
            compute_type=cfg.get("compute_type", "auto")
        )
    elif name == "gemini":
        key = cfg.get("api_keys", {}).get("gemini", "")
        return GeminiSTTProvider(api_key=key)
    elif name == "google":
        key = cfg.get("api_keys", {}).get("google_cloud", "")
        return GoogleSTTProvider(api_key=key)
    elif name == "azure":
        key = cfg.get("api_keys", {}).get("azure_speech", "")
        reg = cfg.get("api_keys", {}).get("azure_region", "eastus")
        return AzureSTTProvider(api_key=key, region=reg)
    elif name == "custom":
        url = cfg.get("api_keys", {}).get("custom_api_url", "")
        key = cfg.get("api_keys", {}).get("custom_api_key", "")
        return CustomSTTProvider(api_url=url, api_key=key)
    else:
        # Standart sifatida local whisper
        return LocalWhisperProvider(model_size="small")


# ==================== STATUS VA SALOMATLIK ====================

@app.get("/health")
def health_check():
    """Server, GPU va FFmpeg holatini tekshiradi"""
    has_gpu = False
    gpu_name = "CPU"
    try:
        import torch
        if torch.cuda.is_available():
            has_gpu = True
            gpu_name = torch.cuda.get_device_name(0)
    except Exception:
        pass

    return {
        "status": "online",
        "message": "O'zbekcha AI Subtitr Backend faol",
        "gpu_available": has_gpu,
        "device_name": gpu_name,
        "ffmpeg_available": check_ffmpeg(),
        "active_provider": config_manager.config.get("provider", "local_whisper"),
        "model_size": config_manager.config.get("model_size", "small")
    }


@app.get("/providers")
def list_providers():
    """Barcha provayderlar ro'yxati va ularning tayyorligini qaytaradi"""
    cfg = config_manager.config
    keys = cfg.get("api_keys", {})

    return [
        {
            "id": "local_whisper",
            "name": "Lokal Whisper (Offline / GPU / CPU)",
            "available": True,
            "description": "Internet talab qilmaydi, yuqori aniqlik va so'zma-so'z vaqtlar."
        },
        {
            "id": "gemini",
            "name": "Google Gemini AI (Google One / AI Studio)",
            "available": bool(keys.get("gemini")),
            "description": "Google One egalari uchun bepul va o'ta aniq o'zbekcha AI transkripsiya."
        },
        {
            "id": "google",
            "name": "Google Cloud Speech-to-Text",
            "available": bool(keys.get("google_cloud")),
            "description": "Bulutli, yuqori tezlik (API kalit talab qilinadi)."
        },
        {
            "id": "azure",
            "name": "Microsoft Azure Speech",
            "available": bool(keys.get("azure_speech")),
            "description": "Microsoft Speech API (API kalit talab qilinadi)."
        },
        {
            "id": "custom",
            "name": "Maxsus STT API (OpenAI / Mohirdev / Boshqa)",
            "available": bool(keys.get("custom_api_url")),
            "description": "Istalgan tashqi REST API formati."
        }
    ]


# ==================== SOZLAMALAR VA LUG'AT ====================

@app.get("/config")
def get_config():
    """Joriy sozlamalarni olish"""
    return config_manager.config


@app.post("/config")
def update_config(payload: Dict[str, Any]):
    """Sozlamalarni yangilash"""
    success = config_manager.save_config(payload)
    if not success:
        raise HTTPException(status_code=500, detail="Sozlamalarni saqlashda xatolik yuz berdi")
    return {"status": "ok", "config": config_manager.config}


@app.get("/dictionary")
def get_dictionary():
    """Shaxsiy o'zbekcha lug'atni olish"""
    return config_manager.dictionary


@app.post("/dictionary")
def update_dictionary(dictionary: Dict[str, str]):
    """Shaxsiy lug'atni yangilash"""
    success = config_manager.save_dictionary(dictionary)
    if not success:
        raise HTTPException(status_code=500, detail="Lug'atni saqlashda xatolik yuz berdi")
    return {"status": "ok", "count": len(dictionary)}


# ==================== ASOSIY TRANSKRIPSIYA ====================

class TranscribeRequest(BaseModel):
    file_path: Optional[str] = None
    provider: Optional[str] = None
    language: Optional[str] = "uz"
    script: Optional[str] = None  # "latin" yoki "cyrillic"
    convert_numbers: Optional[bool] = None
    max_line_length: Optional[int] = None
    max_lines: Optional[int] = None


from pathlib import Path


def resolve_media_file_on_disk(name_or_path: str) -> Optional[str]:
    """Fayl nomi yoki noto'liq yo'li berilsa, uni kompyuter diskidan avtomatik topadi"""
    if not name_or_path:
        return None
    if os.path.exists(name_or_path):
        return name_or_path

    clean_name = os.path.basename(name_or_path).strip()
    search_dirs = [
        Path.home() / "Downloads" / "Telegram Desktop",
        Path.home() / "Downloads",
        Path.home() / "Desktop",
        Path.home() / "Videos",
        Path("D:/mantaj/mantaj/tajriba uchun"),
        Path("D:/mantaj/mantaj"),
        Path("D:/mantaj"),
        Path("D:/"),
        Path("C:/")
    ]
    for d in search_dirs:
        try:
            if not d.exists():
                continue
            candidate = d / clean_name
            if candidate.is_file():
                return str(candidate)
            if d not in [Path("C:/"), Path("D:/")]:
                for found in d.glob(f"*{clean_name}*"):
                    if found.is_file():
                        return str(found)
        except Exception:
            continue
    return None


@app.post("/transcribe")
async def transcribe_audio(
    file_path: Optional[str] = Form(None),
    provider: Optional[str] = Form(None),
    language: Optional[str] = Form("uz"),
    script: Optional[str] = Form(None),
    convert_numbers: Optional[bool] = Form(None),
    max_line_length: Optional[int] = Form(None),
    max_lines: Optional[int] = Form(None),
    in_point: Optional[float] = Form(None),
    out_point: Optional[float] = Form(None),
    duration: Optional[float] = Form(None),
    fps: Optional[float] = Form(None),
    sync_offset_ms: Optional[float] = Form(None),
    timeline_offset_ms: Optional[float] = Form(None),
    clip_start: Optional[float] = Form(None),
    clip_end: Optional[float] = Form(None),
    clip_speed: Optional[float] = Form(None),
    model_size: Optional[str] = Form(None),
    forced_alignment: Optional[bool] = Form(None),
    audio_energy_snap: Optional[bool] = Form(None),
    pause_hide_text: Optional[bool] = Form(None),
    pause_hide_threshold_ms: Optional[int] = Form(None),
    char_reveal: Optional[bool] = Form(None),
    file: Optional[UploadFile] = File(None)
):
    """
    Audio faylni o'zbekcha matnga aylantirish asosiy nuqtasi.
    Fayl to'g'ridan-to'g'ri diskdagi yo'l orqali (file_path) yoki yuklangan fayl (file) orqali qabul qilinadi.
    Agar in_point va duration berilgan bo'lsa, faqat qirqilgan klip qismini tezkor ajratib oladi!
    """
    temp_files_to_clean = []
    cfg = config_manager.config

    target_script = script or cfg.get("script", "latin")
    do_convert_numbers = convert_numbers if convert_numbers is not None else cfg.get("convert_numbers", False)
    line_len = max_line_length or cfg.get("max_line_length", 35)
    lines_cnt = max_lines or cfg.get("max_lines", 2)
    selected_provider = provider or cfg.get("provider", "local_whisper")

    try:
        # 1. Kiruvchi audio yo'lini aniqlash
        actual_input_path = ""
        if file_path:
            if os.path.exists(file_path):
                actual_input_path = file_path
            else:
                # Diskdan avtomatik qidirish
                resolved = resolve_media_file_on_disk(file_path)
                if resolved:
                    actual_input_path = resolved

        if not actual_input_path and file:
            temp_in = tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(file.filename)[1])
            temp_files_to_clean.append(temp_in.name)
            with open(temp_in.name, "wb") as f:
                shutil.copyfileobj(file.file, f)
            actual_input_path = temp_in.name

        if not actual_input_path:
            raise HTTPException(status_code=400, detail="Audio fayl yoki uning yo'li ko'rsatilmadi!")

        # in_point va duration hisoblash (faqat kesilgan qismini tezkor qayta ishlash)
        start_sec = in_point if (in_point is not None and in_point > 0) else None
        duration_sec = duration
        if duration_sec is None and out_point is not None and in_point is not None and out_point > in_point:
            duration_sec = out_point - in_point

        # 2. 16kHz mono WAV ga o'tkazish (Whisper uchun har doim 16k mono bo'lishi shart)
        wav_path = actual_input_path
        if selected_provider == "local_whisper":
            temp_wav = tempfile.NamedTemporaryFile(delete=False, suffix=".wav")
            temp_files_to_clean.append(temp_wav.name)
            wav_path = convert_to_16k_mono_wav(actual_input_path, temp_wav.name, start_sec=start_sec, duration_sec=duration_sec)

        # 3. STT provayderini chaqirish (Avtomatik zaxira bilan)
        m_size = model_size or cfg.get("model_size", "small")
        stt_instance = get_stt_provider(selected_provider, model_size=m_size)
        try:
            # Gemini bevosita video/audio dan yengil MP3 oladi, Whisper esa WAV bilan ishlaydi
            input_for_stt = actual_input_path if selected_provider == "gemini" else wav_path
            transcription: TranscriptionResult = await stt_instance.transcribe(
                input_for_stt,
                language=language,
                start_sec=start_sec,
                duration_sec=duration_sec
            )
        except Exception as sttErr:
            print(f"[{selected_provider}] Xatosi: {sttErr}")
            raise HTTPException(status_code=500, detail=f"Transkripsiyada xatolik ({selected_provider}): {str(sttErr)}")

        # 4. O'zbek tili NLP qayta ishlash zanjiri
        dictionary = config_manager.dictionary
        raw_processed_segments = []

        for seg in transcription.segments:
            text = seg.text

            # a) Lug'atdagi xatolarni tuzatish
            text = apply_custom_dictionary(text, dictionary)

            # b) Raqamlarni so'zga aylantirish
            if do_convert_numbers:
                text = replace_numbers_with_words(text)

            # c) O'zbekcha belgilarni normallashtirish (o‘, g‘)
            text = normalize_uzbek_text(text)

            # d) Agar kirill tanlangan bo'lsa, kirillga o'tkazish
            if target_script == "cyrillic":
                text = lotin_to_kirill(text)

            # So'zlar ro'yxatini ham mos ravishda yangilash
            processed_words = []
            for w in seg.words:
                w_text = apply_custom_dictionary(w.word, dictionary)
                if do_convert_numbers:
                    w_text = replace_numbers_with_words(w_text)
                w_text = normalize_uzbek_text(w_text)
                if target_script == "cyrillic":
                    w_text = lotin_to_kirill(w_text)

                w_prob = getattr(w, "confidence", None) or getattr(w, "score", 1.0)
                processed_words.append(
                    WordItem(
                        word=w_text,
                        start=w.start,
                        end=w.end,
                        score=w.score,
                        confidence=w_prob,
                        pause_after_ms=getattr(w, "pause_after_ms", 0.0)
                    )
                )

            raw_processed_segments.append(
                SegmentItem(
                    id=seg.id,
                    start=seg.start,
                    end=seg.end,
                    text=text,
                    words=processed_words
                )
            )

        # 4.5. SO'Z VAQTLARINI 3 QATLAMLI ANIQLASHTIRISH (Alignment & Snapping)
        do_forced_align = forced_alignment if forced_alignment is not None else cfg.get("forced_alignment", True)
        do_audio_snap = audio_energy_snap if audio_energy_snap is not None else cfg.get("audio_energy_snap", True)

        all_raw_words = []
        for s in raw_processed_segments:
            all_raw_words.extend(s.words)

        alignment_method_used = "whisper_word_timestamps"
        align_stats = {
            "total_words": len(all_raw_words),
            "snapped_count": 0,
            "avg_shift_ms": 0.0,
            "max_shift_ms": 0.0,
            "pauses_found": 0
        }

        # B) Forced Alignment (ixtiyoriy, torchaudio MMS mavjud bo'lsa)
        if do_forced_align and all_raw_words and wav_path and os.path.exists(wav_path):
            mms_words, mms_status = align_with_mms(wav_path, [w.model_dump() for w in all_raw_words], language="uz")
            if mms_words:
                alignment_method_used = "torchaudio_mms_fa"
                all_raw_words = [WordItem(**mw) for mw in mms_words]
            else:
                print(f"[Alignment] {mms_status}")

        # C) Ovoz energiyasi va sukut/pauza bilan aniqlashtirish (Audio Energy Snapping)
        if do_audio_snap and all_raw_words and wav_path and os.path.exists(wav_path):
            snapped, stats = snap_word_timestamps_to_audio(
                all_raw_words,
                wav_path=wav_path,
                search_window_ms=150.0,
                min_word_dur_ms=80.0,
                min_pause_ms=200.0,
                fps=fps
            )
            if snapped:
                if alignment_method_used == "torchaudio_mms_fa":
                    alignment_method_used += " + audio_energy_snapped"
                else:
                    alignment_method_used = "audio_energy_snapped_whisper"
                align_stats = stats
                all_raw_words = [WordItem(**sw) for sw in snapped]

        # Aniqlangan so'zlarni segmentlarga qaytarib biriktirish
        word_cursor = 0
        for s in raw_processed_segments:
            count = len(s.words)
            s.words = all_raw_words[word_cursor : word_cursor + count]
            word_cursor += count
            if s.words:
                s.start = s.words[0].start
                s.end = s.words[-1].end

        # 5. QAT'IY 1-2 QATORGA BO'LISH (Hech qachon 3-4 qator bo'lmaydi)
        # Har bir segment ko'pi bilan 3-5 ta so'z (28 ta belgi) dan oshmaydi
        processed_segments = []
        global_seg_id = 1

        for seg in raw_processed_segments:
            words = seg.words or []
            if not words:
                raw_w = seg.text.replace("\n", " ").split()
                if not raw_w:
                    continue
                dur = max(0.4, seg.end - seg.start)
                dur_per_w = dur / len(raw_w)
                words = [
                    WordItem(
                        word=w,
                        start=round(seg.start + idx * dur_per_w, 3),
                        end=round(seg.start + (idx + 1) * dur_per_w, 3),
                        score=1.0
                    )
                    for idx, w in enumerate(raw_w)
                ]

            clean_text = " ".join([w.word for w in words])
            # Agar so'zlar 4 tagacha bo'lsa va 26 belgidan oshmasa, bitta segment qoladi
            if len(words) <= 4 and len(clean_text) <= 28:
                fmt_text = split_subtitle_text(clean_text, max_chars=24, max_lines=2)
                processed_segments.append(
                    SegmentItem(
                        id=global_seg_id,
                        start=words[0].start,
                        end=words[-1].end,
                        text=fmt_text,
                        words=words
                    )
                )
                global_seg_id += 1
                continue

            # Nutqdagi tabiiy pauzalar, intonatsiya va tinish belgilari bo'yicha bo'laklaymiz (Blok F: 9.3)
            chunks = chunk_words_by_pause(
                words,
                max_chars_line=28,
                max_lines=2,
                max_words=7,
                min_chunk_chars=12,
                pause_threshold=0.35
            )

            for c in chunks:
                if not c:
                    continue
                c_text = " ".join([w.word for w in c])
                fmt_c_text = split_subtitle_text(c_text, max_chars=28, max_lines=2)
                c_start = c[0].start
                c_end = c[-1].end
                if c_end <= c_start:
                    c_end = round(c_start + 0.35, 3)

                processed_segments.append(
                    SegmentItem(
                        id=global_seg_id,
                        start=c_start,
                        end=c_end,
                        text=fmt_c_text,
                        words=c
                    )
                )
                global_seg_id += 1

        # 6. Klip Speed (Tezlik), Timeline Offset, Clamping va Kadr tezligiga (FPS) moslash
        speed_factor = float(clip_speed) if (clip_speed and clip_speed > 0) else 1.0
        tl_offset_sec = float(clip_start) if (clip_start is not None) else 0.0
        if timeline_offset_ms:
            tl_offset_sec += (float(timeline_offset_ms) / 1000.0)
        sync_shift_sec = (float(sync_offset_ms) / 1000.0) if (sync_offset_ms is not None and sync_offset_ms != 0) else 0.0
        total_time_shift = tl_offset_sec + sync_shift_sec

        fps_val = float(fps) if (fps is not None and fps > 0) else 25.0
        frame_dur = 1.0 / fps_val

        # Klipning timeline'dagi maksimal tugash chegarasi (Clamping uchun)
        max_clip_end = float(clip_end) if (clip_end is not None and clip_end > tl_offset_sec) else None
        if max_clip_end is None and duration_sec:
            max_clip_end = tl_offset_sec + (duration_sec / speed_factor)

        def transform_time(t: float) -> float:
            scaled = (t / speed_factor) + total_time_shift
            quantized = round(round(scaled * fps_val) / fps_val, 3)
            return quantized

        final_segments = []
        for s in processed_segments:
            final_words = []
            for w in s.words:
                orig_w_start = round(float(w.start), 3)
                orig_w_end = round(float(w.end), 3)

                t_w_start = transform_time(orig_w_start)
                t_w_end = transform_time(orig_w_end)

                # CLAMPING: Agar so'z boshlanishi klip tugash chegarasidan keyin bo'lsa -> tashlab yuborish
                if max_clip_end is not None and t_w_start >= round(max_clip_end, 3):
                    continue

                is_clamped = False
                if max_clip_end is not None and t_w_end > round(max_clip_end, 3):
                    t_w_end = round(max_clip_end, 3)
                    is_clamped = True

                if t_w_start < tl_offset_sec:
                    t_w_start = tl_offset_sec

                if t_w_end <= t_w_start:
                    t_w_end = round(t_w_start + frame_dur, 3)
                    if max_clip_end is not None and t_w_end > max_clip_end:
                        t_w_end = max_clip_end

                if t_w_start >= t_w_end:
                    continue

                w.start = t_w_start
                w.end = t_w_end
                w.raw_start = orig_w_start
                w.raw_end = orig_w_end
                w.clamped = is_clamped
                final_words.append(w)

            if not final_words:
                continue

            s.words = final_words
            s.start = final_words[0].start
            s.end = final_words[-1].end
            final_segments.append(s)

        processed_segments = final_segments

        full_clean_text = " ".join([s.text.replace("\n", " ") for s in processed_segments])

        # Diagnostika ma'lumotlari (so'zlar soni, vaqt oralig'i, rejim)
        total_words_count = sum(len(s.words) for s in processed_segments)
        first_w_time = processed_segments[0].words[0].start if (processed_segments and processed_segments[0].words) else (processed_segments[0].start if processed_segments else 0.0)
        last_w_time = processed_segments[-1].words[-1].end if (processed_segments and processed_segments[-1].words) else (processed_segments[-1].end if processed_segments else 0.0)

        diagnostics_data = {
            "total_segments": len(processed_segments),
            "total_words": total_words_count,
            "first_word_time": first_w_time,
            "last_word_time": last_w_time,
            "clip_start": tl_offset_sec,
            "clip_end": max_clip_end,
            "clip_speed": speed_factor,
            "sync_offset_ms": sync_offset_ms or 0.0,
            "fps_quantized": fps_val,
            "audio_spec": "16000Hz mono WAV",
            "alignment_method": alignment_method_used,
            "snapped_words_count": align_stats.get("snapped_count", 0),
            "avg_shift_ms": align_stats.get("avg_shift_ms", 0.0),
            "max_shift_ms": align_stats.get("max_shift_ms", 0.0),
            "pauses_found": align_stats.get("pauses_found", 0),
            "global_offset_sec": align_stats.get("global_offset_sec", 0.0),
            "global_offset_ms": align_stats.get("global_offset_ms", 0.0),
            "global_offset_applied": align_stats.get("global_offset_applied", False),
            "support_count": align_stats.get("support_count", 0)
        }
        print(f"[Transcribe Diagnostics] Jami {total_words_count} ta so'z aniqlandi ({first_w_time}s -> {last_w_time}s, Metod: {alignment_method_used}, Offset: {tl_offset_sec}s, Speed: {speed_factor}x, Clamped End: {max_clip_end}s)")

        return {
            "status": "success",
            "provider": selected_provider,
            "duration": transcription.duration,
            "full_text": full_clean_text,
            "offset_applied": True,
            "clip_start": tl_offset_sec,
            "clip_end": max_clip_end,
            "clip_speed": speed_factor,
            "fps": fps_val,
            "segments": [s.model_dump() for s in processed_segments],
            "diagnostics": diagnostics_data
        }

    except Exception as e:
        print(f"[Xatolik] Transkripsiyada xato yuz berdi: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        # Vaqtinchalik fayllarni tozalash
        for tmp in temp_files_to_clean:
            try:
                if os.path.exists(tmp):
                    os.remove(tmp)
            except Exception:
                pass


# ==================== EKSPORT: SRT, VTT, JSON ====================

def seconds_to_srt_time(seconds: float) -> str:
    """00:00:00,000 formatiga o'tkazish (kadr aniqligida yaxlitlash)"""
    sec_val = float(seconds)
    total_ms = int(round(sec_val * 1000.0))
    hrs = total_ms // 3600000
    total_ms %= 3600000
    mins = total_ms // 60000
    total_ms %= 60000
    secs = total_ms // 1000
    millis = total_ms % 1000
    return f"{hrs:02d}:{mins:02d}:{secs:02d},{millis:03d}"


def seconds_to_vtt_time(seconds: float) -> str:
    """00:00:00.000 formatiga o'tkazish (kadr aniqligida yaxlitlash)"""
    sec_val = float(seconds)
    total_ms = int(round(sec_val * 1000.0))
    hrs = total_ms // 3600000
    total_ms %= 3600000
    mins = total_ms // 60000
    total_ms %= 60000
    secs = total_ms // 1000
    millis = total_ms % 1000
    return f"{hrs:02d}:{mins:02d}:{secs:02d}.{millis:03d}"


class ExportRequest(BaseModel):
    segments: List[Dict[str, Any]]
    output_path: Optional[str] = None
    word_mode: Optional[str] = None  # "accumulate", "single", "karaoke", "stack", "cascade" or None
    highlight_color: Optional[str] = "#ffe600"
    pause_hide_text: Optional[bool] = False
    pause_hide_threshold_ms: Optional[int] = 800


@app.post("/export/srt")
def export_srt(payload: ExportRequest):
    """Subtitrlarni standart yoki so'zma-so'z SRT fayliga aylantiradi va saqlaydi"""
    lines = []
    cue_id = 1
    w_mode = payload.word_mode
    thresh = payload.pause_hide_threshold_ms or 800

    for seg in payload.segments:
        words = seg.get("words") or []
        seg_start = float(seg.get("start", 0))
        seg_end = float(seg.get("end", 0))
        text = normalize_uzbek_text(seg.get("text", "")).strip()

        # Agar so'zma-so'z rejim yoqilgan bo'lsa va so'zlar mavjud bo'lsa:
        if w_mode == "accumulate" and words:
            # To'planib borsin: Har bir yangi so'z aytilganda qatorga qo'shiladi
            for w_idx in range(len(words)):
                c_start = float(words[w_idx].get("start", seg_start))
                w_end = float(words[w_idx].get("end", c_start + 0.3))
                pause_after = float(words[w_idx].get("pause_after_ms", 0.0))

                # Pauzada matnni yashirish sozlamasi:
                if payload.pause_hide_text and pause_after >= thresh:
                    c_end = w_end
                else:
                    c_end = float(words[w_idx + 1].get("start")) if (w_idx + 1 < len(words)) else seg_end

                if c_end <= c_start:
                    c_end = c_start + 0.3

                accum_text = normalize_uzbek_text(" ".join([str(words[k].get("word", "")) for k in range(w_idx + 1)]))
                lines.append(f"{cue_id}")
                lines.append(f"{seconds_to_srt_time(c_start)} --> {seconds_to_srt_time(c_end)}")
                lines.append(accum_text)
                lines.append("")
                cue_id += 1

        elif w_mode in ("single", "stack", "cascade") and words:
            # Bitta so'z yoki Kaskad: so'z keyingi so'z kelguncha (yoki pauzada) ko'rinadi
            for w_idx, w_item in enumerate(words):
                c_start = float(w_item.get("start", seg_start))
                w_end = float(w_item.get("end", c_start + 0.3))
                pause_after = float(w_item.get("pause_after_ms", 0.0))
                if w_mode in ("stack", "cascade") and (w_idx + 1 < len(words)):
                    next_start = float(words[w_idx + 1].get("start", w_end))
                    if payload.pause_hide_text and pause_after >= thresh:
                        c_end = w_end
                    else:
                        c_end = next_start
                else:
                    c_end = w_end
                if c_end <= c_start:
                    c_end = c_start + 0.25
                w_text = normalize_uzbek_text(str(w_item.get("word", ""))).strip()
                if not w_text:
                    continue
                lines.append(f"{cue_id}")
                lines.append(f"{seconds_to_srt_time(c_start)} --> {seconds_to_srt_time(c_end)}")
                lines.append(w_text)
                lines.append("")
                cue_id += 1

        elif w_mode == "karaoke" and words:
            # Ajratib bo'yash (karaoke): butun qator ko'rinadi, faol so'z rangi o'zgaradi
            h_color = payload.highlight_color or "#ffe600"
            for w_idx in range(len(words)):
                c_start = float(words[w_idx].get("start", seg_start))
                c_end = float(words[w_idx + 1].get("start")) if (w_idx + 1 < len(words)) else seg_end
                if c_end <= c_start:
                    c_end = c_start + 0.3

                k_parts = []
                for k in range(len(words)):
                    kw = normalize_uzbek_text(str(words[k].get("word", "")))
                    if k == w_idx:
                        k_parts.append(f'<font color="{h_color}">{kw}</font>')
                    else:
                        k_parts.append(kw)

                lines.append(f"{cue_id}")
                lines.append(f"{seconds_to_srt_time(c_start)} --> {seconds_to_srt_time(c_end)}")
                lines.append(" ".join(k_parts))
                lines.append("")
                cue_id += 1

        else:
            # Standart rejim (jumla bo'yicha)
            start_str = seconds_to_srt_time(seg_start)
            end_str = seconds_to_srt_time(seg_end)
            lines.append(f"{cue_id}")
            lines.append(f"{start_str} --> {end_str}")
            lines.append(text)
            lines.append("")
            cue_id += 1

    srt_content = "\n".join(lines)

    saved_path = payload.output_path
    if payload.output_path:
        os.makedirs(os.path.dirname(payload.output_path), exist_ok=True)
        with open(payload.output_path, "w", encoding="utf-8") as f:
            f.write(srt_content)
    else:
        temp_dir = tempfile.gettempdir()
        temp_srt = os.path.join(temp_dir, "temp_uz_subtitles.srt")
        with open(temp_srt, "w", encoding="utf-8") as f:
            f.write(srt_content)
        saved_path = temp_srt

    return {"status": "ok", "content": srt_content, "file_path": saved_path}


@app.post("/export/vtt")
def export_vtt(payload: ExportRequest):
    """Subtitrlarni WebVTT formatiga aylantiradi"""
    lines = ["WEBVTT", ""]
    for idx, seg in enumerate(payload.segments):
        start_str = seconds_to_vtt_time(float(seg.get("start", 0)))
        end_str = seconds_to_vtt_time(float(seg.get("end", 0)))
        text = normalize_uzbek_text(seg.get("text", "")).strip()

        lines.append(f"{idx + 1}")
        lines.append(f"{start_str} --> {end_str}")
        lines.append(text)
        lines.append("")

    vtt_content = "\n".join(lines)
    return {"status": "ok", "content": vtt_content}


# ==================== SO'Z VAQTLARINI QAYTA TEKISLASH VA ALIGNMENT STATUS ====================

class RealignWordsRequest(BaseModel):
    words: List[Dict[str, Any]]
    wav_path: Optional[str] = None
    min_pause_ms: Optional[float] = 200.0
    fps: Optional[float] = None


@app.post("/realign_words")
def realign_words_endpoint(payload: RealignWordsRequest):
    """Tanlangan so'zlarni audio energiyasi va pauzalar bo'yicha qayta tekislash"""
    refined, stats = snap_word_timestamps_to_audio(
        payload.words,
        wav_path=payload.wav_path,
        min_pause_ms=payload.min_pause_ms or 200.0,
        fps=payload.fps
    )
    return {"status": "success", "words": refined, "stats": stats}


@app.get("/status/alignment")
def alignment_status_endpoint():
    """Majburiy tekislash (Forced Alignment) va MMS holatini qaytaradi"""
    return check_forced_alignment_status()


# ==================== O'ZBEK TILI MATN AMALLARI ====================

class TransliterateRequest(BaseModel):
    text: str
    target: str  # "latin" yoki "cyrillic"


@app.post("/nlp/transliterate")
def transliterate_endpoint(req: TransliterateRequest):
    """Lotin <-> Kirill o'giruvchi API"""
    if req.target == "cyrillic":
        converted = lotin_to_kirill(req.text)
    else:
        converted = kirill_to_lotin(req.text)
    return {"original": req.text, "result": converted, "target": req.target}


@app.post("/nlp/numbers-to-words")
def numbers_to_words_endpoint(payload: Dict[str, str]):
    """Raqamlarni o'zbekcha so'zlarga o'girish"""
    raw_text = payload.get("text", "")
    converted = replace_numbers_with_words(raw_text)
    return {"original": raw_text, "result": converted}


_cached_local_templates: List[Dict[str, Any]] = []

def get_anim_type_from_name(low_name: str, low_root: str) -> str:
    if "hormozi" in low_name: return "hormozi"
    if "beast" in low_name: return "beast"
    if any(k in low_name for k in ["luke", "elly", "dina", "karaoke"]): return "karaoke"
    if "glitch" in low_name: return "glitch"
    if "zoom" in low_name: return "zoom"
    if any(k in low_name for k in ["slide", "butter", "slant"]): return "slide"
    if any(k in low_name for k in ["wave", "waving"]): return "wave"
    if "bounce" in low_name: return "bounce"
    if any(k in low_name for k in ["spin", "cracked", "3d"]) or "01.3d" in low_root: return "3d"
    if "blur" in low_name or "motion blur" in low_name or "03.blurs" in low_root: return "blur"
    if "neon" in low_name or "glow" in low_name: return "neon"
    if any(k in low_name for k in ["caption", "title", "box", "lower", "texte"]): return "title"
    return "pop"


@app.get("/presets/local_templates")
def get_local_templates_endpoint(refresh: bool = False):
    """C: va D: disklardagi barcha MOGRT, FFX va AEP shablon/animatsiyalarni qidirib topadi"""
    global _cached_local_templates
    if _cached_local_templates and not refresh:
        return {"status": "ok", "count": len(_cached_local_templates), "templates": _cached_local_templates}

    scan_folders = [
        ("D:\\plaginlar\\05_MOGRT_va_Titlar (Essential Graphics)", "D_MOGRT"),
        ("D:\\plaginlar\\04_Presetlar_va_Shablonlar (Presets & FFX)", "D_PRESETS"),
        ("C:\\Users\\baxru\\AppData\\Roaming\\Adobe\\Common\\Essential Graphics", "C_EG"),
        ("C:\\Users\\baxru\\AppData\\Roaming\\Adobe\\Common\\Motion Graphics Templates", "C_MGT")
    ]

    items = []
    seen_paths = set()

    for folder, source_tag in scan_folders:
        if not os.path.exists(folder):
            continue
        for root, dirs, files in os.walk(folder):
            for f in files:
                ext = os.path.splitext(f)[1].lower()
                # Faqat haqiqiy MOGRT va FFX fayllar qabul qilinadi (.aep loyihalari emas)
                if ext in [".mogrt", ".ffx"]:
                    full_p = os.path.join(root, f).replace("\\", "/")
                    if full_p in seen_paths:
                        continue
                    seen_paths.add(full_p)

                    base_name = os.path.splitext(f)[0]
                    clean_name = base_name.replace("_", " ").strip()
                    low_name = clean_name.lower()
                    low_root = root.lower()

                    category = "Essential Graphics Shablonlari"
                    if "aejuice" in low_root or "aejuice" in low_name:
                        category = "AEJuice Subtitrlar"
                    elif "captioneer" in low_root or "9•16" in clean_name or "9 16" in clean_name or "9:16" in clean_name:
                        category = "Captioneer (9:16 Shorts/Reels)"
                    elif any(k in low_name or k in low_root for k in ["hormozi", "beast", "luke", "elly", "dina", "karaoke"]):
                        category = "Reels / Shorts (Hormozi & Beast)"
                    elif any(k in low_name for k in ["smooth", "trendy", "zoom", "butter", "slide", "spin", "wave", "bounce", "cracked", "zogo"]):
                        category = "Dinamik & Trendy Animatsiya"
                    elif any(k in low_name for k in ["caption", "title", "text fon", "box", "texte", "opros", "lower", "sonlar"]):
                        category = "Titllar & Lower Thirds"
                    elif ext == ".ffx":
                        category = "After Effects Presets (.ffx)"
                    elif "social" in low_root or any(k in low_name for k in ["like", "subscribe", "share"]):
                        category = "Ijtimoiy Tarmoqlar"
                    elif "sports" in low_root:
                        category = "Sport & Dinamik"
                    elif "gaming" in low_root:
                        category = "O'yin & Gaming"
                    elif "film" in low_root:
                        category = "Film & Kinematik"

                    # Video va Rasm preview mavjudligini aniqlash
                    has_video = False
                    has_thumb = False
                    if ext == ".mogrt":
                        try:
                            with zipfile.ZipFile(os.path.join(root, f), "r") as z:
                                nlist = [n.lower() for n in z.namelist()]
                                has_video = any(n.endswith(".mp4") for n in nlist)
                                has_thumb = any(n.endswith((".png", ".jpg", ".jpeg")) for n in nlist)
                        except:
                            has_thumb = True
                    else:
                        pdir = os.path.join(root, "(preview)")
                        if os.path.exists(pdir):
                            pfiles = [x.lower() for x in os.listdir(pdir)]
                            has_video = (base_name.lower() + ".mp4") in pfiles or any(x.endswith(".mp4") for x in pfiles)
                            has_thumb = (base_name.lower() + ".jpg") in pfiles or any(x.endswith((".jpg", ".png")) for x in pfiles)

                    anim_type = get_anim_type_from_name(low_name, low_root)

                    items.append({
                        "id": "tpl_" + str(len(items) + 1),
                        "name": clean_name,
                        "fileName": f,
                        "ext": ext.replace(".", ""),
                        "category": category,
                        "path": full_p,
                        "source": source_tag,
                        "animType": anim_type,
                        "hasVideo": has_video,
                        "hasThumb": has_thumb
                    })

    # D_MOGRT shablonlarini (Beast, Hormozi, Zoom In, Butter Up) eng birinchi o'ringa qo'yish
    items.sort(key=lambda x: (0 if x["source"] == "D_MOGRT" else 1, 0 if "hormozi" in x["name"].lower() or "beast" in x["name"].lower() else 1, x["name"]))
    _cached_local_templates = items
    return {"status": "ok", "count": len(items), "templates": items}


@app.get("/presets/preview")
def get_preset_preview_endpoint(path: str, media_type: str = "auto"):
    """MOGRT yoki Text Pack fayllaridan video va rasmli animatsiya preview'larini o'qib uzatadi"""
    clean_p = path.replace("/", "\\")
    if not os.path.exists(clean_p):
        raise HTTPException(status_code=404, detail="Fayl topilmadi")

    ext = os.path.splitext(clean_p)[1].lower()

    # 1. MOGRT ZIP arxividan thumb.mp4 yoki thumb.png olish
    if ext == ".mogrt":
        try:
            with zipfile.ZipFile(clean_p, "r") as z:
                names = z.namelist()
                if media_type in ["auto", "video"]:
                    mp4_name = next((n for n in names if n.lower().endswith(".mp4")), None)
                    if mp4_name:
                        data = z.read(mp4_name)
                        return Response(content=data, media_type="video/mp4", headers={"Cache-Control": "public, max-age=86400"})

                img_name = next((n for n in names if n.lower().endswith((".png", ".jpg", ".jpeg"))), None)
                if img_name:
                    data = z.read(img_name)
                    mime = "image/png" if img_name.lower().endswith(".png") else "image/jpeg"
                    return Response(content=data, media_type=mime, headers={"Cache-Control": "public, max-age=86400"})
        except Exception as e:
            pass

    # 2. Text Animation Presets Pack ichidagi (preview) papkadan olish
    d = os.path.dirname(clean_p)
    base = os.path.splitext(os.path.basename(clean_p))[0]
    check_dirs = [os.path.join(d, "(preview)"), d, os.path.join(os.path.dirname(d), "(preview)")]

    for cdir in check_dirs:
        if os.path.exists(cdir):
            if media_type in ["auto", "video"]:
                for f in os.listdir(cdir):
                    if f.lower().endswith(".mp4") and (base.lower() in f.lower() or f.lower().startswith("scene")):
                        f_path = os.path.join(cdir, f)
                        with open(f_path, "rb") as vf:
                            return Response(content=vf.read(), media_type="video/mp4", headers={"Cache-Control": "public, max-age=86400"})

            for f in os.listdir(cdir):
                if f.lower().endswith((".jpg", ".jpeg", ".png")) and (base.lower() in f.lower() or f.lower().startswith("scene")):
                    f_path = os.path.join(cdir, f)
                    mime = "image/png" if f.lower().endswith(".png") else "image/jpeg"
                    with open(f_path, "rb") as imgf:
                        return Response(content=imgf.read(), media_type=mime, headers={"Cache-Control": "public, max-age=86400"})

    raise HTTPException(status_code=404, detail="Preview fayl topilmadi")

# ==================== CAPCUT USLUBIDAGI BEAT & RITM DETECTOR ====================

@app.post("/detect-beats")
async def detect_beats_endpoint(
    file_path: Optional[str] = Form(None),
    sensitivity: Optional[float] = Form(0.5),
    mode: Optional[str] = Form("auto"),
    fps: Optional[float] = Form(25.0),
    in_point: Optional[float] = Form(None),
    out_point: Optional[float] = Form(None),
    duration: Optional[float] = Form(None),
    file: Optional[UploadFile] = File(None)
):
    """
    CapCut 'Beats' moduli kabi musiqa ritmini, zarbalarini va kadr o'tish nuqtalarini aniqlaydi.
    """
    temp_files_to_clean = []
    try:
        actual_input_path = ""
        if file_path:
            if os.path.exists(file_path):
                actual_input_path = file_path
            else:
                resolved = resolve_media_file_on_disk(file_path)
                if resolved:
                    actual_input_path = resolved

        if not actual_input_path and file:
            temp_in = tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(file.filename)[1])
            temp_files_to_clean.append(temp_in.name)
            with open(temp_in.name, "wb") as f:
                shutil.copyfileobj(file.file, f)
            actual_input_path = temp_in.name

        if not actual_input_path:
            raise HTTPException(status_code=400, detail="Musiqa fayli yoki uning yo'li topilmadi!")

        # Agar in_point va duration bo'lsa, qirqilgan qismini tezkor ajratamiz
        start_sec = in_point if (in_point is not None and in_point > 0) else None
        duration_sec = duration
        if duration_sec is None and out_point is not None and in_point is not None and out_point > in_point:
            duration_sec = out_point - in_point

        analysis_file = actual_input_path
        if (start_sec is not None or duration_sec is not None) and check_ffmpeg():
            temp_cut = tempfile.NamedTemporaryFile(delete=False, suffix=".wav")
            temp_files_to_clean.append(temp_cut.name)
            analysis_file = convert_to_16k_mono_wav(actual_input_path, temp_cut.name, start_sec=start_sec, duration_sec=duration_sec)

        sens_val = float(sensitivity) if sensitivity is not None else 0.5
        fps_val = float(fps) if fps is not None else 25.0
        if fps_val <= 0:
            fps_val = 25.0

        result = detect_tempo_and_beats(
            audio_path=analysis_file,
            sensitivity=sens_val,
            mode=mode or "auto",
            fps=fps_val
        )
        
        # Audio path URL yoki disk path qaytarish (panelda tinglash uchun)
        result["file_path"] = actual_input_path
        return result

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ritm va zarbalarni aniqlashda xatolik: {str(e)}")
    finally:
        for tmp in temp_files_to_clean:
            if os.path.exists(tmp):
                try:
                    os.remove(tmp)
                except Exception:
                    pass


@app.get("/audio-file")
def get_audio_file(path: str):
    """Lokal audio faylni panel ichidagi <audio> pleerida eshitish uchun uzatadi"""
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Fayl topilmadi")
    ext = os.path.splitext(path)[1].lower()
    mime = "audio/wav"
    if ext in [".mp3"]:
        mime = "audio/mpeg"
    elif ext in [".m4a", ".aac"]:
        mime = "audio/mp4"
    elif ext in [".ogg"]:
        mime = "audio/ogg"
    
    with open(path, "rb") as af:
        return Response(content=af.read(), media_type=mime)


if __name__ == "__main__":
    import uvicorn
    # Localhost 8765 portida ishga tushirish
    uvicorn.run("main:app", host="127.0.0.1", port=8765, reload=True)
