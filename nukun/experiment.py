"""Exécution reproductible : python -m nukun.experiment --size 30000 --seeds 2026 2027 2028."""

import argparse
import csv
import hashlib
import json
from pathlib import Path
import platform
from time import perf_counter

import numpy as np

from nukun.features import BASE_FEATURES, FEATURE_NAMES, causal_matrix, rule_score
from nukun.model import LogisticRisk, metrics, operating_threshold
from nukun.simulation import Transaction, generate


ROOT = Path(__file__).resolve().parents[1]


def write_json(path: Path, obj):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, ensure_ascii=False, indent=2, allow_nan=False) + "\n", encoding="utf-8")


def source_digest():
    sources = sorted((ROOT / "nukun").glob("*.py"))
    digest = hashlib.sha256()
    for path in sources:
        digest.update(path.name.encode())
        digest.update(path.read_bytes())
    return digest.hexdigest()


def run(seed: int, size: int, steps: int):
    started = perf_counter()
    dataset = generate(seed=seed, size=size)
    x, history = causal_matrix(dataset.transactions, dataset.declarations)
    feature_seconds = perf_counter() - started
    y = np.array(dataset.labels)
    timestamps = np.array([t.timestamp for t in dataset.transactions])
    # Coupures temporelles explicites, indépendantes des étiquettes et des comptes.
    train_cut, valid_cut = 18 * 86400, 24 * 86400
    train, valid, test = timestamps < train_cut, (timestamps >= train_cut) & (timestamps < valid_cut), timestamps >= valid_cut
    profiles = np.array([dataset.profiles[t.receiver] for t in dataset.transactions])
    results, models = {}, {}
    scores = {"R0_rules": np.array([rule_score(row) for row in x])}
    training_seconds = {}
    for name, columns in [
        ("R1_history", list(range(len(BASE_FEATURES)))),
        ("R1_history_akwe", list(range(len(FEATURE_NAMES)))),
    ]:
        tick = perf_counter()
        model = LogisticRisk.fit(x[train], y[train], columns, steps=steps)
        training_seconds[name] = perf_counter() - tick
        models[name] = model
        scores[name] = model.score(x)
    for name, values in scores.items():
        threshold = operating_threshold(y[valid], values[valid], .80)
        results[name] = {
            "validation": metrics(y[valid], values[valid], threshold,
                                  profiles[valid] == "merchant", profiles[valid] == "imitator"),
            "test": metrics(y[test], values[test], threshold,
                            profiles[test] == "merchant", profiles[test] == "imitator"),
        }
    # Le modèle avec contexte est le modèle d'ablation prévu ; aucun choix sur test.
    probe = Transaction("BENCH", int(timestamps[-1]) + 1, "C0000", "M000", 12000)
    model = models["R1_history_akwe"]
    for _ in range(20):
        model.score(history.vector(probe))
    durations = []
    for _ in range(200):
        tick = perf_counter()
        model.score(history.vector(probe))
        durations.append((perf_counter() - tick) * 1000)
    info = {
        "seed": seed, "size": size, "dataset_sha256": dataset.digest(),
        "train_cut_seconds": train_cut, "validation_cut_seconds": valid_cut,
        "counts": {"train": int(train.sum()), "validation": int(valid.sum()), "test": int(test.sum())},
        "features_seconds": feature_seconds, "training_seconds": training_seconds,
        "benchmark": {"device": "CPU", "requests": 200, "warmup": 20,
                      "p50_ms": float(np.percentile(durations, 50)),
                      "p95_ms": float(np.percentile(durations, 95)),
                      "includes": "caractéristiques locales 7 jours + score, historique déjà chargé ; hors UI et réseau"},
        "models": results,
    }
    return info, models, dataset


def report_document(report: dict) -> str:
    lines = [
        "# Résultats du premier prototype NUKÚN × Akwɛ", "",
        "Expérience sur simulation locale uniquement. Ces résultats ne mesurent pas la performance terrain au Bénin.", "",
        "## Protocole", "",
        "30 jours simulés ; entraînement avant le jour 18, validation des jours 18 à 24, test à partir du jour 24. "
        "Le seuil de chaque variante est choisi sur validation pour atteindre au moins 80 % de rappel. "
        "Le rappel réellement obtenu sur test est publié sans réajuster les seuils. "
        "Les comptes déjà rencontrés peuvent réapparaître sur test : ce n'est pas une évaluation indépendante sur nouveaux comptes.", "",
        "Les caractéristiques utilisent les transactions strictement antérieures et les déclarations confirmées, compatibles avec un paiement observé. "
        "Les profils du simulateur et les labels ne sont jamais des entrées du modèle. "
        "La couverture déclarative et les comportements sont des hypothèses du générateur, qui peuvent rendre l'expérience trop favorable.", "",
        "AP désigne l'average precision, calculée aux seuils distincts ; ce n'est pas une aire PR par interpolation trapézoïdale. "
        "Les scores de régression pondérée ne sont pas des probabilités calibrées.", "",
        "## Mesures sur test", "",
        "| Seed | Variante | Fraudes | Rappel | Précision | AP | Faux positifs commerçants | Commerçants | Rappel imitateurs |",
        "| --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    ]
    for run_info in report["runs"]:
        for name, model in run_info["models"].items():
            m = model["test"]
            imitate = f'{m["imitator_recall"]:.1%}' if m["imitator_recall"] is not None else "n/a"
            lines.append(f'| {run_info["seed"]} | {name} | {m["fraud_count"]} | {m["recall"]:.1%} | '
                         f'{m["precision"]:.1%} | {m["average_precision"]:.3f} | '
                         f'{m["merchant_false_positives"]} | {m["merchant_count"]} | {imitate} |')
    lines.extend(["", "## Lecture des résultats", ""])
    for run_info in report["runs"]:
        before = run_info["models"]["R1_history"]["test"]
        after = run_info["models"]["R1_history_akwe"]["test"]
        delta = after["recall"] - before["recall"]
        fpr_before, fpr_after = before["merchant_fpr"], after["merchant_fpr"]
        if fpr_before and fpr_after is not None:
            reduction = (fpr_before - fpr_after) / fpr_before
            lines.append(f'- Seed {run_info["seed"]} : variation relative des faux positifs commerçants '
                         f'{-reduction:+.1%} ; écart de rappel fraude {delta:+.1%} '
                         f'(proportion, soit {delta * 100:+.1f} points).')
        else:
            lines.append(f'- Seed {run_info["seed"]} : réduction relative non calculable, effectifs à examiner.')
    lines.extend([
        "", "Une baisse des faux positifs accompagnée d'une baisse du rappel ne suffit pas à établir une amélioration. "
        "Examiner aussi le rappel des fraudeurs imitateurs et la variabilité entre seeds. Les variantes de cette expérience initiale sont tabulaires. L'expérience GraphSAGE est documentée séparément dans STRESS_RESULTATS.md.",
        "", "## Exécution et reproductibilité", "",
        f'Empreinte des sources métier : `{report["source_sha256"]}`.', "",
        f'Python {report["environment"]["python"]}, NumPy {report["environment"]["numpy"]}. '
        f'Système : {report["environment"]["platform"]}.', "",
        "Le benchmark CPU mesure caractéristiques et score, historique déjà chargé, après 20 échauffements. "
        "Il exclut le rendu Streamlit, le réseau et la reconnaissance vocale. Aucun gain GPU n'est revendiqué.", "",
    ])
    for run_info in report["runs"]:
        b = run_info["benchmark"]
        lines.append(f'- Seed {run_info["seed"]} : p50 {b["p50_ms"]:.3f} ms, '
                     f'p95 {b["p95_ms"]:.3f} ms sur {b["requests"]} requêtes ; '
                     f'empreinte données `{run_info["dataset_sha256"]}`.')
    lines.extend(["", "## Limites et étapes suivantes", "",
        "Fraude rare réelle, changement de distribution, historique sans Akwɛ, nouveaux comptes, incertitude statistique "
        "et nouvelles familles d'attaques restent à évaluer. La simulation inclut des fraudeurs avec fausses déclarations, "
        "mais ne remplace pas des cas enquêtés. Le score ne doit pas autoriser ou bloquer un paiement réel. "
        "La voix fon et les mesures GPU restent des jalons distincts ; l'expérience GraphSAGE dispose de son propre protocole.", ""])
    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--size", type=int, default=30000)
    parser.add_argument("--seeds", type=int, nargs="+", default=[2026, 2027, 2028])
    parser.add_argument("--steps", type=int, default=600)
    args = parser.parse_args()
    report = {"schema_version": 1, "source_sha256": source_digest(),
              "config": vars(args), "environment": {"python": platform.python_version(),
              "numpy": np.__version__, "platform": platform.platform(), "processor": platform.processor()}, "runs": []}
    for index, seed in enumerate(args.seeds):
        print(f"Seed {seed} : simulation, calcul causal et entraînement ({args.size} transactions)...", flush=True)
        info, models, dataset = run(seed, args.size, args.steps)
        report["runs"].append(info)
        if index == 0:
            dataset.save(ROOT / "data" / "generated")
            artifact = {"schema_version": 1, "feature_names": FEATURE_NAMES,
                        "source_sha256": report["source_sha256"], "dataset_sha256": info["dataset_sha256"],
                        "seed": seed, "size": args.size,
                        "models": {name: {"model": model.to_dict(),
                                   "threshold": info["models"][name]["validation"]["threshold"]}
                                   for name, model in models.items()}}
            write_json(ROOT / "artifacts" / "baseline.json", artifact)
        print(json.dumps(info["models"], ensure_ascii=False), flush=True)
    write_json(ROOT / "reports" / "metrics.json", report)
    with (ROOT / "reports" / "benchmark.csv").open("w", newline="", encoding="utf-8") as stream:
        writer = csv.DictWriter(stream, fieldnames=["seed", "device", "requests", "warmup", "p50_ms", "p95_ms", "includes"])
        writer.writeheader()
        for info in report["runs"]:
            writer.writerow({"seed": info["seed"], **info["benchmark"]})
    (ROOT / "reports" / "RESULTATS.md").write_text(report_document(report), encoding="utf-8")
    print("Résultats : reports/metrics.json et reports/RESULTATS.md", flush=True)


if __name__ == "__main__":
    main()
