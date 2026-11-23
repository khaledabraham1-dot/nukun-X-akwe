# Démonstration du premier prototype

## Préparation

Depuis la racine : `python -m streamlit run app.py`. Ouvrir `http://127.0.0.1:8501`, attendre le chargement puis cliquer sur « Nouvelle session de démonstration ». Ce bouton crée un nouveau cahier et remet le portefeuille fictif à 100 000 XOF. Vérifier les pages avant la présentation.

## Parcours de cinq minutes adaptable

1. **Vue d'ensemble** : présenter le problème du commerçant qui peut ressembler à une mule. Préciser que le prototype fonctionne sur simulation locale et CPU.
2. **NUKÚN Protège** : sélectionner X000, analyser 12 000 XOF. Lire les faits calculés. Si le seuil est franchi, montrer que la confirmation exige d'abord l'acquittement de l'avertissement. Aucun transfert ne part lors de l'analyse.
3. **Cahier Akwɛ** : saisir « J'ai vendu pour 12 000 francs ». Préparer l'écriture et montrer que les totaux restent nuls. Confirmer : les ventes passent à 12 000 XOF et le rapprochement avec `DEMO_SALE` apparaît.
4. **NUKÚN Protège** : analyser M000. Les deux indices affichés viennent des deux modèles réels, sans valeurs scénarisées. La vente confirmée alimente l'historique de cette session ; ne pas promettre un changement d'alerte pour cet exemple isolé.
5. **Résultats** : montrer les trois seeds et distinguer l'expérience initiale du nouveau protocole de stress. Expliquer seuil de validation, rappel test, commerçants nouveaux et panne du contexte. Le graphe améliore le classement dans cette simulation ; le bénéfice automatique d'Akwɛ reste non robuste.
6. **Laboratoire graphe** : sélectionner `sage_history`, proposer 12 000 XOF vers M000 et calculer l'indice avec les poids exportés. Montrer le réseau et le nombre de liens réellement analysés. Le portefeuille n'est pas débité par cette analyse expérimentale.

## Cas de robustesse

- Changer le montant après analyse : la confirmation disparaît et une nouvelle analyse est demandée.
- Saisir « Vente 12 000 et 500 francs » : le système demande une reformulation.
- Annuler une écriture confirmée : les totaux se corrigent et la trace reste visible.
- Saisir une vente en espèces : elle entre dans le cahier sans réclamer de paiement mobile.
- Après confirmation d'un transfert fictif, recharger la page : le solde n'est pas débité deux fois.

## Limites à annoncer

Le portefeuille conserve le modèle tabulaire de référence ; GraphSAGE est réellement entraîné, évalué et interrogeable dans le laboratoire distinct. La voix n'est pas intégrée. Aucun benchmark GPU ni résultat terrain n'est acquis. Le dossier commercial est descriptif et ne donne pas droit au crédit. L'application locale n'a ni authentification de production ni intégration opérateur.
