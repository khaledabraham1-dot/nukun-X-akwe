# API de score NUKÚN (Vercel, Python)

- `GET /api/score?receiver=M012&amount=12000` : score calculé à la demande (GraphSAGE `sage_history` et `sage_akwe`, régression logistique), faits causaux, voisinage 7 jours, temps de calcul `ms`. Erreurs d'entrée en 400 JSON (receiver inconnu, amount entier hors 100..2 000 000).
- `GET /api/health` : statut, version, nombre de comptes.
- `GET /api/accounts` : identifiants des 105 comptes notables (sans profil simulé).

Fonctionnement : `_lib/state.json` fige l'historique causal à now = 30 jours (première apparition des comptes, transactions de la fenêtre de 7 jours, déclarations rapprochées) et les poids des 3 modèles. À chaque appel, `_lib/engine.py` reconstruit l'instantané du graphe avec la transaction proposée (C0000 vers receiver) et refait le forward complet en NumPy, sans PyTorch. L'état est mis en cache au niveau du module.

Régénérer l'état : `python3 api/_lib/build_state.py <dépôt nukun>` (vérifie le SHA-256 du jeu simulé).

Vérifié identique à `src/engine.json` sur les 105 comptes × 3 montants (écart max 0 à 4 décimales).
