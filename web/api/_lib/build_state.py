"""Outil de build (hors runtime) : fige l'état nécessaire au score dans state.json.

Usage : python3 api/_lib/build_state.py <chemin_du_depot_nukun>
Rejoue generate_stress(seed, size) + causal_matrix, confirme les déclarations
connues avant now = 30 j, puis n'exporte que ce que History/snapshot lisent à now :
date de première apparition de chaque compte, transactions de la fenêtre de 7 jours,
déclarations rapprochées de ces transactions, et les 3 modèles utilisés.
"""
import json
import sys
from pathlib import Path

REPO = Path(sys.argv[1])
sys.path.insert(0, str(REPO))
from nukun.features import causal_matrix  # noqa: E402
from nukun.stress_data import generate_stress  # noqa: E402

art = json.loads((REPO / "artifacts/stress_models.json").read_text())
sd = generate_stress(art["seed"], art["size"])
ds = sd.dataset
assert ds.digest() == art["dataset_sha256"], "dataset mismatch"
_, history = causal_matrix(ds.transactions, ds.declarations)
now = 30 * 86400
for d in ds.declarations:
    if d.known_at < now:
        history.confirm(d, now)

lo = now - history.window
window = [t for t in ds.transactions if lo <= t.timestamp < now]
ids = {t.id for t in window}
matches = [[m.id, m.merchant, m.transaction_id, m.amount, m.known_at]
           for tid, m in history.matches.items() if tid in ids]
notable = sorted(a for a, p in ds.profiles.items() if p in ("merchant", "mule", "imitator", "agent"))
keep = ("sage_history", "sage_akwe", "logistic_history")
state = {
    "seed": art["seed"], "size": art["size"], "dataset_sha256": art["dataset_sha256"],
    "now": now, "window": history.window, "last_observed": history.last_observed,
    "first_seen": {k: a.first_seen for k, a in history.accounts.items()},
    "transactions": [[t.id, t.timestamp, t.sender, t.receiver, t.amount] for t in window],
    "matches": matches, "notable": notable,
    "models": {k: art["models"][k] for k in keep},
    "thresholds": {k: art["thresholds"][k] for k in keep},
}
out = Path(__file__).with_name("state.json")
out.write_text(json.dumps(state, separators=(",", ":")))
print(out, out.stat().st_size, "octets", len(window), "tx", len(matches), "matches", len(state["first_seen"]), "comptes")
