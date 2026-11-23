"""Régression logistique NumPy, artefacts JSON portables sans pickle."""

from dataclasses import dataclass
import numpy as np


def sigmoid(x):
    return 1.0 / (1.0 + np.exp(-np.clip(x, -35, 35)))


@dataclass
class LogisticRisk:
    mean: np.ndarray
    scale: np.ndarray
    weights: np.ndarray
    bias: float
    columns: list[int]

    @classmethod
    def fit(cls, x: np.ndarray, y: np.ndarray, columns: list[int], steps: int = 600):
        if len(np.unique(y)) != 2:
            raise ValueError("Les deux classes sont nécessaires à l'entraînement.")
        selected = x[:, columns]
        mean, scale = selected.mean(axis=0), selected.std(axis=0)
        scale = np.where(scale < 1e-8, 1, scale)
        z = (selected - mean) / scale
        w = np.zeros(len(columns))
        b = 0.0
        sample_weight = np.where(y == 1, .5 / y.mean(), .5 / (1 - y.mean()))
        # Descente Adam pleine passe ; poids de classes définis sur train seulement.
        mw, vw = np.zeros_like(w), np.zeros_like(w)
        mb, vb = 0.0, 0.0
        for step in range(1, steps + 1):
            error = (sigmoid(z @ w + b) - y) * sample_weight
            gw = z.T @ error / len(y) + .005 * w
            gb = error.mean()
            mw, vw = .9 * mw + .1 * gw, .999 * vw + .001 * gw * gw
            mb, vb = .9 * mb + .1 * gb, .999 * vb + .001 * gb * gb
            w -= .035 * (mw / (1 - .9 ** step)) / (np.sqrt(vw / (1 - .999 ** step)) + 1e-8)
            b -= .035 * (mb / (1 - .9 ** step)) / (np.sqrt(vb / (1 - .999 ** step)) + 1e-8)
        return cls(mean, scale, w, float(b), columns)

    def score(self, x: np.ndarray) -> np.ndarray:
        # Ces sorties pondérées ne sont pas des probabilités calibrées.
        return sigmoid(((np.atleast_2d(x)[:, self.columns] - self.mean) / self.scale) @ self.weights + self.bias)

    def to_dict(self) -> dict:
        return {"type": "numpy_logistic_v1", "mean": self.mean.tolist(), "scale": self.scale.tolist(),
                "weights": self.weights.tolist(), "bias": self.bias, "columns": self.columns}

    @classmethod
    def from_dict(cls, obj: dict):
        if obj["type"] != "numpy_logistic_v1":
            raise ValueError("Type d'artefact inconnu.")
        return cls(np.array(obj["mean"]), np.array(obj["scale"]), np.array(obj["weights"]),
                   float(obj["bias"]), list(obj["columns"]))


def operating_threshold(y: np.ndarray, scores: np.ndarray, recall_target: float = .8) -> float:
    if not 0 < recall_target <= 1 or not np.any(y == 1):
        raise ValueError("Rappel cible invalide ou absence de fraude dans la validation.")
    positive_scores = np.sort(scores[y == 1])[::-1]
    return float(positive_scores[int(np.ceil(recall_target * len(positive_scores))) - 1])


def average_precision(y: np.ndarray, scores: np.ndarray) -> float:
    """AP au niveau des seuils distincts, invariance à l'ordre des ex aequo."""
    if not np.any(y):
        return 0.0
    order = np.argsort(-scores, kind="stable")
    ranked, sorted_scores = y[order], scores[order]
    ends = np.r_[np.where(np.diff(sorted_scores) != 0)[0], len(y) - 1]
    tp = np.cumsum(ranked)[ends]
    recall = tp / y.sum()
    precision = tp / (ends + 1)
    return float(np.sum(np.diff(np.r_[0, recall]) * precision))


def metrics(y: np.ndarray, scores: np.ndarray, threshold: float, merchant_mask: np.ndarray,
            imitator_mask: np.ndarray) -> dict:
    alert = scores >= threshold
    tp, fp = int(np.sum(alert & (y == 1))), int(np.sum(alert & (y == 0)))
    legitimate_merchants = merchant_mask & (y == 0)
    imitators = imitator_mask & (y == 1)
    return {
        "n": len(y), "fraud_count": int(y.sum()), "alerts": int(alert.sum()),
        "true_positives": tp, "false_positives": fp,
        "recall": tp / max(1, int(y.sum())), "precision": tp / max(1, int(alert.sum())),
        "average_precision": average_precision(y, scores), "threshold": threshold,
        "merchant_count": int(legitimate_merchants.sum()),
        "merchant_false_positives": int(np.sum(alert & legitimate_merchants)),
        "merchant_fpr": float(np.mean(alert[legitimate_merchants])) if legitimate_merchants.any() else None,
        "imitator_count": int(imitators.sum()),
        "imitator_recall": float(np.mean(alert[imitators])) if imitators.any() else None,
    }
