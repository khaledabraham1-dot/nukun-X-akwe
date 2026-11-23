"""Transactions fictives et déclarations imparfaites, sans données personnelles."""

from dataclasses import asdict, dataclass
import hashlib
import json
from pathlib import Path

import numpy as np


@dataclass(frozen=True)
class Transaction:
    id: str
    timestamp: int  # secondes depuis le début de la simulation
    sender: str
    receiver: str
    amount: int  # XOF entiers

    def __post_init__(self):
        if not isinstance(self.amount, int) or isinstance(self.amount, bool) or self.amount <= 0:
            raise ValueError("Le montant doit être un entier XOF strictement positif.")
        if self.sender == self.receiver:
            raise ValueError("Les deux comptes doivent être distincts.")
        if self.timestamp < 0:
            raise ValueError("Horodatage invalide.")


@dataclass(frozen=True)
class Declaration:
    id: str
    merchant: str
    transaction_id: str
    amount: int
    known_at: int


@dataclass
class Dataset:
    transactions: list[Transaction]
    declarations: list[Declaration]
    labels: list[int]
    profiles: dict[str, str]  # évaluation seulement, jamais passé au prédicteur
    seed: int

    def digest(self) -> str:
        payload = {
            "transactions": [asdict(t) for t in self.transactions],
            "declarations": [asdict(d) for d in self.declarations],
            "labels": self.labels, "profiles": self.profiles, "seed": self.seed,
        }
        return hashlib.sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest()

    def save(self, directory: Path):
        directory.mkdir(parents=True, exist_ok=True)
        for filename, rows in [
            ("transactions.jsonl", [asdict(t) for t in self.transactions]),
            ("declarations.jsonl", [asdict(d) for d in self.declarations]),
            ("evaluation_only.jsonl", [
                {"transaction_id": t.id, "is_fraud": y, "receiver_profile": self.profiles[t.receiver]}
                for t, y in zip(self.transactions, self.labels, strict=True)
            ]),
        ]:
            with (directory / filename).open("w", encoding="utf-8") as stream:
                for row in rows:
                    stream.write(json.dumps(row, ensure_ascii=False) + "\n")


def generate(seed: int = 2026, size: int = 30000, days: int = 30) -> Dataset:
    """Générateur de stress synthétique ; il ne représente pas une population béninoise.

    Les fraudeurs peuvent tenir un faux cahier ; les commerçants peuvent disperser
    leurs recettes et manquer des déclarations. Les profils ont des distributions
    qui se chevauchent. La cible est le paiement dirigé vers un compte du scénario
    frauduleux, pas une vérité issue d'une enquête terrain.
    """
    if size < 100 or days < 2:
        raise ValueError("Prévoir au moins 100 transactions et 2 jours.")
    rng = np.random.default_rng(seed)
    clients = [f"C{i:04d}" for i in range(500)]
    shops = [f"M{i:03d}" for i in range(45)]
    agents = [f"A{i:03d}" for i in range(10)]
    mules = [f"X{i:03d}" for i in range(12)]
    mimics = [f"I{i:03d}" for i in range(8)]
    recipients = clients + shops + agents + mules + mimics
    profiles = {a: "client" for a in clients}
    profiles.update({a: "merchant" for a in shops})
    profiles.update({a: "agent" for a in agents})
    profiles.update({a: "mule" for a in mules})
    profiles.update({a: "imitator" for a in mimics})
    weights = np.array([.40 / len(clients)] * len(clients)
                       + [.43 / len(shops)] * len(shops)
                       + [.10 / len(agents)] * len(agents)
                       + [.04 / len(mules)] * len(mules)
                       + [.03 / len(mimics)] * len(mimics))
    selected = rng.choice(len(recipients), size=size, p=weights)
    times = np.sort(rng.integers(0, days * 86400, size=size))
    transactions, declarations, labels = [], [], []
    recent_inbound: dict[str, list[Transaction]] = {}
    regular_customers = {shop: rng.choice(clients, size=25, replace=False).tolist() for shop in shops}
    for i, (recipient_index, ts) in enumerate(zip(selected, times, strict=True)):
        receiver = recipients[int(recipient_index)]
        profile = profiles[receiver]
        sender = str(rng.choice(clients))
        if profile == "merchant" and rng.random() < .55:
            sender = str(rng.choice(regular_customers[receiver]))
        amount = int(max(100, round(rng.lognormal(8.8, .95) / 100) * 100))
        # Une partie des mules redistribue rapidement, mais pas toutes ; les
        # commerçants et agents font aussi des sorties légitimes fréquentes.
        pools = mules + mimics + shops + agents
        active = [a for a in pools if recent_inbound.get(a)]
        if active and rng.random() < .23:
            candidate = str(rng.choice(active))
            prior = recent_inbound[candidate][-1]
            elapsed = int(ts) - prior.timestamp
            probability = .85 if profiles[candidate] in {"mule", "imitator"} else .38
            if elapsed < 86400 and rng.random() < probability:
                sender = candidate
                receiver = str(rng.choice(clients))
                amount = max(100, int(prior.amount * rng.uniform(.45, 1.0) / 100) * 100)
                profile = "client"
        if sender == receiver:
            sender = clients[(clients.index(sender) + 1) % len(clients)]
        tx = Transaction(f"T{i:07d}", int(ts), sender, receiver, amount)
        transactions.append(tx)
        labels.append(int(profile in {"mule", "imitator"}))
        recent_inbound.setdefault(receiver, []).append(tx)
        # L'adhésion n'est pas obligatoire et varie entre commerçants.
        coverage = .72 if profile == "merchant" else .62 if profile == "imitator" else .12
        if profile in {"merchant", "imitator", "mule", "agent"} and rng.random() < coverage:
            declared_amount = amount if rng.random() < .87 else amount + 500
            declarations.append(Declaration(
                f"D{i:07d}", receiver, tx.id, declared_amount,
                int(ts) + int(rng.integers(60, 10800)),
            ))
    return Dataset(transactions, sorted(declarations, key=lambda d: d.known_at), labels, profiles, seed)
