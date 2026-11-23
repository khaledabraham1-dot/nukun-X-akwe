import csv
import importlib.util
import json
from pathlib import Path
import unittest

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
READY = importlib.util.find_spec("torch") is not None and (ROOT / "artifacts" / "stress_models.json").exists()


@unittest.skipUnless(READY, "Poids expérimentaux ou PyTorch absents")
class GraphReplayTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        from nukun.stress_data import generate_stress
        from nukun.features import causal_matrix
        from nukun.graph import build_snapshots
        cls.artifact = json.loads((ROOT / "artifacts" / "stress_models.json").read_text(encoding="utf-8"))
        cls.ds = generate_stress(cls.artifact["seed"], cls.artifact["size"]).dataset
        cls.x, _ = causal_matrix(cls.ds.transactions, cls.ds.declarations)
        cls.snaps = build_snapshots(cls.ds.transactions, cls.ds.declarations)

    def test_exported_weights_reproduce_all_saved_graph_predictions(self):
        from nukun.graph import GraphModel
        report = json.loads((ROOT / "reports" / "stress_metrics.json").read_text(encoding="utf-8"))
        self.assertEqual(self.artifact["protocol_sha256"], report["protocol_sha256"])
        self.assertEqual(self.artifact["sources"], report["sources"])
        self.assertEqual(self.ds.digest(), self.artifact["dataset_sha256"])
        mask = np.array([t.timestamp >= 24 * 86400 for t in self.ds.transactions])
        with (ROOT / "reports" / f"stress_predictions_{self.ds.seed}.csv").open(encoding="utf-8") as stream:
            rows = list(csv.DictReader(stream))
        for name in ("mlp_history", "mlp_akwe", "sage_history", "sage_akwe"):
            with self.subTest(model=name):
                model = GraphModel.from_dict(self.artifact["models"][name])
                predictions = model.predict(self.snaps, self.x)[mask]
                np.testing.assert_allclose(predictions, [float(r[name]) for r in rows], atol=1e-6)

    def test_inference_accepts_unseen_account_without_id_embedding(self):
        from nukun.graph_inference import load_research_engine, analyze
        history, models, now = load_research_engine(self.artifact)
        result = analyze(history, models["sage_history"], now, "UNSEEN_ACCOUNT", 12000)
        self.assertTrue(0 <= result["score"] <= 1)
        self.assertEqual(result["facts"]["incoming_count"], 0)


if __name__ == "__main__":
    unittest.main()
