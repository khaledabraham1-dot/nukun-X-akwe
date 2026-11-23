"""Protocole de stress et expérience GraphSAGE indépendants de la démo tabulaire."""

import argparse
import csv
import hashlib
import json
import os
from pathlib import Path
import platform
from time import perf_counter

import numpy as np

from nukun.experiment import write_json
from nukun.features import causal_matrix, rule_score
from nukun.graph import build_snapshots, fit_graph
from nukun.model import LogisticRisk, metrics, operating_threshold
from nukun.stress_data import generate_stress
from nukun.uncertainty import clustered_intervals


ROOT = Path(__file__).resolve().parents[1]


def fingerprint():
    files = ["stress_data.py", "stress_experiment.py", "graph.py", "features.py", "model.py", "simulation.py", "uncertainty.py"]
    hasher = hashlib.sha256()
    for name in sorted(files):
        hasher.update(name.encode())
        hasher.update((ROOT / "nukun" / name).read_bytes().replace(b"\r\n", b"\n"))
    return {"sha256": hasher.hexdigest(), "files": sorted(files), "line_endings": "LF"}


def population_metrics(y, scores, threshold, mask):
    selected = mask & (y == 1)
    legitimate = mask & (y == 0)
    alert = scores >= threshold
    return {"n": int(mask.sum()), "positive_count": int(selected.sum()), "negative_count": int(legitimate.sum()),
            "recall": float(alert[selected].mean()) if selected.any() else None,
            "fpr": float(alert[legitimate].mean()) if legitimate.any() else None,
            "alert_rate": float(alert[mask].mean()) if mask.any() else None}


def run(seed, protocol, device="cpu", graphs=True):
    started = perf_counter()
    stress = generate_stress(seed, protocol["transactions_per_seed"])
    ds, cohorts = stress.dataset, stress.cohorts
    x, _ = causal_matrix(ds.transactions, ds.declarations)
    no_context = x.copy()
    no_context[:, 9:] = 0
    y = np.array(ds.labels, dtype=np.int64)
    ts = np.array([t.timestamp for t in ds.transactions])
    train_cut, valid_cut = protocol["train_cut_seconds"], protocol["validation_cut_seconds"]
    train = ts < train_cut
    valid, test = (ts >= train_cut) & (ts < valid_cut), ts >= valid_cut
    profiles = np.array([ds.profiles[t.receiver] for t in ds.transactions])
    receivers = np.array([t.receiver for t in ds.transactions])
    first_seen = {}
    for tx in ds.transactions:
        for account in (tx.sender, tx.receiver):
            first_seen.setdefault(account, tx.timestamp)
    merchant = profiles == "merchant"
    masks = {
        "new_to_training": np.array([first_seen[a] >= train_cut for a in receivers]),
        "new_merchants": merchant & np.array([first_seen[a] >= train_cut for a in receivers]),
        "merchants_without_akwe": merchant & np.array([not cohorts.get(a, {}).get("akwe_enrolled", False) for a in receivers]),
        "imitators": profiles == "imitator",
    }
    scores = {"rules": np.array([rule_score(row) for row in x])}
    blackout_scores = {"rules": scores["rules"]}
    artifacts, training = {}, {}
    for name, count in [("logistic_history", 9), ("logistic_akwe", 12)]:
        tick = perf_counter()
        model = LogisticRisk.fit(x[train], y[train], list(range(count)), protocol["logistic_steps"])
        scores[name], blackout_scores[name] = model.score(x), model.score(no_context)
        artifacts[name] = model.to_dict()
        training[name] = {"seconds": perf_counter() - tick, "device": "cpu", "parameters": count + 1}
    if graphs:
        snaps = build_snapshots(ds.transactions, ds.declarations, protocol["graph_snapshot_seconds"])
        for name, context, aggregate in [
            ("mlp_history", False, False), ("mlp_akwe", True, False),
            ("sage_history", False, True), ("sage_akwe", True, True),
        ]:
            model, log = fit_graph(snaps, x, y, train, train_cut, context, aggregate,
                                   seed + 31, protocol["graph_hidden_dim"], protocol["graph_epochs"],
                                   protocol["graph_learning_rate"], device)
            scores[name] = model.predict(snaps, x)
            blackout_scores[name] = model.predict(snaps, x, blackout=True)
            artifacts[name], training[name] = model.to_dict(), log
            print(f"  {name}: entraîné en {log['seconds']:.2f}s ({device})", flush=True)
    results, alert_masks, thresholds = {}, {}, {}
    for name, values in scores.items():
        threshold = operating_threshold(y[valid], values[valid], protocol["recall_target"])
        thresholds[name] = threshold
        common = (merchant[test], profiles[test] == "imitator")
        results[name] = {
            "threshold": threshold,
            "validation": metrics(y[valid], values[valid], threshold, merchant[valid], profiles[valid] == "imitator"),
            "test": metrics(y[test], values[test], threshold, *common),
            "blackout_test": metrics(y[test], blackout_scores[name][test], threshold, *common),
            "populations": {key: population_metrics(y[test], values[test], threshold, mask[test]) for key, mask in masks.items()},
        }
        alert_masks[name] = values[test] >= threshold
    uncertainty = clustered_intervals(y[test], receivers[test], merchant[test], alert_masks,
                                      protocol["bootstrap_repeats"], seed + 300)
    info = {"seed": seed, "size": len(y), "dataset_sha256": ds.digest(),
            "counts": {"train": int(train.sum()), "validation": int(valid.sum()), "test": int(test.sum())},
            "models": results, "training": training, "uncertainty": uncertainty,
            "total_seconds": perf_counter() - started}
    test_rows = [{"id": tx.id, "receiver": tx.receiver, "is_fraud": int(label),
                  "profile": profile, **{name: float(values[i]) for name, values in scores.items()}}
                 for i, (tx, label, profile) in enumerate(zip(ds.transactions, y, profiles, strict=True)) if test[i]]
    return info, {"models": artifacts, "thresholds": thresholds}, test_rows


def report_markdown(report):
    lines = ["# Résultats du protocole de stress NUKÚN × Akwɛ", "",
             "Simulation contrôlée, sans validation terrain. Toutes les variantes prévues et exécutées sont publiées ; "
             "aucun modèle n'est choisi sur test pour remplacer le moteur de démonstration.", "",
             f'Protocole `{report["protocol"]["protocol_id"]}`, SHA-256 `{report["protocol_sha256"]}`.', "",
             "## Résultats sur la période de test", "",
             "| Seed | Variante | Rappel fraude | Précision | AP | FPR commerçants | Rappel imitateurs | Alertes |",
             "| --- | --- | --- | --- | --- | --- | --- | --- |"]
    def pct(value):
        return "n/a" if value is None else f"{value:.1%}"
    for run_info in report["runs"]:
        for name, entry in run_info["models"].items():
            m = entry["test"]
            lines.append(f'| {run_info["seed"]} | {name} | {pct(m["recall"])} | {pct(m["precision"])} | '
                         f'{m["average_precision"]:.3f} | {pct(m["merchant_fpr"])} | {pct(m["imitator_recall"])} | {m["alerts"]} |')
    lines.extend(["", "## Diagnostic du contexte commercial", "",
        "Les seuils visent un rappel de 80 % sur validation et restent gelés sur test. "
        "Les écarts ci-dessous sont des différences de taux, en points de pourcentage. "
        "Un FPR plus bas avec un rappel plus bas n'établit pas un meilleur compromis.", ""])
    for run_info in report["runs"]:
        for prefix in ("logistic", "mlp", "sage"):
            if f"{prefix}_akwe" not in run_info["models"]:
                continue
            before, after = (run_info["models"][f"{prefix}_{suffix}"]["test"] for suffix in ("history", "akwe"))
            d_recall = (after["recall"] - before["recall"]) * 100
            d_fpr = (after["merchant_fpr"] - before["merchant_fpr"]) * 100
            ci = run_info["uncertainty"]["paired_context_deltas"][prefix]
            r_ci, f_ci = ci["recall"], ci["merchant_fpr"]
            ci_text = ""
            if r_ci and f_ci:
                ci_text = (f" ; IC bootstrap exploratoires : rappel [{100*r_ci['low']:+.1f}, {100*r_ci['high']:+.1f}], "
                           f"FPR [{100*f_ci['low']:+.1f}, {100*f_ci['high']:+.1f}] points")
            lines.append(f'- Seed {run_info["seed"]}, {prefix} : rappel {d_recall:+.1f} points, '
                         f'FPR commerçants {d_fpr:+.1f} points{ci_text}.')
    lines.extend(["", "## Sous populations et panne du contexte", "",
        "| Seed | Variante avec contexte | FPR commerçants sans Akwɛ | FPR nouveaux commerçants | Rappel nouveaux comptes | Rappel en panne de contexte |",
        "| --- | --- | --- | --- | --- | --- |"])
    for run_info in report["runs"]:
        for name, entry in run_info["models"].items():
            if name.endswith("akwe"):
                p = entry["populations"]
                lines.append(f'| {run_info["seed"]} | {name} | {pct(p["merchants_without_akwe"]["fpr"])} | '
                             f'{pct(p["new_merchants"]["fpr"])} | {pct(p["new_to_training"]["recall"])} | '
                             f'{pct(entry["blackout_test"]["recall"])} |')
    lines.extend(["", "Les effectifs, seuils, précision en panne et intervalles complets sont dans `stress_metrics.json`. "
        "Les intervalles rééchantillonnent les comptes destinataires ; ils ne représentent pas toute l'incertitude liée aux réseaux, "
        "au choix du simulateur ou au transfert vers le terrain.", "", "## Exécution", "",
        f'Environnement : Python {report["environment"]["python"]}, NumPy {report["environment"]["numpy"]}, '
        f'PyTorch {report["environment"]["torch"]}, appareil {report["environment"]["device"]}.', "",
        "Les durées d'entraînement incluent les époques et la synchronisation finale, mais pas la préparation des données et tenseurs. "
        "Ces durées seules ne constituent pas un benchmark comparatif CPU et GPU. Aucun gain GPU n'est affirmé pour une exécution CPU.", "",
        "GraphSAGE est ici une variante orientée à moyennes entrantes et sortantes sur voisinages complets, avec deux couches. "
        "Le MLP emploie la même architecture avec messages voisins nuls. Les instantanés de 12 heures sont causaux et "
        "les nouveaux comptes n'ont pas d'embeddings d'identifiants appris.", "",
        f'Empreinte des sources : `{report["sources"]["sha256"]}`.', "",
        "Les résultats dépendent des hypothèses de coordination et d'adhésion au cahier. "
        "Ils peuvent réfuter l'efficacité du contexte ou du graphe sur ce protocole ; les résultats défavorables restent publiés. "
        "La voix fon et l'intégration opérateur sont hors de cette expérience.", ""])
    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--protocol", type=Path, default=ROOT / "configs" / "stress_protocol.json")
    parser.add_argument("--without-graph", action="store_true")
    parser.add_argument("--device", choices=["cpu", "cuda"], default="cpu")
    parser.add_argument("--output-root", type=Path, default=ROOT)
    args = parser.parse_args()
    raw = args.protocol.read_bytes()
    protocol = json.loads(raw)
    torch_version = None
    gpu_name = None
    if not args.without_graph:
        os.environ.setdefault("CUBLAS_WORKSPACE_CONFIG", ":4096:8")
        import torch
        torch_version = torch.__version__
        if args.device == "cuda":
            if not torch.cuda.is_available():
                parser.error("GPU CUDA demandé mais indisponible ; aucun repli CPU automatique.")
            gpu_name = torch.cuda.get_device_name(0)
    elif args.device == "cuda":
        parser.error("Le mode sans graphe utilise uniquement les modèles NumPy CPU.")
    report = {"schema_version": 1, "protocol": protocol, "protocol_sha256": hashlib.sha256(raw).hexdigest(),
              "sources": fingerprint(), "graph_status": "not_run" if args.without_graph else "executed",
              "environment": {"python": platform.python_version(), "numpy": np.__version__, "torch": torch_version,
                              "device": args.device, "gpu_name": gpu_name}, "runs": []}
    output = args.output_root.resolve() / "reports"
    output.mkdir(parents=True, exist_ok=True)
    for index, seed in enumerate(protocol["seeds"]):
        print(f"Seed stress {seed} : {protocol['transactions_per_seed']} transactions...", flush=True)
        info, artifacts, predictions = run(seed, protocol, args.device, not args.without_graph)
        report["runs"].append(info)
        with (output / f"stress_predictions_{seed}.csv").open("w", newline="", encoding="utf-8") as stream:
            writer = csv.DictWriter(stream, fieldnames=list(predictions[0]))
            writer.writeheader()
            writer.writerows(predictions)
        if index == 0:
            write_json(args.output_root.resolve() / "artifacts" / "stress_models.json", {"protocol_sha256": report["protocol_sha256"],
                       "sources": report["sources"], "seed": seed, "size": info["size"],
                       "dataset_sha256": info["dataset_sha256"], **artifacts})
        for name, entry in info["models"].items():
            m = entry["test"]
            print(f"  {name}: recall={m['recall']:.3f}, precision={m['precision']:.3f}, merchant_fpr={m['merchant_fpr']:.3f}", flush=True)
    write_json(output / "stress_metrics.json", report)
    (output / "STRESS_RESULTATS.md").write_text(report_markdown(report), encoding="utf-8")
    print("Résultats de stress enregistrés, démo de référence conservée.", flush=True)


if __name__ == "__main__":
    main()
