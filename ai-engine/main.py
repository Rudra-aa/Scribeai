import os
import re
import uuid
import time
import json
import math
import asyncio
import logging
import tempfile
import subprocess
import traceback
from collections import deque
from pathlib import Path
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any, Deque, Tuple

import httpx
from fastapi import FastAPI, BackgroundTasks, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from pymongo import MongoClient
from dotenv import load_dotenv

# ─── Structured Logging ───────────────────────────────────────────────────────

class JSONFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        base = {
            "ts":     datetime.utcnow().isoformat(timespec="milliseconds") + "Z",
            "level":  record.levelname,
            "logger": record.name,
            "msg":    record.getMessage(),
        }
        for key in ("job_id", "session_id", "speaker", "stage", "latency_ms", "lang"):
            val = record.__dict__.get(key)
            if val is not None:
                base[key] = val
        if record.exc_info:
            base["exc"] = self.formatException(record.exc_info)
        return json.dumps(base, ensure_ascii=False)


def _build_logger(name: str) -> logging.Logger:
    logger = logging.getLogger(name)
    logger.setLevel(logging.DEBUG)
    if not logger.handlers:
        sh = logging.StreamHandler()
        sh.setFormatter(JSONFormatter())
        logger.addHandler(sh)
        log_path = Path(__file__).parent / "scribeai.log"
        fh = logging.FileHandler(log_path, encoding="utf-8")
        fh.setFormatter(JSONFormatter())
        logger.addHandler(fh)
    logger.propagate = False
    return logger


log = _build_logger("scribeai")

# ─── FastText Initialization ────────────────────────────────────────────────────
import urllib.request

FASTTEXT_MODEL_PATH = Path(__file__).parent / "lid.176.bin"
_fasttext_model = None

def get_fasttext_model():
    global _fasttext_model
    if _fasttext_model is None:
        try:
            import fasttext
            if not FASTTEXT_MODEL_PATH.exists():
                log.info("Downloading fastText language model...")
                urllib.request.urlretrieve("https://dl.fbaipublicfiles.com/fasttext/supervised-models/lid.176.bin", FASTTEXT_MODEL_PATH)
                log.info("Downloaded fastText model.")
            fasttext.FastText.eprint = lambda x: None
            _fasttext_model = fasttext.load_model(str(FASTTEXT_MODEL_PATH))
        except Exception as e:
            log.warning("FastText initialization failed: %s", e)
            _fasttext_model = False
    return _fasttext_model

def get_fasttext_lang(transcript: str) -> Tuple[Optional[str], float]:
    """Returns (lang_code, confidence) based on transcript text"""
    if not transcript.strip():
        return None, 0.0
    model = get_fasttext_model()
    if not model:
        return None, 0.0
    text = transcript.replace("\n", " ").strip()
    try:
        predictions = model.predict(text, k=1)
        lang_label = predictions[0][0].replace("__label__", "")
        conf = float(predictions[1][0])
        return lang_label, conf
    except Exception as e:
        log.warning("FastText prediction failed: %s", e)
        return None, 0.0

# ─── DNS / Environment Bootstrap ──────────────────────────────────────────────

try:
    import dns.resolver
    dns.resolver.default_resolver = dns.resolver.Resolver(configure=False)
    dns.resolver.default_resolver.nameservers = ["8.8.8.8", "8.8.4.4"]
    log.info("Configured Google DNS for MongoDB Atlas SRV resolution.")
except Exception as _dns_err:
    log.warning("Custom DNS setup skipped: %s", _dns_err)

load_dotenv(dotenv_path=Path(__file__).parent.parent / ".env")

# ─── Configuration ─────────────────────────────────────────────────────────────

GROQ_API_KEY    = os.getenv("GROQ_API_KEY", "").strip()
GROQ_WHISPER    = "whisper-large-v3"
GROQ_LLM_MODEL  = "llama-3.3-70b-versatile"
OLLAMA_HOST     = os.getenv("OLLAMA_HOST", "http://localhost:11434")
OLLAMA_MODEL    = os.getenv("OLLAMA_MODEL", "phi3:mini")
MONGO_URI_RAW   = os.getenv("MONGO_URI", "mongodb://localhost:27017/scribeai")
OUTPUTS_DIR     = Path(__file__).parent.parent / "outputs"
OUTPUTS_DIR.mkdir(parents=True, exist_ok=True)

# FIX-9: Realistic ASR budget — 500ms was never achievable for real audio.
# 30s covers a typical 5-10 min file on Groq. Chunked files run in parallel
# so wall-clock time stays low even for longer content.
PERF_BUDGET = {"asr": 30_000, "translation": 1000, "tts": 1000, "e2e": 120_000}

# LLM call timeouts
LLM_CHUNK_TIMEOUT  = 15    # per-chunk translate
LLM_WS_TIMEOUT     = 30    # whole WS translate call

# FIX-8: Groq Whisper hard limit is 25MB.  We stay under 24MB to be safe.
# Audio chunks are split at AUDIO_CHUNK_SECS boundaries.
GROQ_MAX_BYTES     = 24 * 1024 * 1024   # 24 MB
AUDIO_CHUNK_SECS   = 600                # 10-minute chunks

# ─── Language Tables ──────────────────────────────────────────────────────────

LANG_NAMES: Dict[str, str] = {
    "en": "English",    "hi": "Hindi",      "es": "Spanish",   "fr": "French",
    "de": "German",     "ja": "Japanese",   "zh": "Chinese",   "ar": "Arabic",
    "pt": "Portuguese", "ko": "Korean",     "it": "Italian",   "ru": "Russian",
    "tr": "Turkish",    "nl": "Dutch",      "pl": "Polish",    "sv": "Swedish",
    "da": "Danish",     "fi": "Finnish",    "cs": "Czech",     "uk": "Ukrainian",
}

TTS_VOICES: Dict[str, str] = {
    "en": "en-US-AriaNeural",     "hi": "hi-IN-SwaraNeural",    "es": "es-ES-ElviraNeural",
    "fr": "fr-FR-DeniseNeural",   "de": "de-DE-KatjaNeural",    "ja": "ja-JP-NanamiNeural",
    "zh": "zh-CN-XiaoxiaoNeural", "ar": "ar-SA-ZariyahNeural",  "pt": "pt-BR-FranciscaNeural",
    "ko": "ko-KR-SunHiNeural",    "it": "it-IT-ElsaNeural",     "ru": "ru-RU-SvetlanaNeural",
}

# FIX-6: Full NAME_TO_CODE covering every string Groq/faster-whisper may return.
NAME_TO_CODE: Dict[str, str] = {v.lower(): k for k, v in LANG_NAMES.items()}
NAME_TO_CODE.update({
    "hinglish": "hi", "mandarin": "zh", "cantonese": "zh",
    "chinese":    "zh", "japanese":   "ja", "korean":     "ko",
    "arabic":     "ar", "portuguese": "pt", "russian":    "ru",
    "turkish":    "tr", "ukrainian":  "uk", "czech":      "cs",
    "danish":     "da", "dutch":      "nl", "finnish":    "fi",
    "polish":     "pl", "swedish":    "sv", "german":     "de",
    "french":     "fr", "spanish":    "es", "italian":    "it",
    "english":    "en", "hindi":      "hi",
    "zh-cn": "zh", "zh-tw": "zh", "pt-br": "pt", "pt-pt": "pt",
})

MAX_TRANSLATE_CHARS    = 3_000
MAX_SUMMARY_CHARS      = 6_000
TRANSLATION_MAX_TOKENS = 2_048
CONTEXT_WINDOW_TURNS   = 20

# ─── MongoDB Setup ────────────────────────────────────────────────────────────

def _resolve_mongo_srv(srv_uri: str) -> str:
    if not srv_uri.startswith("mongodb+srv://"):
        return srv_uri
    import urllib.parse

    def _doh_query(name: str, rtype: str) -> list:
        providers = [
            ("https://1.1.1.1/dns-query",           {"accept": "application/dns-json"}),
            ("https://dns.google/resolve",           {}),
            ("https://cloudflare-dns.com/dns-query", {"accept": "application/dns-json"}),
        ]
        for base_url, hdrs in providers:
            try:
                url = f"{base_url}?name={urllib.parse.quote(name)}&type={rtype}"
                r = httpx.get(url, headers=hdrs, timeout=4.0)
                if r.status_code == 200:
                    answers = r.json().get("Answer", [])
                    if answers:
                        return answers
            except Exception:
                pass
        raise RuntimeError(f"DoH resolution failed for {name}/{rtype}")

    try:
        m = re.match(
            r"^mongodb\+srv://([^:]+):([^@]+)@([^/?]+)(?:/([^?]*))?(?:\?(.*))?$", srv_uri
        )
        if not m:
            return srv_uri
        username, password, srv_host, db_name, srv_options = m.groups()
        srv_recs = _doh_query(f"_mongodb._tcp.{srv_host}", "SRV")
        hosts = []
        for rec in srv_recs:
            parts = rec.get("data", "").split()
            if len(parts) >= 4:
                hosts.append(f"{parts[3].rstrip('.')}:{parts[2]}")
        if not hosts:
            raise ValueError("No SRV hosts found")
        txt_opts = ""
        try:
            txt_recs = _doh_query(srv_host, "TXT")
            if txt_recs:
                txt_opts = txt_recs[0].get("data", "").strip().strip('"')
        except Exception:
            pass
        uri = f"mongodb://{username}:{password}@{','.join(hosts)}/{db_name or ''}?ssl=true"
        if txt_opts:
            uri += f"&{txt_opts}"
        if srv_options:
            from urllib.parse import parse_qs
            orig = parse_qs(srv_options)
            existing = parse_qs(txt_opts)
            for k, v in orig.items():
                if k not in existing:
                    uri += f"&{k}={v[0]}"
        log.info("Resolved SRV URI → %s", re.sub(r":[^:@]+@", ":****@", uri))
        return uri
    except Exception as exc:
        log.warning("SRV resolution failed (%s), using original URI.", exc)
        return srv_uri


MONGO_URI = _resolve_mongo_srv(MONGO_URI_RAW)
_mongo    = MongoClient(MONGO_URI)
db        = _mongo.get_default_database()

# ─── Pydantic Models ──────────────────────────────────────────────────────────

class ProcessRequest(BaseModel):
    job_id:          str
    uid:             str
    file_path:       Optional[str] = None
    youtube_url:     Optional[str] = None
    file_name:       str
    language:        str = "en"
    target_language: Optional[str] = None
    mode:            str = Field(default="quick", pattern="^(quick|conversation|meeting|conference)$")

class TranslateRequest(BaseModel):
    text:            str
    target_language: str
    source_language: Optional[str] = None
    session_id:      Optional[str] = None
    speaker_id:      Optional[str] = None

class SpeakerTurn(BaseModel):
    speaker_id:  str
    language:    str
    text:        str
    translation: Optional[str] = None
    ts:          str = Field(default_factory=lambda: datetime.utcnow().isoformat())

# ─── Conversation Memory ──────────────────────────────────────────────────────

class ConversationMemory:
    def __init__(self, maxlen: int = CONTEXT_WINDOW_TURNS):
        self._store: Dict[str, Deque[SpeakerTurn]] = {}
        self._maxlen = maxlen

    def add(self, session_id: str, turn: SpeakerTurn):
        if session_id not in self._store:
            self._store[session_id] = deque(maxlen=self._maxlen)
        self._store[session_id].append(turn)

    def get_context_block(self, session_id: str) -> str:
        turns = self._store.get(session_id, [])
        if not turns:
            return ""
        return "\n".join(
            f"[{t.speaker_id or 'Speaker'}]: {t.translation or t.text}"
            for t in turns
        )

    def clear(self, session_id: str):
        self._store.pop(session_id, None)


memory = ConversationMemory()

# ─── Helpers ──────────────────────────────────────────────────────────────────

def normalize_lang(lang: Optional[str]) -> str:
    """
    FIX-1 + FIX-6: Robustly map any language identifier to ISO-639-1 code.
    Handles 2-char codes, BCP-47 region tags, and full English names from Whisper.
    """
    if not lang:
        return "en"
    s = lang.strip().lower()
    if len(s) == 2 and s.isalpha():
        return s
    if re.match(r"^[a-z]{2}-[a-z]{2,}$", s):
        return NAME_TO_CODE.get(s, s.split("-")[0])
    if s in NAME_TO_CODE:
        return NAME_TO_CODE[s]
    log.warning("normalize_lang: unrecognised language '%s', defaulting to 'en'", lang)
    return "en"


def srt_time(ms: int) -> str:
    h, r = divmod(ms, 3_600_000)
    m, r = divmod(r, 60_000)
    s, f = divmod(r, 1_000)
    return f"{h:02d}:{m:02d}:{s:02d},{f:03d}"


def build_srt(segments: List[Dict[str, Any]]) -> str:
    lines, idx = [], 1
    for seg in segments:
        text = seg["text"].strip()
        if not text:
            continue
        s_ms = int(seg["start"] * 1000)
        e_ms = int(seg["end"]   * 1000)
        lines += [str(idx), f"{srt_time(s_ms)} --> {srt_time(e_ms)}", text, ""]
        idx += 1
    return "\n".join(lines)


def srt_to_vtt(srt: str) -> str:
    if not srt.strip():
        return "WEBVTT\n\n"
    vtt = re.sub(r"(\d{2}:\d{2}:\d{2}),(\d{3})", r"\1.\2", srt)
    vtt = re.sub(r"(?m)^\d+\s*\n(?=\d{2}:\d{2}:\d{2})", "", vtt)
    return "WEBVTT\n\n" + vtt.strip() + "\n"


# ─── DB Helper ────────────────────────────────────────────────────────────────

async def db_update_async(job_id: str, updates: Dict[str, Any]):
    def _sync():
        try:
            db.jobs.update_one({"id": job_id}, {"$set": updates})
        except Exception as exc:
            log.error("MongoDB update failed", extra={"job_id": job_id, "stage": "db", "error_detail": str(exc)})
        try:
            headers = {"x-callback-secret": os.getenv("CALLBACK_SECRET", "scribeai_callback_dev_secret_123")}
            httpx.post(
                f"{os.getenv('NODE_BACKEND_URL', 'http://localhost:5001')}/api/callback/job/{job_id}",
                json=updates, headers=headers, timeout=2.0
            )
        except Exception:
            pass
    await asyncio.to_thread(_sync)


# ─── Audio Processing (FIX-7 + FIX-8) ────────────────────────────────────────

AUDIO_EXTS = {".mp3", ".wav", ".m4a", ".flac", ".ogg", ".opus", ".aac"}


def _audio_duration_secs(path: str) -> float:
    """Return audio duration in seconds using ffprobe. Returns 0 on failure."""
    try:
        result = subprocess.run(
            [
                "ffprobe", "-v", "quiet", "-print_format", "json",
                "-show_streams", "-select_streams", "a:0", path,
            ],
            capture_output=True, text=True, timeout=30,
        )
        data = json.loads(result.stdout)
        dur = data.get("streams", [{}])[0].get("duration", 0)
        return float(dur)
    except Exception as exc:
        log.warning("ffprobe duration check failed: %s", exc)
        return 0.0


def compress_audio(input_path: str, output_path: str) -> bool:
    """
    FIX-7: Re-encode to mono 16kHz MP3 128kbps.

    Why this helps:
      - A 10-min stereo 44kHz WAV  ≈ 100 MB  →  after compression ≈  9 MB
      - A 30-min stereo 44kHz WAV  ≈ 300 MB  →  after compression ≈ 28 MB (needs chunking)
      - Groq Whisper accuracy is identical at 16kHz mono for speech
      - Reduces upload time to Groq by 10-30×
    """
    try:
        subprocess.run(
            [
                "ffmpeg", "-i", input_path,
                "-vn",                      # drop video
                "-ac", "1",                 # mono
                "-ar", "16000",             # 16 kHz
                "-b:a", "128k",             # 128 kbps MP3
                "-codec:a", "libmp3lame",
                "-af", "loudnorm,silenceremove=stop_periods=-1:stop_duration=2:stop_threshold=-50dB",
                "-y", output_path,
            ],
            check=True, capture_output=True, timeout=300,
        )
        original_mb  = os.path.getsize(input_path)  / (1024 * 1024)
        compressed_mb = os.path.getsize(output_path) / (1024 * 1024)
        log.info(
            "Audio compressed %.1fMB → %.1fMB (%.0f%% reduction)",
            original_mb, compressed_mb,
            (1 - compressed_mb / original_mb) * 100 if original_mb > 0 else 0,
            extra={"stage": "audio_compress"},
        )
        return True
    except Exception as exc:
        log.error("Audio compression failed: %s", exc, extra={"stage": "audio_compress"})
        return False


def split_audio_into_chunks(audio_path: str, chunk_secs: int, out_dir: str) -> List[str]:
    """
    FIX-8: Split audio into ≤chunk_secs pieces using ffmpeg segment muxer.
    Returns list of chunk paths in order.
    """
    chunk_pattern = os.path.join(out_dir, "chunk_%03d.mp3")
    try:
        subprocess.run(
            [
                "ffmpeg", "-i", audio_path,
                "-f", "segment",
                "-segment_time", str(chunk_secs),
                "-ac", "1", "-ar", "16000", "-b:a", "128k",
                "-codec:a", "libmp3lame",
                "-af", "loudnorm,silenceremove=stop_periods=-1:stop_duration=2:stop_threshold=-50dB",
                "-reset_timestamps", "1",
                "-y", chunk_pattern,
            ],
            check=True, capture_output=True, timeout=600,
        )
        chunks = sorted(
            [os.path.join(out_dir, f) for f in os.listdir(out_dir) if f.startswith("chunk_")],
            key=lambda p: int(re.search(r"chunk_(\d+)", p).group(1)),
        )
        log.info(
            "Split audio into %d chunks of ≤%ds",
            len(chunks), chunk_secs,
            extra={"stage": "audio_split"},
        )
        return chunks
    except Exception as exc:
        log.error("Audio split failed: %s", exc, extra={"stage": "audio_split"})
        return [audio_path]  # fallback: try the whole file


def extract_audio(video_path: str, tmp_dir: Optional[str] = None) -> str:
    """
    FIX-7: Extract + compress audio in one step.
    Input can be any video or audio format.
    Output is always a compressed mono 16kHz MP3.
    """
    src = Path(video_path)
    out_dir  = tmp_dir or str(src.parent)
    out_path = os.path.join(out_dir, src.stem + "_compressed.mp3")

    if compress_audio(video_path, out_path):
        return out_path

    # Fallback: if compression failed, try basic extraction without compression
    if src.suffix.lower() in AUDIO_EXTS:
        return video_path

    wav_path = os.path.join(out_dir, src.stem + ".wav")
    try:
        subprocess.run(
            ["ffmpeg", "-i", video_path, "-vn",
             "-acodec", "pcm_s16le", "-ar", "16000", "-ac", "1", "-y", wav_path],
            check=True, capture_output=True, timeout=300,
        )
        return wav_path
    except Exception as exc:
        log.warning("ffmpeg extraction failed, using original: %s", exc)
        return video_path


def download_youtube_audio(yt_url: str, out_dir: str) -> str:
    import yt_dlp
    opts = {
        "format": "bestaudio/best",
        "outtmpl": os.path.join(out_dir, "%(id)s.%(ext)s"),
        "quiet": True, "no_warnings": True,
        "postprocessors": [{"key": "FFmpegExtractAudio", "preferredcodec": "mp3",
                            "preferredquality": "128"}],
        # Post-process to mono 16kHz to ensure size stays manageable
        "postprocessor_args": ["-ac", "1", "-ar", "16000"],
    }
    with yt_dlp.YoutubeDL(opts) as ydl:
        info   = ydl.extract_info(yt_url, download=True)
        vid_id = info.get("id", "audio")
    for fname in sorted(os.listdir(out_dir)):
        fpath = os.path.join(out_dir, fname)
        if os.path.exists(fpath) and fname.startswith(vid_id):
            return fpath
    raise FileNotFoundError("yt-dlp: download did not produce an output file.")


# ─── Transcription (FIX-8 + FIX-10) ─────────────────────────────────────────

async def transcribe_audio(audio_path: str, language: str) -> Dict[str, Any]:
    """
    FIX-8 + FIX-10: Auto-chunk large files and transcribe all chunks
    concurrently via asyncio.gather(), then stitch results in order.
    """
    t0        = time.perf_counter()
    file_size = os.path.getsize(audio_path)

    if GROQ_API_KEY and file_size > GROQ_MAX_BYTES:
        # File is too large for Groq — split and process concurrently
        log.info(
            "Audio file %.1fMB exceeds Groq limit (%.0fMB) — splitting into chunks",
            file_size / (1024 * 1024), GROQ_MAX_BYTES / (1024 * 1024),
            extra={"stage": "asr_split"},
        )
        chunk_dir    = audio_path + "_chunks"
        os.makedirs(chunk_dir, exist_ok=True)
        chunk_paths  = await asyncio.to_thread(
            split_audio_into_chunks, audio_path, AUDIO_CHUNK_SECS, chunk_dir
        )
        result = await _transcribe_chunks_concurrent(chunk_paths, language)
    elif GROQ_API_KEY:
        result = await _transcribe_groq(audio_path, language)
    else:
        result = await _transcribe_local(audio_path, language)

    ms = int((time.perf_counter() - t0) * 1000)

    # FIX-5: normalise detected language immediately
    raw_lang           = result.get("language", language)
    result["language"] = normalize_lang(raw_lang)

    log.info(
        "ASR complete in %dms — %d chars, %d segments, lang=%s (raw: %s)",
        ms, len(result.get("text", "")), len(result.get("segments", [])),
        result["language"], raw_lang,
        extra={"stage": "asr", "latency_ms": ms, "lang": result["language"]},
    )
    if ms > PERF_BUDGET["asr"]:
        log.warning("ASR exceeded budget (%dms > %dms)", ms, PERF_BUDGET["asr"])
    return result


async def _transcribe_chunks_concurrent(
    chunk_paths: List[str], language: str
) -> Dict[str, Any]:
    """
    FIX-10: Transcribe all chunks in parallel, then stitch segments with
    correct time offsets so the final SRT timestamps are accurate.
    """
    log.info(
        "Transcribing %d chunks concurrently via Groq",
        len(chunk_paths),
        extra={"stage": "asr_concurrent"},
    )

    async def _transcribe_one(path: str, chunk_index: int) -> Tuple[int, Dict]:
        try:
            result = await _transcribe_groq(path, language)
            return chunk_index, result
        except Exception as exc:
            log.error("Chunk %d transcription failed: %s", chunk_index, exc)
            return chunk_index, {"text": "", "segments": [], "language": language}

    # Run all chunks concurrently
    tasks   = [_transcribe_one(p, i) for i, p in enumerate(chunk_paths)]
    results = await asyncio.gather(*tasks)
    results = sorted(results, key=lambda x: x[0])  # sort by chunk index

    # Stitch: calculate time offset for each chunk using ffprobe
    all_segments: List[Dict] = []
    all_text_parts: List[str] = []
    detected_lang = language
    time_offset = 0.0

    for chunk_idx, (_, chunk_result) in enumerate(results):
        if chunk_result.get("language"):
            detected_lang = chunk_result["language"]

        chunk_text = chunk_result.get("text", "").strip()
        if chunk_text:
            all_text_parts.append(chunk_text)

        for seg in chunk_result.get("segments", []):
            all_segments.append({
                "start": seg["start"] + time_offset,
                "end":   seg["end"]   + time_offset,
                "text":  seg["text"],
            })

        # Compute offset for next chunk from the last segment end time
        if chunk_result.get("segments"):
            time_offset = all_segments[-1]["end"] + 0.05
        elif chunk_idx < len(chunk_paths) - 1:
            # Fallback: estimate from file duration
            dur = await asyncio.to_thread(_audio_duration_secs, chunk_paths[chunk_idx])
            time_offset += dur

    return {
        "text":     " ".join(all_text_parts),
        "segments": all_segments,
        "language": detected_lang,
        "language_probability": 1.0,
        "transcript_confidence": 1.0
    }


async def _transcribe_groq(audio_path: str, language: str) -> Dict[str, Any]:
    data: Dict[str, Any] = {
        "model":                     GROQ_WHISPER,
        "response_format":           "verbose_json",
        "timestamp_granularities[]": "segment",
        "temperature":               "0",
        "prompt":                    "Transcribe the audio accurately. Ignore background noise and music.",
    }
    if language and language != "auto":
        data["language"] = language
    async with httpx.AsyncClient(timeout=300) as client:
        with open(audio_path, "rb") as f:
            resp = await client.post(
                "https://api.groq.com/openai/v1/audio/transcriptions",
                headers={"Authorization": f"Bearer {GROQ_API_KEY}"},
                data=data,
                files={"file": (Path(audio_path).name, f, "audio/mpeg")},
            )
        resp.raise_for_status()
        raw = resp.json()
    return {
        "text":     raw.get("text", ""),
        "segments": [{"start": s["start"], "end": s["end"], "text": s["text"]}
                     for s in raw.get("segments", [])],
        "language": raw.get("language", language),
        "language_probability": 1.0,
        "transcript_confidence": 1.0
    }


async def _transcribe_local(audio_path: str, language: str) -> Dict[str, Any]:
    def _run():
        from faster_whisper import WhisperModel
        model      = WhisperModel("large-v3", device="cpu", compute_type="int8")
        lang_param = language if language != "auto" else None
        segs_gen, info = model.transcribe(
            audio_path,
            beam_size=5,
            language=lang_param,
            vad_filter=True,
            vad_parameters=dict(min_silence_duration_ms=500)
        )
        segs, full = [], []
        confidences = []
        for s in segs_gen:
            segs.append({"start": s.start, "end": s.end, "text": s.text})
            full.append(s.text)
            confidences.append(math.exp(s.avg_logprob))
            
        avg_conf = sum(confidences) / len(confidences) if confidences else 1.0
        return {"text": " ".join(full), "segments": segs, "language": info.language, "language_probability": getattr(info, 'language_probability', 1.0), "transcript_confidence": avg_conf}
    return await asyncio.to_thread(_run)


# ─── LLM Routing ──────────────────────────────────────────────────────────────

async def run_llm(
    prompt: str,
    sys_prompt: str = "",
    max_tokens: int = TRANSLATION_MAX_TOKENS,
    temperature: float = 0.2,
) -> str:
    if GROQ_API_KEY:
        try:
            return await _llm_groq(prompt, sys_prompt, max_tokens, temperature)
        except Exception as groq_err:
            log.warning("Groq failed (%s), falling back to Ollama.", groq_err)
            try:
                return await _llm_ollama(prompt, sys_prompt, max_tokens, temperature)
            except Exception as ollama_err:
                log.error("Both Groq and Ollama failed. Ollama: %s | Groq: %s", ollama_err, groq_err)
                raise ollama_err
    return await _llm_ollama(prompt, sys_prompt, max_tokens, temperature)


async def _llm_groq(prompt: str, sys_prompt: str, max_tokens: int, temperature: float) -> str:
    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={"Authorization": f"Bearer {GROQ_API_KEY}", "Content-Type": "application/json"},
            json={
                "model":       GROQ_LLM_MODEL,
                "max_tokens":  max_tokens,
                "temperature": temperature,
                "messages": [
                    {"role": "system", "content": sys_prompt},
                    {"role": "user",   "content": prompt},
                ],
            },
        )
        resp.raise_for_status()
        return resp.json()["choices"][0]["message"]["content"]


async def _llm_ollama(prompt: str, sys_prompt: str, max_tokens: int, temperature: float) -> str:
    full_prompt = f"{sys_prompt}\n\n{prompt}" if sys_prompt else prompt
    async with httpx.AsyncClient(timeout=120) as client:
        resp = await client.post(
            f"{OLLAMA_HOST}/api/generate",
            json={
                "model":   OLLAMA_MODEL,
                "prompt":  full_prompt,
                "options": {"num_predict": max_tokens, "temperature": temperature},
                "stream":  False,
            },
        )
        resp.raise_for_status()
        return resp.json()["response"]


# ─── Chunked Translation ──────────────────────────────────────────────────────

def _split_text_into_chunks(text: str, max_chars: int = MAX_TRANSLATE_CHARS) -> List[str]:
    sentences = re.split(r'(?<=[.!?।。！？])\s+', text.strip())
    chunks, current = [], ""
    for sent in sentences:
        if len(current) + len(sent) + 1 <= max_chars:
            current = (current + " " + sent).strip()
        else:
            if current:
                chunks.append(current)
            if len(sent) > max_chars:
                words, part = sent.split(), ""
                for word in words:
                    if len(part) + len(word) + 1 <= max_chars:
                        part = (part + " " + word).strip()
                    else:
                        if part:
                            chunks.append(part)
                        part = word
                if part:
                    chunks.append(part)
            else:
                current = sent
    if current:
        chunks.append(current)
    return chunks or [text]


async def translate_text_chunked(
    text: str,
    target_lang_code: str,
    sys_prompt: str,
    context_block: str = "",
    session_id: Optional[str] = None,
) -> str:
    if not text.strip():
        return ""

    lang_name = LANG_NAMES.get(target_lang_code, target_lang_code.upper())
    chunks    = _split_text_into_chunks(text)
    translated_parts: List[str] = []

    for i, chunk in enumerate(chunks):
        t0           = time.perf_counter()
        context_hint = (
            f"\n\nConversation context (do NOT translate this block):\n{context_block}\n"
            if context_block else ""
        )
        prompt = (
            f"{context_hint}Translate the following text into {lang_name}. "
            f"Return ONLY the direct translation, no preamble, no quotes:\n\n{chunk}"
        )
        tokens = min(TRANSLATION_MAX_TOKENS, max(128, len(chunk.split()) * 4 + 128))

        try:
            # FIX-3: per-chunk timeout
            part = await asyncio.wait_for(
                run_llm(prompt, sys_prompt, max_tokens=tokens, temperature=0.1),
                timeout=LLM_CHUNK_TIMEOUT,
            )
            part = part.strip().strip('"').strip("'")
            translated_parts.append(part)
        except asyncio.TimeoutError:
            log.error("Chunk %d/%d timed out after %ds — keeping original",
                      i + 1, len(chunks), LLM_CHUNK_TIMEOUT,
                      extra={"stage": "translation", "lang": target_lang_code})
            translated_parts.append(chunk)
        except Exception as exc:
            log.error("Chunk %d/%d translation failed: %s", i + 1, len(chunks), exc,
                      extra={"stage": "translation", "lang": target_lang_code})
            translated_parts.append(chunk)

        ms = int((time.perf_counter() - t0) * 1000)
        log.info("Translated chunk %d/%d (%d→%d chars) in %dms",
                 i + 1, len(chunks), len(chunk), len(translated_parts[-1]), ms,
                 extra={"stage": "translation", "latency_ms": ms, "lang": target_lang_code})

    return " ".join(translated_parts)


# ─── SRT Translation ──────────────────────────────────────────────────────────

async def translate_srt(srt: str, target_lang_code: str, sys_prompt: str) -> str:
    if not srt.strip():
        return srt
    blocks: List[List[str]] = []
    current: List[str] = []
    for line in srt.splitlines():
        if line.strip():
            current.append(line)
        else:
            if current:
                blocks.append(current)
                current = []
    if current:
        blocks.append(current)

    lang_name            = LANG_NAMES.get(target_lang_code, target_lang_code.upper())
    text_lines_indexed: List[tuple] = []
    parsed_blocks: List[Dict]       = []

    for block in blocks:
        if len(block) < 3:
            parsed_blocks.append({"raw": block, "text_idx": None})
            continue
        parsed_blocks.append({
            "idx_line": block[0],
            "ts_line":  block[1],
            "text":     " ".join(block[2:]),
            "text_idx": len(text_lines_indexed),
        })
        text_lines_indexed.append((len(text_lines_indexed), " ".join(block[2:])))

    if not text_lines_indexed:
        return srt

    numbered_src = "\n".join(f"{i+1}. {txt}" for i, (_, txt) in enumerate(text_lines_indexed))
    prompt = (
        f"Translate each numbered line into {lang_name}. "
        f"Return ONLY the numbered lines in the same order, preserving the 'N. ' prefix:\n\n{numbered_src}"
    )
    tokens = min(4096, max(256, len(numbered_src.split()) * 6))
    raw    = await run_llm(prompt, sys_prompt, max_tokens=tokens, temperature=0.1)

    translated_map: Dict[int, str] = {}
    for line in raw.splitlines():
        m = re.match(r"^(\d+)\.\s+(.*)", line.strip())
        if m:
            translated_map[int(m.group(1)) - 1] = m.group(2).strip()

    out_lines: List[str] = []
    for pb in parsed_blocks:
        if pb.get("text_idx") is None:
            out_lines.extend(pb["raw"])
            out_lines.append("")
            continue
        tidx            = pb["text_idx"]
        translated_text = translated_map.get(tidx, pb["text"])
        out_lines.extend([pb["idx_line"], pb["ts_line"], translated_text, ""])

    return "\n".join(out_lines)


# ─── Notes Builders ────────────────────────────────────────────────────────────

def _notes_header(filename: str, source_lang: str, target_lang: Optional[str],
                  duration_s: int, num_segments: int) -> List[str]:
    name     = Path(filename).stem.replace("-", " ").replace("_", " ").title()
    src_name = LANG_NAMES.get(source_lang, source_lang.upper())
    tgt_part = f" → {LANG_NAMES.get(target_lang, target_lang.upper())}" if target_lang else ""
    now      = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    m, s     = divmod(duration_s, 60)
    h, m     = divmod(m, 60)
    dur_str  = f"{h:02d}:{m:02d}:{s:02d}" if h else f"{m:02d}:{s:02d}"
    return [
        f"# {name}", "",
        "| Field | Value |", "|---|---|",
        f"| File | `{filename}` |",
        f"| Language | {src_name}{tgt_part} |",
        f"| Duration | {dur_str} |",
        f"| Segments | {num_segments} |",
        f"| Generated | {now} |", "",
    ]


def _chapters_block(segments: List[Dict]) -> List[str]:
    lines, chapter_start, chapter_texts = [], segments[0]["start"], []
    for seg in segments:
        if seg["start"] - chapter_start >= 60 and chapter_texts:
            ts      = f"{int(chapter_start//60):02d}:{int(chapter_start%60):02d}"
            preview = " ".join(chapter_texts)[:100].strip().rstrip(".,") + "..."
            lines.append(f"### [{ts}] - {preview}")
            chapter_start, chapter_texts = seg["start"], []
        chapter_texts.append(seg["text"].strip())
    if chapter_texts:
        ts = f"{int(chapter_start//60):02d}:{int(chapter_start%60):02d}"
        lines.append(f"### [{ts}] - {' '.join(chapter_texts)[:100].strip().rstrip('.,') + '...'}")
    return lines


def _paragraphs_block(segments: List[Dict]) -> List[str]:
    lines, para, para_start = [], [], None
    for i, seg in enumerate(segments):
        if para_start is None:
            para_start = seg["start"]
        para.append(seg["text"].strip())
        if (i + 1) % 10 == 0 or seg["text"].strip().endswith((".", "!", "?", "।", "。")):
            ts = f"{int(para_start//60):02d}:{int(para_start%60):02d}"
            lines.append(f"**[{ts}]** {' '.join(para)}")
            para, para_start = [], None
    if para and para_start is not None:
        ts = f"{int(para_start//60):02d}:{int(para_start%60):02d}"
        lines.append(f"**[{ts}]** {' '.join(para)}")
    return lines


def build_notes(filename: str, language: str, transcript: str,
                segments: List[Dict[str, Any]]) -> str:
    duration_s = int(segments[-1]["end"]) if segments else 0
    lines      = _notes_header(filename, language, None, duration_s, len(segments))
    sentences  = re.split(r'(?<=[.!?।।])\s+', transcript.strip())
    summary    = " ".join(sentences[:3]).strip()
    if summary:
        lines += ["## Summary", "", summary, ""]
    if segments:
        chaps = _chapters_block(segments)
        if chaps:
            lines += ["## Chapters", ""] + chaps + [""]
        lines += ["## Full Transcript", ""] + _paragraphs_block(segments) + [""]
    else:
        lines += ["## Full Transcript", "", transcript, ""]
    return "\n".join(lines)


def build_translated_notes(
    filename: str, source_lang: str, target_lang: str, duration_s: int,
    num_segments: int, summary: str, chapters_block: str, paragraphs_block: str,
) -> str:
    target_code = normalize_lang(target_lang)
    lines = _notes_header(filename, source_lang, target_code, duration_s, num_segments)
    if summary:
        lines += ["## Summary", "", summary, ""]
    if chapters_block:
        lines += ["## Chapters", "", chapters_block, ""]
    if paragraphs_block:
        lines += ["## Full Transcript", "", paragraphs_block, ""]
    return "\n".join(lines)


# ─── TTS ──────────────────────────────────────────────────────────────────────

async def generate_tts(text: str, lang_code: str, out_path: Path) -> Optional[str]:
    try:
        import edge_tts
        voice = TTS_VOICES.get(lang_code, "en-US-AriaNeural")
        t0    = time.perf_counter()
        communicate = edge_tts.Communicate(text.strip(), voice)
        await communicate.save(str(out_path))
        ms = int((time.perf_counter() - t0) * 1000)
        log.info("TTS generated in %dms", ms, extra={"stage": "tts", "latency_ms": ms, "lang": lang_code})
        return str(out_path)
    except Exception as exc:
        log.error("TTS failed: %s", exc, extra={"stage": "tts"})
        return None


# ─── Core Processing Pipeline ─────────────────────────────────────────────────

async def process_pipeline(req: ProcessRequest, tmp_dir: str):
    job_id  = req.job_id
    t_start = time.perf_counter()
    log.info("Pipeline started", extra={"job_id": job_id, "stage": "pipeline_start"})

    try:
        await db_update_async(job_id, {"status": "processing", "progress": 5})

        if req.youtube_url:
            log.info("DOWNLOADING", extra={"job_id": job_id, "stage": "downloading"})
            await db_update_async(job_id, {"log_message": "DOWNLOADING"})
            audio_path = await asyncio.to_thread(download_youtube_audio, req.youtube_url, tmp_dir)
            video_path = None
        else:
            log.info("EXTRACTING AUDIO", extra={"job_id": job_id, "stage": "extracting"})
            await db_update_async(job_id, {"log_message": "EXTRACTING AUDIO"})
            video_path = req.file_path
            audio_path = await asyncio.to_thread(extract_audio, video_path, tmp_dir)

        await db_update_async(job_id, {"status": "processing", "progress": 10})

        # ── 1. Audio compression (FIX-7) ────────────────────────────────────
        raw_size_mb = os.path.getsize(audio_path) / (1024 * 1024)
        log.info("Raw audio: %.1fMB", raw_size_mb, extra={"job_id": job_id, "stage": "audio_size"})
        await db_update_async(job_id, {"status": "processing", "progress": 15})

        # ── 2. Transcription ─────────────────────────────────────────────────
        log.info("TRANSCRIBING", extra={"job_id": job_id, "stage": "transcribing"})
        await db_update_async(job_id, {"log_message": "TRANSCRIBING"})
        result = await transcribe_audio(audio_path, normalize_lang(req.language))

        transcript_text = result["text"].strip()
        segments        = result["segments"]
        detected_lang   = result["language"]   # already normalized
        lang_prob       = result.get("language_probability", 1.0)
        trans_conf      = result.get("transcript_confidence", 1.0)

        # ── 2b. Language Verification & Hallucination Checks ─────────────────
        quality_status = "good"
        rejection_reason = ""
        
        ft_lang, ft_conf = get_fasttext_lang(transcript_text)
        if ft_lang:
            ft_lang_norm = normalize_lang(ft_lang)
            if ft_lang_norm != detected_lang and ft_conf > 0.5:
                quality_status = "hallucination"
                rejection_reason = f"Language mismatch (Whisper: {detected_lang}, FastText: {ft_lang_norm})"
                # use fastText language confidence for reporting if mismatch
                lang_prob = min(lang_prob, ft_conf)

        if len(transcript_text) < 10 and not rejection_reason:
            quality_status = "hallucination"
            rejection_reason = "Transcript extremely short, likely noise or silence."
            
        if lang_prob < 0.80 and not rejection_reason:
            quality_status = "low_confidence"
            rejection_reason = f"Language detection confidence too low ({lang_prob:.2f})."
            
        if trans_conf < 0.60 and not rejection_reason:
            quality_status = "low_confidence"
            rejection_reason = f"Transcription confidence too low ({trans_conf:.2f})."

        log.info(
            "Transcription done: %d chars, %d segments, lang=%s (lang_conf=%.2f, t_conf=%.2f, quality=%s)",
            len(transcript_text), len(segments), detected_lang, lang_prob, trans_conf, quality_status,
            extra={"job_id": job_id, "stage": "transcription", "quality_status": quality_status, "rejection_reason": rejection_reason},
        )

        if not transcript_text:
            raise ValueError("No audible speech detected in the audio file.")

        await db_update_async(job_id, {"status": "processing", "progress": 45})

        # ── 3. Baseline notes + subtitles ────────────────────────────────────
        notes = ""
        srt = ""
        vtt = ""
        if quality_status == "good":
            notes = build_notes(req.file_name, detected_lang, transcript_text, segments)
            srt   = build_srt(segments)
            vtt   = srt_to_vtt(srt)
        else:
            notes = f"# Transcription Rejected\n\n**Reason:** {rejection_reason}\n\n**Partial Transcript:**\n{transcript_text}"
            srt   = build_srt(segments)
            vtt   = srt_to_vtt(srt)

        await db_update_async(job_id, {"status": "processing", "progress": 55})

        # ── 4. Translation ───────────────────────────────────────────────────
        target_code = normalize_lang(req.target_language) if req.target_language else None
        translate   = bool(target_code and target_code != detected_lang)

        if translate and quality_status == "good":
            lang_name  = LANG_NAMES.get(target_code, target_code.upper())
            sys_prompt = (
                f"You are a professional translator. Translate accurately into {lang_name}. "
                f"Return ONLY the direct translation, preserving tone and meaning."
            )
            await db_update_async(job_id, {"status": "processing", "progress": 65})

            ctx             = memory.get_context_block(req.job_id)
            log.info("TRANSLATING", extra={"job_id": job_id, "stage": "translating"})
            await db_update_async(job_id, {"log_message": "TRANSLATING"})
            transcript_text = await translate_text_chunked(
                transcript_text, target_code, sys_prompt, context_block=ctx
            )

            log.info("SUMMARIZING", extra={"job_id": job_id, "stage": "summarizing"})
            await db_update_async(job_id, {"log_message": "SUMMARIZING"})
            sentences          = re.split(r'(?<=[.!?।।])\s+', transcript_text.strip())
            translated_summary = " ".join(sentences[:3]).strip()

            raw_chapters        = "\n".join(_chapters_block(segments)) if segments else ""
            translated_chapters = ""
            if raw_chapters:
                translated_chapters = await run_llm(
                    f"Translate the chapter descriptions below into {lang_name}. "
                    f"PRESERVE the exact '### [mm:ss] - ' prefix and trailing '...' on each line. "
                    f"Return ONLY the translated block:\n\n{raw_chapters}",
                    sys_prompt,
                    max_tokens=min(2048, len(raw_chapters.split()) * 6),
                    temperature=0.1,
                )

            raw_paragraphs        = "\n\n".join(_paragraphs_block(segments)) if segments else ""
            translated_paragraphs = ""
            if raw_paragraphs:
                translated_paragraphs = await translate_text_chunked(
                    raw_paragraphs, target_code, sys_prompt, context_block=ctx
                )

            duration_s = int(segments[-1]["end"]) if segments else 0
            notes = build_translated_notes(
                req.file_name, detected_lang, req.target_language,
                duration_s, len(segments),
                translated_summary, translated_chapters, translated_paragraphs,
            )
            srt = await translate_srt(srt, target_code, sys_prompt)
            vtt = srt_to_vtt(srt)

        await db_update_async(job_id, {"status": "processing", "progress": 85})

        # ── 5. TTS ────────────────────────────────────────────────────────────
        audio_summary_path = ""
        if quality_status == "good":
            voiced_lang        = normalize_lang(req.target_language or detected_lang)
            summary_path       = OUTPUTS_DIR / f"{job_id}_summary.mp3"
            audio_summary_path = await generate_tts(transcript_text[:3000], voiced_lang, summary_path) or ""

        # ── 6. Subtitle burn ──────────────────────────────────────────────────
        subtitled_video_path = ""
        # Video rendering with FFmpeg is disabled on the Cloud version because 
        # the 512MB RAM limit causes the server to crash (OOM Kill) at 85%.

        # ── 7. Finalise ───────────────────────────────────────────────────────
        e2e_ms = int((time.perf_counter() - t_start) * 1000)
        log.info("COMPLETED", extra={"job_id": job_id, "stage": "completed"})
        await db_update_async(job_id, {"log_message": "COMPLETED"})
        log.info("Pipeline complete in %dms", e2e_ms,
                 extra={"job_id": job_id, "stage": "done", "latency_ms": e2e_ms})

        log.info("SAVING", extra={"job_id": job_id, "stage": "saving"})
        await db_update_async(job_id, {
            "log_message":          "SAVING",
            "status":               "done",
            "progress":             100,
            "notes":                notes,
            "transcript":           transcript_text,
            "srt_text":             srt,
            "vtt_text":             vtt,
            "language":             detected_lang,
            "target_lang":          req.target_language,
            "duration":             float(segments[-1]["end"]) if segments else 0,
            "segments":             len(segments),
            "audio_summary_path":   audio_summary_path,
            "subtitled_video_path": subtitled_video_path,
            "e2e_latency_ms":       e2e_ms,
            "language_confidence":  lang_prob,
            "transcript_confidence":trans_conf,
            "quality_status":       quality_status,
            "rejection_reason":     rejection_reason
        })

    except Exception as exc:
        log.error("Pipeline error: %s", exc,
                  extra={"job_id": job_id, "stage": "error"}, exc_info=True)
        await db_update_async(job_id, {
            "status":   "error",
            "progress": 0,
            "error":    str(exc)[:2000],
        })
    finally:
        try:
            import shutil
            await asyncio.to_thread(lambda: shutil.rmtree(tmp_dir, ignore_errors=True))
        except Exception:
            pass


# ─── FastAPI App ───────────────────────────────────────────────────────────────

app = FastAPI(title="ScribeAI Engine", version="3.2.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], allow_credentials=True,
    allow_methods=["*"], allow_headers=["*"],
)


@app.get("/")
def root():
    return {"service": "ScribeAI Engine", "version": "3.2.0", "docs": "/docs"}


@app.get("/health")
async def health():
    ollama_ok = False
    try:
        async with httpx.AsyncClient(timeout=3) as c:
            r = await c.get(f"{OLLAMA_HOST}/api/tags")
            ollama_ok = r.status_code == 200
    except Exception:
        pass
    return {
        "status":        "ok",
        "version":       "3.2.0",
        "groq":          bool(GROQ_API_KEY),
        "ollama":        ollama_ok,
        "ollama_model":  OLLAMA_MODEL,
        "perf_budget":   PERF_BUDGET,
        "groq_max_mb":   GROQ_MAX_BYTES // (1024 * 1024),
        "chunk_secs":    AUDIO_CHUNK_SECS,
        "fixes_applied": [
            "FIX-1 lang-norm", "FIX-2 ws-timeout", "FIX-3 chunk-timeout",
            "FIX-4 ws-status", "FIX-5 asr-norm",   "FIX-6 name-to-code",
            "FIX-7 audio-compress", "FIX-8 file-size-guard",
            "FIX-9 asr-budget",     "FIX-10 concurrent-chunks",
        ],
    }


@app.post("/ai/process")
async def process_media(req: ProcessRequest, bg_tasks: BackgroundTasks):
    tmp_dir = tempfile.mkdtemp(prefix=f"scribeai_{req.job_id}_")
    try:
        if not req.youtube_url and (not req.file_path or not os.path.exists(req.file_path)):
            raise HTTPException(400, "file_path missing or not found on disk.")

        bg_tasks.add_task(process_pipeline, req, tmp_dir)
        return {"status": "processing", "job_id": req.job_id}
    except HTTPException:
        raise
    except Exception as exc:
        import shutil; shutil.rmtree(tmp_dir, ignore_errors=True)
        log.error("process_media init failed: %s", exc)
        raise HTTPException(500, str(exc))


@app.post("/ai/translate")
async def translate_endpoint(req: TranslateRequest):
    t0          = time.perf_counter()
    session_id  = req.session_id or "default"
    speaker_id  = req.speaker_id or "Speaker"
    target_code = normalize_lang(req.target_language)
    source_code = normalize_lang(req.source_language) if req.source_language else None
    lang_name   = LANG_NAMES.get(target_code, target_code.upper())

    if not req.text.strip():
        return {"translation": "", "latency_ms": 0}
    if source_code and source_code == target_code:
        return {"translation": req.text.strip(), "latency_ms": 0, "skipped": True}

    sys_prompt = (
        f"You are a professional, high-speed real-time speech translation engine.\n"
        f"Translate the input into {lang_name}.\n"
        f"Rules:\n"
        f"1. Preserve tone, repetitions, and speech patterns exactly.\n"
        f"2. Output ONLY the translated text — no quotes, no explanations, no notes.\n"
        f"3. If input is already in {lang_name}, return it as-is.\n"
        f"4. If input is empty or non-speech, return an empty string."
    )
    ctx         = memory.get_context_block(session_id)
    translation = await translate_text_chunked(
        req.text, target_code, sys_prompt, context_block=ctx, session_id=session_id
    )
    memory.add(session_id, SpeakerTurn(
        speaker_id=speaker_id, language=target_code,
        text=req.text, translation=translation,
    ))

    ms = int((time.perf_counter() - t0) * 1000)
    log.info("Translation done: %d chars in %dms", len(translation), ms,
             extra={"stage": "translation_response", "session_id": session_id, "latency_ms": ms})
    return {"translation": translation, "latency_ms": ms, "session_id": session_id}


# ─── WebSocket — Continuous Conversation Engine ────────────────────────────────

class WSMessageType:
    TEXT_CHUNK  = "text_chunk"
    TRANSLATE   = "translate"
    TRANSLATION = "translation"
    TTS_READY   = "tts_ready"
    STATUS      = "status"
    PING        = "ping"
    PONG        = "pong"
    ERROR       = "error"
    CLEAR_CTX   = "clear_context"


@app.websocket("/ws/conversation")
async def ws_conversation(ws: WebSocket):
    await ws.accept()
    remote = ws.client
    log.info("WS connected: %s", remote, extra={"stage": "ws_connect"})

    async def _send(payload: dict):
        try:
            await ws.send_json(payload)
        except Exception:
            pass

    await _send({"type": WSMessageType.STATUS, "msg": "connected", "version": "3.2.0"})

    try:
        while True:
            try:
                raw = await asyncio.wait_for(ws.receive_json(), timeout=120.0)
            except asyncio.TimeoutError:
                await _send({"type": WSMessageType.PING})
                continue

            msg_type   = raw.get("type", "")
            session_id = raw.get("session_id") or str(uuid.uuid4())
            speaker_id = raw.get("speaker_id", "Speaker")

            if msg_type == WSMessageType.PING:
                await _send({"type": WSMessageType.PONG})
                continue

            if msg_type == WSMessageType.CLEAR_CTX:
                memory.clear(session_id)
                await _send({"type": WSMessageType.STATUS, "msg": "context_cleared"})
                continue

            if msg_type in (WSMessageType.TRANSLATE, WSMessageType.TEXT_CHUNK):
                text        = (raw.get("text") or "").strip()
                target_lang = normalize_lang(raw.get("target_lang") or raw.get("target_language"))
                tts_enabled = bool(raw.get("tts", False))

                if not text:
                    continue

                # FIX-4: immediate acknowledgement
                await _send({
                    "type":       WSMessageType.STATUS,
                    "msg":        "processing",
                    "session_id": session_id,
                    "speaker_id": speaker_id,
                })

                t0        = time.perf_counter()
                lang_name = LANG_NAMES.get(target_lang, target_lang.upper())
                sys_prompt = (
                    f"You are a professional real-time speech translator.\n"
                    f"Translate into {lang_name}.\n"
                    f"Output ONLY the translated text. No notes, no quotes."
                )
                ctx = memory.get_context_block(session_id)

                try:
                    # FIX-2: hard timeout on the whole WS translation turn
                    translation = await asyncio.wait_for(
                        translate_text_chunked(
                            text, target_lang, sys_prompt,
                            context_block=ctx, session_id=session_id,
                        ),
                        timeout=LLM_WS_TIMEOUT,
                    )
                except asyncio.TimeoutError:
                    log.error("WS translation timed out after %ds — session %s",
                              LLM_WS_TIMEOUT, session_id)
                    await _send({
                        "type":       WSMessageType.ERROR,
                        "msg":        f"Translation timed out after {LLM_WS_TIMEOUT}s — LLM may be overloaded. Please retry.",
                        "session_id": session_id,
                    })
                    continue
                except Exception as exc:
                    await _send({"type": WSMessageType.ERROR, "msg": str(exc)})
                    continue

                ms = int((time.perf_counter() - t0) * 1000)
                memory.add(session_id, SpeakerTurn(
                    speaker_id=speaker_id, language=target_lang,
                    text=text, translation=translation,
                ))

                await _send({
                    "type":        WSMessageType.TRANSLATION,
                    "text":        text,
                    "translation": translation,
                    "target_lang": target_lang,
                    "latency_ms":  ms,
                    "session_id":  session_id,
                    "speaker_id":  speaker_id,
                })

                if tts_enabled:
                    tts_file = OUTPUTS_DIR / f"ws_{session_id}_{int(time.time())}.mp3"
                    asyncio.create_task(
                        _ws_tts_and_notify(ws, translation, target_lang, tts_file, session_id)
                    )
            else:
                await _send({"type": WSMessageType.ERROR, "msg": f"Unknown message type: {msg_type}"})

    except WebSocketDisconnect:
        log.info("WS disconnected: %s", remote, extra={"stage": "ws_disconnect"})
    except Exception as exc:
        log.error("WS error: %s", exc, extra={"stage": "ws_error"}, exc_info=True)
        try:
            await _send({"type": WSMessageType.ERROR, "msg": str(exc)})
        except Exception:
            pass


async def _ws_tts_and_notify(ws: WebSocket, text: str, lang: str,
                              out_path: Path, session_id: str):
    path = await generate_tts(text, lang, out_path)
    if path:
        try:
            await ws.send_json({
                "type": WSMessageType.TTS_READY, "path": path, "session_id": session_id,
            })
        except Exception:
            pass


# ─── Debug Endpoints ──────────────────────────────────────────────────────────

@app.get("/debug/report")
async def debug_report():
    log_file    = Path(__file__).parent / "scribeai.log"
    recent_logs: List[str] = []
    if log_file.exists():
        lines       = log_file.read_text(encoding="utf-8", errors="replace").splitlines()
        recent_logs = lines[-100:]

    latencies: Dict[str, List[int]] = {"asr": [], "translation": [], "tts": [], "e2e": []}
    for line in recent_logs:
        try:
            rec   = json.loads(line)
            stage = rec.get("stage", "")
            ms    = rec.get("latency_ms")
            if ms and stage in latencies:
                latencies[stage].append(int(ms))
        except Exception:
            pass

    def _stats(vals: List[int]) -> Dict:
        if not vals:
            return {}
        vals_s = sorted(vals)
        return {
            "count": len(vals_s), "min_ms": vals_s[0], "max_ms": vals_s[-1],
            "avg_ms": int(sum(vals_s) / len(vals_s)),
            "p95_ms": vals_s[int(len(vals_s) * 0.95)],
        }

    return {
        "service":         "ScribeAI Engine v3.2",
        "groq_available":  bool(GROQ_API_KEY),
        "ollama_model":    OLLAMA_MODEL,
        "perf_budget_ms":  PERF_BUDGET,
        "timeout_config":  {"llm_chunk_s": LLM_CHUNK_TIMEOUT, "ws_total_s": LLM_WS_TIMEOUT},
        "audio_config":    {"groq_max_mb": GROQ_MAX_BYTES // (1024*1024), "chunk_secs": AUDIO_CHUNK_SECS},
        "latency_stats":   {k: _stats(v) for k, v in latencies.items()},
        "active_sessions": list(memory._store.keys()),
        "outputs_dir":     str(OUTPUTS_DIR),
        "recent_errors":   [json.loads(l) for l in recent_logs if "ERROR" in l or "WARNING" in l][-20:],
    }


@app.post("/debug/validate-translation")
async def validate_translation(body: dict):
    target_lang = normalize_lang(body.get("target_lang", "hi"))
    texts       = body.get("texts") or [
        "Hello.",
        "The weather is nice today. How are you doing?",
        "This is a long paragraph to test chunking. " * 20,
    ]
    lang_name  = LANG_NAMES.get(target_lang, target_lang.upper())
    sys_prompt = f"Translate accurately into {lang_name}. Return ONLY the translation."
    results = []
    for text in texts:
        t0 = time.perf_counter()
        try:
            translated = await translate_text_chunked(text, target_lang, sys_prompt)
            ms = int((time.perf_counter() - t0) * 1000)
            results.append({
                "input_len":   len(text), "output_len": len(translated),
                "latency_ms":  ms, "chunks": len(_split_text_into_chunks(text)),
                "translation": translated[:200], "status": "ok",
            })
        except Exception as exc:
            results.append({"input_len": len(text), "status": "error", "error": str(exc)})
    return {"target_lang": target_lang, "results": results}


@app.post("/debug/test-audio-compress")
async def test_audio_compress(body: dict):
    """
    Test endpoint: POST {"file_path": "/path/to/audio"} to check what
    compression + chunking would do without running a full pipeline.
    """
    file_path = body.get("file_path", "")
    if not file_path or not os.path.exists(file_path):
        raise HTTPException(400, "file_path missing or not found")

    orig_mb   = os.path.getsize(file_path) / (1024 * 1024)
    duration  = await asyncio.to_thread(_audio_duration_secs, file_path)
    needs_split = orig_mb > (GROQ_MAX_BYTES / (1024 * 1024))
    num_chunks  = math.ceil(duration / AUDIO_CHUNK_SECS) if needs_split else 1

    return {
        "original_mb":   round(orig_mb, 2),
        "duration_secs": round(duration, 1),
        "groq_limit_mb": GROQ_MAX_BYTES // (1024 * 1024),
        "needs_chunking": needs_split,
        "estimated_chunks": num_chunks,
        "estimated_compressed_mb": round(orig_mb * 0.09, 2),  # ~9% for 16kHz mono MP3
    }


# ─── Entry Point ───────────────────────────────────────────────────────────────

log.info("ScribeAI Engine v3.2 loaded. Groq=%s, Ollama=%s", bool(GROQ_API_KEY), OLLAMA_MODEL)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)