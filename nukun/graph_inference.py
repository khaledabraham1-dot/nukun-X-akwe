"""Rejeu des poids GraphSAGE exportés, sans réentraînement ni transfert financier."""

import json
from pathlib import Path
from time import perf_counter

import numpy as np

from nukun.features import causal_matrix
from nukun.graph import GraphModel, snapshot
from nukun.simulation import Transaction
from nukun.stress_data import generate_stress


ROOT = Path(__file__).resolve().parents[1]


def load_research_engine(artifact: dict):
    dataset = generate_stress(artifact["seed"], artifact["size"]).dataset
    if dataset.digest() != artifact["dataset_sha256"]:
        raise ValueError("Les données régénérées ne correspondent pas au modèle de graphe.")
    _, history = causal_matrix(dataset.transactions, dataset.declarations)
    now = 30 * 86400
    for declaration in dataset.declarations:
        if declaration.known_at < now:
            history.confirm(declaration, now)
    models = {name: GraphModel.from_dict(obj) for name, obj in artifact["models"].items()
              if obj["type"] == "directed_mean_graphsage_v1"}
    return history, models, now


def analyze(history, model, now: int, receiver: str, amount: int, blackout: bool = False):
    tx = Transaction("RESEARCH_PROPOSAL", now, "C0000", receiver, amount)
    started = perf_counter()
    vector = np.atleast_2d(history.vector(tx))
    snap = snapshot(history, [tx], now, np.array([0]))
    value = float(model.predict([snap], vector, blackout=blackout)[0])
    return {"score": value, "facts": history.describe(tx), "nodes": len(snap.names),
            "edges": snap.edges.shape[1], "milliseconds": (perf_counter() - started) * 1000,
            "device": model.device, "context_available": not blackout}


def main():
    import argparse
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--receiver", default="M000")
    parser.add_argument("--amount", type=int, default=12000)
    parser.add_argument("--model", default="sage_history")
    parser.add_argument("--blackout", action="store_true")
    args = parser.parse_args()
    artifact = json.loads((ROOT / "artifacts" / "stress_models.json").read_text(encoding="utf-8"))
    history, models, now = load_research_engine(artifact)
    if args.model not in models:
        parser.error("Choisissez un réseau parmi : " + ", ".join(models))
    result = analyze(history, models[args.model], now, args.receiver, args.amount, args.blackout)
    result["model"] = args.model
    result["threshold"] = artifact["thresholds"][args.model]
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
