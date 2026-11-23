# Résultats du protocole de stress NUKÚN × Akwɛ

Simulation contrôlée, sans validation terrain. Toutes les variantes prévues et exécutées sont publiées ; aucun modèle n'est choisi sur test pour remplacer le moteur de démonstration.

Protocole `stress-v1-2026-11-22`, SHA-256 `e3fa7f99db81a8ec59ab1b914de09eafd6b1b57132cfa5314e1d6a8027894f45`.

## Résultats sur la période de test

| Seed | Variante | Rappel fraude | Précision | AP | FPR commerçants | Rappel imitateurs | Alertes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 73101 | rules | 70.9% | 14.6% | 0.134 | 76.6% | 63.1% | 2422 |
| 73101 | logistic_history | 75.7% | 21.6% | 0.202 | 78.1% | 81.4% | 1745 |
| 73101 | logistic_akwe | 76.7% | 21.9% | 0.191 | 78.1% | 82.5% | 1744 |
| 73101 | mlp_history | 73.1% | 29.1% | 0.384 | 54.0% | 68.1% | 1253 |
| 73101 | mlp_akwe | 57.8% | 26.6% | 0.270 | 44.3% | 56.7% | 1082 |
| 73101 | sage_history | 66.1% | 56.5% | 0.533 | 15.0% | 67.3% | 582 |
| 73101 | sage_akwe | 70.5% | 57.5% | 0.629 | 16.6% | 71.1% | 610 |
| 73102 | rules | 81.9% | 21.5% | 0.166 | 61.0% | 78.4% | 1985 |
| 73102 | logistic_history | 79.4% | 24.0% | 0.200 | 79.2% | 85.6% | 1723 |
| 73102 | logistic_akwe | 76.3% | 23.4% | 0.184 | 78.8% | 84.6% | 1695 |
| 73102 | mlp_history | 77.5% | 29.7% | 0.305 | 56.6% | 82.1% | 1356 |
| 73102 | mlp_akwe | 73.1% | 24.3% | 0.216 | 68.9% | 82.1% | 1564 |
| 73102 | sage_history | 55.2% | 60.9% | 0.642 | 11.1% | 54.5% | 471 |
| 73102 | sage_akwe | 67.5% | 36.5% | 0.601 | 36.6% | 64.9% | 962 |
| 73103 | rules | 85.0% | 16.3% | 0.147 | 68.4% | 88.2% | 2438 |
| 73103 | logistic_history | 75.2% | 17.9% | 0.170 | 85.6% | 79.2% | 1959 |
| 73103 | logistic_akwe | 76.7% | 19.4% | 0.226 | 82.1% | 82.0% | 1842 |
| 73103 | mlp_history | 70.4% | 25.4% | 0.383 | 52.8% | 75.1% | 1295 |
| 73103 | mlp_akwe | 61.5% | 27.8% | 0.327 | 44.1% | 75.5% | 1033 |
| 73103 | sage_history | 78.4% | 47.9% | 0.663 | 24.7% | 82.0% | 764 |
| 73103 | sage_akwe | 78.2% | 43.9% | 0.599 | 27.9% | 83.3% | 831 |

## Diagnostic du contexte commercial

Les seuils visent un rappel de 80 % sur validation et restent gelés sur test. Les écarts ci-dessous sont des différences de taux, en points de pourcentage. Un FPR plus bas avec un rappel plus bas n'établit pas un meilleur compromis.

- Seed 73101, logistic : rappel +1.0 points, FPR commerçants +0.0 points ; IC bootstrap exploratoires : rappel [-2.7, +5.7], FPR [-3.0, +2.6] points.
- Seed 73101, mlp : rappel -15.3 points, FPR commerçants -9.6 points ; IC bootstrap exploratoires : rappel [-30.4, +4.1], FPR [-27.0, +6.2] points.
- Seed 73101, sage : rappel +4.4 points, FPR commerçants +1.6 points ; IC bootstrap exploratoires : rappel [-0.2, +9.0], FPR [-3.0, +7.2] points.
- Seed 73102, logistic : rappel -3.1 points, FPR commerçants -0.4 points ; IC bootstrap exploratoires : rappel [-11.8, +7.0], FPR [-4.7, +4.4] points.
- Seed 73102, mlp : rappel -4.4 points, FPR commerçants +12.2 points ; IC bootstrap exploratoires : rappel [-20.5, +13.0], FPR [+0.8, +26.0] points.
- Seed 73102, sage : rappel +12.3 points, FPR commerçants +25.5 points ; IC bootstrap exploratoires : rappel [+3.4, +21.7], FPR [+17.0, +35.9] points.
- Seed 73103, logistic : rappel +1.5 points, FPR commerçants -3.5 points ; IC bootstrap exploratoires : rappel [-13.3, +19.9], FPR [-8.8, +1.3] points.
- Seed 73103, mlp : rappel -9.0 points, FPR commerçants -8.7 points ; IC bootstrap exploratoires : rappel [-16.7, -0.8], FPR [-21.9, +7.0] points.
- Seed 73103, sage : rappel -0.2 points, FPR commerçants +3.3 points ; IC bootstrap exploratoires : rappel [-9.9, +10.9], FPR [-1.3, +9.7] points.

## Sous populations et panne du contexte

| Seed | Variante avec contexte | FPR commerçants sans Akwɛ | FPR nouveaux commerçants | Rappel nouveaux comptes | Rappel en panne de contexte |
| --- | --- | --- | --- | --- | --- |
| 73101 | logistic_akwe | 78.4% | 68.1% | 50.0% | 71.5% |
| 73101 | mlp_akwe | 77.8% | 71.9% | 62.5% | 76.5% |
| 73101 | sage_akwe | 21.6% | 57.3% | 94.6% | 84.3% |
| 73102 | logistic_akwe | 66.1% | 56.6% | 48.3% | 64.8% |
| 73102 | mlp_akwe | 54.1% | 78.1% | 87.9% | 42.9% |
| 73102 | sage_akwe | 57.5% | 87.6% | 100.0% | 65.4% |
| 73103 | logistic_akwe | 58.3% | 55.6% | 45.8% | 30.4% |
| 73103 | mlp_akwe | 50.8% | 45.4% | 49.2% | 46.9% |
| 73103 | sage_akwe | 10.6% | 89.9% | 100.0% | 35.5% |

Les effectifs, seuils, précision en panne et intervalles complets sont dans `stress_metrics.json`. Les intervalles rééchantillonnent les comptes destinataires ; ils ne représentent pas toute l'incertitude liée aux réseaux, au choix du simulateur ou au transfert vers le terrain.

## Exécution

Environnement : Python 3.12.10, NumPy 2.5.3, PyTorch 2.15.0+cpu, appareil cpu.

Les durées d'entraînement incluent les époques et la synchronisation finale, mais pas la préparation des données et tenseurs. Ces durées seules ne constituent pas un benchmark comparatif CPU et GPU. Aucun gain GPU n'est affirmé pour une exécution CPU.

GraphSAGE est ici une variante orientée à moyennes entrantes et sortantes sur voisinages complets, avec deux couches. Le MLP emploie la même architecture avec messages voisins nuls. Les instantanés de 12 heures sont causaux et les nouveaux comptes n'ont pas d'embeddings d'identifiants appris.

Empreinte des sources : `371c7ab60e35797b22e2cb88d7cd25655588cc9a2a84a26b63fbf2deca63a1e4`.

Les résultats dépendent des hypothèses de coordination et d'adhésion au cahier. Ils peuvent réfuter l'efficacité du contexte ou du graphe sur ce protocole ; les résultats défavorables restent publiés. La voix fon et l'intégration opérateur sont hors de cette expérience.
