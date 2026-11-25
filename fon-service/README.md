# Nukun Fon : traduction fon <-> français en local (CPU)

Service FastAPI sur `http://127.0.0.1:8765`, appelé par https://nukun-web.vercel.app.

## Installation
```bash
cd ~/nukun-fon
uv venv -p 3.12 .venv
uv pip install -p .venv/bin/python --index-url https://download.pytorch.org/whl/cpu \
  --extra-index-url https://pypi.org/simple --index-strategy unsafe-best-match \
  torch==2.5.1 transformers==4.46.3 ctranslate2 sentencepiece fastapi "uvicorn[standard]" \
  python-multipart numpy psutil "huggingface_hub<1"
./download_models.sh        # NLLB-600M (converti CTranslate2 int8) + MMS-TTS fon
./download_models.sh asr    # optionnel : MMS-1b-all (~4 Go), reconnaissance vocale fon
```
`ffmpeg` doit être installé (décodage webm/opus du navigateur).

## Lancement
```bash
./start.sh
```
Un seul worker. MT et TTS sont préchargés en arrière plan ; l'ASR se charge au premier appel
et renvoie une erreur 503 propre si la RAM libre est insuffisante (seuil `NUKUN_ASR_MIN_FREE_MB`, 2500 Mo par défaut).

## Routes
| Route | Entrée | Sortie |
|---|---|---|
| `GET /health` | | `{ok, models:{asr,mt,tts}, device:"cpu", ...}` |
| `POST /translate` | `{text, src:"fon"\|"fr", tgt:"fr"\|"fon"}` | `{text, ms}` |
| `POST /tts` | `{text, lang:"fon"}` | `audio/wav` |
| `POST /asr` | multipart `audio` (webm/opus ou wav) | `{text, ms}` |
| `POST /speech` | multipart `audio` | `{fon, fr, ms}` |

CORS ouvert, préflights avec `Access-Control-Allow-Private-Network: true`.

## Modèles (tous publics)
- Traduction : `facebook/nllb-200-distilled-600M` (`fon_Latn`, `fra_Latn`), CTranslate2 int8.
- Synthèse : `facebook/mms-tts-fon` (VITS).
- Reconnaissance : `facebook/mms-1b-all` + adaptateur `fon`, quantification dynamique int8.

## Limites
- La qualité de NLLB sur le fon est imparfaite : relire les traductions importantes.
- MMS-1b-all est lourd (~4 Go en fp32 au chargement) : sur une machine à 6 Go il peut ne pas tenir.
