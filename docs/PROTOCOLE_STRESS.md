# Protocole de stress fixé avant les essais

Protocole `stress-v1-2026-11-22`. Les paramètres exécutables sont dans `configs/stress_protocol.json`. Ce protocole est enregistré avant la première exécution des nouvelles seeds 73101, 73102 et 73103. Le jeu initial et ses résultats restent conservés comme expérience exploratoire distincte.

## Hypothèse et critère principal

Tester si le contexte commercial rapproché réduit les faux positifs chez les commerçants, à rappel fraude comparable. Le seuil de chaque variante est choisi exclusivement sur la validation pour atteindre au moins 80 % de rappel. Le rappel réellement obtenu sur test, le nombre d'alertes, la précision, l'average precision et les effectifs sont publiés ensemble. Une baisse de faux positifs accompagnée d'une baisse de rappel ne démontre pas le bénéfice attendu.

Les seeds sont des répétitions indépendantes du simulateur, pas trois échantillons terrain. Aucun modèle ne sera promu dans la démonstration à partir de son résultat sur test. Toute modification motivée par ces résultats exigera une nouvelle version de protocole et des seeds finales inédites.

## Difficultés introduites

- Activité, montants, ancienneté et récurrence se chevauchent entre commerçants et fraudeurs ; leur appartenance ne figure jamais dans les variables d'entrée.
- Une partie des commerçants n'utilise pas Akwɛ. Les utilisateurs d'Akwɛ peuvent omettre ou mal saisir une écriture.
- Certains fraudeurs déclarent des montants exacts et peuvent obtenir de vrais rapprochements. Le cahier ne doit pas les rendre automatiquement légitimes.
- Une partie des acteurs n'apparaît qu'au jour 24. Leur première apparition, émetteur ou destinataire, doit être postérieure à la période d'entraînement.
- Un essai supplémentaire retire tout contexte Akwɛ lors du test, sans réentraînement ni changement de seuil, pour mesurer la dégradation en panne.

Le simulateur peut donner aux fraudeurs des contreparties plus concentrées ou partagées. Ce signal de coordination est une hypothèse contrôlée, pas une signature universelle de fraude. Les variations de paramètres et les cas où les fraudeurs sont indiscernables restent des limites.

## Comparaisons

Règles, régressions logistiques avec et sans contexte, puis quatre réseaux de mêmes dimensions : MLP sans agrégation et GraphSAGE avec agrégation, chacun avec ou sans Akwɛ. L'ablation MLP aide à distinguer l'effet de l'agrégation de celui d'une architecture non linéaire.

Le graphe est un graphe orienté de contreparties, sans embedding d'identifiant appris. Il utilise la moyenne des attributs entrants et sortants sur deux couches. Les instantanés sont construits toutes les 12 heures avec les seules transactions et déclarations strictement antérieures au début de l'intervalle. Les caractéristiques de la transaction utilisent l'historique disponible juste avant sa décision ; elles peuvent être plus récentes que l'instantané. Les dimensions, le nombre d'époques et le taux d'apprentissage sont fixés avant les essais.

L'entraînement utilise les jours 0 à 18, la validation les jours 18 à 24 et le test les jours 24 à 30. Les labels ne sont jamais passés au constructeur de graphe ni aux variables du modèle. Pendant validation et test, les poids restent gelés ; l'historique évolue uniquement avec les événements déjà observés.

## Sous populations et incertitude

Publier séparément les commerçants sans adhésion à Akwɛ, les commerçants nouvellement apparus, les fraudeurs imitateurs et les comptes absents de l'entraînement. Si une population ou une classe est absente, afficher un résultat non calculable plutôt qu'une performance artificielle de zéro.

Les intervalles exploratoires à 95 % sont obtenus par bootstrap des comptes destinataires, en conservant ensemble les transactions d'un même compte. Ils reflètent la variabilité de la simulation sous ce regroupement ; les dépendances entre comptes et les hypothèses du générateur limitent leur interprétation. La différence de faux positifs et la différence de rappel entre variantes avec et sans Akwɛ sont calculées avec les mêmes tirages.

## Preuves d'exécution

Conserver configuration, empreinte du protocole, empreinte des sources, empreintes des jeux, seuils, durée, matériel, scores du test et poids du modèle. L'exécution CPU sert à valider le réseau. Toute exécution GPU devra enregistrer le GPU, CUDA, la VRAM, le temps et la même charge CPU avant de revendiquer une accélération.
