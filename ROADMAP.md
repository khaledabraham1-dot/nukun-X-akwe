# Roadmap NUKÚN × Akwɛ pour le GPU Challenge 2026

Version initiale du 22 novembre 2026 à 13 h 15, heure du Bénin, UTC+1. Mise à jour version 0.2 : socle CPU, cahier, protocole de stress, GraphSAGE entraîné et laboratoire interactif opérationnels. Les horaires ci-dessous sont des objectifs de travail ; les résultats effectivement obtenus sont distingués dans le suivi final, `reports/RESULTATS.md` et `reports/STRESS_RESULTATS.md`.

L'objectif est de livrer un prototype convaincant et reproductible avant le mardi 24 novembre à 23 h 59, puis de le défendre en demi-finale le 25 et, en cas de qualification, en finale le 26. Il reste environ 59 heures calendaires à la création du plan. Le dépôt doit être prêt à 20 h le 24 pour conserver une marge de remise.

La stratégie est de prouver une idée centrale : **les écritures commerciales confirmées et rapprochées des paiements peuvent aider un moteur antifraude à distinguer un commerçant d'un compte mule**. La voix facilite la tenue du cahier ; ce cahier apporte du contexte au graphe ; un dossier financier explicable valorise l'historique. Cette amélioration est une hypothèse à tester, pas une propriété garantie.

## 1 État de départ et contraintes

Les quatre pièces du dossier ont été lues : `mailrecu.txt`, le PDF d'une page `Cas_usage_GPU_Challenge_2026.pdf`, `NUKÚN × Akwɛ, en un seul projet.txt` et l'affiche du concours.

| Élément | Constat vérifié | Conséquence |
| --- | --- | --- |
| Livrables demandés | Prototype ou dépôt de code, comparaison avec une référence simple, mesures et limites, support de présentation | Produire code, résultats et pitch comme un seul ensemble |
| Critères du jury | Utilité métier, résultat technique, qualité des données, reproductibilité, faisabilité d'un pilote | Associer une preuve à chacun, sans inventer de pondération |
| Cas d'usage | Fraude, voix locale, risque de crédit et comptabilité figurent dans les pistes autorisées | Présenter un parcours cohérent plutôt que quatre produits séparés |
| Code local | Un commit d'initialisation `330f70b`, quatre documents, aucune application | Réserver le premier jalon à une chaîne qui fonctionne de bout en bout |
| GitHub | URL fournie : `https://github.com/khaledabraham1-dot/nukun-X-akwe.git` ; lecture distante réussie sans référence annoncée | Dépôt distant apparemment vide ; aucun contenu distant supplémentaire accessible à intégrer |
| Configuration Git locale | Branche `master`, aucun remote configuré au cadrage | Relier ensuite ce dossier au dépôt fourni et vérifier l'état distant avant le premier push |
| Moyens | Taille de l'équipe, GPU, budget et éventuels jeux de données partenaires non confirmés | Prévoir un parcours pour une personne et des replis explicites |

La date de remise vient du courriel. Le fuseau n'y est pas précisé : le planning utilise l'heure du Bénin et une remise anticipée. Le formulaire n'a pas été inspecté ; vérifier ses champs dès le premier jalon, sans attendre mardi soir.

## 2 Périmètre pour gagner en crédibilité

### P0 à livrer avant la remise

1. **NUKÚN Protège** : simuler une demande de transfert, évaluer son risque, afficher des raisons factuelles et demander une confirmation renforcée si nécessaire. Le portefeuille est fictif.
2. **Akwɛ** : saisir une vente ou une dépense, proposer une écriture structurée, la faire confirmer, puis la rapprocher d'un paiement compatible. Le texte doit fonctionner même si la voix est indisponible.
3. **Preuve du lien** : comparer les alertes avec et sans contexte commercial sur le même jeu de test. Inclure des commerçants légitimes atypiques et des fraudeurs qui déclarent une fausse activité.
4. **Calcul GPU réel** : entraîner un modèle et conserver les preuves d'exécution, les métriques et le matériel utilisé. GraphSAGE est l'expérience prioritaire ; une solution plus simple garde le prototype utilisable.
5. **Démonstration autonome** : données et modèles locaux, trois scénarios rejouables, remise à zéro, résultats exportés et vidéo de secours.

### P1 après validation du cœur

- Voix française opérationnelle et essai de reconnaissance du fon sur des enregistrements distincts des exemples de développement.
- Alerte en fon validée par un locuteur, générée ou préenregistrée avec une origine clairement indiquée.
- Passeport financier décrivant recettes, dépenses, régularité, rapprochements et qualité de l'historique. Sur données simulées, il reste descriptif et ne prétend pas prédire le défaut.
- Interface plus soignée, graphiques de voisinage et restitution bilingue si les validations sont faites.

### P2 après le concours

Connexion WhatsApp officielle, intégration opérateur, action sur des transferts réels, reconnaissance vocale fon robuste, adaptation des modèles, crédit prédictif et passage à grande échelle. L'OCR et l'analyse de faux SMS restent des extensions : un message suspect peut être analysé, mais un dépôt ne peut être authentifié sans une source transactionnelle de confiance.

**Règle de priorité :** supprimer une extension qui met en danger les résultats comparatifs, la reproductibilité ou le dépôt. Un prototype mesuré avec limites explicites vaut mieux qu'une promesse de quatre systèmes incomplets.

## 3 Démonstration cible

| Scénario | Parcours visible | Preuve attendue |
| --- | --- | --- |
| Transfert suspect | Un destinataire reçoit des fonds puis les disperse rapidement ; l'utilisateur prépare un transfert vers lui | Score, motifs liés à l'historique disponible, avertissement et absence d'exécution avant confirmation |
| Vrai commerçant | Un compte reçoit beaucoup de petits paiements, mais ses ventes confirmées concordent avec une partie des encaissements | Comparaison sans et avec contexte ; réduction d'alerte seulement si le moteur la produit réellement |
| Commerçant qui tient ses comptes | « J'ai vendu pour 12 000 francs » ; correction éventuelle ; confirmation ; rapprochement avec un paiement de 12 000 XOF | Une seule écriture, montant exact, statut du rapprochement et synthèse financière actualisée |

Prévoir aussi un cas où le système ne sait pas conclure. Une déclaration commerciale, même confirmée, ne constitue pas une preuve absolue de légitimité. L'absence d'Akwɛ ne doit pas devenir à elle seule un signal de fraude.

## 4 Architecture retenue

### Structure logicielle

Pour ce délai, partir sur un **monolithe Python modulaire**, une interface Streamlit et SQLite. Cette combinaison limite les installations et accélère la démonstration. Ajouter une API FastAPI seulement si une intégration effective la rend nécessaire. Le domaine et les modèles restent indépendants de l'interface pour permettre cette évolution.

```text
Interface de démonstration
  ├── Portefeuille fictif → service de risque → décision expliquée
  └── Texte ou audio → transcription → proposition d'écriture
                                      → confirmation → cahier
                                                        ↓
Historique des transactions → rapprochements → contexte commercial
              ↓                                      ↓
       graphe historique ─────────────────────→ moteur de risque
                                                        ↓
                                      dossier financier descriptif
```

La transcription et l'extraction ne doivent jamais écrire directement dans le cahier. Une confirmation explicite constitue la transition entre proposition et écriture enregistrée.

| Composant | Choix initial | Condition d'évolution |
| --- | --- | --- |
| Interface | Streamlit, trois parcours, reset de la démo | Interface web dédiée après stabilisation du moteur |
| Données | pandas ou Polars selon maîtrise, fichiers Parquet, SQLite pour la démo | Stockage serveur pendant le pilote |
| Référence fraude | Règles simples documentées puis modèle tabulaire léger | Garder les mêmes variables admissibles et les mêmes partitions |
| Modèle graphe | Petit GraphSAGE PyTorch Geometric, graphe orienté avec historique causal | Modèle temporel avancé après démonstration d'un gain |
| Extracteur comptable | Parseur déterministe pour les formulations bornées ; LLM facultatif à sortie validée | Ajouter un petit modèle si les cas évalués justifient le coût |
| Voix | Adaptateur remplaçable, essais MMS pour le fon ; texte toujours disponible | Adapter le modèle après audit des corpus et collecte ciblée |
| Exécution | Python et dépendances verrouillées ; artefacts téléchargeables ou inclus selon licences | Conteneur optionnel si disponible et testé |

Ne pas rendre vLLM, RAPIDS, un serveur de graphe ou Qwen 7B obligatoires au démarrage. Un GPU peut accélérer l'entraînement sans être nécessaire à chaque score individuel. L'intérêt de son usage doit être établi par la mesure.

### Contrats de données

- **Transaction** : identifiant stable, horodatage, émetteur, destinataire, montant entier en XOF, type et provenance. Les labels de fraude restent dans une table réservée à l'entraînement et à l'évaluation.
- **Écriture** : identifiant, commerçant, date, vente ou dépense ou dette, montant, canal cash ou mobile money, statut proposé ou confirmé ou annulé et référence de confirmation. Distinguer vente à crédit, remboursement et encaissement pour éviter le double comptage.
- **Rapprochement** : transaction et écriture associées, critères utilisés, statut certain ou ambigu ou absent. Une même transaction ne justifie pas plusieurs ventes. Les ventes en espèces restent admissibles sans paiement mobile associé.
- **Décision** : score brut, action de démonstration, raisons calculées, version de modèle, horodatage et indicateur d'information insuffisante. N'afficher un pourcentage de probabilité que si une calibration a été évaluée.
- **Trace d'exécution** : seed, version du code, configuration, hash du jeu de données et de l'artefact, matériel, durée et métriques.

## 5 Données et protocole scientifique

### Constitution des jeux

Commencer par un simulateur local déterministe pour garantir la reproductibilité sans accès externe. Viser initialement 50 000 à 100 000 transactions et quelques milliers de comptes, puis augmenter uniquement si le temps et le matériel le permettent. Ces volumes sont des paramètres de travail.

Séparer clairement trois sources éventuelles : données du simulateur local, PaySim importé, données réelles consenties si un partenaire en fournit. Publier leurs métriques séparément. PaySim est un simulateur de mobile money ; ses données ne valident pas, à elles seules, la fraude par manipulation en fon au Bénin. Voir le [dépôt original PaySim](https://github.com/EdgarLopezPhD/PaySim).

Le simulateur doit produire des clients ordinaires, des commerçants réguliers ou saisonniers, des agents à forte activité, des comptes neufs, des mules avec dispersion rapide et des fraudeurs qui imitent les commerçants. Ajouter bruit, erreurs de saisie, retards, transactions répétées et déclarations incohérentes. Le type latent « mule » ou « commerçant » sert à l'évaluation, jamais directement au modèle.

Éviter un générateur où une seule règle révèle toujours la réponse. Les faux dépôts nécessitent des messages ou événements dédiés ; ils ne peuvent pas être déduits automatiquement d'un journal de transferts.

### Prévention des fuites

1. Découper chronologiquement, par exemple 60 % entraînement, 20 % validation, 20 % test. Fixer les dates de coupure et les conserver pour toutes les variantes.
2. Pour une décision à l'instant t, calculer caractéristiques, voisinage et rapprochements avec les seules informations disponibles avant la décision. La transaction proposée fournit son montant et ses parties, sans ses conséquences futures.
3. Ne jamais utiliser les soldes après opération, les labels, le scénario du générateur ou un statut obtenu ultérieurement comme variables de prédiction.
4. Choisir hyperparamètres, seuils et calibration sur la validation. Ouvrir le test pour le rapport final après ces choix.
5. Évaluer également de nouveaux comptes et, si possible, des scénarios ou paramètres de simulation absents de l'entraînement. Conserver des seeds de test distinctes.
6. Dans GraphSAGE, former les représentations sur des instantanés causaux ; ne pas injecter les arêtes du futur dans le graphe d'entraînement ou les voisinages de test.

### Comparaisons obligatoires

| Variante | Informations | Question |
| --- | --- | --- |
| R0 | Règles simples | Quelle performance minimale obtient-on sans apprentissage ? |
| R1 | Modèle tabulaire sur historique admissible | Le graphe apporte-t-il plus qu'un bon modèle simple ? |
| G0 | Graphe et transactions, sans Akwɛ | Le contexte relationnel aide-t-il ? |
| G1 | Même moteur que G0 avec variables commerciales rapprochées | Akwɛ réduit-il les faux positifs sans masquer les fraudeurs ? |

Si GraphSAGE n'aboutit pas, comparer R1 sans et avec Akwɛ ; nommer explicitement cette expérience et présenter le GNN comme travail non terminé. Ne pas appeler GNN un ensemble de statistiques de graphe.

Le résultat central est le taux de faux positifs chez les commerçants **à rappel fraude comparable**. Fixer un rappel cible sur la validation et reporter sur le test le rappel réellement obtenu, les faux positifs, la précision, la PR-AUC et les volumes. Ajouter une comparaison à budget d'alertes égal si les rappels divergent trop. Mesurer les fraudeurs se déclarant commerçants et les utilisateurs sans Akwɛ.

Calculer la réduction relative par `(FPR sans contexte − FPR avec contexte) / FPR sans contexte`, seulement si le dénominateur est non nul. Publier aussi les écarts en points et les effectifs. Si le contexte n'aide pas ou réduit la détection, le rapport doit le montrer et expliquer les limites de l'expérience.

Conserver au moins une exécution complète ; viser trois seeds si le coût le permet, avec dispersion. Les pertes évitées calculées sur simulation restent des estimations scénarisées, sans extrapolation commerciale automatique.

### Voix et extraction

Le modèle [MMS ASR](https://huggingface.co/facebook/mms-1b-all) liste le fon parmi ses langues. Un modèle [MMS TTS fon](https://huggingface.co/facebook/mms-tts-fon) existe. Leur disponibilité ne prouve pas leur qualité sur les montants, les accents ou le bruit du marché. Leurs fiches indiquent une licence CC BY NC 4.0 : vérifier les conditions du concours et prévoir un remplacement ou les droits adaptés avant tout pilote commercial.

Tester tôt un lot de 20 à 30 phrases courtes consenties, avec au moins deux locuteurs si possible et un sous-ensemble réservé au test. Annoter transcription, montant, devise, type et date attendus. Mesurer surtout l'exactitude des montants et l'extraction des champs ; WER ou CER complète le diagnostic. Une phrase non comprise doit ouvrir une correction, jamais inventer un montant.

Limiter l'essai initial fon à deux heures. Si la chaîne est insuffisante, maintenir texte et voix française, et des alertes fon préenregistrées validées. Afficher clairement ce qui est reconnu automatiquement et ce qui est un enregistrement. Auditer ALFFA et FFSTC avant usage : accès, couverture du fon, licence, qualité et temps de préparation ne sont pas établis dans les documents fournis.

## 6 Jalons jusqu'au dépôt

Les créneaux sont à adapter à l'équipe. Ils incluent une nuit de repos : 59 heures calendaires ne représentent pas 59 heures de travail par personne. Le chemin critique est **schémas → données → référence → comparaison → intégration → preuve reproductible → remise**.

| Jalon et horaire au Bénin | Travail | Livrable et critère de sortie |
| --- | --- | --- |
| J0 dimanche 22, 13 h à 15 h | Vérifier GPU, environnement, équipe et champs du formulaire ; figer P0 ; préparer structure et commandes | Installation de base validée, responsables définis, budget de calcul explicite, formulaire accessible |
| J1 dimanche 22, 15 h à 19 h | Simulateur, schémas, interface minimale, règles R0, cahier texte et confirmation | Un transfert et une écriture traversent toute la chaîne ; reset possible ; aucune écriture sans confirmation |
| J2 dimanche 22, 19 h à 22 h | Partitions temporelles, R1, premiers résultats et test GPU ; essai vocal borné | Référence exportée ; exécution GPU vérifiée ou blocage documenté ; décision sur le parcours voix |
| J3 lundi 23, 8 h à 13 h | GraphSAGE causal si environnement prêt ; rapprochement ; variables Akwɛ | Artefact entraîné et score reproductible ; rapprochements ambigus signalés ; repli acté si besoin |
| J4 lundi 23, 14 h à 19 h | Comparaisons, cas adverses, seuils de validation, bench CPU et GPU | Résultats sans et avec contexte, effectifs et erreurs ; décision sur le modèle retenu |
| J5 lundi 23, 19 h à 21 h | Intégration des modèles, trois scénarios, explications et dossier descriptif | Démo intégrée ; chiffres du tableau reliés au fichier de résultats |
| J6 mardi 24, 8 h à 12 h | Tests critiques, corrections, installation dans un environnement propre, README | Une autre personne ou un environnement vierge exécute le parcours documenté |
| J7 mardi 24, 13 h à 17 h | Gel des fonctionnalités, rapport, présentation PDF, vidéo et répétition | Livrables complets ; démonstration tenue dans la durée autorisée ou version adaptable |
| J8 mardi 24, 17 h à 20 h | Dernière répétition, vérification des liens, des droits d'accès et des fichiers | Dépôt via formulaire, confirmation conservée, copie locale et hors machine |
| Marge mardi 24, 20 h à 23 h 59 | Corriger uniquement un problème bloquant de remise | Aucun ajout de fonctionnalité ; réception vérifiée avant échéance |

### Organisation selon l'effectif

- **Une personne** : réaliser les tâches dans l'ordre du chemin critique. Réserver environ 28 à 32 heures de travail concentré sur les trois jours. Borner la voix fon, le GNN et l'habillage ; conserver une comparaison tabulaire avec contexte si le GNN dépasse son budget. Le passeport reste un écran descriptif.
- **Deux personnes** : une personne porte données et modèles ; l'autre porte interface, cahier, voix et remise. Définir ensemble les schémas dès J0 et intégrer à J1 puis quotidiennement.
- **Trois personnes ou plus** : séparer données et évaluation, application et parcours, voix et restitution. Désigner un responsable final de l'intégration et de la remise. La rédaction du pitch commence dès que la référence existe.

## 7 Décisions de repli

| Déclencheur | Décision à prendre | Preuve conservée |
| --- | --- | --- |
| Pas d'accès GPU confirmé à J0 | Chercher un accès organisateur ou un fournisseur autorisé ; plafonner le coût avant allocation ; développer sur CPU entre-temps | Prototype CPU fonctionnel, liste des calculs GPU restant à réaliser |
| CUDA ou PyG non opérationnel après 90 minutes | Utiliser un environnement Linux GPU déjà disponible et compatible, ou revenir au modèle simple ; ne pas reconstruire toute la pile Windows | Versions, erreur et temps déjà consacré |
| Pas de GPU réel lundi à 10 h | Considérer l'absence de preuve GPU comme un risque majeur pour le concours ; réserver les créneaux restants aux preuves accessibles | Aucun benchmark inventé ; démonstration CPU explicitement identifiée |
| GraphSAGE non entraîné lundi à 13 h | Basculer la comparaison principale vers R1 avec et sans Akwɛ ; GNN devient une extension conditionnelle | Résultats effectifs et protocole inchangé |
| Fon insuffisant après l'essai de deux heures | Texte, français et alertes fon préenregistrées | Échantillons, erreurs et origine des audios |
| Pas de gain du graphe ou du contexte à J4 | Garder le meilleur modèle validé, rapporter l'ablation et analyser les erreurs | Tableau complet, sans sélectionner seulement les exemples favorables |
| Réseau indisponible sur scène | Utiliser données, modèles et sons locaux ; vidéo de secours si panne de machine | Même version et mêmes résultats que le dépôt |

## 8 Mesures et critères de qualité

| Domaine | Objectif de travail | Validation |
| --- | --- | --- |
| Métier | Réduire les alertes injustifiées sans dégrader fortement le rappel | Comparaison causale sur le même test, rappel et effectifs visibles |
| Risque | Score local p95 inférieur à 1 seconde sur la charge déclarée | Au moins 100 requêtes après échauffement ; préciser calcul des caractéristiques inclus ou exclu |
| GPU | Montrer une charge réellement accélérée, si le matériel est obtenu | Temps CPU et GPU, même tâche et données, VRAM, taille des lots ; synchronisation CUDA pour le chronométrage |
| Comptabilité | Montants exacts sur les scénarios critiques ; aucun doublon après double clic ou rejeu | Tests de confirmation, idempotence, correction et annulation |
| Voix | Aucun montant incertain validé silencieusement | Mesure de l'extraction et démonstration de correction ; latence vocale séparée du score risque |
| Reproductibilité | Relancer données, entraînement, évaluation et démo | Seed, dépendances verrouillées, commandes copiables et artefacts versionnés |
| Présentation | Trois répétitions consécutives sans erreur bloquante | Chronométrage et scénario de repli prêt |

Tester en priorité les invariants à impact : absence de fuite temporelle, absence d'écriture sans confirmation, non-duplication des rapprochements, montant positif, cohérence de la monnaie, erreur de modèle gérée et remise à zéro de la démo. Les captures d'écran ne remplacent pas ces vérifications.

Pour le GNN, conserver un classifieur de transaction qui combine les représentations de l'émetteur et du destinataire avec les caractéristiques disponibles de la transaction. Les motifs affichés doivent venir de faits calculés ; des règles explicatives ne doivent pas être présentées comme une explication causale du réseau neuronal.

## 9 Présentation et éléments de preuve

Préparer environ sept diapositives, adaptables au temps de parole qui sera communiqué :

1. Un commerçant légitime peut ressembler à une mule dans un graphe de paiements.
2. Le parcours NUKÚN × Akwɛ et le bénéfice attendu pour le commerçant et l'opérateur.
3. La démonstration du transfert suspect, du commerçant et de l'écriture confirmée.
4. Le tableau comparatif réel, avec référence, ablation et effectifs.
5. Le rôle effectivement mesuré du GPU et la reproductibilité.
6. Les limites : simulation, voix, déclarations adverses, données manquantes et absence d'intégration réelle.
7. Le pilote proposé, le partenaire recherché et les critères de succès.

Préparer des réponses courtes aux objections : pourquoi un graphe plutôt qu'un arbre ? Que se passe-t-il si un fraudeur invente ses ventes ? Sans Akwɛ, est-on pénalisé ? Que signifie un score sur données simulées ? Pourquoi la voix en fon est-elle fiable ou limitée ? Quel calcul le GPU a-t-il réellement accéléré ?

Le modèle commercial initial vise un opérateur ou une fintech disposant des flux nécessaires. L'intérêt économique reste à valider par entretiens et pilote. Ne pas présenter les opérateurs cités dans l'idée comme des partenaires acquis.

## 10 Dossier de remise

Structure cible pour la remise. Le premier socle utilise déjà `nukun/` à la racine et `app.py` comme point d'entrée, plutôt que `src/nukun/` et `app/`. Les dépendances directes et transitives Windows sont épinglées. La présentation PDF, la vidéo, la voix et le GNN restent à produire :

```text
ROADMAP.md
README.md
pyproject.toml et fichier de verrouillage
src/nukun/                 domaine, données, risque, cahier, voix
app/                      interface de démonstration
scripts/                  génération, entraînement, évaluation, lancement
configs/                  paramètres et partitions
tests/                    invariants critiques
data/README.md            provenance, licence, génération et dictionnaire
artifacts/                modèles et manifestes, ou liens vérifiés
reports/metrics.json       mesures réellement obtenues
reports/benchmark.csv      mesures CPU et GPU
reports/RESULTATS.md        protocole, résultats, erreurs et limites
docs/ARCHITECTURE.md
docs/DEMO.md
slides/presentation.pdf
```

Prévoir une commande documentée pour chaque étape et un mode rapide pour rejouer la démo sans réentraîner. Les commandes ne sont considérées comme livrées qu'après exécution réelle. Garder les gros fichiers hors Git si nécessaire, avec téléchargements versionnés, sommes de contrôle et solution de copie locale.

Checklist de remise :

- [ ] Dépôt ou archive accessibles avec les droits attendus par le jury.
- [ ] Installation, démo et reproduction des métriques vérifiées depuis un environnement propre.
- [ ] Tous les scénarios utilisent la version de modèle annoncée.
- [ ] Rapport comparant le résultat à une référence simple et présentant les limites.
- [ ] Modèles, données, audios et dépendances accompagnés de leur provenance et licence.
- [ ] Présentation PDF et vidéo de secours lisibles hors ligne.
- [ ] Aucun secret, numéro personnel réel ni donnée financière non consentie dans le dépôt.
- [ ] Formulaire rempli avant 20 h le 24 ; confirmation et copie des fichiers conservées.

## 11 Demi finale et finale

Le 25 novembre, partir de la version remise, charger les modèles avant le passage et limiter les modifications aux correctifs vérifiés. Recueillir les questions du jury et qualifier les points qui peuvent être améliorés sans changer le protocole.

En cas de qualification pour le 26, choisir une seule amélioration fondée sur les retours : clarté de la démonstration, analyse d'erreurs ou robustesse vocale. Garder le paquet remis comme secours. Toute nouvelle métrique doit être identifiée comme résultat de la version suivante.

## 12 Pilote après le concours

| Horizon indicatif | Objectif | Condition de passage |
| --- | --- | --- |
| Semaine 1 | Entretiens avec commerçants, agent et opérateur ; accès aux données et périmètre du pilote | Partenaire identifié, finalité et responsabilités clarifiées, consentement et accès cadrés |
| Semaines 2 et 3 | Données historiques pseudonymisées, audit des labels, essai en mode observation | Aucun effet sur les paiements ; mesures par population et vérification des droits d'usage |
| Semaines 4 à 6 | Cahier et voix auprès d'un petit groupe volontaire ; revue humaine des alertes | Montants corrigibles, adoption mesurée, faux positifs acceptables pour le partenaire |
| Semaines 7 et 8 | Bilan technique et économique, intégration éventuelle et plan d'industrialisation | Go ou arrêt documenté selon bénéfice, coût, sécurité et capacité opérationnelle |

La taille du groupe et les seuils de succès seront fixés avec le partenaire selon les volumes de fraude observables. Un petit pilote peut mesurer la qualité du cahier et l'ergonomie sans suffire à estimer la détection d'une fraude rare.

Avant toute action réelle sur un transfert : authentification, permissions par rôle, chiffrement, journal d'audit, supervision, délais de réponse, politique d'indisponibilité et recours humain validés avec l'opérateur. Avant un usage crédit : données de remboursement adaptées, validation hors période, calibration, contrôle des biais et décision sous responsabilité de l'institution financière. La diversité des clients ou les liens du graphe ne suffisent pas à établir la capacité de remboursement.

## 13 Sources et affirmations à maîtriser

- `mailrecu.txt` : calendrier de remise, livrables et critères du jury.
- `Cas_usage_GPU_Challenge_2026.pdf` : pistes indicatives ; liberté d'adapter le projet.
- `NUKÚN × Akwɛ, en un seul projet.txt` : vision initiale, hypothèses métier et choix technologiques proposés.
- Affiche locale : événement annoncé les 25 et 26 novembre 2026 à Epitech Bénin.
- [BCEAO sur le lancement officiel de PI SPI](https://www.bceao.int/index.php/fr/content/lancement-officiel-de-la-plateforme-interoperable-du-systeme-de-paiement-instantane-pi-spi) : lancement le 30 septembre 2025. Cette source n'établit pas une latence garantie d'une seconde pour notre intégration, ni une impossibilité universelle de recours.
- [PaySim original](https://github.com/EdgarLopezPhD/PaySim) : nature et origine du simulateur ; vérifier séparément la licence de tout fichier de données téléchargé.
- [MMS ASR](https://huggingface.co/facebook/mms-1b-all) et [MMS TTS fon](https://huggingface.co/facebook/mms-tts-fon) : disponibilité des modèles et licences ; qualité métier à mesurer localement.

L'affirmation initiale selon laquelle l'opérateur serait automatiquement responsable de toute fraude n'est pas retenue comme argument commercial établi. La qualification d'une opération et les responsabilités doivent être examinées avec le partenaire sur les textes applicables. Le prototype ne prétend ni certifier un compte comme sûr, ni accorder un crédit.

## 14 Première séquence de travail

1. Vérifier l'accès GPU, l'effectif, les champs du formulaire et le temps de passage annoncé.
2. Créer l'environnement, les schémas et le simulateur local.
3. Faire fonctionner transfert, règle de risque, écriture texte, confirmation et rapprochement.
4. Exporter la référence avant d'ajouter GraphSAGE ou la voix.
5. À chaque jalon, inscrire ici l'état réel, le livrable vérifié et la prochaine décision ; conserver les résultats chiffrés dans `reports/`.

| Jalon | État après le premier développement | Preuve et reste à faire |
| --- | --- | --- |
| J0 | Partiellement terminé | Environnement Python vérifié ; aucun GPU NVIDIA détecté. Effectif, GPU distant et budget à confirmer. Lecture du formulaire tentée sans succès via l'outil web ; ses champs restent à vérifier. |
| J1 | Terminé pour le socle texte CPU | `app.py`, `nukun/ledger.py`, `nukun/wallet.py`, simulateur et règles. Transfert fictif, confirmation, cahier, rapprochement et nouvelle session testés. |
| J2 | Référence CPU terminée | Trois seeds de 30 000 transactions, deux régressions NumPy et règles ; `reports/metrics.json`, `reports/RESULTATS.md`, `reports/benchmark.csv`, artefact JSON et empreintes concordantes. GPU et essai vocal non réalisés. |
| J3 et J4 | Graphe et stress CPU terminés | GraphSAGE à deux couches et contrôle MLP, avec et sans contexte ; sept variantes, trois nouvelles seeds de 18 000 transactions, nouveaux comptes au jour 24, commerçants sans Akwɛ, panne de contexte et 400 tirages bootstrap par compte. Le gain automatique d'Akwɛ sur les faux positifs n'est pas robuste. GPU encore non exécuté. |
| J5 | Intégration version 0.2 disponible | Cinq écrans, laboratoire GraphSAGE interrogeable avec les poids exportés, paiement fictif et écriture partageant le contexte M000, export CSV et dossier descriptif. Le portefeuille conserve sa référence tabulaire ; voix absente. |
| J6 | Audit fonctionnel et navigateur terminé | 50 tests passent avec le Python PyTorch du projet et 14 contrôles passent dans Edge réel, dont CSV téléchargé, deux sessions isolées et viewport mobile. Montants ambigus, chronologie comptable, messages d'annulation et téléchargement corrigés. Bilan `reports/QA.md`. Installation vierge et exécution CI non vérifiées. |
| J7 et J8 | À démarrer | Guide `docs/DEMO.md` disponible ; pitch PDF, vidéo, répétitions, vérification du formulaire et remise à réaliser. |

Les tests se relancent avec `python -m unittest discover -s tests -v`. L'expérience se reproduit avec `python -m nukun.experiment --size 30000 --seeds 2026 2027 2028`. Les chiffres et limites du rapport priment sur les cibles initiales. Le modèle enrichi améliore la précision dans ces essais, mais son rappel baisse fortement sur une seed ; ce compromis doit être résolu ou expliqué avant de défendre la solution.

## 15 Décision après le protocole de stress

Le protocole `configs/stress_protocol.json` a été fixé avant les nouvelles seeds 73101, 73102 et 73103. La définition des données et la méthode sont dans `docs/PROTOCOLE_STRESS.md`. Aucune variante ni seed n'a été supprimée après observation des résultats. Les seuils viennent de la validation, sans ajustement sur test.

GraphSAGE sans Akwɛ obtient une average precision test de 0,533 à 0,663, contre 0,305 à 0,384 pour le MLP sans contexte. Cela soutient l'intérêt de l'agrégation dans ce simulateur. Les rappels test restent variables, de 0,552 à 0,784 pour GraphSAGE sans contexte, et les nouveaux commerçants restent difficiles. Ce résultat ne prouve pas une efficacité terrain ni un niveau de performance suffisant pour un pilote actif.

Le contexte Akwɛ ne réduit pas les faux positifs de façon robuste dans l'expérience difficile. Sa valeur immédiate est la tenue du cahier et la fourniture de faits rapprochés pour l'examen d'un compte. Il ne donne pas d'exemption automatique de risque. Le moteur du portefeuille n'est pas remplacé à partir des résultats de test. Une évolution des modèles ou des hypothèses de simulation exigera un protocole suivant et des seeds finales inédites.

Livrables supplémentaires : `artifacts/stress_models.json`, scores complets `reports/stress_predictions_*.csv`, rapport `reports/STRESS_RESULTATS.md`, laboratoire dans `app.py`, guide `docs/GPU.md`, notebook `notebooks/GPU_Challenge.ipynb` et script `scripts/package_source.py`. Le notebook est préparé et ses cellules Python sont syntaxiquement vérifiées ; il n'a pas été exécuté sur une machine distante.

Ordre de travail suivant : obtenir l'exécution GPU et comparer CPU et GPU sur le même hôte, établir le protocole vocal et son repli, puis préparer les supports de jury. La validation totalement isolée, les retours de commerçants et la remise finale restent à réaliser.


## Mise à jour du 23 novembre

La dictée française sur CPU est intégrée et testée avec un fichier vocal synthétique. L'essai avec un commerçant au microphone, la comparaison GPU et les supports de jury restent ouverts.
