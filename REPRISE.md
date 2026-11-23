# Point de reprise NUKÚN × Akwɛ

Travail suspendu à la demande de l'utilisateur le 22 novembre 2026, avant fermeture du terminal. Reprendre depuis ce fichier, puis consulter `ROADMAP.md`. Ne pas recommencer le projet ni les expériences déjà validées.

## État sauvegardé

- Prototype local Streamlit dans `app.py`, avec portefeuille fictif, cahier Akwɛ, résultats et laboratoire de graphe.
- GraphSAGE entraîné sur CPU, poids JSON exportés et prédictions rejouables. Sept variantes comparées sur trois seeds de stress de 18 000 transactions.
- 50 tests métier et interface réussis, également depuis une extraction de l'archive corrigée.
- 14 contrôles dans Edge réel réussis : cinq écrans, CSV, isolation de sessions, transfert et avertissement, inférence GraphSAGE et viewport mobile. Aucune erreur console ou JavaScript lors de l'exécution finale.
- Corrections effectuées : devises et montants ambigus, chronologie des opérations comptables, types des montants importés, messages d'annulation, espacement sous la barre supérieure et téléchargement sans relance de l'application.
- Rapports : `reports/QA.md`, `reports/browser_checks.json`, `reports/RESULTATS.md`, `reports/STRESS_RESULTATS.md`. Captures dans `reports/screenshots/`.
- Archive actualisée : `dist/nukun-akwe-source.zip`, avec manifeste et `dist/SHA256SUMS`.
- Modifications locales non commitées au dernier contrôle Git ; aucun push effectué pendant cette session.

## Chantier autorisé en cours

L'utilisateur a autorisé l'ajout de la voix française à Akwɛ : enregistrement ou fichier audio, transcription locale, correction du texte, proposition d'écriture, confirmation explicite puis rapprochement. La saisie texte doit rester disponible. Ne jamais créer automatiquement une écriture confirmée à partir de l'audio.

Le 23 novembre, le parcours vocal français a été intégré et vérifié sur CPU. Vosk et le modèle français sont installés localement. Le README documente la réinstallation depuis l'archive source. Les résultats et limites des essais figurent dans reports/QA.md.

Prochaine vérification vocale sur le terrain : dicter une vente et une dépense au microphone avec un locuteur, relire les montants, puis confirmer et consulter le cahier.

Le GPU n'est pas disponible localement ; aucune exécution GPU n'est validée. Le notebook `notebooks/GPU_Challenge.ipynb` et `docs/GPU.md` sont préparés pour une comparaison CPU/GPU sur le même hôte. La voix fon nécessitera une validation dédiée avec un locuteur. L'apport automatique du contexte Akwɛ aux faux positifs n'est pas robuste sur le protocole de stress ; ne pas présenter cette hypothèse comme démontrée.

## Relancer après fermeture du terminal

Depuis `C:\dev\hackhathongpu`, dans PowerShell :

```powershell
.\.venv\Scripts\python.exe -m streamlit run app.py
```

Ouvrir `http://127.0.0.1:8501`. Si le serveur existe encore, réutiliser celui-ci plutôt que lancer une seconde instance sur le même port. Les fichiers et poids sont sur disque ; le portefeuille de démonstration en mémoire et la connexion du navigateur peuvent être réinitialisés par l'arrêt du serveur.

Pour relancer les vérifications seulement si une nouvelle modification le justifie :

```powershell
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
.\.venv\Scripts\python.exe scripts/browser_smoke.py
```

La remise du concours reste fixée au 24 novembre à 23 h 59 selon le courriel. Pitch PDF, vidéo, vérification du formulaire, essai micro terrain, preuve GPU et remise restent à accomplir.
