# Données du prototype

La version initiale utilise exclusivement le simulateur local `nukun/simulation.py`. Aucune donnée personnelle, aucun journal opérateur et aucun fichier PaySim externe n'ont été importés.

## Scénarios et hypothèses

30 jours de transactions entre 500 clients, 45 commerçants, 10 agents, 12 comptes du scénario mule et 8 comptes imitateurs. Les proportions d'activité et de fraude sont choisies pour l'expérimentation ; elles ne représentent pas des statistiques béninoises. Les profils peuvent avoir des flux semblables, mais le générateur reste simple.

Les commerçants ont une clientèle partiellement récurrente et des écritures manquantes ou incorrectes. Certains comptes frauduleux déclarent aussi des ventes. Le rapprochement exige une référence transactionnelle, le destinataire et le montant compatibles, ainsi qu'une confirmation déjà connue à l'instant du score. Cette référence est disponible dans le simulateur ; les journaux opérateurs réels pourraient fournir moins d'information.

## Fichiers générés

`python -m nukun.experiment` écrit sous `data/generated/`, dossier exclu de Git :

| Fichier | Champs | Usage |
| --- | --- | --- |
| `transactions.jsonl` | `id`, `timestamp`, `sender`, `receiver`, `amount` | Historique observable |
| `declarations.jsonl` | `id`, `merchant`, `transaction_id`, `amount`, `known_at` | Déclarations confirmées avec retard et erreurs simulés |
| `evaluation_only.jsonl` | `transaction_id`, `is_fraud`, `receiver_profile` | Cible et sous-populations, jamais caractéristiques du prédicteur |

Les montants sont des entiers XOF strictement positifs. Les temps sont des secondes depuis le début de la simulation. Les identifiants sont entièrement fictifs. L'empreinte SHA-256 de l'ensemble est enregistrée dans le rapport et l'artefact modèle.

## Variables du modèle

Montant logarithmique, nombre d'encaissements, nombre d'émetteurs distincts, ratio sorties sur entrées plafonné, récurrence des clients, ancienneté observée, montant par rapport à la moyenne, sorties récentes et activité de l'émetteur. La variante Akwɛ ajoute la proportion des encaissements rapprochés et deux interactions avec rotation et récurrence. L'ancienneté est celle de la première observation, pas celle de l'ouverture réelle du compte.

Les fenêtres ne contiennent que des événements strictement antérieurs à la décision. La présence d'une vente déclarée ne rend pas le compte automatiquement légitime.

## Validation à compléter

Le test temporel partage des comptes avec l'entraînement. Prévoir un test sur nouveaux comptes, des familles de simulation inédites, la mesure sur commerçants sans Akwɛ, des intervalles d'incertitude et un audit sur données partenaires avant toute extrapolation. Le jeu initial sépare trop facilement plusieurs commerçants des autres comptes : l'hypothèse de réduction des faux positifs demande un jeu de stress plus exigeant, avec protocole fixé avant son évaluation.

## Jeu de stress de la version 0.2

`nukun/stress_data.py` définit un second générateur indépendant de la démonstration initiale. Trois seeds inédites de 18 000 transactions sont évaluées selon `configs/stress_protocol.json`, enregistré avant leur première exécution. Les profils comprennent 480 clients, 65 commerçants, 12 agents, 14 mules et 14 imitateurs ; une partie des acteurs et 50 clients ne peuvent apparaître qu'après le jour 24.

Les paramètres individuels d'activité, de récurrence, de sorties, d'adhésion et de couverture sont tirés avec chevauchement entre profils. Les fraudeurs peuvent produire des déclarations de montants exacts ; certaines contreparties sont plus partagées dans les scénarios frauduleux. Les cohortes et profils servent exclusivement à la simulation et à l'évaluation, jamais comme variables du modèle.

Les déclarations sont rapprochées par référence transactionnelle dans ce simulateur ; il ne simule pas toutes les ambiguïtés d'un journal incomplet. Le moteur de cahier utilise séparément un rapprochement prudent par montant, jour, sens et unicité. Ces conditions différentes limitent le transfert direct des métriques à l'usage réel.

Les scores test complets figurent dans `reports/stress_predictions_*.csv`, avec labels et profils pour audit. Les empreintes des jeux sont dans `stress_metrics.json`. La validation par comptes nouveaux, les sous-populations sans Akwɛ et les intervalles par compte sont maintenant calculés pour ce protocole ; leur interprétation reste limitée au simulateur. Le gain automatique attribué au contexte commercial n'est pas établi de manière robuste.
