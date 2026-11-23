# NUKÚN × Akwɛ

Prototype du GPU Challenge 2026 : prévention de fraude sur portefeuille fictif et cahier commercial avec confirmation. L'expérience compare une référence par règles, une régression logistique sur l'historique et la même famille de modèle enrichie du contexte commercial rapproché.

**Version 0.2 :** application locale CPU, données simulées, saisie texte française et expérience GraphSAGE réellement entraînée. Le portefeuille conserve son modèle tabulaire ; un laboratoire distinct permet d'interroger les réseaux exportés. Les résultats de référence sont dans [reports/RESULTATS.md](reports/RESULTATS.md), ceux du graphe dans [reports/STRESS_RESULTATS.md](reports/STRESS_RESULTATS.md). L'exécution GPU et la voix fon restent à réaliser ; aucun opérateur réel n'est connecté.

## Équipe

[@Lookman](https://github.com/Lookman) · [@nabilnondichao](https://github.com/nabilnondichao) · [@KOBA2008](https://github.com/KOBA2008)

## Lancer la démonstration

Python 3.12 ou supérieur. Depuis le dossier du projet, sous PowerShell :

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m streamlit run app.py
```

Ouvrir `http://127.0.0.1:8501`. Si les dépendances sont déjà installées, `python -m streamlit run app.py` suffit. L'application écoute uniquement sur la machine locale.

L'artefact JSON du premier modèle et les résultats sont versionnés. Si les données générées sont absentes, l'application les régénère avec la seed de l'artefact, vérifie leur empreinte puis charge l'historique. Le premier chargement prend quelques secondes ; aucun accès réseau n'est nécessaire pour la démo une fois les dépendances installées.

## Modifier l’interface

L’accueil React et TypeScript est livré compilé avec l’application. Pour modifier le frontend, ouvrez le dossier `frontend`, exécutez `npm ci` puis `npm run build`. La compilation contrôle les types et produit les ressources locales Tailwind et React dans `frontend/assets`. Les composants Button et Tabs sont adaptés du registre officiel shadcn/ui New York (révision `055aa6b`). Le menu des paramètres Streamlit permet de choisir le thème clair ou sombre.

## Reproduire les résultats

```powershell
python -m nukun.experiment --size 30000 --seeds 2026 2027 2028
python -m unittest discover -s tests -v
```

Utiliser le Python du venv si nécessaire. L'expérience régénère les données et réentraîne deux modèles pour chacune des trois seeds. Les poids du premier essai alimentent l'application ; les trois essais alimentent le rapport. Pour un essai rapide distinct : `python -m nukun.experiment --size 3000 --seeds 42 --steps 200`. Cette commande remplace les artefacts et résultats : relancer la commande complète pour revenir à la version de présentation.

Les dépendances directes sont épinglées dans `requirements.txt`. `requirements.lock` contient aussi les versions transitives actives sous Windows et Python 3.12 ; pour reproduire cet environnement, utiliser `python -m pip install -r requirements.lock`. Ce snapshot ne contient pas de hashes de wheels. La validation d'une installation vierge reste à effectuer avant remise. Les tests d'interface utilisent `streamlit.testing.v1.AppTest` et les tests métier utilisent `unittest`. Un workflow GitHub Actions Windows est préparé ; il ne sera exécuté qu'après publication du code.

## Reproduire GraphSAGE

Le protocole a été fixé dans [configs/stress_protocol.json](configs/stress_protocol.json) avant les trois essais de stress. Il compare sept variantes : règles, deux régressions, deux MLP et deux GraphSAGE orientés. Les nouveaux acteurs apparaissent seulement au jour 24 ; le test inclut des commerçants sans Akwɛ et des fraudeurs capables de déclarer des montants exacts.

Avec le Python du projet contenant PyTorch :

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements-graph-cpu.lock
.\.venv\Scripts\python.exe -m nukun.stress_experiment --device cpu
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
.\.venv\Scripts\python.exe -m streamlit run app.py
```

Pour un environnement neuf, installer aussi `requirements.txt` ou `requirements.lock`. Le venv de développement actuel hérite des dépendances système ; une installation totalement isolée reste à valider. Sans PyTorch, les résultats exportés restent consultables et les tests de réseau sont explicitement sautés. `--without-graph` permet de calculer seulement les références, sans prétendre avoir exécuté les réseaux.

Les artefacts sont dans `artifacts/stress_models.json`, les résultats dans `reports/stress_metrics.json` et les scores test complets dans `reports/stress_predictions_*.csv`. Les poids JSON sont rejouables sans pickle. Pour une analyse expérimentale en ligne de commande :

```powershell
.\.venv\Scripts\python.exe -m nukun.graph_inference --receiver M000 --amount 12000 --model sage_history
```

Le graphe améliore le classement dans ce simulateur, mais l'apport automatique d'Akwɛ n'est pas robuste. Les commerçants nouveaux restent particulièrement difficiles. Ces résultats n'autorisent aucune exemption ou décision financière automatique. Le notebook et les instructions de GPU sont dans [docs/GPU.md](docs/GPU.md).

## Parcours disponibles

- **Vue d'ensemble** : historique, voisinage des encaissements et état du prototype.
- **NUKÚN Protège** : analyser un transfert, comparer les deux indices, lire les faits puis confirmer. Un changement de montant ou destinataire impose une nouvelle analyse. Un indice élevé impose l'acquittement de l'avertissement.
- **Cahier Akwɛ** : saisir « J'ai vendu pour 12 000 francs », préparer, confirmer et rapprocher le paiement fictif du même montant. Les propositions n'entrent pas dans les totaux. Une annulation est conservée dans le journal.
- **Résultats** : rappel, précision, average precision, faux positifs commerçants, rappel des imitateurs et latence CPU pour chaque seed.
- **Laboratoire graphe** : charger les poids entraînés du protocole de stress et calculer un indice expérimental pour une nouvelle proposition, sans déplacer d'argent.

La saisie accepte une vente ou dépense du jour avec un montant entier en XOF, en mobile money ou espèces. Les dettes, les montants en lettres, plusieurs opérations et les dates relatives nécessitent une correction ; ils ne sont pas devinés. Les écritures d'une session sont persistées dans un fichier SQLite sous `runtime/`, exclu du dépôt. Chaque nouvelle session de démonstration commence avec un autre cahier et un portefeuille fictif de 100 000 XOF.

## Garanties et limites du prototype

Les caractéristiques sont calculées avant observation de la transaction évaluée ; les arêtes au même instant et les déclarations confirmées ultérieurement sont exclues. Les profils latents et labels du simulateur sont réservés à l'évaluation. Un paiement ne peut rapprocher qu'une écriture active, et les candidats ambigus ne sont pas résolus automatiquement.

La régression logistique NumPy est un modèle de référence transparent et portable. Les sorties pondérées sont des indices de classement non calibrés. La carte du voisinage est une visualisation des paiements, sans réseau neuronal de graphe. Le portefeuille n'exécute aucun transfert réel et n'est pas une infrastructure comptable ou bancaire de production.

Le laboratoire utilise un véritable réseau à agrégation de voisins, tandis que la carte visible ne montre qu'un sous-ensemble du graphe. Les comptes n'ont aucun embedding d'identifiant appris ; les tests vérifient l'invariance au renommage et l'absence d'effet des labels et caractéristiques de validation sur l'entraînement. Les intervalles du rapport de stress rééchantillonnent les comptes destinataires et restent exploratoires.

Les seuils sont choisis sur validation pour un rappel cible de 80 %, puis gelés sur test. Les données du test restent synthétiques, certains comptes sont déjà connus et le rappel test varie entre seeds. Les hypothèses déclaratives du générateur peuvent faciliter la classification. Le premier générateur produit très peu de fausses alertes commerçants avant ajout d'Akwɛ ; il ne constitue donc pas encore une preuve solide de réduction de ces alertes. Les montants évités et l'efficacité terrain ne sont pas estimés.

## Organisation du code

| Fichier | Rôle |
| --- | --- |
| `nukun/simulation.py` | Générateur déterministe, transactions et déclarations |
| `nukun/features.py` | Historique causal sur 7 jours, caractéristiques et référence par règles |
| `nukun/model.py` | Régression logistique NumPy, métriques et seuil de validation |
| `nukun/experiment.py` | Entraînement, mesure CPU, empreintes et rapports |
| `nukun/ledger.py` | SQLite, confirmations, annulations, audit et rapprochement |
| `nukun/wallet.py` | Transferts fictifs idempotents |
| `app.py` | Interface Streamlit |

Le calendrier et les décisions de périmètre sont dans [ROADMAP.md](ROADMAP.md). Le scénario de présentation est dans [docs/DEMO.md](docs/DEMO.md). La provenance et le dictionnaire des données sont dans [data/README.md](data/README.md).

Pour emporter les sources, poids et résultats sans le venv ni les données de session : `python scripts/package_source.py`. L'archive est écrite dans `dist/nukun-akwe-source.zip`, avec un manifeste de hashes par fichier et une somme SHA-256 de l'archive.

## Vérification dans un navigateur réel

Le bilan et les corrections issus de l'audit sont dans [reports/QA.md](reports/QA.md). Les contrôles Edge couvrent les cinq écrans, le CSV téléchargé, deux sessions isolées, l'avertissement avant transfert et un viewport mobile de 390 pixels. Les captures et le résultat JSON se trouvent dans `reports/screenshots/` et `reports/browser_checks.json`.

Pour relancer ces parcours avec l'application déjà démarrée : installer `requirements-test.txt`, puis exécuter `python scripts/browser_smoke.py`. Sous Windows, le script utilise Edge installé en mode sans fenêtre. `--channel chrome` permet d'utiliser Chrome. Les tests créent uniquement des sessions et des transferts fictifs.
## Dictée française dans le cahier Akwɛ

Installez le moteur facultatif avec `python -m pip install -r requirements-voice.txt`. Décompressez le [modèle français Vosk](https://alphacephei.com/vosk/models/vosk-model-small-fr-0.22.zip) sous `runtime/` pour obtenir `runtime/vosk-model-small-fr-0.22/am/final.mdl`. L’application transcrit ensuite sur le serveur Streamlit local, hors ligne.

Dans **Cahier Akwɛ → Dicter une opération en français**, utilisez le micro ou importez un WAV mono PCM 16 bits de 16 à 48 kHz, limité à une minute. Cliquez sur **Transcrire dans le champ de saisie**, relisez la phrase et saisissez le montant en chiffres. **Préparer l’écriture** affiche le montant à vérifier. La confirmation ajoute l’écriture aux totaux et déclenche le rapprochement.
