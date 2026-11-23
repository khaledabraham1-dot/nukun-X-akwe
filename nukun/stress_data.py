"""Simulation de stress v1 : distributions superposées et nouveaux comptes au jour 24."""

from dataclasses import dataclass

import numpy as np

from nukun.simulation import Dataset, Declaration, Transaction


@dataclass
class StressData:
    dataset: Dataset
    cohorts: dict[str, dict]


def generate_stress(seed: int, size: int = 18000) -> StressData:
    if size < 100:
        raise ValueError("Au moins 100 transactions sont nécessaires.")
    rng = np.random.default_rng(seed)
    clients = np.array([f"C{i:04d}" for i in range(480)])
    groups = {"merchant": [f"M{i:03d}" for i in range(65)],
              "agent": [f"A{i:03d}" for i in range(12)],
              "mule": [f"X{i:03d}" for i in range(14)],
              "imitator": [f"I{i:03d}" for i in range(14)]}
    actors = np.array([a for names in groups.values() for a in names])
    profiles = {str(c): "client" for c in clients}
    profiles.update({a: profile for profile, names in groups.items() for a in names})
    cohorts = {}
    # Variabilité individuelle : aucune simple valeur de couverture ne code le label.
    for profile, names in groups.items():
        cold = set(names[-max(2, len(names) // 5):])
        for actor in names:
            enrolled = bool(rng.random() < .78)
            cohorts[actor] = {
                "activation": 24 * 86400 if actor in cold else 0,
                "akwe_enrolled": enrolled,
                "coverage": float(rng.uniform(.35, .95)) if enrolled else 0.0,
                "accuracy": float(rng.uniform(.75, .99)),
                "repeat_rate": float(rng.uniform(.15, .65)),
                "outgoing_share": float(rng.uniform(.2, .6)),
                "activity": float(rng.lognormal(0, .65)),
            }
    pools = {}
    for actor in actors:
        # Les fraudeurs partagent un groupe de contreparties ; leurs attributs
        # individuels ne sont pas labellisés et leurs paiements restent légitimes.
        source = clients[360:430] if profiles[actor] in {"mule", "imitator"} else clients[:430]
        pools[str(actor)] = rng.choice(source, size=28, replace=False)
    times = np.sort(rng.integers(0, 30 * 86400, size=size))
    txs, declarations, labels = [], [], []
    inbound: dict[str, list[Transaction]] = {}
    for i, ts in enumerate(times):
        now = int(ts)
        active = [str(a) for a in actors if cohorts[str(a)]["activation"] <= now]
        weights = np.array([cohorts[a]["activity"] for a in active])
        actor = str(rng.choice(active, p=weights / weights.sum()))
        cfg = cohorts[actor]
        clients_now = clients if now >= 24 * 86400 else clients[:430]
        client = str(rng.choice(clients_now))
        if rng.random() < cfg["repeat_rate"]:
            client = str(rng.choice(pools[actor]))
        amount = int(max(100, round(rng.lognormal(8.8, 1.0) / 100) * 100))
        is_outgoing = bool(inbound.get(actor)) and rng.random() < cfg["outgoing_share"]
        if is_outgoing:
            prior = inbound[actor][-1]
            amount = max(100, int(prior.amount * rng.uniform(.3, 1.3) / 100) * 100)
            sender, receiver = actor, client
        else:
            sender, receiver = client, actor
        tx = Transaction(f"S{i:07d}", now, sender, receiver, amount)
        txs.append(tx)
        labels.append(int(profiles[receiver] in {"mule", "imitator"}))
        if not is_outgoing:
            inbound.setdefault(actor, []).append(tx)
            if rng.random() < cfg["coverage"]:
                declared_amount = amount if rng.random() < cfg["accuracy"] else amount + 500
                declarations.append(Declaration(f"DS{i:07d}", actor, tx.id, declared_amount,
                                                now + int(rng.integers(60, 14400))))
    ds = Dataset(txs, sorted(declarations, key=lambda d: d.known_at), labels, profiles, seed)
    return StressData(ds, cohorts)
