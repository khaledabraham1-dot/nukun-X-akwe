"""Parcours navigateur réels, données fictives et captures locales de vérification."""

import argparse
import csv
import json
from pathlib import Path
import re
import sys
from time import perf_counter

from playwright.sync_api import expect, sync_playwright


ROOT = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", default="http://127.0.0.1:8501")
    parser.add_argument("--sale-audio", type=Path, help="WAV français de la phrase « j'ai vendu pour douze mille francs »")
    parser.add_argument("--channel", default="msedge" if sys.platform == "win32" else None)
    args = parser.parse_args()
    output = ROOT / "runtime" / "browser-tests"
    output.mkdir(parents=True, exist_ok=True)
    result = {"base_url": args.base_url, "browser_channel": args.channel, "checks": [], "console_errors": [],
              "page_errors": [], "http_errors": [], "screenshots": [], "status": "running"}
    started = perf_counter()
    expect.set_options(timeout=90000)

    def check(name):
        result["checks"].append(name)
        print("OK : " + name, flush=True)

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(channel=args.channel, headless=True)
        result["browser_version"] = browser.version
        context = browser.new_context(viewport={"width": 1440, "height": 1050}, locale="fr-FR", accept_downloads=True)
        page = context.new_page()
        page.set_default_timeout(90000)
        page.on("pageerror", lambda error: result["page_errors"].append(str(error)))
        page.on("console", lambda msg: result["console_errors"].append(msg.text) if msg.type == "error" else None)
        page.on("response", lambda response: result["http_errors"].append({"url": response.url,
                 "status": response.status, "resource_type": response.request.resource_type}) if response.status >= 400 else None)

        def screenshot(name, target=page):
            expect(target.get_by_text("NUKÚN × Akwɛ · Prototype local de recherche · Les scores ne constituent pas une décision financière.", exact=True)).to_be_visible()
            for metric in target.get_by_test_id("stMetricValue").all():
                expect(metric).not_to_be_empty()
            if target.get_by_test_id("stPlotlyChart").first.is_visible():
                expect(target.locator(".js-plotly-plot .main-svg").first).to_be_visible()
            target.evaluate("document.fonts.ready")
            path = output / f"{name}.png"
            target.screenshot(path=str(path), full_page=True, animations="disabled")
            result["screenshots"].append(path.relative_to(ROOT).as_posix())

        def navigate(label, heading):
            page.get_by_test_id("stSidebar").get_by_text(label, exact=True).click()
            expect(page.get_by_role("heading", name=heading)).to_be_visible()
            expect(page.get_by_test_id("stException")).to_have_count(0)

        try:
            page.goto(args.base_url, wait_until="domcontentloaded")
            expect(page.get_by_role("heading", name=re.compile("La confiance commence"))).to_be_visible()
            page.get_by_role("tab", name="30 j").click()
            expect(page.get_by_role("tab", name="30 j")).to_have_attribute("aria-selected", "true")
            page.get_by_role("tab", name="30 j").press("ArrowLeft")
            expect(page.get_by_role("tab", name="7 j")).to_have_attribute("aria-selected", "true")
            screenshot("01-accueil-desktop")
            check("Accueil et rendu desktop")

            page.get_by_role("button", name=re.compile("Ouvrir le cahier")).click()
            expect(page.get_by_role("heading", name="Vos mots. Vos comptes.")).to_be_visible()
            statement = page.get_by_label("Décrivez une opération")
            statement.fill("Vente 10 €")
            page.get_by_role("button", name="Préparer l'écriture", exact=True).click()
            expect(page.get_by_text("Utilisez un montant entier positif en francs CFA, sans décimales.", exact=True)).to_be_visible()
            expect(page.get_by_role("button", name="Confirmer l'écriture", exact=True)).to_have_count(0)
            check("Devise étrangère refusée sans proposition")
            statement.fill("Vente 1 million de francs")
            page.get_by_role("button", name="Préparer l'écriture", exact=True).click()
            expect(page.get_by_text("Utilisez une opération réalisée et un montant intégralement écrit en chiffres.", exact=True)).to_be_visible()
            check("Montant à multiplicateur refusé")
            if args.sale_audio:
                page.get_by_text("Dicter une opération en français", exact=True).click()
                transcribe = page.get_by_role("button", name="Transcrire dans le champ de saisie")
                expect(transcribe).to_be_disabled()
                page.get_by_text("Fichier WAV", exact=True).click()
                upload = page.locator('input[type="file"]')
                upload.set_input_files({"name": "invalide.wav", "mimeType": "audio/wav", "buffer": b"invalid"})
                transcribe.click()
                expect(page.get_by_text("Fichier WAV vide ou illisible.", exact=True)).to_be_visible()
                expect(statement).to_have_value("Vente 1 million de francs")
                upload.set_input_files(args.sale_audio)
                expect(page.get_by_text("Fichier WAV vide ou illisible.", exact=True)).to_have_count(0)
                transcribe.click()
                expect(statement).to_have_value("j'ai vendu pour douze mille francs")
                expect(page.get_by_role("button", name="Confirmer l'écriture", exact=True)).to_have_count(0)
                expect(page.get_by_test_id("stMetricValue").first).to_have_text("0 XOF")
                check("Import WAV invalide puis dictée locale corrigible sans écriture")
            statement.fill("J'ai vendu pour 12 000 francs")
            page.get_by_role("button", name="Préparer l'écriture", exact=True).click()
            expect(page.get_by_role("heading", name="À vérifier avant enregistrement")).to_be_visible()
            expect(page.get_by_test_id("stMetricValue").first).to_have_text("0 XOF")
            check("Aucun total avant confirmation")
            page.get_by_role("button", name="Confirmer l'écriture", exact=True).click()
            expect(page.get_by_test_id("stMetricValue").first).to_have_text("12 000 XOF")
            expect(page.get_by_test_id("stException")).to_have_count(0)
            screenshot("02-cahier-confirme")
            check("Vente confirmée et totaux actualisés")
            with page.expect_download() as download_info:
                page.get_by_role("button", name="Exporter le cahier CSV", exact=True).click()
            csv_path = output / "cahier.csv"
            download_info.value.save_as(str(csv_path))
            rows = list(csv.DictReader(csv_path.open(encoding="utf-8-sig")))
            assert rows[0]["amount"] == "12000" and rows[0]["match_status"] == "Rapproché", rows
            check("Téléchargement CSV et rapprochement vérifiés")

            other_context = browser.new_context(viewport={"width": 1280, "height": 900}, locale="fr-FR")
            other = other_context.new_page()
            other.set_default_timeout(90000)
            other.goto(args.base_url, wait_until="domcontentloaded")
            expect(other.get_by_role("heading", name=re.compile("La confiance commence"))).to_be_visible()
            other.get_by_test_id("stSidebar").get_by_text("Cahier Akwɛ", exact=True).click()
            expect(other.get_by_role("heading", name="Vos mots. Vos comptes.")).to_be_visible()
            expect(other.get_by_test_id("stMetricValue").first).to_have_text("0 XOF")
            check("Deux sessions navigateur isolent leurs cahiers")
            other_context.close()
            page.get_by_role("button", name="Annuler cette écriture confirmée", exact=True).click()
            expect(page.get_by_test_id("stMetricValue").first).to_have_text("0 XOF")
            check("Annulation corrige les totaux")

            navigate("NUKÚN Protège", "Un temps pour vérifier.")
            page.get_by_role("button", name="Analyser le transfert", exact=True).click()
            expect(page.get_by_role("button", name="Confirmer le transfert fictif", exact=True)).to_be_visible()
            amount = page.get_by_label("Montant en XOF", exact=True)
            amount.fill("13000")
            amount.press("Tab")
            expect(page.get_by_text("Les paramètres ont changé. Relancez l'analyse avant de confirmer.", exact=True)).to_be_visible()
            expect(page.get_by_role("button", name="Confirmer le transfert fictif", exact=True)).to_have_count(0)
            check("Changement de montant invalide la confirmation")
            amount.fill("12000")
            amount.press("Tab")
            page.get_by_role("button", name="Analyser le transfert", exact=True).click()
            acknowledgement = page.get_by_label("J'ai vérifié le destinataire et lu l'avertissement.", exact=True)
            if acknowledgement.count():
                expect(page.get_by_role("button", name="Confirmer le transfert fictif", exact=True)).to_be_disabled()
                page.get_by_text("J'ai vérifié le destinataire et lu l'avertissement.", exact=True).click()
                expect(acknowledgement).to_be_checked()
                check("Avertissement à acquitter avant confirmation")
            page.get_by_role("button", name="Confirmer le transfert fictif", exact=True).click()
            expect(page.get_by_text(re.compile("Transfert fictif confirmé : 12 000 XOF"))).to_be_visible()
            expect(page.get_by_text(re.compile("Disponible : 88 000 XOF"))).to_be_visible()
            expect(page.get_by_role("button", name="Confirmer le transfert fictif", exact=True)).to_have_count(0)
            screenshot("03-transfert-confirme")
            check("Débit fictif unique de 12 000 XOF")

            page.get_by_role("combobox").first.click()
            page.get_by_role("option", name="X000 · scénario de compte suspect", exact=True).click()
            page.get_by_role("button", name="Analyser le transfert", exact=True).click()
            expect(page.get_by_label("J'ai vérifié le destinataire et lu l'avertissement.", exact=True)).to_be_visible()
            expect(page.get_by_role("button", name="Confirmer le transfert fictif", exact=True)).to_be_disabled()
            screenshot("03b-avertissement-risque")
            page.get_by_text("J'ai vérifié le destinataire et lu l'avertissement.", exact=True).click()
            expect(page.get_by_label("J'ai vérifié le destinataire et lu l'avertissement.", exact=True)).to_be_checked()
            expect(page.get_by_role("button", name="Confirmer le transfert fictif", exact=True)).to_be_enabled()
            check("Scénario à risque exige l'acquittement explicite")

            navigate("Résultats", "Mesurer ce qui change.")
            expect(page.get_by_text("Comptes nouveaux et contexte imparfait", exact=True)).to_be_visible()
            expect(page.get_by_test_id("stDataFrame").first).to_be_visible()
            expect(page.get_by_test_id("stException")).to_have_count(0)
            screenshot("04-resultats")
            check("Résultats et tableaux rendus dans le navigateur")
            navigate("Laboratoire graphe", "Interroger le réseau entraîné.")
            page.get_by_role("button", name="Calculer avec le réseau entraîné", exact=True).click()
            expect(page.get_by_text("Indice expérimental", exact=True)).to_be_visible()
            expect(page.get_by_test_id("stException")).to_have_count(0)
            screenshot("05-graphe-calcule")
            check("Inférence GraphSAGE déclenchée depuis le navigateur")

            mobile_context = browser.new_context(viewport={"width": 390, "height": 844}, is_mobile=True,
                                                  has_touch=True, device_scale_factor=1, locale="fr-FR", color_scheme="dark")
            mobile = mobile_context.new_page()
            mobile.set_default_timeout(90000)
            mobile.goto(args.base_url, wait_until="domcontentloaded")
            expect(mobile.get_by_role("heading", name=re.compile("La confiance commence"))).to_be_visible()
            expect(mobile.get_by_role("tab", name="7 j")).to_be_visible()
            mobile.get_by_role("tab", name="30 j").click()
            expect(mobile.get_by_role("tab", name="30 j")).to_have_attribute("aria-selected", "true")
            assert mobile.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1"), "Débordement horizontal mobile"
            screenshot("06-accueil-mobile", mobile)
            check("Accueil mobile 390 pixels sans débordement horizontal")
            mobile_context.close()
            assert not result["page_errors"], result["page_errors"]
            assert not result["console_errors"], result["console_errors"]
            result["status"] = "passed"
        except Exception as exc:
            result["status"] = "failed"
            result["failure"] = repr(exc)
            page.screenshot(path=str(output / "failure.png"), full_page=True)
            raise
        finally:
            result["seconds"] = perf_counter() - started
            (output / "results.json").write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
            browser.close()
            print(f"Résultat : {result['status']} · {len(result['checks'])} vérifications", flush=True)


if __name__ == "__main__":
    main()
