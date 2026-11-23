"""Bootstrap exploratoire par compte destinataire, tirages appariés entre variantes."""

import numpy as np


def clustered_intervals(y, receivers, merchant_mask, alerts: dict[str, np.ndarray], repeats=400, seed=0):
    if repeats < 20 or len(y) == 0:
        raise ValueError("Prévoir un échantillon et au moins 20 tirages bootstrap.")
    _, group = np.unique(receivers, return_inverse=True)
    n = int(group.max()) + 1
    rng = np.random.default_rng(seed)
    weights = rng.multinomial(n, np.ones(n) / n, size=repeats)
    def totals(mask):
        return weights @ np.bincount(group, weights=np.asarray(mask, dtype=float), minlength=n)
    positive, merchants = totals(y == 1), totals(merchant_mask & (y == 0))
    def ratios(numerator, denominator):
        return np.divide(numerator, denominator, out=np.full(repeats, np.nan), where=denominator > 0)
    def interval(values):
        valid = values[np.isfinite(values)]
        if not len(valid):
            return None
        return {"low": float(np.quantile(valid, .025)), "high": float(np.quantile(valid, .975)),
                "valid_repeats": len(valid)}
    distributions = {}
    for name, alert in alerts.items():
        tp = totals(alert & (y == 1))
        distributions[name] = {
            "recall": ratios(tp, positive), "precision": ratios(tp, totals(alert)),
            "merchant_fpr": ratios(totals(alert & merchant_mask & (y == 0)), merchants),
        }
    result = {"unit": "receiver_account", "groups": n, "repeats": repeats,
              "models": {name: {metric: interval(values) for metric, values in stats.items()}
                         for name, stats in distributions.items()}, "paired_context_deltas": {}}
    for prefix in ("logistic", "mlp", "sage"):
        before, after = f"{prefix}_history", f"{prefix}_akwe"
        if before in distributions and after in distributions:
            result["paired_context_deltas"][prefix] = {
                key: interval(distributions[after][key] - distributions[before][key])
                for key in ("recall", "merchant_fpr", "precision")}
    return result
