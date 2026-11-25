"""Nukun Fon : service local de traduction fon <-> francais (CPU).

Routes : /health, /translate, /tts, /asr, /speech.
Chaque modele est charge paresseusement et independamment.
"""
import io
import os
import subprocess
import threading
import time
import wave
from pathlib import Path

os.environ.setdefault("OMP_NUM_THREADS", str(min(8, os.cpu_count() or 4)))

import numpy as np
import psutil
from fastapi import FastAPI, File, HTTPException, Request, UploadFile
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel

BASE = Path(__file__).resolve().parent
MODELS = BASE / "models"
NLLB_ID = "facebook/nllb-200-distilled-600M"
NLLB_CT2 = MODELS / "nllb-200-distilled-600M-ct2-int8"
TTS_ID = "facebook/mms-tts-fon"
ASR_ID = os.environ.get("NUKUN_ASR_MODEL", "facebook/mms-1b-all")
ASR_LANG = os.environ.get("NUKUN_ASR_LANG", "fon")
# RAM disponible minimale (Mo) avant de tenter de charger l'ASR
ASR_MIN_FREE_MB = int(os.environ.get("NUKUN_ASR_MIN_FREE_MB", "2500"))
LANG = {"fon": "fon_Latn", "fr": "fra_Latn"}

import torch  # noqa: E402

torch.set_num_threads(int(os.environ["OMP_NUM_THREADS"]))

app = FastAPI(title="Nukun Fon", version="1.0")


# ---------------------------------------------------------------- CORS + PNA
CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "*",
    "Access-Control-Allow-Private-Network": "true",
    "Access-Control-Max-Age": "600",
}


@app.middleware("http")
async def cors(request: Request, call_next):
    if request.method == "OPTIONS":
        h = dict(CORS_HEADERS)
        req_h = request.headers.get("access-control-request-headers")
        if req_h:
            h["Access-Control-Allow-Headers"] = req_h
        return Response(status_code=204, headers=h)
    resp = await call_next(request)
    for k, v in CORS_HEADERS.items():
        resp.headers[k] = v
    return resp


# ---------------------------------------------------------------- etat
_state = {"mt": None, "tts": None, "asr": None}
_errors = {"mt": None, "tts": None, "asr": None}
_locks = {k: threading.Lock() for k in _state}


def _rss_mb():
    return round(psutil.Process().memory_info().rss / 1e6)


# ---------------------------------------------------------------- MT
def load_mt():
    with _locks["mt"]:
        if _state["mt"] is not None:
            return _state["mt"]
        from transformers import AutoTokenizer

        tok = AutoTokenizer.from_pretrained(NLLB_ID)
        if (NLLB_CT2 / "model.bin").exists():
            import ctranslate2

            tr = ctranslate2.Translator(
                str(NLLB_CT2), device="cpu", compute_type="int8",
                intra_threads=int(os.environ["OMP_NUM_THREADS"]),
            )
            _state["mt"] = ("ct2", tok, tr)
        else:
            from transformers import AutoModelForSeq2SeqLM

            m = AutoModelForSeq2SeqLM.from_pretrained(NLLB_ID, low_cpu_mem_usage=True).eval()
            m = torch.quantization.quantize_dynamic(m, {torch.nn.Linear}, dtype=torch.qint8)
            _state["mt"] = ("torch", tok, m)
        return _state["mt"]


def translate(text: str, src: str, tgt: str) -> str:
    kind, tok, model = load_mt()
    tok.src_lang = LANG[src]
    out = []
    # traduction phrase par phrase (NLLB est entraine sur des phrases)
    for line in [s for s in text.split("\n") if s.strip()]:
        if kind == "ct2":
            ids = tok(line).input_ids
            toks = tok.convert_ids_to_tokens(ids)
            res = model.translate_batch(
                [toks], target_prefix=[[LANG[tgt]]], beam_size=2,
                max_decoding_length=min(256, int(len(toks) * 2.2) + 8),
                repetition_penalty=1.2, no_repeat_ngram_size=3,
            )
            hyp = res[0].hypotheses[0][1:]
            out.append(tok.decode(tok.convert_tokens_to_ids(hyp), skip_special_tokens=True))
        else:
            enc = tok(line, return_tensors="pt")
            with torch.inference_mode():
                gen = model.generate(
                    **enc, forced_bos_token_id=tok.convert_tokens_to_ids(LANG[tgt]),
                    num_beams=2, max_new_tokens=256,
                )
            out.append(tok.batch_decode(gen, skip_special_tokens=True)[0])
    return "\n".join(out)


# ---------------------------------------------------------------- TTS
def load_tts():
    with _locks["tts"]:
        if _state["tts"] is None:
            from transformers import AutoTokenizer, VitsModel

            tok = AutoTokenizer.from_pretrained(TTS_ID)
            m = VitsModel.from_pretrained(TTS_ID).eval()
            _state["tts"] = (tok, m)
        return _state["tts"]


def synth(text: str) -> bytes:
    tok, m = load_tts()
    torch.manual_seed(0)
    enc = tok(text.strip(), return_tensors="pt")
    if enc.input_ids.shape[1] == 0:
        raise HTTPException(400, "texte vide apres normalisation")
    with torch.inference_mode():
        wav = m(**enc).waveform[0].numpy()
    pcm = (np.clip(wav, -1, 1) * 32767).astype(np.int16)
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(m.config.sampling_rate)
        w.writeframes(pcm.tobytes())
    return buf.getvalue()


# ---------------------------------------------------------------- ASR
def load_asr():
    with _locks["asr"]:
        if _state["asr"] is not None:
            return _state["asr"]
        free = psutil.virtual_memory().available / 1e6
        if free < ASR_MIN_FREE_MB:
            _errors["asr"] = f"RAM libre insuffisante ({free:.0f} Mo < {ASR_MIN_FREE_MB} Mo)"
            raise HTTPException(503, f"ASR indisponible : {_errors['asr']}")
        try:
            from transformers import AutoProcessor, Wav2Vec2ForCTC

            proc = AutoProcessor.from_pretrained(ASR_ID)
            m = Wav2Vec2ForCTC.from_pretrained(ASR_ID, low_cpu_mem_usage=True)
            if "mms-1b" in ASR_ID:
                proc.tokenizer.set_target_lang(ASR_LANG)
                m.load_adapter(ASR_LANG)
            m.eval()
            m = torch.quantization.quantize_dynamic(m, {torch.nn.Linear}, dtype=torch.qint8)
            _state["asr"] = (proc, m)
            _errors["asr"] = None
        except HTTPException:
            raise
        except Exception as e:  # noqa: BLE001
            _errors["asr"] = f"{type(e).__name__}: {e}"
            raise HTTPException(503, f"ASR indisponible : {_errors['asr']}")
        return _state["asr"]


def decode_audio(data: bytes) -> np.ndarray:
    p = subprocess.run(
        ["ffmpeg", "-hide_banner", "-loglevel", "error", "-i", "pipe:0",
         "-ac", "1", "-ar", "16000", "-f", "f32le", "pipe:1"],
        input=data, capture_output=True, timeout=60,
    )
    if p.returncode != 0:
        raise HTTPException(400, f"audio illisible : {p.stderr.decode()[-300:]}")
    a = np.frombuffer(p.stdout, dtype=np.float32)
    if a.size < 1600:
        raise HTTPException(400, "audio trop court")
    return a


def recognize(audio: np.ndarray) -> str:
    proc, m = load_asr()
    inp = proc(audio, sampling_rate=16000, return_tensors="pt")
    with torch.inference_mode():
        logits = m(**inp).logits
    ids = torch.argmax(logits, dim=-1)[0]
    return proc.decode(ids).strip()


# ---------------------------------------------------------------- routes
class TranslateIn(BaseModel):
    text: str
    src: str = "fr"
    tgt: str = "fon"


class TtsIn(BaseModel):
    text: str
    lang: str = "fon"


@app.get("/health")
def health():
    return {
        "ok": True,
        "models": {k: v is not None for k, v in _state.items()},
        "errors": {k: v for k, v in _errors.items() if v},
        "device": "cpu",
        "rss_mb": _rss_mb(),
        "ram_free_mb": round(psutil.virtual_memory().available / 1e6),
    }


@app.post("/translate")
def r_translate(body: TranslateIn):
    if body.src not in LANG or body.tgt not in LANG or body.src == body.tgt:
        raise HTTPException(400, "src/tgt doivent etre 'fon' et 'fr' (differents)")
    if not body.text.strip():
        raise HTTPException(400, "texte vide")
    t = time.perf_counter()
    try:
        res = translate(body.text[:2000], body.src, body.tgt)
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001
        _errors["mt"] = f"{type(e).__name__}: {e}"
        raise HTTPException(503, f"traduction indisponible : {_errors['mt']}")
    return {"text": res, "ms": round((time.perf_counter() - t) * 1000)}


@app.post("/tts")
def r_tts(body: TtsIn):
    if body.lang != "fon":
        raise HTTPException(400, "seule la langue 'fon' est disponible")
    if not body.text.strip():
        raise HTTPException(400, "texte vide")
    t = time.perf_counter()
    try:
        data = synth(body.text[:600])
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001
        _errors["tts"] = f"{type(e).__name__}: {e}"
        raise HTTPException(503, f"synthese indisponible : {_errors['tts']}")
    ms = round((time.perf_counter() - t) * 1000)
    return Response(data, media_type="audio/wav", headers={"X-Gen-Ms": str(ms)})


@app.post("/asr")
async def r_asr(audio: UploadFile = File(...)):
    data = await audio.read()
    t = time.perf_counter()
    text = recognize(decode_audio(data))
    return {"text": text, "ms": round((time.perf_counter() - t) * 1000)}


@app.post("/speech")
async def r_speech(audio: UploadFile = File(...)):
    data = await audio.read()
    t = time.perf_counter()
    fon = recognize(decode_audio(data))
    fr = translate(fon, "fon", "fr") if fon else ""
    return {"fon": fon, "fr": fr, "ms": round((time.perf_counter() - t) * 1000)}


@app.exception_handler(HTTPException)
async def http_exc(_req, exc: HTTPException):
    return JSONResponse({"error": exc.detail}, status_code=exc.status_code, headers=CORS_HEADERS)


@app.on_event("startup")
def preload():
    if os.environ.get("NUKUN_PRELOAD", "1") != "1":
        return

    def run():
        for name, fn in (("mt", load_mt), ("tts", load_tts)):
            try:
                fn()
            except Exception as e:  # noqa: BLE001
                _errors[name] = f"{type(e).__name__}: {e}"

    threading.Thread(target=run, daemon=True).start()
