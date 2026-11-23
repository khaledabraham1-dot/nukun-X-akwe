# Exécuter et comparer le graphe sur GPU

Le réseau GraphSAGE a été entraîné et testé localement sur CPU avec PyTorch 2.15.0. Aucune exécution GPU n'est encore réalisée. Le notebook `notebooks/GPU_Challenge.ipynb` prépare une expérience sur une machine distante disposant d'un GPU NVIDIA.

## Transférer les sources

Exécuter `python scripts/package_source.py`, puis charger `dist/nukun-akwe-source.zip` sur la machine GPU. L'archive inclut code, configuration, poids, rapports, tests et notebook. Elle exclut `.venv`, `.git`, les bases de session, les secrets et les documents initiaux du concours. Le fichier `SOURCE_MANIFEST.json` contient les empreintes de chaque fichier inclus.

Le dépôt GitHub peut aussi servir de source une fois le code publié. À ce stade, la source transportable vérifiée est l'archive locale.

## Préparer l'environnement distant

Choisir un environnement Python 3.12 compatible et installer les dépendances directes et le build PyTorch CUDA adapté au pilote de la machine. `requirements-graph.txt` fixe la version de PyTorch ; le build CPU de `requirements-graph-cpu.lock` sert uniquement aux essais CPU locaux. Utiliser le [sélecteur officiel PyTorch](https://pytorch.org/get-started/locally/) pour sélectionner le build CUDA.

Avant entraînement, vérifier `torch.cuda.is_available()` et afficher le nom du GPU, la version PyTorch et CUDA. Le script refuse `--device cuda` si CUDA n'est pas disponible. Il ne remplace pas silencieusement une exécution GPU par du CPU.

## Mesurer sur la même machine

Depuis la racine des sources, sur la machine GPU :

```text
python -m unittest discover -s tests -p test_stress.py -v
python -m nukun.stress_experiment --device cpu --output-root runtime/cpu_same_host
python -m nukun.stress_experiment --device cuda --output-root runtime/gpu_same_host
```

Les deux exécutions utilisent le même protocole, les mêmes seeds et les mêmes données. Les artefacts locaux initiaux ne sont pas écrasés. Le temps d'entraînement inclut les époques et la synchronisation finale ; il exclut la préparation des tenseurs. La VRAM maximale allouée est enregistrée pour CUDA. Les sorties JSON, poids et prédictions se trouvent sous chaque répertoire de sortie.

Comparer par seed et variante, vérifier l'identité des empreintes de données et de protocole, puis calculer `temps CPU / temps GPU`. Reporter le matériel, le nombre de paramètres et les résultats des deux appareils. Les petites charges peuvent être plus lentes sur GPU ; ne pas conclure que le GPU est indispensable à partir de ce seul prototype.

Les résultats CPU et GPU peuvent différer légèrement numériquement. Les algorithmes déterministes sont demandés à PyTorch ; une opération non disponible en mode déterministe doit être signalée et analysée plutôt que masquée. Voir la [documentation PyTorch sur la reproductibilité](https://docs.pytorch.org/docs/stable/notes/randomness.html).

## Portée scientifique

Le modèle est une variante orientée à moyennes entrantes et sortantes de [GraphSAGE](https://arxiv.org/abs/1706.02216), sur voisinages complets. Le contrôle MLP met à zéro les messages des voisins dans la même architecture. Cette comparaison teste l'intérêt de l'agrégation dans notre simulateur ; elle ne garantit pas un avantage sur un réseau financier réel.

L'entraînement sur CPU valide l'implémentation ; le benchmark GPU reste un livrable distinct. Les résultats de stress déjà obtenus ne justifient pas une réduction automatique du risque dès qu'un commerçant utilise Akwɛ.
