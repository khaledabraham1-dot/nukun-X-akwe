"""Caractéristiques causales : le score précède toujours l'observation du paiement."""

from collections import Counter, deque
from dataclasses import dataclass, field
import math

import numpy as np

from nukun.simulation import Declaration, Transaction


BASE_FEATURES = [
    "log_amount", "log_incoming_count", "log_unique_senders", "outgoing_to_incoming",
    "repeat_customer_share", "log_account_age_days", "amount_over_mean",
    "recent_outgoing_share", "log_sender_outgoing_count",
]
CONTEXT_FEATURES = ["matched_sales_share", "context_x_turnover", "context_x_repeat"]
FEATURE_NAMES = BASE_FEATURES + CONTEXT_FEATURES


@dataclass
class Account:
    first_seen: int
    incoming: deque = field(default_factory=deque)
    outgoing: deque = field(default_factory=deque)


class History:
    def __init__(self, window: int = 7 * 86400):
        self.window = window
        self.accounts: dict[str, Account] = {}
        self.transactions: dict[str, Transaction] = {}
        self.matches: dict[str, Declaration] = {}
        self.last_observed = -1

    def _account(self, name: str, now: int) -> Account:
        account = self.accounts.setdefault(name, Account(now))
        for queue in (account.incoming, account.outgoing):
            while queue and queue[0].timestamp < now - self.window:
                queue.popleft()
        return account

    def observe(self, tx: Transaction):
        if tx.id in self.transactions:
            raise ValueError("Transaction déjà observée.")
        if tx.timestamp < self.last_observed:
            raise ValueError("L'historique doit être chronologique.")
        self._account(tx.receiver, tx.timestamp).incoming.append(tx)
        self._account(tx.sender, tx.timestamp).outgoing.append(tx)
        self.transactions[tx.id] = tx
        self.last_observed = tx.timestamp

    def confirm(self, declaration: Declaration, now: int) -> bool:
        tx = self.transactions.get(declaration.transaction_id)
        if (tx is None or tx.id in self.matches or declaration.known_at >= now
                or declaration.known_at < tx.timestamp or tx.timestamp >= now
                or tx.receiver != declaration.merchant or tx.amount != declaration.amount):
            return False
        self.matches[tx.id] = declaration
        return True

    def describe(self, tx: Transaction) -> dict:
        if tx.timestamp < self.last_observed:
            raise ValueError("Un score passé ne peut utiliser l'historique futur.")
        # La lecture ne modifie pas l'état : plusieurs évaluations d'une même
        # proposition restent identiques et n'altèrent pas l'historique partagé.
        a = self.accounts.get(tx.receiver, Account(tx.timestamp))
        s = self.accounts.get(tx.sender, Account(tx.timestamp))
        # Même horodatage : tous les paiements à t sont exclus du score à t.
        incoming = [t for t in a.incoming if tx.timestamp - self.window <= t.timestamp < tx.timestamp]
        outgoing = [t for t in a.outgoing if tx.timestamp - self.window <= t.timestamp < tx.timestamp]
        senders = Counter(t.sender for t in incoming)
        total_in = sum(t.amount for t in incoming)
        total_out = sum(t.amount for t in outgoing)
        repeat = sum(n for n in senders.values() if n > 1) / max(1, len(incoming))
        matched = sum(t.amount for t in incoming if t.id in self.matches
                      and self.matches[t.id].known_at < tx.timestamp)
        recent = sum(t.amount for t in outgoing if t.timestamp >= tx.timestamp - 86400)
        return {
            "incoming_count": len(incoming), "unique_senders": len(senders),
            "incoming_amount": total_in, "outgoing_amount": total_out,
            "turnover": min(3.0, total_out / max(1, total_in)), "repeat_share": repeat,
            "account_age_days": max(0, (tx.timestamp - a.first_seen) / 86400),
            "amount_over_mean": min(10.0, tx.amount / max(1, total_in / max(1, len(incoming)))),
            "recent_outgoing_share": min(3.0, recent / max(1, total_in)),
            "sender_outgoing_count": sum(tx.timestamp - self.window <= t.timestamp < tx.timestamp for t in s.outgoing),
            "matched_share": min(1.0, matched / max(1, total_in)),
            "matched_count": sum(t.id in self.matches and self.matches[t.id].known_at < tx.timestamp
                                 for t in incoming),
        }

    def vector(self, tx: Transaction) -> np.ndarray:
        d = self.describe(tx)
        return np.array([
            math.log1p(tx.amount), math.log1p(d["incoming_count"]),
            math.log1p(d["unique_senders"]), d["turnover"], d["repeat_share"],
            math.log1p(d["account_age_days"]), d["amount_over_mean"],
            d["recent_outgoing_share"], math.log1p(d["sender_outgoing_count"]),
            d["matched_share"], d["matched_share"] * d["turnover"],
            d["matched_share"] * d["repeat_share"],
        ], dtype=np.float64)


def causal_matrix(transactions: list[Transaction], declarations: list[Declaration]):
    history = History()
    declarations = sorted(declarations, key=lambda d: d.known_at)
    cursor, rows = 0, []
    for tx in transactions:
        while cursor < len(declarations) and declarations[cursor].known_at < tx.timestamp:
            history.confirm(declarations[cursor], tx.timestamp)
            cursor += 1
        rows.append(history.vector(tx))
        history.observe(tx)
    return np.array(rows), history


def rule_score(vector: np.ndarray) -> float:
    """Référence fixe ; score de classement, pas probabilité de fraude."""
    inbound = math.expm1(vector[1])
    return float(np.clip(.10 + .22 * (inbound >= 5) + .24 * min(1, vector[3])
                         + .22 * (1 - vector[4]) * (inbound >= 3)
                         + .18 * min(1, vector[7]), 0, 1))
