"""Portefeuille de démonstration : aucune connexion à un opérateur."""

from dataclasses import dataclass
from uuid import uuid4


@dataclass(frozen=True)
class TransferRequest:
    id: str
    receiver: str
    amount: int
    score: float
    threshold: float


class DemoWallet:
    def __init__(self, balance: int = 100000):
        self.balance = balance
        self.pending: TransferRequest | None = None
        self.completed: dict[str, TransferRequest] = {}

    def prepare(self, receiver: str, amount: int, score: float, threshold: float) -> TransferRequest:
        if type(amount) is not int or not 0 < amount <= self.balance or not receiver:
            raise ValueError("Montant invalide ou solde fictif insuffisant.")
        if not (0 <= score <= 1 and 0 <= threshold <= 1):
            raise ValueError("Score de risque invalide.")
        self.pending = TransferRequest(uuid4().hex, receiver, amount, score, threshold)
        return self.pending

    def confirm(self, request_id: str, warning_acknowledged: bool = False) -> TransferRequest:
        if request_id in self.completed:
            return self.completed[request_id]
        request = self.pending
        if request is None or request.id != request_id:
            raise ValueError("Demande absente ou remplacée. Relancez l'analyse.")
        if request.score >= request.threshold and not warning_acknowledged:
            raise ValueError("Veuillez confirmer avoir lu l'avertissement.")
        if self.balance < request.amount:
            raise ValueError("Solde fictif insuffisant.")
        self.balance -= request.amount
        self.completed[request.id] = request
        self.pending = None
        return request
