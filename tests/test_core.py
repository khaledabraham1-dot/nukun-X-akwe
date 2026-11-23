import json
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import tempfile
import unittest

import numpy as np

from nukun.features import History, causal_matrix
from nukun.ledger import Ledger, Proposal, parse_statement
from nukun.model import LogisticRisk, average_precision, operating_threshold
from nukun.simulation import Declaration, Transaction, generate
from nukun.wallet import DemoWallet


class CausalityTests(unittest.TestCase):
    def test_current_transaction_and_future_never_enter_features(self):
        earlier = Transaction("1", 100, "C1", "M1", 1000)
        current = Transaction("2", 200, "C2", "M1", 2000)
        future = Transaction("3", 300, "C3", "M1", 90000)
        short, _ = causal_matrix([earlier, current], [])
        long, _ = causal_matrix([earlier, current, future], [])
        np.testing.assert_array_equal(short, long[:2])
        self.assertEqual(short[0, 1], 0)

    def test_same_timestamp_is_excluded(self):
        h = History()
        h.observe(Transaction("1", 100, "C1", "M1", 1000))
        self.assertEqual(h.describe(Transaction("2", 100, "C2", "M1", 1000))["incoming_count"], 0)

    def test_confirmation_is_known_before_score_and_unique(self):
        h = History()
        h.observe(Transaction("1", 100, "C1", "M1", 1000))
        d = Declaration("d", "M1", "1", 1000, 150)
        self.assertFalse(h.confirm(d, 150))
        self.assertTrue(h.confirm(d, 151))
        self.assertFalse(h.confirm(d, 200))
        self.assertEqual(h.describe(Transaction("2", 200, "C2", "M1", 1000))["matched_share"], 1)

    def test_wrong_amount_and_merchant_rejected(self):
        h = History()
        h.observe(Transaction("1", 100, "C1", "M1", 1000))
        self.assertFalse(h.confirm(Declaration("d", "M1", "1", 999, 150), 200))
        self.assertFalse(h.confirm(Declaration("d", "X1", "1", 1000, 150), 200))
        self.assertFalse(h.confirm(Declaration("d", "M1", "1", 1000, 50), 200))

    def test_past_queries_rejected_and_score_read_only(self):
        h = History()
        h.observe(Transaction("1", 100, "C1", "M1", 1000))
        with self.assertRaises(ValueError):
            h.vector(Transaction("2", 99, "C2", "M1", 1000))
        before = set(h.accounts)
        h.vector(Transaction("2", 999999, "unknown", "another", 1000))
        self.assertEqual(before, set(h.accounts))

    def test_expired_context_is_not_reused(self):
        h = History(window=100)
        h.observe(Transaction("1", 100, "C1", "M1", 1000))
        h.confirm(Declaration("d", "M1", "1", 1000, 110), 120)
        self.assertEqual(h.describe(Transaction("2", 201, "C2", "M1", 1000))["matched_share"], 0)


class LedgerTests(unittest.TestCase):
    def setUp(self):
        self.ledger = Ledger()
        self.now = 1795352400

    def tearDown(self):
        self.ledger.close()

    def proposal(self, key="request", channel="mobile_money"):
        return self.ledger.propose("M1", parse_statement("J'ai vendu pour 12 000 francs", channel), key, self.now)

    def test_no_entry_in_totals_without_confirmation(self):
        p = self.proposal()
        self.assertEqual(self.ledger.summary("M1")["sales"], 0)
        with self.assertRaises(ValueError):
            self.ledger.reconcile(p["id"], self.now)
        self.ledger.confirm(p["id"], 1, self.now)
        self.ledger.confirm(p["id"], 1, self.now)
        self.assertEqual(self.ledger.summary("M1")["sales"], 12000)
        self.assertEqual(len(self.ledger.entries("M1")), 1)

    def test_request_key_cannot_change_payload(self):
        self.proposal()
        self.proposal()
        with self.assertRaises(ValueError):
            self.ledger.propose("M1", parse_statement("Vente de 500 francs"), "request", self.now)

    def test_single_payment_matches_only_once_and_cancel_releases(self):
        self.ledger.add_payment("p1", "M1", 12000, "incoming", self.now - 5)
        first = self.proposal()
        self.ledger.confirm(first["id"], 1, self.now)
        self.assertEqual(self.ledger.reconcile(first["id"], self.now)["match_status"], "matched")
        second = self.proposal("another")
        self.ledger.confirm(second["id"], 1, self.now)
        self.assertEqual(self.ledger.reconcile(second["id"], self.now)["match_status"], "unmatched")
        self.ledger.cancel(first["id"], self.now)
        self.assertEqual(self.ledger.reconcile(second["id"], self.now)["match_status"], "matched")
        self.assertEqual(self.ledger.summary("M1")["sales"], 12000)

    def test_ambiguous_payments_are_not_auto_matched(self):
        for payment in ("p1", "p2"):
            self.ledger.add_payment(payment, "M1", 12000, "incoming", self.now)
        p = self.proposal()
        self.ledger.confirm(p["id"], 1, self.now)
        self.assertEqual(self.ledger.reconcile(p["id"], self.now)["match_status"], "ambiguous")

    def test_future_payment_and_wrong_direction_do_not_match(self):
        self.ledger.add_payment("future", "M1", 12000, "incoming", self.now + 1)
        self.ledger.add_payment("out", "M1", 12000, "outgoing", self.now)
        p = self.proposal()
        self.ledger.confirm(p["id"], 1, self.now)
        self.assertEqual(self.ledger.reconcile(p["id"], self.now)["match_status"], "unmatched")

    def test_competing_entries_are_ambiguous(self):
        self.ledger.add_payment("p", "M1", 12000, "incoming", self.now)
        a, b = self.proposal("a"), self.proposal("b")
        for p in (a, b):
            self.ledger.confirm(p["id"], 1, self.now)
        self.assertEqual(self.ledger.reconcile(a["id"], self.now)["match_status"], "ambiguous")

    def test_cash_sale_needs_no_mobile_payment(self):
        p = self.proposal(channel="cash")
        self.ledger.confirm(p["id"], 1, self.now)
        self.assertEqual(self.ledger.reconcile(p["id"], self.now)["match_status"], "cash")

    def test_cancelled_proposal_cannot_be_confirmed(self):
        p = self.proposal()
        self.ledger.cancel(p["id"], self.now)
        with self.assertRaises(ValueError):
            self.ledger.confirm(p["id"], 1, self.now)

    def test_database_survives_reopen(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "ledger.sqlite"
            db = Ledger(path)
            p = db.propose("M", parse_statement("Dépense 800 francs"), "key", self.now)
            db.confirm(p["id"], 1, self.now)
            db.close()
            reopened = Ledger(path)
            self.assertEqual(reopened.summary("M")["expenses"], 800)
            reopened.close()

    def test_concurrent_replay_creates_one_entry(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "concurrent.sqlite"
            Ledger(path).close()

            def submit(_):
                db = Ledger(path)
                try:
                    p = db.propose("M1", parse_statement("Vente 12000 francs"), "same-request", self.now)
                    db.confirm(p["id"], 1, self.now)
                    return p["id"]
                finally:
                    db.close()

            with ThreadPoolExecutor(max_workers=2) as pool:
                ids = list(pool.map(submit, range(2)))
            self.assertEqual(ids[0], ids[1])
            db = Ledger(path)
            self.assertEqual(db.summary("M1")["sales"], 12000)
            db.close()

    def test_business_day_uses_benin_timezone(self):
        from datetime import datetime, timezone
        # 23 h 30 UTC est déjà le lendemain au Bénin.
        payment_time = int(datetime(2026, 11, 21, 23, 30, tzinfo=timezone.utc).timestamp())
        entry_time = int(datetime(2026, 11, 22, 0, 10, tzinfo=timezone.utc).timestamp())
        self.ledger.add_payment("p", "M1", 12000, "incoming", payment_time)
        p = self.ledger.propose("M1", parse_statement("Vente 12000 francs"), "tz", entry_time)
        self.ledger.confirm(p["id"], 1, entry_time)
        self.assertEqual(self.ledger.reconcile(p["id"], entry_time)["match_status"], "matched")


class ParsingTests(unittest.TestCase):
    def test_french_amounts(self):
        for phrase in ["J'ai vendu pour 12 000 francs", "Vente 12000 XOF", "J’ai encaissé 12\u202f000 FCFA"]:
            self.assertEqual(parse_statement(phrase).amount, 12000)
        self.assertEqual(parse_statement("J'ai acheté pour 8 500 francs").kind, "expense")

    def test_reject_uncertain_and_multiple_amounts(self):
        for phrase in ["Vente de douze mille francs", "Vente 12000 et 500 francs", "Vente -500",
                       "Vente 12,50", "Vente 0", "Vente 50 euros", "Vente à crédit 12000",
                       "Vente et achat 12000", "vente hier 12000", "Je n'ai pas vendu 12000",
                       "vente environ 12000", "vente moins 500", "vente prévue 12000"]:
            with self.subTest(phrase=phrase), self.assertRaises(ValueError):
                parse_statement(phrase)


class ModelTests(unittest.TestCase):
    def test_ap_ties_do_not_depend_on_row_order(self):
        y = np.array([1, 0, 1, 0])
        self.assertEqual(average_precision(y, np.ones(4)), .5)
        self.assertEqual(average_precision(y[::-1], np.ones(4)), .5)
        self.assertEqual(average_precision(y, np.array([.9, .2, .8, .1])), 1)

    def test_threshold_is_chosen_from_validation_positives(self):
        threshold = operating_threshold(np.array([1, 0, 1, 1]), np.array([.9, .95, .6, .3]), 2 / 3)
        self.assertEqual(threshold, .6)

    def test_model_roundtrip_and_learning(self):
        x = np.array([[-2.], [-1.], [1.], [2.]])
        y = np.array([0, 0, 1, 1])
        model = LogisticRisk.fit(x, y, [0], 150)
        np.testing.assert_array_equal(model.score(x) >= .5, y)
        loaded = LogisticRisk.from_dict(json.loads(json.dumps(model.to_dict())))
        np.testing.assert_array_equal(model.score(x), loaded.score(x))

    def test_simulation_is_reproducible(self):
        self.assertEqual(generate(7, 200).digest(), generate(7, 200).digest())
        self.assertNotEqual(generate(7, 200).digest(), generate(8, 200).digest())


class WalletTests(unittest.TestCase):
    def test_confirmation_is_required_idempotent_and_warning_enforced(self):
        wallet = DemoWallet(20000)
        request = wallet.prepare("M1", 12000, .9, .6)
        self.assertEqual(wallet.balance, 20000)
        with self.assertRaises(ValueError):
            wallet.confirm(request.id)
        wallet.confirm(request.id, True)
        wallet.confirm(request.id, True)
        self.assertEqual(wallet.balance, 8000)

    def test_superseded_request_rejected(self):
        wallet = DemoWallet()
        old = wallet.prepare("M1", 1000, .2, .6)
        wallet.prepare("M2", 2000, .2, .6)
        with self.assertRaises(ValueError):
            wallet.confirm(old.id)


if __name__ == "__main__":
    unittest.main()
