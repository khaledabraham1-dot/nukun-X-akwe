"""Parcours de l'interface réelle avec le moteur de test officiel Streamlit."""

from pathlib import Path
import importlib.util
import unittest

from streamlit.testing.v1 import AppTest

ROOT = Path(__file__).resolve().parents[1]


@unittest.skipUnless((ROOT / "artifacts" / "baseline.json").exists(), "Exécuter l'expérience avant les tests UI")
class AppTests(unittest.TestCase):
    def app(self):
        app = AppTest.from_file(str(ROOT / "app.py"), default_timeout=90).run()
        self.assertEqual(len(app.exception), 0)
        return app

    def test_all_screens_render(self):
        app = self.app()
        for page in ["NUKÚN Protège", "Cahier Akwɛ", "Résultats", "Laboratoire graphe", "Vue d'ensemble"]:
            app.radio(key="page").set_value(page).run()
            with self.subTest(page=page):
                self.assertEqual(len(app.exception), 0)

    @unittest.skipUnless(importlib.util.find_spec("torch") is not None and
                         (ROOT / "artifacts" / "stress_models.json").exists(), "Environnement graphe absent")
    def test_graph_lab_scores_real_exported_model(self):
        app = self.app()
        app.radio(key="page").set_value("Laboratoire graphe").run()
        self.assertEqual(len(app.exception), 0)
        app.button(key="lab_analyze").click().run()
        self.assertEqual(len(app.exception), 0)
        result = app.session_state["lab_result"]
        self.assertGreater(result["nodes"], 0)
        self.assertGreater(result["edges"], 0)
        self.assertTrue(0 <= result["score"] <= 1)
        self.assertEqual(app.session_state["wallet"].balance, 100000)

    def test_sale_requires_confirmation_and_matches_payment(self):
        app = self.app()
        app.radio(key="page").set_value("Cahier Akwɛ").run()
        app.session_state["voice_draft"] = "j'ai vendu pour douze mille francs"
        app.run()
        self.assertEqual(app.text_area(key="statement").value, "j'ai vendu pour douze mille francs")
        self.assertFalse(any(button.key == "confirm_entry" for button in app.button))
        self.assertEqual(app.metric[0].value, "0 XOF")
        app.text_area(key="statement").set_value("J'ai vendu pour 12 000 francs")
        app.button[0].click().run()  # soumission du formulaire
        self.assertEqual(len(app.exception), 0)
        self.assertEqual(app.metric[0].value, "0 XOF")
        app.button(key="confirm_entry").click().run()
        self.assertEqual(len(app.exception), 0)
        self.assertEqual(app.metric[0].value, "12 000 XOF")
        self.assertTrue(any("Rapproché" in str(frame.value) for frame in app.dataframe))
        app.run()
        self.assertEqual(app.metric[0].value, "12 000 XOF")

    def test_transfer_parameters_cannot_change_after_analysis(self):
        app = self.app()
        app.radio(key="page").set_value("NUKÚN Protège").run()
        app.button(key="analyze").click().run()
        self.assertEqual(len(app.exception), 0)
        self.assertEqual(app.session_state["wallet"].balance, 100000)
        app.number_input(key="transfer_amount").set_value(13000).run()
        self.assertFalse(any(button.key == "confirm_transfer" for button in app.button))
        self.assertEqual(app.session_state["wallet"].balance, 100000)

    def test_transfer_and_reset(self):
        app = self.app()
        app.radio(key="page").set_value("NUKÚN Protège").run()
        app.button(key="analyze").click().run()
        if app.checkbox:
            app.checkbox[0].check().run()
        app.button(key="confirm_transfer").click().run()
        self.assertEqual(len(app.exception), 0)
        self.assertEqual(app.session_state["wallet"].balance, 88000)
        app.run()
        self.assertEqual(app.session_state["wallet"].balance, 88000)
        app.button(key="reset").click().run()
        self.assertEqual(len(app.exception), 0)
        self.assertEqual(app.session_state["wallet"].balance, 100000)

    def test_expired_analysis_cannot_be_confirmed(self):
        app = self.app()
        app.radio(key="page").set_value("NUKÚN Protège").run()
        app.button(key="analyze").click().run()
        decision = app.session_state["decision"]
        decision["timestamp"] -= 121
        app.session_state["decision"] = decision
        app.run()
        self.assertFalse(any(button.key == "confirm_transfer" for button in app.button))
        self.assertEqual(app.session_state["wallet"].balance, 100000)

    def test_cancellation_replaces_confirmation_success_message(self):
        app = self.app()
        app.radio(key="page").set_value("Cahier Akwɛ").run()
        app.button[0].click().run()
        app.button(key="confirm_entry").click().run()
        app.button(key="cancel_confirmed").click().run()
        self.assertEqual(app.metric[0].value, "0 XOF")
        self.assertFalse(any("Écriture confirmée" in item.value for item in app.success))
        self.assertTrue(any("annulée" in item.value for item in app.success))


if __name__ == "__main__":
    unittest.main()
