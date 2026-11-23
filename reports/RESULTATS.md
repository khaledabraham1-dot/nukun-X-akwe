# Résultats du premier prototype NUKÚN × Akwɛ

Expérience sur simulation locale uniquement. Ces résultats ne mesurent pas la performance terrain au Bénin.

## Protocole

30 jours simulés ; entraînement avant le jour 18, validation des jours 18 à 24, test à partir du jour 24. Le seuil de chaque variante est choisi sur validation pour atteindre au moins 80 % de rappel. Le rappel réellement obtenu sur test est publié sans réajuster les seuils. Les comptes déjà rencontrés peuvent réapparaître sur test : ce n'est pas une évaluation indépendante sur nouveaux comptes.

Les caractéristiques utilisent les transactions strictement antérieures et les déclarations confirmées, compatibles avec un paiement observé. Les profils du simulateur et les labels ne sont jamais des entrées du modèle. La couverture déclarative et les comportements sont des hypothèses du générateur, qui peuvent rendre l'expérience trop favorable.

AP désigne l'average precision, calculée aux seuils distincts ; ce n'est pas une aire PR par interpolation trapézoïdale. Les scores de régression pondérée ne sont pas des probabilités calibrées.

## Mesures sur test

| Seed | Variante | Fraudes | Rappel | Précision | AP | Faux positifs commerçants | Commerçants | Rappel imitateurs |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026 | R0_rules | 358 | 77.1% | 10.3% | 0.070 | 0 | 2246 | 64.9% |
| 2026 | R1_history | 358 | 76.3% | 24.9% | 0.251 | 5 | 2246 | 72.4% |
| 2026 | R1_history_akwe | 358 | 88.5% | 39.7% | 0.806 | 0 | 2246 | 94.8% |
| 2027 | R0_rules | 356 | 80.9% | 10.7% | 0.070 | 0 | 2198 | 75.2% |
| 2027 | R1_history | 356 | 75.6% | 19.5% | 0.242 | 0 | 2198 | 75.2% |
| 2027 | R1_history_akwe | 356 | 75.3% | 64.9% | 0.796 | 0 | 2198 | 83.9% |
| 2028 | R0_rules | 384 | 74.2% | 10.5% | 0.076 | 0 | 2208 | 88.1% |
| 2028 | R1_history | 384 | 84.4% | 21.8% | 0.233 | 1 | 2208 | 94.4% |
| 2028 | R1_history_akwe | 384 | 64.8% | 68.0% | 0.802 | 0 | 2208 | 100.0% |

## Lecture des résultats

- Seed 2026 : variation relative des faux positifs commerçants -100.0% ; écart de rappel fraude +12.3% (proportion, soit +12.3 points).
- Seed 2027 : réduction relative non calculable, effectifs à examiner.
- Seed 2028 : variation relative des faux positifs commerçants -100.0% ; écart de rappel fraude -19.5% (proportion, soit -19.5 points).

Une baisse des faux positifs accompagnée d'une baisse du rappel ne suffit pas à établir une amélioration. Examiner aussi le rappel des fraudeurs imitateurs et la variabilité entre seeds. Les variantes de cette expérience initiale sont tabulaires. L'expérience GraphSAGE est documentée séparément dans STRESS_RESULTATS.md.

## Exécution et reproductibilité

Empreinte des sources métier : `21782072825e461f84781941198958fb838ff286288f94f29a06d2d478881d5a`.

Python 3.12.10, NumPy 2.5.3. Système : Windows-11-10.0.26300-SP0.

Le benchmark CPU mesure caractéristiques et score, historique déjà chargé, après 20 échauffements. Il exclut le rendu Streamlit, le réseau et la reconnaissance vocale. Aucun gain GPU n'est revendiqué.

- Seed 2026 : p50 0.081 ms, p95 0.173 ms sur 200 requêtes ; empreinte données `d8022e0f275ec75292391e27afcaa308ee825e02b26f1e86814f46843eca6ac1`.
- Seed 2027 : p50 0.213 ms, p95 0.428 ms sur 200 requêtes ; empreinte données `91071b6928fdd36671dcef1acfc8a9c0021d616f0bf96f53a478caec5100e209`.
- Seed 2028 : p50 0.086 ms, p95 0.278 ms sur 200 requêtes ; empreinte données `7a96b6efc3d7a4d24de6429e585cdb55f3b51e2d1d43037a7483472c8dd50c64`.

## Limites et étapes suivantes

Fraude rare réelle, changement de distribution, historique sans Akwɛ, nouveaux comptes, incertitude statistique et nouvelles familles d'attaques restent à évaluer. La simulation inclut des fraudeurs avec fausses déclarations, mais ne remplace pas des cas enquêtés. Le score ne doit pas autoriser ou bloquer un paiement réel. La voix fon et les mesures GPU restent des jalons distincts ; l'expérience GraphSAGE dispose de son propre protocole.
