"""GET /api/accounts : identifiants des comptes notables (jamais le profil simulé)."""
import os
import sys
from http.server import BaseHTTPRequestHandler

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "_lib"))
from engine import get_engine  # noqa: E402
from http_utils import send_json, send_options  # noqa: E402


class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        send_options(self)

    def do_GET(self):
        try:
            e = get_engine()
        except Exception as exc:
            return send_json(self, 500, {"error": "moteur indisponible", "detail": str(exc)})
        send_json(self, 200, {"count": len(e.notable), "accounts": e.notable})
