#!/usr/bin/env bash
# Telecharge les modeles publics et convertit NLLB en CTranslate2 int8.
# Usage : ./download_models.sh            (MT + TTS)
#         ./download_models.sh asr        (ajoute mms-1b-all, ~4 Go)
set -euo pipefail
cd "$(dirname "$0")"
source .venv/bin/activate
python - <<'PY'
from huggingface_hub import snapshot_download
snapshot_download("facebook/mms-tts-fon")
snapshot_download("facebook/nllb-200-distilled-600M",
                  allow_patterns=["*.json", "*.model", "pytorch_model.bin"])
PY
if [ ! -f models/nllb-200-distilled-600M-ct2-int8/model.bin ]; then
  mkdir -p models
  ct2-transformers-converter --model facebook/nllb-200-distilled-600M \
    --output_dir models/nllb-200-distilled-600M-ct2-int8 \
    --quantization int8 --low_cpu_mem_usage --force
fi
if [ "${1:-}" = "asr" ]; then
  python -c "from huggingface_hub import snapshot_download as s; s('facebook/mms-1b-all', allow_patterns=['*.json','model.safetensors','adapter.fon.safetensors'])"
fi
echo "OK"
