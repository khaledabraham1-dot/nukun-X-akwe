"""Cahier SQLite : proposition, confirmation idempotente et rapprochement prudent."""

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
import json
from pathlib import Path
import re
import sqlite3
import unicodedata
from uuid import uuid4

BENIN_TZ = timezone(timedelta(hours=1))


def normalize(text: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFKD", text.lower())
                   if not unicodedata.combining(c))


@dataclass(frozen=True)
class Proposal:
    kind: str
    amount: int
    channel: str
    source: str


def parse_statement(text: str, channel: str = "mobile_money") -> Proposal:
    """Grammaire française volontairement bornée ; aucune somme devinée."""
    if channel not in {"cash", "mobile_money"}:
        raise ValueError("Canal inconnu.")
    text = text.strip()
    clean = normalize(text).replace("\u202f", " ").replace("\xa0", " ")
    if not clean or len(clean) > 1000:
        raise ValueError("Saisissez une phrase courte décrivant une seule opération.")
    if re.search(r"\b(dette|credit|rembours|pret|demain|hier)\w*\b", clean):
        raise ValueError("Cette version accepte les ventes et dépenses du jour, sans dette ni crédit.")
    if re.search(r"\b(pas|jamais|aucun|moins|annul\w*|environ|probablement|prevu\w*|estime\w*|si)\b|peut.?etre", clean):
        raise ValueError("Décrivez une opération réalisée avec un montant certain, sans négation ni estimation.")
    if not re.match(r"^(?:aujourd['’]hui[, ]+)?(?:(?:j['’]ai|nous avons)\s+(?:vendu|encaisse|achete|paye|depense)\b|"
                    r"(?:vente|ventes|achat|depense|depenses|recette|recettes)\b)", clean):
        raise ValueError("Décrivez une opération réalisée : « J'ai vendu pour 12 000 francs » ou « Dépense 500 francs ».")
    if re.search(r"\b(aurais|aurait|aurions|auraient|potentiel\w*|eventuel\w*|futur\w*|millions?|milliards?|mille)\b", clean):
        raise ValueError("Utilisez une opération réalisée et un montant intégralement écrit en chiffres.")
    sale = bool(re.search(r"\b(vendu|vente|ventes|encaisse|recette|recettes)\b", clean))
    expense = bool(re.search(r"\b(achete|achat|depense|depenses|paye)\b", clean))
    if sale == expense:
        raise ValueError("Précisez une vente OU une dépense, une seule opération par phrase.")
    if any(unicodedata.category(c) == "Sc" for c in clean) or re.search(r"[-−]\s*\d|\d[.,]\d|\b(euros?|dollars?|usd|eur)\b", clean):
        raise ValueError("Utilisez un montant entier positif en francs CFA, sans décimales.")
    amounts = list(re.finditer(r"(?<!\w)(?:\d{1,3}(?: \d{3})+|\d+)(?!\w)", clean))
    if len(amounts) != 1:
        raise ValueError("Indiquez exactement un montant en chiffres, par exemple 12 000 francs.")
    tail = clean[amounts[0].end():].strip()
    if not re.fullmatch(r"(?:(?:francs?(?:\s+cfa)?|f\.?\s?cfa|cfa|xof)\s*)?(?:aujourd['’]hui)?[.! ]*", tail):
        raise ValueError("Après le montant, utilisez uniquement francs CFA, FCFA ou XOF ; écrivez le montant complet en chiffres.")
    amount = int(amounts[0].group().replace(" ", ""))
    if not 0 < amount <= 100_000_000:
        raise ValueError("Montant hors limites du prototype (1 à 100 000 000 XOF).")
    return Proposal("sale" if sale else "expense", amount, channel, text)


class Ledger:
    def __init__(self, path: str | Path = ":memory:"):
        self.path = str(path)
        self.db = sqlite3.connect(self.path, timeout=10)
        self.db.row_factory = sqlite3.Row
        self.db.execute("PRAGMA foreign_keys=ON")
        self.db.executescript("""
            CREATE TABLE IF NOT EXISTS payments (
                id TEXT PRIMARY KEY, merchant TEXT NOT NULL, amount INTEGER NOT NULL CHECK(amount>0),
                direction TEXT NOT NULL CHECK(direction IN ('incoming','outgoing')),
                timestamp INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS entries (
                id TEXT PRIMARY KEY, request_key TEXT NOT NULL UNIQUE, merchant TEXT NOT NULL,
                kind TEXT NOT NULL CHECK(kind IN ('sale','expense')),
                amount INTEGER NOT NULL CHECK(amount>0), channel TEXT NOT NULL,
                source TEXT NOT NULL, business_day TEXT NOT NULL,
                status TEXT NOT NULL CHECK(status IN ('proposed','confirmed','cancelled')),
                version INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL,
                confirmed_at INTEGER, matched_payment TEXT UNIQUE REFERENCES payments(id),
                match_status TEXT NOT NULL DEFAULT 'pending'
            );
            CREATE TABLE IF NOT EXISTS audit (
                id INTEGER PRIMARY KEY AUTOINCREMENT, entry_id TEXT NOT NULL REFERENCES entries(id),
                action TEXT NOT NULL, timestamp INTEGER NOT NULL, details TEXT NOT NULL
            );
        """)

    def close(self):
        self.db.close()

    def _audit(self, entry_id: str, action: str, now: int, details: dict):
        self.db.execute("INSERT INTO audit(entry_id,action,timestamp,details) VALUES(?,?,?,?)",
                        (entry_id, action, now, json.dumps(details, ensure_ascii=False)))

    def _validate_event_time(self, entry_id: str, now: int):
        if type(now) is not int or now < 0:
            raise ValueError("Horodatage invalide.")
        latest = self.db.execute("SELECT max(timestamp) FROM audit WHERE entry_id=?", (entry_id,)).fetchone()[0]
        if latest is not None and now < latest:
            raise ValueError("L'opération ne peut pas précéder le dernier événement de cette écriture.")

    def get(self, entry_id: str) -> dict:
        row = self.db.execute("SELECT * FROM entries WHERE id=?", (entry_id,)).fetchone()
        if row is None:
            raise ValueError("Écriture inconnue.")
        return dict(row)

    def propose(self, merchant: str, proposal: Proposal, request_key: str, now: int) -> dict:
        if (proposal.kind not in {"sale", "expense"} or proposal.channel not in {"cash", "mobile_money"}
                or type(proposal.amount) is not int or not 0 < proposal.amount <= 100_000_000
                or not merchant or not request_key or type(now) is not int or now < 0):
            raise ValueError("Proposition invalide.")
        day = datetime.fromtimestamp(now, BENIN_TZ).date().isoformat()
        with self.db:
            self.db.execute("BEGIN IMMEDIATE")
            existing = self.db.execute("SELECT * FROM entries WHERE request_key=?", (request_key,)).fetchone()
            if existing:
                if (existing["merchant"], existing["kind"], existing["amount"], existing["channel"], existing["source"]) != (
                        merchant, proposal.kind, proposal.amount, proposal.channel, proposal.source):
                    raise ValueError("Cette clé de requête correspond déjà à une autre proposition.")
                return dict(existing)
            entry_id = uuid4().hex
            self.db.execute("""INSERT INTO entries
                (id,request_key,merchant,kind,amount,channel,source,business_day,status,created_at)
                VALUES(?,?,?,?,?,?,?,?, 'proposed',?)""",
                (entry_id, request_key, merchant, proposal.kind, proposal.amount,
                 proposal.channel, proposal.source, day, now))
            self._audit(entry_id, "proposed", now, {})
        return self.get(entry_id)

    def confirm(self, entry_id: str, expected_version: int, now: int) -> dict:
        with self.db:
            self.db.execute("BEGIN IMMEDIATE")
            entry = self.get(entry_id)
            self._validate_event_time(entry_id, now)
            if entry["status"] == "confirmed":
                return entry  # un rejeu n'ajoute ni écriture ni mouvement
            if entry["status"] != "proposed" or entry["version"] != expected_version or now < entry["created_at"]:
                raise ValueError("Confirmation périmée ou écriture annulée.")
            self.db.execute("""UPDATE entries SET status='confirmed', confirmed_at=?, version=version+1
                               WHERE id=?""", (now, entry_id))
            self._audit(entry_id, "confirmed", now, {})
        return self.get(entry_id)

    def cancel(self, entry_id: str, now: int) -> dict:
        with self.db:
            self.db.execute("BEGIN IMMEDIATE")
            entry = self.get(entry_id)
            self._validate_event_time(entry_id, now)
            if now < entry["created_at"]:
                raise ValueError("L'annulation ne peut pas précéder la proposition.")
            if entry["status"] != "cancelled":
                self.db.execute("""UPDATE entries SET status='cancelled', matched_payment=NULL,
                                   match_status='cancelled', version=version+1 WHERE id=?""", (entry_id,))
                self._audit(entry_id, "cancelled", now, {})
        return self.get(entry_id)

    def add_payment(self, payment_id: str, merchant: str, amount: int, direction: str, timestamp: int):
        if (type(amount) is not int or not 0 < amount <= 100_000_000
                or type(timestamp) is not int or timestamp < 0
                or direction not in {"incoming", "outgoing"} or not payment_id or not merchant):
            raise ValueError("Paiement invalide : identifiants, montant entier, sens et horodatage sont requis.")
        with self.db:
            self.db.execute("INSERT INTO payments VALUES(?,?,?,?,?)",
                            (payment_id, merchant, amount, direction, timestamp))

    def reconcile(self, entry_id: str, now: int) -> dict:
        with self.db:
            self.db.execute("BEGIN IMMEDIATE")
            entry = self.get(entry_id)
            self._validate_event_time(entry_id, now)
            if entry["status"] != "confirmed":
                raise ValueError("Une écriture doit être confirmée avant rapprochement.")
            if entry["matched_payment"]:
                return entry
            if entry["channel"] == "cash":
                status, payment = "cash", None
            else:
                direction = "incoming" if entry["kind"] == "sale" else "outgoing"
                candidates = self.db.execute("""SELECT p.* FROM payments p
                    WHERE p.merchant=? AND p.amount=? AND p.direction=? AND p.timestamp<=?
                    AND p.id NOT IN (SELECT matched_payment FROM entries WHERE matched_payment IS NOT NULL)
                    ORDER BY p.timestamp""", (entry["merchant"], entry["amount"], direction, now)).fetchall()
                candidates = [p for p in candidates if
                    datetime.fromtimestamp(p["timestamp"], BENIN_TZ).date().isoformat() == entry["business_day"]]
                # Deux écritures identiques confirmées sont elles aussi ambiguës.
                competing = self.db.execute("""SELECT count(*) FROM entries WHERE merchant=? AND amount=?
                    AND kind=? AND business_day=? AND channel='mobile_money' AND status='confirmed'
                    AND matched_payment IS NULL""", (entry["merchant"], entry["amount"], entry["kind"],
                                                       entry["business_day"])).fetchone()[0]
                payment = candidates[0]["id"] if len(candidates) == 1 and competing == 1 else None
                status = "matched" if payment else "ambiguous" if candidates else "unmatched"
            self.db.execute("UPDATE entries SET matched_payment=?,match_status=? WHERE id=?",
                            (payment, status, entry_id))
            self._audit(entry_id, "reconciled", now, {"status": status, "payment": payment})
        return self.get(entry_id)

    def entries(self, merchant: str) -> list[dict]:
        return [dict(r) for r in self.db.execute(
            "SELECT * FROM entries WHERE merchant=? ORDER BY created_at DESC, rowid DESC", (merchant,))]

    def summary(self, merchant: str) -> dict:
        rows = [e for e in self.entries(merchant) if e["status"] == "confirmed"]
        sales = sum(e["amount"] for e in rows if e["kind"] == "sale")
        expenses = sum(e["amount"] for e in rows if e["kind"] == "expense")
        return {"sales": sales, "expenses": expenses, "net_recorded": sales - expenses,
                "confirmed_count": len(rows), "matched_count": sum(e["match_status"] == "matched" for e in rows)}
