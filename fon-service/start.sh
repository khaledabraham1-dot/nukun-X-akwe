#!/usr/bin/env bash
# Lance Nukun Fon sur http://127.0.0.1:8765 (1 worker, MT + TTS precharges).
cd "$(dirname "$0")"
source .venv/bin/activate
export NUKUN_PRELOAD=1
# une fois les modeles telecharges, on evite tout appel reseau au demarrage
if [ -d "$HOME/.cache/huggingface/hub/models--facebook--mms-tts-fon" ]; then export HF_HUB_OFFLINE=1; fi
exec uvicorn server:app --host 127.0.0.1 --port 8765 --workers 1
