"""Moteur de score NUKÚN pour l'API : GraphSAGE entraîné rejoué en NumPy, sans PyTorch.

L'état (historique causal à now = 30 j, modèles) est chargé une seule fois par
instance (cache module). Chaque appel reconstruit l'instantané du graphe avec la
transaction proposée et refait le forward complet des deux couches GraphSAGE.
"""
import json
import sys
from pathlib import Path
from time import perf_counter

import numpy as np

_HERE = Path(__file__).resolve().parent
if str(_HERE) not in sys.path:
    sys.path.insert(0, str(_HERE))

from nukun.features import Account, History  # noqa: E402
from nukun.graph import snapshot  # noqa: E402
from nukun.simulation import Declaration, Transaction  # noqa: E402

VERSION = "1.0.0"
SENDER = "C0000"
MODEL_LABEL = "GraphSAGE (poids entraînés, rejoués en NumPy)"
MIN_AMOUNT, MAX_AMOUNT = 100, 2_000_000


def _relu(x):
    return np.maximum(x, 0)


def _mean_adj(edges, n, reverse=False):
    row, col = (edges[0], edges[1]) if reverse else (edges[1], edges[0])
    deg = np.bincount(row, minlength=n)
    a = np.zeros((n, n), dtype=np.float64)
    np.add.at(a, (row, col), 1.0 / np.maximum(1, deg[row]))
    return a


class NpSage:
    def __init__(self, obj):
        self.o = obj
        self.s = {k: np.array(v, dtype=np.float64) for k, v in obj["state"].items()}
        self.node_mean, self.node_scale = np.array(obj["node_mean"]), np.array(obj["node_scale"])
        self.tx_mean, self.tx_scale = np.array(obj["tx_mean"]), np.array(obj["tx_scale"])

    def _lin(self, x, name):
        return x @ self.s[name + ".weight"].T + self.s[name + ".bias"]

    def predict(self, snap, xrow, a_in, a_out):
        ctx = self.o["context"]
        node = (snap.node_x[:, :10 if ctx else 9].astype(np.float64) - self.node_mean) / self.node_scale
        tx = (xrow[:, :12 if ctx else 9].astype(np.float64) - self.tx_mean) / self.tx_scale

        def layer(x, name):
            if self.o["aggregate"]:
                ni, no = a_in @ x, a_out @ x
            else:
                ni, no = np.zeros_like(x), np.zeros_like(x)
            return _relu(self._lin(np.concatenate([x, ni, no], 1), name))

        h = layer(layer(node, "first"), "second")
        h = h / np.maximum(np.linalg.norm(h, axis=1, keepdims=True), 1e-12)
        z = np.concatenate([h[snap.senders], h[snap.receivers], tx], 1)
        z = self._lin(_relu(self._lin(z, "head.0")), "head.2")
        return 1 / (1 + np.exp(-z[:, 0]))


def _logistic(obj, xrow):
    x = xrow[:, :len(obj["columns"])]
    z = ((x - np.array(obj["mean"])) / np.array(obj["scale"])) @ np.array(obj["weights"]) + obj["bias"]
    return 1 / (1 + np.exp(-z))


class Engine:
    def __init__(self, state):
        self.now = state["now"]
        self.notable = state["notable"]
        self.thresholds = state["thresholds"]
        h = History(window=state["window"])
        for name, first in state["first_seen"].items():
            h.accounts[name] = Account(first)
        for tid, ts, s, r, amt in state["transactions"]:
            t = Transaction(tid, ts, s, r, amt)
            h.accounts[r].incoming.append(t)
            h.accounts[s].outgoing.append(t)
            h.transactions[tid] = t
        for mid, merchant, tid, amt, known in state["matches"]:
            h.matches[tid] = Declaration(mid, merchant, tid, amt, known)
        h.last_observed = state["last_observed"]
        self.history = h
        m = state["models"]
        self.sage, self.sage_akwe, self.logistic = NpSage(m["sage_history"]), NpSage(m["sage_akwe"]), m["logistic_history"]

    def accounts(self):
        return sorted(self.history.accounts)

    def known(self, name):
        return name in self.history.accounts and name != SENDER

    def score(self, receiver, amount):
        t0 = perf_counter()
        h, now = self.history, self.now
        tx = Transaction("P0", now, SENDER, receiver, amount)
        x = np.atleast_2d(h.vector(tx))
        snap = snapshot(h, [tx], now, np.arange(1))
        n = len(snap.names)
        a_in, a_out = _mean_adj(snap.edges, n), _mean_adj(snap.edges, n, reverse=True)
        s1 = float(self.sage.predict(snap, x, a_in, a_out)[0])
        s2 = float(self.sage_akwe.predict(snap, x, a_in, a_out)[0])
        s3 = float(_logistic(self.logistic, x)[0])
        ms = (perf_counter() - t0) * 1000
        facts = {k: (round(v, 3) if isinstance(v, float) else v) for k, v in h.describe(tx).items()}
        acc = h.accounts.get(receiver)
        lo = now - h.window
        inc = [t for t in acc.incoming if lo <= t.timestamp < now] if acc else []
        out = [t for t in acc.outgoing if lo <= t.timestamp < now] if acc else []
        return {
            "receiver": receiver, "amount": amount,
            "scores": {"sage": round(s1, 4), "sage_akwe": round(s2, 4), "logistic": round(s3, 4)},
            "thresholds": self.thresholds,
            "alert": s1 >= self.thresholds["sage_history"],
            "facts": facts,
            "neighborhood": {
                "in": [[t.sender, t.amount, round((now - t.timestamp) / 3600, 1)] for t in inc[-40:]],
                "out": [[t.receiver, t.amount, round((now - t.timestamp) / 3600, 1)] for t in out[-25:]],
            },
            "graph": {"nodes": n, "edges": int(snap.edges.shape[1])},
            "ms": round(ms, 1),
            "model": MODEL_LABEL,
        }


_ENGINE = None


def get_engine():
    global _ENGINE
    if _ENGINE is None:
        _ENGINE = Engine(json.loads((_HERE / "state.json").read_text()))
    return _ENGINE


def parse_amount(raw):
    try:
        value = int(str(raw).strip())
    except (TypeError, ValueError):
        return None
    return value if MIN_AMOUNT <= value <= MAX_AMOUNT else None
