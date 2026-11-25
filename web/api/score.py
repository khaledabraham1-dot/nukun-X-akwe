"""GET /api/score?receiver=M012&amount=12000 : score de fraude calculé à la demande."""
import os
import sys
from http.server import BaseHTTPRequestHandler
from urllib.parse import parse_qs, urlparse

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "_lib"))
from engine import MAX_AMOUNT, MIN_AMOUNT, get_engine, parse_amount  # noqa: E402
from http_utils import send_json, send_options  # noqa: E402


class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        send_options(self)

    def do_GET(self):
        q = parse_qs(urlparse(self.path).query)
        receiver = (q.get("receiver") or [""])[0].strip().upper()
        raw_amount = (q.get("amount") or [""])[0]
        try:
            engine = get_engine()
        except Exception as exc:  # état introuvable ou corrompu
            return send_json(self, 500, {"error": "moteur indisponible", "detail": str(exc)})
        if not receiver or not engine.known(receiver):
            return send_json(self, 400, {"error": "receiver inconnu", "receiver": receiver})
        amount = parse_amount(raw_amount)
        if amount is None:
            return send_json(self, 400, {"error": f"amount doit être un entier entre {MIN_AMOUNT} et {MAX_AMOUNT}",
                                         "amount": raw_amount})
        try:
            result = engine.score(receiver, amount)
        except Exception as exc:
            return send_json(self, 500, {"error": "échec du calcul", "detail": str(exc)})
        send_json(self, 200, result)
