# NUKÚN × Akwɛ

**Protéger l'argent mobile des Béninois, puis le faire grandir.** Prototype du GPU Challenge 2026 (Fintech Academia × Next Fintech Forum, Epitech Bénin).

- **NUKÚN** (« l'œil » en fon) : au moment d'un transfert mobile money, un réseau de neurones sur graphe (GraphSAGE) analyse le compte destinataire. S'il ressemble à un compte mule, l'envoi est mis en pause et une alerte vocale explique le risque.
- **Akwɛ** (« l'argent ») : la commerçante raconte sa journée à la voix, son cahier se remplit, son solde bouge, et son passeport de crédit lui ouvre un prêt en 48 h.

**Démo en ligne : https://nukun-web.vercel.app** (application dans `#/app`).

## Équipe

[@Lookman](https://github.com/Lookman) · [@nabilnondichao](https://github.com/nabilnondichao) · [@KOBA2008](https://github.com/KOBA2008) · [@khaledabraham1-dot](https://github.com/khaledabraham1-dot)

## Organisation du dépôt

| Dossier | Contenu |
| --- | --- |
| `web/` | Application React + Vite + Tailwind (liquid glass, clair/sombre) déployée sur Vercel, et API serverless Python `web/api/` |
| `web/api/` | `/api/score` (score GraphSAGE avec les poids entraînés, rejoués en NumPy, ~20 ms), `/api/health`, `/api/accounts` |
| `fon-service/` | Service local fon ↔ français : traduction NLLB-200 (CTranslate2 int8) et voix MMS-TTS, sur `127.0.0.1:8765` |
| `nukun/`, `configs/`, `artifacts/`, `reports/`, `tests/`, `notebooks/` | Recherche : simulateur béninois, protocole de stress, entraînement et évaluation de GraphSAGE et des références |
| `docs/` | Protocole (`PROTOCOLE_STRESS.md`), exécution GPU (`GPU.md`), présentation animée et dossier projet (`docs/pitch/`) |

## L'application (`web/`)

Parcours : page d'accueil, générique, connexion (« Je suis commerçant(e) » ou « Je suis un établissement »), puis un espace par profil.

**Espace commerçante**
- **Tableau de bord** : « Racontez votre journée » en français (micro) ou en fon (traduit) ; le cahier et le solde se mettent à jour.
- **Portefeuille** : envoi d'argent à la voix ; NUKÚN vérifie le destinataire et met en pause les envois suspects.
- **Messages** : analyse d'un SMS ou message suspect, avec indices et bon réflexe.
- **Cahier Akwɛ** : ventes, dépenses, dettes, bilan, passeport de crédit et **rapport de chiffre d'affaires en PDF**.
- **Prêt en 48 h** : assistant vocal en 5 questions, suivi de la demande jusqu'au versement.
- **Traducteur fon** : fon ↔ français et écoute en fon (service local requis).

**Espace établissement** : demandes de prêt reçues, passeport Akwɛ, vérification NUKÚN, accord ou refus.

```bash
cd web
npm ci
npm run dev          # http://localhost:5173
node --test src/nlp.test.mjs   # 72 tests de compréhension du français
vercel deploy --prod # déploiement (projet Vercel « nukun-web »)
```

Les données de démonstration (profil, cahier, prêts) restent dans le navigateur : aucun serveur de comptes.

## Le service fon (`fon-service/`)

Modèles publics de Meta, sur CPU : NLLB-200 distillé 600M (`fon_Latn` ↔ `fra_Latn`) et MMS-TTS fon.

```bash
cd fon-service
./download_models.sh                 # ~2,5 Go
python convert_nllb.py               # conversion CTranslate2 int8 (contourne une incompatibilité dtype)
./start.sh                           # http://127.0.0.1:8765
```

Le site Vercel appelle ce service depuis le navigateur du même ordinateur. Chrome demande alors l'autorisation d'accéder au réseau local : il faut accepter. La reconnaissance du fon parlé (MMS-1b-all, ~4 Go) n'est pas chargée faute de mémoire : c'est notre principal besoin GPU.

## La recherche (GraphSAGE)

Le protocole a été fixé dans [configs/stress_protocol.json](configs/stress_protocol.json) avant les trois essais de stress (3 × 18 000 transactions simulées). Il compare sept variantes : règles, deux régressions, deux MLP et deux GraphSAGE orientés. Les nouveaux acteurs apparaissent seulement au jour 24 ; le test inclut des commerçants sans Akwɛ et des fraudeurs capables de déclarer des montants exacts.

| Moyenne des 3 essais | Précision moyenne (AP) | Commerçants alertés à tort |
| --- | --- | --- |
| Règles simples | 0,15 | 69 % |
| Régression logistique | 0,19 | 81 % |
| Réseau sans graphe (MLP) | 0,36 | 55 % |
| **GraphSAGE** | **0,61** | **17 %** |

Détail complet : [reports/STRESS_RESULTATS.md](reports/STRESS_RESULTATS.md). L'apport automatique du contexte Akwɛ au score n'est pas robuste sur ce protocole ; nous le publions tel quel.

```bash
python -m pip install -r requirements.txt -r requirements-graph-cpu.lock
python -m nukun.stress_experiment --device cpu      # ou --device cuda, voir docs/GPU.md
python -m unittest discover -s tests -v
python -m nukun.graph_inference --receiver M000 --amount 12000 --model sage_history
```

Les poids exportés (`artifacts/stress_models.json`) alimentent l'API du site : `web/api/_lib/build_state.py` en extrait l'état utilisé par `/api/score`.

## Limites

Données simulées (aucune donnée réelle d'opérateur), entraînement sur CPU, portefeuille et prêts fictifs, fon parlé non reconnu sur un ordinateur portable. Le score met en pause et explique : il ne bloque jamais seul un paiement réel.
