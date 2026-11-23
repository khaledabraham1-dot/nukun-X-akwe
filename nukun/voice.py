"""Dictée française locale de clips WAV PCM."""

from functools import lru_cache
from io import BytesIO
import json
from pathlib import Path
import wave


@lru_cache(maxsize=1)
def local_model():
    from vosk import Model

    path = Path(__file__).resolve().parents[1] / "runtime" / "vosk-model-small-fr-0.22"
    if not path.is_dir():
        raise RuntimeError("Modèle français absent. Consultez la rubrique Dictée du README.")
    return Model(str(path))


def transcribe(data):
    if len(data) > 8_000_000:
        raise ValueError("Le fichier dépasse 8 Mo.")
    try:
        with wave.open(BytesIO(data)) as wav:
            rate = wav.getframerate()
            frames = wav.getnframes()
            if wav.getnchannels() != 1 or wav.getsampwidth() != 2 or not 16000 <= rate <= 48000:
                raise ValueError("Utilisez un WAV PCM mono 16 bits à 16–48 kHz.")
            if not 0 < frames <= 60 * rate:
                raise ValueError("Enregistrez une phrase de 60 secondes maximum.")
            pcm = wav.readframes(frames)
            if len(pcm) != frames * 2:
                raise ValueError("Le fichier WAV est incomplet.")
    except (wave.Error, EOFError) as exc:
        raise ValueError("Fichier WAV vide ou illisible.") from exc

    from vosk import KaldiRecognizer

    recognizer = KaldiRecognizer(local_model(), rate)
    parts = []
    for offset in range(0, len(pcm), 8000):
        if recognizer.AcceptWaveform(pcm[offset:offset + 8000]):
            parts.append(json.loads(recognizer.Result())["text"])
    parts.append(json.loads(recognizer.FinalResult())["text"])
    text = " ".join(filter(None, parts)).strip()
    if not text:
        raise ValueError("Aucune parole comprise. Réessayez ou saisissez le texte.")
    return text
