# Architecture du premier prototype

## Séparation des responsabilités

Le domaine métier se trouve dans `nukun/`, sans import Streamlit. `app.py` orchestre ses services et affiche les résultats. Les modèles sont des fichiers JSON contenant coefficients, standardisation, colonnes et seuils ; leur chargement n'exécute pas de code Python sérialisé.

Le simulateur produit des transactions observables, des déclarations connues avec retard et un fichier d'évaluation séparé. L'expérience construit les caractéristiques dans l'ordre temporel, entraîne sur la première période et choisit le seuil sur la seconde. La troisième période est évaluée avec des paramètres gelés. Le rapport conserve configuration, empreintes, effectifs, résultats et temps CPU.

## Flux d'un paiement fictif

L'interface construit une proposition dont les faits proviennent de l'historique antérieur. Deux régressions logistiques donnent des indices avec et sans contexte commercial. La préparation réserve une demande identifiée, sans débit. Une confirmation traite cette demande une seule fois ; un rejeu renvoie le même transfert sans deuxième débit. L'interface refuse la confirmation si les paramètres ont changé ou si l'analyse a plus de deux minutes.

L'historique simulé est une photographie pour le parcours : les transferts fictifs confirmés sont inscrits au journal de session, mais ne sont pas réinjectés dans le graphe ni dans le jeu d'évaluation. Le solde est celui du portefeuille de démonstration en mémoire, distinct du cahier SQLite et d'un compte réel.

## Flux d'une écriture

Le parseur borne la saisie à une opération du jour et un montant certain. `Ledger.propose` crée une écriture proposée avec une clé d'idempotence. `Ledger.confirm` vérifie l'état et la version puis rend l'écriture comptabilisable. `Ledger.reconcile` cherche un paiement observé du même jour au Bénin, du même montant et dans le bon sens. Il exige un candidat unique et l'absence d'autre écriture confirmée concurrente.

Les opérations de confirmation, annulation et rapprochement utilisent une transaction SQLite avec verrou d'écriture. Un index unique empêche de réutiliser le même paiement pour plusieurs écritures actives. L'annulation libère l'association, retire l'écriture des totaux et garde sa trace d'audit. Aucun effacement de l'audit n'est exposé dans l'interface.

Le paiement fictif `DEMO_SALE`, seul paiement ajouté au cahier de démonstration, existe également dans l'historique visible du moteur. Une écriture confirmée et rapprochée ajoute son contexte au score de M000. La chronologie relative du simulateur est alignée à l'heure de début de session ; les résultats d'évaluation restent indépendants des actions de démonstration.

## État et accès

Chaque session Streamlit utilise un identifiant aléatoire et un fichier SQLite sous `runtime/`. Le portefeuille reste en mémoire de session ; le cahier est persisté dans le fichier de cette session. Le bouton de réinitialisation crée un nouvel identifiant sans effacer les fichiers précédents. Ils peuvent être archivés ou purgés hors démonstration selon une politique à définir.

L'historique et les modèles chargés sont partagés en cache ; la lecture des caractéristiques ne modifie pas cet historique. Les rapprochements propres à une session sont appliqués sur une copie de son dictionnaire de correspondances. L'interface écoute sur `127.0.0.1`. Elle ne fournit pas d'authentification, d'autorisation multiutilisateur ou de garanties adaptées à l'hébergement public.

## Modèle de graphe expérimental

La version 0.2 ajoute `stress_data.py`, `graph.py`, `stress_experiment.py`, `uncertainty.py` et `graph_inference.py`. Elle applique un protocole distinct, fixé avant les nouvelles seeds : distributions superposées, comptes jamais rencontrés pendant l'entraînement, commerçants sans cahier et fraudeurs déclarants. Les deux couches GraphSAGE agrègent les moyennes des attributs entrants et sortants, sans embedding d'identifiant. Les instantanés de 12 heures excluent les événements de leur intervalle courant et du futur.

Quatre réseaux sont comparés : GraphSAGE et le contrôle sans messages de voisins, chacun avec et sans contexte Akwɛ. Les poids et la normalisation sont exportés en JSON. Les tests rejouent les poids exportés et comparent les scores aux prédictions sauvegardées. Les intervalles exploratoires rééchantillonnent les comptes destinataires avec les mêmes tirages pour comparer les variantes.

Le laboratoire charge les poids entraînés et reconstruit au jour 30 un instantané causal pour une nouvelle proposition. Il garde le portefeuille séparé : aucun moteur n'est promu à partir des résultats test. Les résultats montrent un gain de classement du graphe dans la simulation, mais pas de réduction robuste des faux positifs grâce à Akwɛ. La forte difficulté des nouveaux commerçants interdit de confondre manque d'historique et fraude établie.

## Évolutions conditionnelles

Un service vocal devra retourner une proposition corrigeable, jamais écrire directement dans le cahier. Une intégration opérateur exigera une source de paiements fiable, un contrat d'API, une gestion explicite des délais et incidents et un contrôle des accès. La preuve d'accélération GPU nécessite encore une exécution sur matériel adapté ; le notebook compare CPU et GPU sur le même hôte avec sorties séparées. Voix, intégration opérateur et exécution GPU ne sont pas présentées comme opérationnelles.
