"""GET /api/health : statut du moteur."""
import os
import sys
from http.server import BaseHTTPRequestHandler

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "_lib"))
from engine import MODEL_LABEL, VERSION, get_engine  # noqa: E402
from http_utils import send_json, send_options  # noqa: E402


class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        send_options(self)

    def do_GET(self):
        try:
            e = get_engine()
        except Exception as exc:
            return send_json(self, 500, {"status": "error", "version": VERSION, "detail": str(exc)})
        send_json(self, 200, {"status": "ok", "version": VERSION, "model": MODEL_LABEL,
                              "accounts": len(e.history.accounts), "notable": len(e.notable)})
