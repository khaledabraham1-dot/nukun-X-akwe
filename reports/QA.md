# Vérification du prototype NUKÚN × Akwɛ

Audit local du 22 novembre 2026, après ajout de GraphSAGE. Le bilan porte sur le prototype CPU et ses parcours fictifs. Les tests ont servi à reproduire les défauts ci-dessous, puis à vérifier leurs corrections.

## Résultats vérifiés

| Contrôle | Résultat |
| --- | --- |
| Suite métier et interface Streamlit | 50 tests réussis, incluant 10 nouveaux tests de non-régression |
| Navigateur réel | 14 contrôles réussis sous Edge 158.0.4370.33, Playwright 1.65.2, sans fenêtre |
| Affichage | Desktop 1440 × 1050 et viewport mobile 390 × 844 ; captures des écrans examinées |
| Erreurs navigateur | Aucune erreur JavaScript ou console dans l'exécution finale |
| Données scientifiques | Les 21 comparaisons de stress sont recalculées depuis les scores CSV et concordent avec le rapport JSON |
| Provenance | Empreintes courantes des sources et des modèles concordantes pour les expériences initiale et de stress |
| Dépendances | `pip check` ne signale aucune dépendance cassée dans le venv de développement |
| Archive corrigée | Manifeste et empreintes vérifiés ; les 50 tests passent également depuis une nouvelle extraction, avec le même environnement de dépendances |

## Défauts reproduits et corrigés

Les saisies « Vente 10 € », « Vente 100 NGN » et « Vente 1 million de francs » pouvaient être transformées en montants XOF incorrects. Le parseur refuse désormais les devises étrangères, les multiplicateurs en lettres et les formulations hypothétiques. Le montant doit être écrit intégralement en chiffres. Les formulations supportées, dont « J'ai vendu du riz pour 12000 XOF », restent acceptées.

Le service comptable acceptait un rapprochement ou une annulation horodatés avant la confirmation de l'écriture. Il vérifie désormais que chaque opération intervient au plus tôt à la date du dernier événement d'audit. Les paiements importés exigent également un montant entier strictement positif : les booléens, décimaux et chaînes ne sont plus convertis silencieusement par SQLite.

Après annulation, le message d'une confirmation précédente restait affiché. Les messages reflètent maintenant l'action effectuée et les anciennes confirmations sont effacées à la préparation d'une nouvelle opération. Le titre de contexte en haut de page, partiellement masqué par la barre supérieure, dispose d'un espacement corrigé.

Un téléchargement CSV a produit une erreur console 404 intermittente malgré un fichier reçu. Les exports ne provoquent désormais plus de relance de l'application au clic. La dernière exécution navigateur vérifie le fichier téléchargé et ne présente plus cette erreur.

## Parcours exercés dans Edge

Accueil ; refus d'une devise étrangère ; refus d'un montant à multiplicateur ; totaux nuls avant confirmation ; vente confirmée ; CSV contenant le montant exact et le rapprochement ; isolation de deux sessions ; annulation corrigeant les totaux ; changement de montant invalidant l'analyse ; débit fictif unique ; avertissement à acquitter ; tableaux de résultats ; inférence du réseau exporté ; accueil mobile sans débordement horizontal.

Les captures sont dans `reports/screenshots/`. Le résultat détaillé et les versions du navigateur figurent dans `reports/browser_checks.json`. Le scénario à risque vérifie le bouton désactivé avant acquittement, puis activé après clic sur le libellé visible de la case personnalisée.

## Reproduction

```powershell
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
.\.venv\Scripts\python.exe -m streamlit run app.py
```

Dans un second terminal, après installation de `requirements-test.txt` :

```powershell
.\.venv\Scripts\python.exe scripts/browser_smoke.py
```

## Périmètre restant

Le mobile est une émulation de viewport dans Edge, pas une validation sur téléphone physique. Le venv de développement hérite de dépendances système : l'installation entièrement vierge reste à vérifier. Les workflows GitHub Actions n'ont pas encore été exécutés. Le GPU, la voix fon, les connexions opérateurs et les données terrain ne sont pas validés par ces tests locaux.

Les limites scientifiques du contexte Akwɛ et des nouveaux commerçants restent celles du rapport `STRESS_RESULTATS.md`. Réussir ces tests fonctionnels ne suffit pas à démontrer une performance antifraude terrain.

## Essai vocal français du 23 novembre

Sur CPU, Vosk a transcrit un WAV synthétisé par Microsoft Hortense (« j'ai vendu pour douze mille francs »). Un WAV silencieux a produit le message de parole non comprise. Les tests couvrent aussi les fichiers vides et invalides. Le test Streamlit injecte un brouillon vocal, vérifie les totaux, corrige le montant en chiffres, prépare et confirme une vente rapprochée de 12 000 XOF. Un essai avec microphone physique et locuteur reste à effectuer.
