"""Régressions issues de l'audit manuel : monnaies, unités et chronologie."""

from datetime import datetime, timezone
import unittest

from nukun.ledger import Ledger, parse_statement


class StatementSafetyTests(unittest.TestCase):
    def test_foreign_currency_symbols_and_codes_are_not_xof(self):
        for text in ("Vente 10 €", "Vente 100 NGN", "Vente $500", "Vente 12 GBP", "Vente 700 nairas"):
            with self.subTest(text=text), self.assertRaises(ValueError):
                parse_statement(text)

    def test_amount_multipliers_and_hypothetical_sales_require_rephrasing(self):
        for text in ("Vente 1 million de francs", "Vente 12 mille francs", "Vente 5 millions",
                     "J’aurais vendu 12000 francs", "Vente potentielle 12000 francs"):
            with self.subTest(text=text), self.assertRaises(ValueError):
                parse_statement(text)

    def test_supported_currency_and_completed_statements_remain_valid(self):
        for text in ("Vente 12000", "Vente 12 000 francs CFA", "J'ai vendu du riz pour 12000 XOF",
                     "J’ai encaissé 12000 FCFA", "Vente 12000 francs aujourd'hui."):
            with self.subTest(text=text):
                self.assertEqual(parse_statement(text).amount, 12000)


class LedgerTimeTests(unittest.TestCase):
    def setUp(self):
        self.db = Ledger()
        self.now = int(datetime(2026, 11, 22, 12, tzinfo=timezone.utc).timestamp())
        self.db.add_payment("p", "M", 12000, "incoming", self.now)
        self.entry = self.db.propose("M", parse_statement("Vente 12000 francs"), "request", self.now)
        self.db.confirm(self.entry["id"], 1, self.now + 100)

    def tearDown(self):
        self.db.close()

    def test_reconciliation_cannot_precede_confirmation(self):
        with self.assertRaises(ValueError):
            self.db.reconcile(self.entry["id"], self.now + 50)
        self.assertIsNone(self.db.get(self.entry["id"])["matched_payment"])

    def test_cancellation_cannot_precede_confirmation(self):
        with self.assertRaises(ValueError):
            self.db.cancel(self.entry["id"], self.now + 50)
        self.assertEqual(self.db.get(self.entry["id"])["status"], "confirmed")

    def test_reconciliation_and_cancellation_after_confirmation_remain_valid(self):
        self.assertEqual(self.db.reconcile(self.entry["id"], self.now + 100)["match_status"], "matched")
        self.assertEqual(self.db.cancel(self.entry["id"], self.now + 101)["status"], "cancelled")
        self.assertEqual(self.db.summary("M")["sales"], 0)

    def test_late_audit_event_cannot_be_followed_by_earlier_cancellation(self):
        self.db.reconcile(self.entry["id"], self.now + 200)
        with self.assertRaises(ValueError):
            self.db.cancel(self.entry["id"], self.now + 150)

    def test_payment_amount_must_be_integer_not_bool_or_decimal(self):
        for amount in (True, 12000.5, "12000", 0, -1):
            with self.subTest(amount=amount), self.assertRaises(ValueError):
                self.db.add_payment("invalid", "M", amount, "incoming", self.now)


if __name__ == "__main__":
    unittest.main()
