"""Interface locale : python -m streamlit run app.py."""

import copy
import importlib.util
from dataclasses import asdict
from datetime import datetime
import json
from pathlib import Path
import time
from uuid import uuid4

import numpy as np
import pandas as pd
import plotly.graph_objects as go
import streamlit as st

from nukun.features import causal_matrix
from nukun.ledger import BENIN_TZ, Ledger, parse_statement
from nukun.model import LogisticRisk
from nukun.simulation import Dataset, Declaration, Transaction, generate
from nukun.wallet import DemoWallet
from nukun.voice import transcribe


ROOT = Path(__file__).resolve().parent
st.set_page_config(page_title="NUKÚN × Akwɛ", page_icon="◈", layout="wide")


def money(amount):
    return f"{int(amount):,}".replace(",", " ") + " XOF"


@st.cache_resource(show_spinner="Chargement de l'historique et des modèles locaux…")
def load_engine(artifact_text):
    artifact = json.loads(artifact_text)
    directory = ROOT / "data" / "generated"
    if all((directory / name).exists() for name in ["transactions.jsonl", "declarations.jsonl", "evaluation_only.jsonl"]):
        def rows(name):
            return [json.loads(line) for line in (directory / name).read_text(encoding="utf-8").splitlines()]
        txs = [Transaction(**r) for r in rows("transactions.jsonl")]
        declarations = [Declaration(**r) for r in rows("declarations.jsonl")]
        evaluation = rows("evaluation_only.jsonl")
        profiles = {r["receiver"]: e["receiver_profile"] for r, e in
                    zip([asdict(t) for t in txs], evaluation, strict=True)}
        # Les profils incluent aussi les comptes uniquement émetteurs ; le digest
        # complet se vérifie via la régénération déterministe ci-dessous.
        expected = generate(artifact["seed"], artifact["size"])
        dataset = Dataset(txs, declarations, [e["is_fraud"] for e in evaluation], expected.profiles, artifact["seed"])
    else:
        dataset = generate(artifact["seed"], artifact["size"])
    if dataset.digest() != artifact["dataset_sha256"]:
        raise ValueError("Les données ne correspondent pas à l'artefact. Relancez l'expérience.")
    _, history = causal_matrix(dataset.transactions, dataset.declarations)
    now = dataset.transactions[-1].timestamp + 3600
    for declaration in dataset.declarations:
        if declaration.known_at < now:
            history.confirm(declaration, now)
    history.observe(Transaction("DEMO_SALE", now - 600, "C0499", "M000", 12000))
    models = {name: LogisticRisk.from_dict(obj["model"]) for name, obj in artifact["models"].items()}
    return dataset, history, models, now, artifact


def graph_figure(history, receiver, now):
    account = history.accounts.get(receiver)
    peers = {} if account is None else {
        t.sender: t.amount for t in account.incoming if now - history.window <= t.timestamp < now
    }
    peers = list(peers.items())[:16]
    fig = go.Figure()
    for i, (peer, amount) in enumerate(peers):
        angle = 2 * np.pi * i / max(1, len(peers))
        x, y = np.cos(angle), np.sin(angle)
        fig.add_trace(go.Scatter(x=[0, x], y=[0, y], mode="lines", line={"color": "#31534E", "width": 1},
                                 hoverinfo="skip", showlegend=False))
        fig.add_trace(go.Scatter(x=[x], y=[y], mode="markers+text", text=[peer], textposition="top center",
                                 marker={"size": 10, "color": "#79AAAE"},
                                 hovertext=[f"{peer} → {receiver} · dernier montant {money(amount)}"],
                                 hoverinfo="text", showlegend=False))
    fig.add_trace(go.Scatter(x=[0], y=[0], mode="markers+text", text=[receiver], textposition="bottom center",
                             marker={"size": 28, "color": "#64E8B6"}, showlegend=False, hoverinfo="text"))
    fig.update_layout(height=330, margin={"l": 25, "r": 25, "t": 20, "b": 20},
                      paper_bgcolor="rgba(0,0,0,0)", plot_bgcolor="rgba(0,0,0,0)",
                      xaxis={"visible": False, "range": [-1.35, 1.35]},
                      yaxis={"visible": False, "scaleanchor": "x", "range": [-1.3, 1.3]})
    return fig


def stress_results():
    path = ROOT / "reports" / "stress_metrics.json"
    if not path.exists():
        st.info("L'expérience de stress n'a pas encore été exécutée.")
        return
    stress = json.loads(path.read_text(encoding="utf-8"))
    st.subheader("Comptes nouveaux et contexte imparfait")
    environment = stress["environment"]
    if stress["graph_status"] == "executed":
        st.info(f"GraphSAGE entraîné et évalué sur {environment['device'].upper()} · "
                "comparaison avec un réseau sans agrégation et des références tabulaires.")
    else:
        st.warning("Cette exécution ne comprend pas les modèles de graphe.")
    seed = st.selectbox("Seed du protocole de stress", [r["seed"] for r in stress["runs"]], key="stress_seed")
    run = next(r for r in stress["runs"] if r["seed"] == seed)
    rows, populations = [], []
    for name, result in run["models"].items():
        m = result["test"]
        interval = run["uncertainty"]["models"][name]["merchant_fpr"]
        rows.append({"Variante": name, "Rappel fraude": m["recall"], "Précision": m["precision"],
                     "Average precision": m["average_precision"], "FPR commerçants": m["merchant_fpr"],
                     "FP commerçants": m["merchant_false_positives"], "Rappel imitateurs": m["imitator_recall"],
                     "IC FPR bas": None if interval is None else interval["low"],
                     "IC FPR haut": None if interval is None else interval["high"]})
        if name.endswith("akwe"):
            p = result["populations"]
            populations.append({"Variante": name,
                                "FPR sans Akwɛ": p["merchants_without_akwe"]["fpr"],
                                "Transactions commerçants sans Akwɛ": p["merchants_without_akwe"]["n"],
                                "FPR nouveaux commerçants": p["new_merchants"]["fpr"],
                                "Rappel nouveaux comptes": p["new_to_training"]["recall"],
                                "Rappel contexte en panne": result["blackout_test"]["recall"]})
    frame = pd.DataFrame(rows)
    st.dataframe(frame, hide_index=True, column_config={name: st.column_config.NumberColumn(format="percent")
                 for name in ["Rappel fraude", "Précision", "FPR commerçants", "Rappel imitateurs", "IC FPR bas", "IC FPR haut"]})
    st.caption("Seuils fixés sur validation à 80 % de rappel cible. Les résultats de test sont publiés sans réajustement. "
               "Un FPR plus bas accompagné d'un rappel plus bas ne suffit pas à démontrer une amélioration.")
    chart = go.Figure()
    for field, color in [("Rappel fraude", "#64E8B6"), ("FPR commerçants", "#E6AA80")]:
        chart.add_trace(go.Bar(name=field, x=frame["Variante"], y=frame[field], marker_color=color))
    chart.update_layout(height=330, yaxis={"range": [0, 1]}, barmode="group", margin={"t": 20, "b": 20})
    st.plotly_chart(chart, width="stretch")
    with st.expander("Comptes nouveaux, absence d'Akwɛ et panne de contexte", expanded=True):
        st.dataframe(pd.DataFrame(populations), hide_index=True)
        st.caption("Les nouveaux acteurs n'apparaissent qu'au jour 24, en dehors de l'entraînement et de la validation. "
                   "La panne retire les variables Akwɛ sans changer les poids ni le seuil.")
    with st.expander("Incertitude et traçabilité du protocole"):
        st.write(f"{run['uncertainty']['repeats']} tirages bootstrap par compte destinataire. "
                 "Ces intervalles restent exploratoires et ne représentent pas l'incertitude terrain.")
        st.json(run["uncertainty"]["paired_context_deltas"])
        st.code(f"Protocole : {stress['protocol']['protocol_id']}\nSHA-256 : {stress['protocol_sha256']}\n"
                f"Données : {run['dataset_sha256']}\nAppareil : {environment['device']}\nPyTorch : {environment['torch']}", language=None)
    st.download_button("Télécharger le rapport de stress JSON", json.dumps(stress, ensure_ascii=False, indent=2),
                       "nukun-stress-metrics.json", "application/json", key="download_stress", on_click="ignore")
    st.caption("Simulation contrôlée : activité, déclarations et coordination sont des hypothèses. "
               "Les résultats de ce protocole ne choisissent pas automatiquement le moteur du portefeuille.")


@st.cache_resource(show_spinner="Chargement du réseau entraîné et du jeu de stress…")
def load_graph_lab(artifact_text):
    from nukun.graph_inference import load_research_engine
    return load_research_engine(json.loads(artifact_text))


def graph_lab():
    st.caption("04 / LABORATOIRE DU GRAPHE")
    st.title("Interroger le réseau entraîné.")
    st.write("Rejeu des poids de l'expérience de stress, sans réentraînement. "
             "Les indices sont expérimentaux et ne déclenchent aucun transfert.")
    if importlib.util.find_spec("torch") is None:
        st.info("Lancez l'application avec l'environnement du projet qui contient PyTorch pour activer ce laboratoire.")
        st.code(".\\.venv\\Scripts\\python.exe -m streamlit run app.py", language="powershell")
        return
    path = ROOT / "artifacts" / "stress_models.json"
    if not path.exists():
        st.info("Exécutez d'abord le protocole de stress avec les modèles de graphe.")
        return
    artifact = json.loads(path.read_text(encoding="utf-8"))
    if "size" not in artifact:
        st.info("L'expérience est en cours de mise à jour. Le laboratoire sera disponible après sa fin.")
        return
    try:
        history, models, now = load_graph_lab(json.dumps(artifact))
    except (ValueError, RuntimeError) as exc:
        st.error(str(exc))
        return
    if not models:
        st.info("Cette exécution ne comporte pas de réseau exporté.")
        return
    left, right = st.columns(2)
    with left:
        model_name = st.selectbox("Réseau à examiner", list(models), index=list(models).index("sage_history"), key="lab_model")
        receiver = st.selectbox("Compte destinataire fictif", ["M000", "X000", "I000", "M064"], key="lab_receiver")
        amount = int(st.number_input("Montant de la proposition en XOF", min_value=100, max_value=1000000,
                                     value=12000, step=100, key="lab_amount"))
        blackout = st.checkbox("Simuler l'indisponibilité du contexte Akwɛ", key="lab_blackout")
        if st.button("Calculer avec le réseau entraîné", type="primary", key="lab_analyze"):
            from nukun.graph_inference import analyze
            result = analyze(history, models[model_name], now, receiver, amount, blackout)
            st.session_state.lab_result = {**result, "model": model_name, "receiver": receiver,
                                           "amount": amount, "blackout": blackout,
                                           "threshold": artifact["thresholds"][model_name]}
        result = st.session_state.get("lab_result")
        if result and (result["model"], result["receiver"], result["amount"], result["blackout"]) == (model_name, receiver, amount, blackout):
            a, b = st.columns(2)
            a.metric("Indice expérimental", f"{100 * result['score']:.1f} / 100")
            b.metric("Seuil fixé sur validation", f"{100 * result['threshold']:.1f} / 100")
            st.caption(f"{result['nodes']} nœuds · {result['edges']} liens orientés · "
                       f"calcul local {result['milliseconds']:.1f} ms sur {result['device'].upper()}. "
                       "Mesure ponctuelle, sans garantie de latence.")
            st.json(result["facts"])
    with right:
        st.plotly_chart(graph_figure(history, receiver, now), width="stretch")
        st.caption("Aperçu d'au plus 16 émetteurs. Le réseau analyse le graphe historique complet disponible, "
                   "pas seulement ces liens affichés.")
        st.write(f"Modèle exporté de la seed **{artifact['seed']}**. "
                 "L'instantané de cette proposition est construit au jour 30 avec les événements antérieurs.")
        st.caption("Le choix du modèle ici est une exploration manuelle. Le moteur du portefeuille n'est pas remplacé. "
                   "Un faible indice ne constitue pas une preuve de légitimité.")


def main():
    st.markdown("""<style>
    .block-container {max-width:1280px;padding-top:4rem;}
    [data-testid="stMetric"] {background:#132127;border:1px solid #284039;border-radius:12px;padding:18px;}
    [data-testid="stMetricLabel"] {color:#A4BDB5;}
    h1 {letter-spacing:-.045em;font-weight:750;}
    div.stButton > button[kind="primary"] {color:#0B1317;font-weight:700;}
    </style>""", unsafe_allow_html=True)

    st.sidebar.markdown("## ◈ NUKÚN × Akwɛ")
    st.sidebar.caption("Protéger l'argent. Comprendre l'activité.")
    page = st.sidebar.radio("Espace de travail", ["Vue d'ensemble", "NUKÚN Protège", "Cahier Akwɛ", "Résultats", "Laboratoire graphe"],
                            key="page", label_visibility="collapsed")
    st.sidebar.divider()
    st.sidebar.caption("GPU CHALLENGE 2026 · BÉNIN")
    st.sidebar.info("Portefeuille fictif · données simulées · exécution CPU")

    artifact_path = ROOT / "artifacts" / "baseline.json"
    if not artifact_path.exists():
        st.title("Initialiser le prototype")
        st.info("Exécutez l'expérience pour produire les données, modèles et résultats, puis rechargez cette page.")
        st.code("python -m nukun.experiment --size 30000 --seeds 2026 2027 2028", language="bash")
        return
    try:
        dataset, base_history, models, base_now, artifact = load_engine(artifact_path.read_text(encoding="utf-8"))
    except (ValueError, OSError, KeyError) as exc:
        st.error(str(exc))
        return

    if "demo_id" not in st.session_state:
        st.session_state.demo_id = uuid4().hex
        st.session_state.wallet = DemoWallet()
        st.session_state.offset = int(time.time()) - base_now
    wallet = st.session_state.wallet
    now_epoch = int(time.time())
    now_sim = max(base_now, now_epoch - st.session_state.offset) + 1
    runtime = ROOT / "runtime"
    runtime.mkdir(exist_ok=True)
    db = Ledger(runtime / f"{st.session_state.demo_id}.sqlite")
    try:
        if not db.db.execute("SELECT 1 FROM payments WHERE id='DEMO_SALE'").fetchone():
            db.add_payment("DEMO_SALE", "M000", 12000, "incoming", base_now - 600 + st.session_state.offset)
        history = copy.copy(base_history)
        history.matches = base_history.matches.copy()
        # Les écritures de cette session complètent le même moteur de risque.
        for entry in db.entries("M000"):
            if entry["status"] == "confirmed" and entry["matched_payment"]:
                history.confirm(Declaration(entry["id"], "M000", entry["matched_payment"], entry["amount"],
                                            entry["confirmed_at"] - st.session_state.offset), now_sim)
        report_path = ROOT / "reports" / "metrics.json"
        report = json.loads(report_path.read_text(encoding="utf-8")) if report_path.exists() else None
        if report and report["runs"][0]["dataset_sha256"] != artifact["dataset_sha256"]:
            st.error("Rapport et modèle ne correspondent pas. Relancez l'expérience.")
            return

        if page == "Vue d'ensemble":
            st.caption("NUKÚN × Akwɛ / PROTOTYPE DE RECHERCHE")
            st.title("La confiance commence\npar comprendre les flux.")
            st.markdown("Un même historique pour **repérer les transferts suspects** et **tenir les comptes des commerçants**. "
                        "Akwɛ apporte un contexte commercial au moteur de risque ; son effet est mesuré sur simulation.")
            a, b, c = st.columns(3)
            a.metric("Transactions simulées", f"{len(dataset.transactions):,}".replace(",", " "))
            b.metric("Fenêtre d'analyse", "7 jours")
            c.metric("Solde de démonstration", money(wallet.balance))
            st.write("")
            left, right = st.columns([1.1, 1])
            with left:
                st.subheader("Le commerçant derrière les paiements")
                st.plotly_chart(graph_figure(history, "M000", now_sim), width="stretch")
                st.caption("Encaissements fictifs de M000, 16 contreparties au maximum. La visualisation n'est pas un GNN.")
            with right:
                st.subheader("Trois parcours à explorer")
                st.markdown("**01 · Protéger un transfert**\n\nAnalysez le destinataire, consultez les motifs et confirmez le paiement fictif.")
                st.markdown("**02 · Confirmer une vente**\n\nSaisissez « J'ai vendu pour 12 000 francs », vérifiez l'écriture et rapprochez le paiement.")
                st.markdown("**03 · Examiner les résultats**\n\nComparez règles, modèle historique et contexte Akwɛ sur les mêmes périodes de test.")
                st.caption("La saisie texte est opérationnelle. L'expérience GraphSAGE figure dans les résultats ; "
                           "la voix fon et les mesures GPU restent à réaliser.")

        elif page == "NUKÚN Protège":
            st.caption("01 / PRÉPARER · COMPRENDRE · CONFIRMER")
            st.title("Un temps pour vérifier.")
            st.write("Analysez un destinataire avant de confirmer un transfert depuis votre portefeuille fictif.")
            choices = {"M000 · commerçant de démonstration": "M000",
                       "X000 · scénario de compte suspect": "X000",
                       "I000 · scénario d'activité imitée": "I000",
                       "C0001 · particulier": "C0001"}
            col, graph = st.columns([1, 1])
            with col:
                receiver_label = st.selectbox("Destinataire", list(choices), key="receiver")
                receiver = choices[receiver_label]
                amount = int(st.number_input("Montant en XOF", min_value=100, max_value=100000, value=12000, step=100, key="transfer_amount"))
                st.caption(f"Disponible : {money(wallet.balance)}. Aucun argent réel n'est déplacé.")
                if st.button("Analyser le transfert", type="primary", key="analyze"):
                    st.session_state.pop("transfer_success", None)
                    tx = Transaction("PROPOSAL", now_sim, "C0000", receiver, amount)
                    vector = history.vector(tx)
                    score = float(models["R1_history_akwe"].score(vector)[0])
                    try:
                        req = wallet.prepare(receiver, amount, score, artifact["models"]["R1_history_akwe"]["threshold"])
                        st.session_state.decision = {
                            "request_id": req.id, "receiver": receiver, "amount": amount,
                            "with_context": score,
                            "without_context": float(models["R1_history"].score(vector)[0]),
                            "facts": history.describe(tx), "timestamp": now_epoch,
                        }
                    except ValueError as exc:
                        st.error(str(exc))
                decision = st.session_state.get("decision")
                if decision and wallet.pending:
                    if (decision["receiver"], decision["amount"]) != (receiver, amount):
                        st.info("Les paramètres ont changé. Relancez l'analyse avant de confirmer.")
                    elif now_epoch - decision["timestamp"] > 120:
                        st.warning("L'analyse a expiré. Relancez-la avant de confirmer.")
                    else:
                        req = wallet.pending
                        risky = req.score >= req.threshold
                        if risky:
                            st.warning("Vigilance renforcée : vérifiez l'identité du destinataire par un canal de confiance.")
                        else:
                            st.info("Le seuil d'alerte n'est pas franchi. Cela ne garantit pas la légitimité du destinataire.")
                        x, y = st.columns(2)
                        x.metric("Indice avec Akwɛ", f"{100 * decision['with_context']:.1f} / 100")
                        y.metric("Indice sans Akwɛ", f"{100 * decision['without_context']:.1f} / 100")
                        st.caption("Deux modèles et seuils validés séparément. Indices non calibrés, pas probabilités de fraude.")
                        facts = decision["facts"]
                        st.markdown(f"Sur 7 jours : **{facts['incoming_count']} encaissements**, "
                                    f"**{facts['unique_senders']} émetteurs distincts**, "
                                    f"**{facts['repeat_share']:.0%}** de paiements issus de clients récurrents, "
                                    f"**{facts['matched_share']:.0%}** du montant encaissé rapproché du cahier.")
                        st.caption("Ces faits décrivent l'historique ; ils ne constituent pas une explication causale du modèle.")
                        acknowledged = st.checkbox("J'ai vérifié le destinataire et lu l'avertissement.", key=f"ack_{req.id}") if risky else True
                        if st.button("Confirmer le transfert fictif", disabled=not acknowledged, key="confirm_transfer"):
                            wallet.confirm(req.id, acknowledged)
                            st.session_state.transfer_success = f"Transfert fictif confirmé : {money(req.amount)} vers {req.receiver}."
                            st.rerun()
                if st.session_state.get("transfer_success"):
                    st.success(st.session_state.transfer_success)
            with graph:
                st.plotly_chart(graph_figure(history, receiver, now_sim), width="stretch")
                st.caption("Les noms des scénarios sont fournis pour la démonstration et ne sont jamais des variables du modèle.")
            if wallet.completed:
                with st.expander("Journal des transferts fictifs"):
                    st.dataframe(pd.DataFrame([asdict(t) for t in wallet.completed.values()]), hide_index=True)

        elif page == "Cahier Akwɛ":
            st.caption("02 / LE CAHIER QUI DONNE DU CONTEXTE")
            st.title("Vos mots. Vos comptes.")
            st.write("Commerçant M000 · ventes et dépenses du jour · saisie française bornée à un montant par phrase.")
            totals = db.summary("M000")
            a, b, c = st.columns(3)
            a.metric("Ventes confirmées", money(totals["sales"]))
            b.metric("Dépenses confirmées", money(totals["expenses"]))
            c.metric("Solde des écritures", money(totals["net_recorded"]))
            left, right = st.columns([1.2, 1])
            with left:
                with st.form("statement_form"):
                    if "voice_draft" in st.session_state:
                        st.session_state.statement = st.session_state.pop("voice_draft")
                    st.session_state.setdefault("statement", "J'ai vendu pour 12 000 francs")
                    statement = st.text_area("Décrivez une opération", key="statement")
                    channel_label = st.radio("Encaissement ou paiement", ["Mobile money", "Espèces"], horizontal=True)
                    prepare = st.form_submit_button("Préparer l'écriture", type="primary")
                with st.expander("Dicter une opération en français"):
                    st.caption("Dictez une phrase de 60 secondes maximum. Après transcription, relisez le texte et écrivez le montant en chiffres avant de préparer l’écriture.")
                    source = st.radio("Source audio", ["Microphone", "Fichier WAV"], horizontal=True)
                    if source == "Microphone":
                        clip = st.audio_input("Enregistrer une opération")
                    else:
                        clip = st.file_uploader("WAV mono 16 bits, 16–48 kHz", type=["wav"])
                    if st.button("Transcrire dans le champ de saisie", disabled=clip is None):
                        try:
                            st.session_state.voice_draft = transcribe(clip.getvalue())
                        except ValueError as exc:
                            st.warning(str(exc))
                        except Exception:
                            st.warning("Dictée locale indisponible. Vérifiez l’installation vocale indiquée dans le README ou utilisez la saisie texte.")
                        else:
                            st.rerun()
                if prepare:
                    st.session_state.pop("ledger_success", None)
                    pending_id = st.session_state.get("pending_entry")
                    pending = db.get(pending_id) if pending_id else None
                    if pending and pending["status"] == "proposed":
                        st.warning("Confirmez ou annulez d'abord la proposition ci-dessous.")
                    else:
                        try:
                            proposal = parse_statement(statement, "cash" if channel_label == "Espèces" else "mobile_money")
                            entry = db.propose("M000", proposal, uuid4().hex, now_epoch)
                            st.session_state.pending_entry = entry["id"]
                        except ValueError as exc:
                            st.error(str(exc))
                pending_id = st.session_state.get("pending_entry")
                pending = db.get(pending_id) if pending_id else None
                if pending and pending["status"] == "proposed":
                    st.subheader("À vérifier avant enregistrement")
                    kind = "Vente" if pending["kind"] == "sale" else "Dépense"
                    st.info(f"{kind} · {money(pending['amount'])} · "
                            f"{'espèces' if pending['channel'] == 'cash' else 'mobile money'}")
                    st.caption("Cette proposition ne figure pas encore dans vos totaux. Pour corriger, annulez puis reformulez.")
                    confirm, cancel = st.columns(2)
                    if confirm.button("Confirmer l'écriture", type="primary", key="confirm_entry"):
                        db.confirm(pending_id, pending["version"], now_epoch)
                        db.reconcile(pending_id, now_epoch)
                        st.session_state.ledger_success = "Écriture confirmée. Le rapprochement a été vérifié."
                        st.rerun()
                    if cancel.button("Annuler la proposition", key="cancel_entry"):
                        db.cancel(pending_id, now_epoch)
                        st.session_state.ledger_success = "Proposition annulée. Aucun montant n'a été ajouté au cahier."
                        st.rerun()
                if st.session_state.get("ledger_success"):
                    st.success(st.session_state.ledger_success)
            with right:
                st.subheader("Un paiement à rapprocher")
                st.write("**12 000 XOF reçus** · compte M000 · paiement fictif `DEMO_SALE`.")
                st.caption("Le rapprochement exige une écriture confirmée, le même montant, le même jour et le bon sens. "
                           "Les correspondances multiples restent ambiguës.")
                st.subheader("Dossier financier descriptif")
                st.write(f"{totals['confirmed_count']} écriture(s) confirmée(s), {totals['matched_count']} rapprochée(s).")
                st.caption("Ce dossier décrit uniquement les écritures saisies. Il ne prédit pas le défaut, "
                           "ne calcule pas un droit au crédit et ne représente pas le solde bancaire.")
            entries = db.entries("M000")
            if entries:
                st.subheader("Votre cahier")
                labels = {"proposed": "À confirmer", "confirmed": "Confirmée", "cancelled": "Annulée",
                          "matched": "Rapproché", "unmatched": "Sans correspondance", "ambiguous": "Ambigu",
                          "cash": "Espèces", "pending": "En attente"}
                frame = pd.DataFrame(entries)[["id", "kind", "amount", "channel", "status", "match_status"]]
                frame["kind"] = frame["kind"].map({"sale": "Vente", "expense": "Dépense"})
                for column in ("status", "match_status"):
                    frame[column] = frame[column].replace(labels)
                st.dataframe(frame.rename(columns={"kind": "Nature", "amount": "Montant XOF", "status": "Statut",
                                                   "channel": "Canal", "match_status": "Rapprochement"}), hide_index=True)
                st.download_button("Exporter le cahier CSV", frame.to_csv(index=False).encode("utf-8-sig"), "akwe-cahier.csv", "text/csv", on_click="ignore")
                confirmed = [e for e in entries if e["status"] == "confirmed"]
                if confirmed:
                    target = st.selectbox("Écriture à annuler si nécessaire", [e["id"] for e in confirmed],
                                          format_func=lambda eid: next(f"{e['kind']} · {money(e['amount'])} · {eid[:8]}" for e in confirmed if e["id"] == eid))
                    if st.button("Annuler cette écriture confirmée", key="cancel_confirmed"):
                        db.cancel(target, now_epoch)
                        st.session_state.ledger_success = "Écriture annulée. Les totaux ont été corrigés."
                        st.rerun()

        elif page == "Laboratoire graphe":
            graph_lab()

        else:
            st.caption("03 / DES PREUVES AVANT LES PROMESSES")
            st.title("Mesurer ce qui change.")
            st.info("Deux expériences distinctes : référence initiale et protocole de stress avec GraphSAGE. "
                    "Le portefeuille conserve son moteur de référence.")
            with st.expander("Expérience de stress et GraphSAGE", expanded=True):
                stress_results()
            st.subheader("Expérience initiale sur données plus simples")
            if not report:
                st.warning("Rapport absent. Relancez l'expérience.")
                return
            seed = st.selectbox("Répétition de l'expérience", [r["seed"] for r in report["runs"]])
            run = next(r for r in report["runs"] if r["seed"] == seed)
            rows = []
            for name, result in run["models"].items():
                m = result["test"]
                rows.append({"Variante": name, "Rappel fraude": m["recall"], "Précision": m["precision"],
                             "Average precision": m["average_precision"], "FP commerçants": m["merchant_false_positives"],
                             "Commerçants": m["merchant_count"], "Rappel imitateurs": m["imitator_recall"]})
            frame = pd.DataFrame(rows)
            st.dataframe(frame, hide_index=True, column_config={name: st.column_config.NumberColumn(format="percent")
                         for name in ["Rappel fraude", "Précision", "Rappel imitateurs"]})
            chart = go.Figure()
            for field, color in [("Rappel fraude", "#64E8B6"), ("Précision", "#76A6E8"), ("Average precision", "#D8BC7A")]:
                chart.add_trace(go.Bar(name=field, x=frame["Variante"], y=frame[field], marker_color=color))
            chart.update_layout(height=330, yaxis={"range": [0, 1]}, margin={"t": 20, "b": 20}, barmode="group")
            st.plotly_chart(chart, width="stretch")
            st.caption("Seuils choisis sur validation à 80 % de rappel cible, puis gelés. "
                       "Les rappels test peuvent diverger ; une baisse des faux positifs seule ne prouve pas un progrès.")
            a, b, c = st.columns(3)
            a.metric("Transactions test", f"{run['counts']['test']:,}".replace(",", " "))
            b.metric("Latence locale CPU p95", f"{run['benchmark']['p95_ms']:.3f} ms")
            c.metric("Répétitions", str(len(report["runs"])))
            st.caption(run["benchmark"]["includes"] + ". Mesure sur 200 requêtes après 20 échauffements.")
            with st.expander("Protocole et limites", expanded=True):
                st.markdown("Entraînement : jours 0 à 18. Validation : jours 18 à 24. Test : jours 24 à 30. "
                            "L'historique évolue pendant le test avec les événements antérieurs, sans réentraîner le modèle. "
                            "Les déclarations adverses sont simulées ; les distributions et leur couverture sont des hypothèses. "
                            "Les mêmes comptes peuvent apparaître à plusieurs périodes. La validation sur des comptes nouveaux, "
                            "des scénarios inédits et des données terrain reste nécessaire.")
                st.code(f"Seed : {seed}\nSHA-256 données : {run['dataset_sha256']}\nSHA-256 sources métier : {report['source_sha256']}", language=None)
            st.download_button("Télécharger les résultats JSON", json.dumps(report, ensure_ascii=False, indent=2),
                               "nukun-metrics.json", "application/json", on_click="ignore")

        st.sidebar.divider()
        if st.sidebar.button("Nouvelle session de démonstration", key="reset"):
            for key in list(st.session_state):
                if key != "page":
                    del st.session_state[key]
            st.rerun()
        st.caption("NUKÚN × Akwɛ · Prototype local de recherche · Les scores ne constituent pas une décision financière.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
