"""
O'zbekcha AI Subtitr - Audio Qayta Ishlash Moduli
- Videodan audioni ajratib olish
- Audioni 16kHz mono 16-bit PCM WAV yoki yengil MP3 formatiga o'tkazish
- Katta audio fayllarni bo'laklarga (chunks) bo'lib ishlash
"""

import os
import shutil
import subprocess
from typing import Tuple, List, Optional
from pathlib import Path


def get_ffmpeg_binary() -> Optional[str]:
    """Tizimdagi yoki imageio_ffmpeg dagi ffmpeg yo'lini qaytaradi"""
    system_ffmpeg = shutil.which("ffmpeg")
    if system_ffmpeg:
        return system_ffmpeg
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        return None


def check_ffmpeg() -> bool:
    """Tizimda FFmpeg mavjudligini tekshiradi"""
    return get_ffmpeg_binary() is not None


def convert_to_16k_mono_wav(
    input_path: str,
    output_path: Optional[str] = None,
    start_sec: Optional[float] = None,
    duration_sec: Optional[float] = None
) -> str:
    """
    Istalgan audio/video faylni 16kHz, mono, PCM s16le WAV formatiga o'tkazadi.
    Agar start_sec va duration_sec berilgan bo'lsa, faqat kesilgan qismini oladi (tezkor seek).
    """
    if not os.path.exists(input_path):
        raise FileNotFoundError(f"Kiritilgan fayl topilmadi: {input_path}")

    ffmpeg_bin = get_ffmpeg_binary()
    if not ffmpeg_bin:
        if input_path.lower().endswith(".wav") and start_sec is None and duration_sec is None:
            return input_path
        raise RuntimeError(
            "Tizimda FFmpeg topilmadi! Iltimos, FFmpeg dasturini o'rnating yoki audioni WAV formatida eksport qiling."
        )

    if not output_path:
        base, _ = os.path.splitext(input_path)
        output_path = f"{base}_16k_mono.wav"

    cmd = [ffmpeg_bin, "-y", "-i", input_path]
    if start_sec is not None and start_sec > 0:
        cmd.extend(["-ss", str(start_sec)])
    if duration_sec is not None and duration_sec > 0:
        cmd.extend(["-t", str(duration_sec)])
    cmd.extend([
        "-vn",
        "-acodec", "pcm_s16le",
        "-ac", "1",
        "-ar", "16000",
        output_path
    ])

    try:
        subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, check=True)
        return output_path
    except subprocess.CalledProcessError as e:
        raise RuntimeError(f"FFmpeg orqali konvertatsiya qilishda xatolik yuz berdi: {e.stderr}")


def convert_to_optimized_mp3(
    input_path: str,
    output_path: Optional[str] = None,
    start_sec: Optional[float] = None,
    duration_sec: Optional[float] = None
) -> str:
    """
    Istalgan video/audiodan eng optimal, juda yengil (48kbps, 16kHz mono) MP3 ajratib oladi.
    Agar start_sec va duration_sec berilgan bo'lsa, faqat qirqilgan klip qismini soniyalar ichida oladi!
    """
    if not os.path.exists(input_path):
        raise FileNotFoundError(f"Kiritilgan fayl topilmadi: {input_path}")

    ffmpeg_bin = get_ffmpeg_binary()
    if not ffmpeg_bin:
        return input_path

    if not output_path:
        base, _ = os.path.splitext(input_path)
        output_path = f"{base}_opt.mp3"

    cmd = [ffmpeg_bin, "-y", "-i", input_path]
    if start_sec is not None and start_sec > 0:
        cmd.extend(["-ss", str(start_sec)])
    if duration_sec is not None and duration_sec > 0:
        cmd.extend(["-t", str(duration_sec)])
    cmd.extend([
        "-vn",
        "-ac", "1",
        "-ar", "16000",
        "-b:a", "48k",
        output_path
    ])

    try:
        subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, check=True)
        return output_path
    except subprocess.CalledProcessError as e:
        raise RuntimeError(f"FFmpeg orqali MP3 ga o'tkazishda xatolik: {e.stderr}")


def get_audio_duration(file_path: str) -> float:
    """Audio fayl davomiyligini (soniyalarda) qaytaradi"""
    # 1. Agar WAV bo'lsa, sof Python wave orqali aniq olish (ffprobe shart emas)
    if file_path.lower().endswith(".wav") and os.path.exists(file_path):
        try:
            import wave
            with wave.open(file_path, "rb") as wf:
                return float(wf.getnframes()) / float(wf.getframerate())
        except Exception:
            pass

    if not check_ffmpeg():
        return 0.0

    if shutil.which("ffprobe"):
        cmd = [
            "ffprobe", "-v", "error",
            "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1",
            file_path
        ]
        try:
            out = subprocess.check_output(cmd, stderr=subprocess.STDOUT).decode().strip()
            return float(out)
        except Exception:
            pass

    ffmpeg_bin = get_ffmpeg_binary()
    if ffmpeg_bin and os.path.exists(file_path):
        try:
            res = subprocess.run([ffmpeg_bin, "-i", file_path], stderr=subprocess.PIPE, stdout=subprocess.PIPE, text=True)
            import re
            m = re.search(r"Duration:\s*(\d+):(\d+):(\d+\.\d+)", res.stderr)
            if m:
                h, m_min, s = float(m.group(1)), float(m.group(2)), float(m.group(3))
                return h * 3600.0 + m_min * 60.0 + s
        except Exception:
            pass

    return 0.0


def split_audio_into_chunks(audio_path: str, chunk_duration_sec: int = 300, output_dir: Optional[str] = None) -> List[Tuple[str, float]]:
    """
    Katta audio fayllarni 5 daqiqalik (300s) bo'laklarga ajratadi.
    Qaytaradi: [(chunk_fayl_yoli, offset_soniyalarda), ...]
    """
    total_duration = get_audio_duration(audio_path)
    if total_duration <= chunk_duration_sec:
        return [(audio_path, 0.0)]

    if not output_dir:
        output_dir = os.path.join(os.path.dirname(audio_path), "chunks")
    os.makedirs(output_dir, exist_ok=True)

    chunks = []
    current_start = 0.0
    chunk_index = 0

    ffmpeg_bin = get_ffmpeg_binary() or "ffmpeg"
    while current_start < total_duration:
        chunk_file = os.path.join(output_dir, f"chunk_{chunk_index:04d}.mp3")
        cmd = [
            ffmpeg_bin, "-y",
            "-ss", str(current_start),
            "-i", audio_path,
            "-t", str(chunk_duration_sec),
            "-vn",
            "-ac", "1",
            "-ar", "16000",
            "-b:a", "48k",
            chunk_file
        ]
        try:
            subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)
            chunks.append((chunk_file, current_start))
        except Exception as e:
            print(f"[Xatolik] Audio bo'laklashda xatolik: {e}")
            break

        current_start += chunk_duration_sec
        chunk_index += 1

    return chunks
