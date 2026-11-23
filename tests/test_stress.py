import importlib.util
import unittest

import numpy as np

from nukun.features import History, causal_matrix
from nukun.graph import Snapshot, build_snapshots, snapshot
from nukun.simulation import Declaration, Transaction
from nukun.stress_data import generate_stress
from nukun.uncertainty import clustered_intervals


HAS_TORCH = importlib.util.find_spec("torch") is not None


class StressDataTests(unittest.TestCase):
    def test_new_accounts_never_appear_before_activation(self):
        stress = generate_stress(17, 1200)
        cold = {a for a, meta in stress.cohorts.items() if meta["activation"] > 0}
        self.assertTrue(cold)
        for tx in stress.dataset.transactions:
            for account in (tx.sender, tx.receiver):
                if account in cold:
                    self.assertGreaterEqual(tx.timestamp, 24 * 86400)

    def test_nonadopters_have_no_declarations_and_fraudsters_can_declare(self):
        stress = generate_stress(19, 2500)
        for declaration in stress.dataset.declarations:
            self.assertTrue(stress.cohorts[declaration.merchant]["akwe_enrolled"])
        self.assertTrue(any(stress.dataset.profiles[d.merchant] == "imitator" for d in stress.dataset.declarations))
        self.assertEqual(stress.dataset.digest(), generate_stress(19, 2500).dataset.digest())

    def test_future_events_and_labels_cannot_enter_snapshot(self):
        history = History()
        history.observe(Transaction("old", 10, "C", "M", 1000))
        proposal = Transaction("next", 20, "D", "M", 1000)
        history.matches["old"] = Declaration("future-declaration", "M", "old", 1000, 21)
        snap = snapshot(history, [proposal], 20, np.array([1]))
        self.assertEqual(snap.node_x[snap.names.index("M"), -1], 0)
        named_edges = {(snap.names[a], snap.names[b]) for a, b in snap.edges.T}
        self.assertEqual(named_edges, {("C", "M")})
        self.assertNotIn(("D", "M"), named_edges)
        history.observe(proposal)
        with self.assertRaises(ValueError):
            snapshot(history, [proposal], 20, np.array([1]))

    def test_snapshot_coverage_and_edges_strictly_before_cut(self):
        ds = generate_stress(17, 1000).dataset
        snaps = build_snapshots(ds.transactions, ds.declarations)
        np.testing.assert_array_equal(np.concatenate([s.transaction_indices for s in snaps]), np.arange(1000))
        for snap in snaps:
            expected = {(t.sender, t.receiver) for t in ds.transactions
                        if snap.start - 7 * 86400 <= t.timestamp < snap.start}
            actual = {(snap.names[a], snap.names[b]) for a, b in snap.edges.T}
            self.assertEqual(actual, expected)


class UncertaintyTests(unittest.TestCase):
    def test_identical_variants_have_zero_paired_difference(self):
        y = np.array([1, 1, 0, 0, 0, 0])
        receivers = np.array(["X", "X", "M", "M", "N", "N"])
        merchants = np.array([False, False, True, True, True, True])
        alert = np.array([True, False, False, True, False, False])
        result = clustered_intervals(y, receivers, merchants,
                                    {"sage_history": alert, "sage_akwe": alert}, repeats=100, seed=17)
        self.assertEqual(result["groups"], 3)
        for interval in result["paired_context_deltas"]["sage"].values():
            self.assertEqual(interval["low"], 0)
            self.assertEqual(interval["high"], 0)


@unittest.skipUnless(HAS_TORCH, "PyTorch optionnel absent : utiliser le Python du venv graphe")
class GraphTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.ds = generate_stress(17, 1000).dataset
        cls.x, _ = causal_matrix(cls.ds.transactions, cls.ds.declarations)
        cls.y = np.array(cls.ds.labels)
        cls.snaps = build_snapshots(cls.ds.transactions, cls.ds.declarations)
        cls.train = np.array([t.timestamp < 18 * 86400 for t in cls.ds.transactions])

    def fit(self, y=None, x=None):
        from nukun.graph import fit_graph
        return fit_graph(self.snaps, self.x if x is None else x, self.y if y is None else y,
                         self.train, 18 * 86400, True, True, 17, hidden=8, epochs=2)

    def test_real_training_and_json_roundtrip(self):
        import json
        from nukun.graph import GraphModel
        model, log = self.fit()
        scores = model.predict(self.snaps, self.x)
        self.assertTrue(np.all(np.isfinite(scores)))
        self.assertGreater(log["parameters"], 0)
        self.assertEqual(len(log["loss_by_epoch"]), 2)
        loaded = GraphModel.from_dict(json.loads(json.dumps(model.to_dict())))
        np.testing.assert_allclose(scores, loaded.predict(self.snaps, self.x), atol=1e-6)

    def test_heldout_labels_and_features_do_not_change_training(self):
        model, _ = self.fit()
        changed_y = self.y.copy()
        changed_y[~self.train] = 1 - changed_y[~self.train]
        changed_x = self.x.copy()
        changed_x[~self.train] = 1000000
        other, _ = self.fit(changed_y, changed_x)
        np.testing.assert_array_equal(model.tx_mean, other.tx_mean)
        for key, value in model.network.state_dict().items():
            np.testing.assert_array_equal(value.detach().numpy(), other.network.state_dict()[key].detach().numpy())

    def test_node_renaming_does_not_change_scores(self):
        model, _ = self.fit()
        snap = self.snaps[-1]
        n = len(snap.names)
        permutation = np.arange(n)[::-1]
        inverse = np.argsort(permutation)
        changed = Snapshot(snap.start, [snap.names[i] for i in permutation], snap.node_x[permutation],
                           inverse[snap.edges], snap.transaction_indices, inverse[snap.senders], inverse[snap.receivers])
        import torch
        model.network.eval()
        with torch.no_grad():
            before = model.network(*model.tensors(snap, self.x)).numpy()
            after = model.network(*model.tensors(changed, self.x)).numpy()
        np.testing.assert_allclose(before, after, atol=1e-6)


if __name__ == "__main__":
    unittest.main()
