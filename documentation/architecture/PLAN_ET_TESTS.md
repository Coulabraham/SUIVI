# Plan de développement et de validation

Les huit phases suivent le prompt de la conversation. Les estimations calendaires dépendent des décisions, des volumes et de la disponibilité de l'environnement ; aucune durée de réalisation n'est inventée.

## Phase 1 — analyse actuelle

Livrables : examen du dossier et du poste, règles et risques, architecture, diagrammes de composants/cas d'utilisation/classes/relationnel, modèle détaillé, contrats prévisionnels, décisions et plan de tests. Sortie : relecture documentaire, validation des diagrammes et présentation à l'utilisateur. **Attendre sa validation avant la phase 2.**

## Phase 2 — initialisation après validation

1. Choisir et figer une version Node LTS compatible et les versions stables des dépendances ; ne pas sélectionner aveuglément un dist-tag qui pointe vers une préversion.
2. Initialiser npm workspaces, frontend React/Vite TypeScript strict, backend NestJS et contrats.
3. Configurer Tailwind, ESLint, Prettier, scripts de build/test et tâches VS Code utiles.
4. Initialiser Git sans modifier un éventuel dépôt existant ; ajouter ignore pour dépendances, builds, secrets, volumes et artefacts de tests.
5. Mettre en place PostgreSQL : rendre Docker opérationnel avec le prérequis Windows choisi, ou utiliser PostgreSQL natif. Ne pas remplacer PostgreSQL par une autre base.
6. Configurer Prisma, variables d'environnement validées et exemples sans secret réel.
7. Vérifier les démarrages frontend/backend, /health, connexion PostgreSQL et builds stricts.

Critère de sortie : installation propre reproductible, deux applications qui démarrent, PostgreSQL joignable, aucune erreur TypeScript bloquante. La réussite de ces vérifications n'équivaut pas à une application métier terminée.

## Phase 3 — données

Créer les modèles, contraintes SQL, index, migrations initiales, rôles SQL et seeds distincts de production/démonstration. Tester sur PostgreSQL réel : unicités de login et responsable, périodes de membres, cohérence semaine/campagne, montants, références, interdictions de suppression et migrations répétables depuis une base vierge.

Critère de sortie : migrations appliquées et contraintes vérifiées, secrets absents du dépôt, bootstrap administrateur non universel, stratégie de sauvegarde avant évolution de schéma.

## Phase 4 — backend, par incréments testés

| Étape | Module livré | Vérification avant l'étape suivante |
|---|---|---|
| 4.1 | Infrastructure d'audit, erreurs, configuration et Auth | Login, mot de passe initial, changement, rotation, reset et révocation |
| 4.2 | Users, guards, périmètres et Devices | Accès croisés refusés et appareil rattaché à son utilisateur |
| 4.3 | Departments et Managers | Remplacement atomique, responsable unique, historique conservé |
| 4.4 | Members et affectations | CRUD autorisé, version, archivage/réactivation et transfert |
| 4.5 | Payments | Montants entiers, idempotence, cumuls, révisions, annulation et concurrence |
| 4.6 | Objectives, CollectionWeeks et Dashboard | Semaines réelles, cible unique, dépassement et agrégats cloisonnés |
| 4.7 | Notifications et consultation d'Audit | Destinataires autorisés, absence de doublons, journaux immuables |
| 4.8 | Synchronization | Lots, reçus, dépendances, conflits, bootstrap et curseurs |
| 4.9 | Reports | PDF, XLSX et CSV réels avec autorisations et exactitude des totaux |

L'infrastructure d'audit est introduite avant les paiements pour garantir leur atomicité dès le premier incrément. Les routes de consultation et notifications complètes sont achevées à leur étape. Chaque module reçoit DTO, OpenAPI, contrôles et tests d'intégration avant d'être déclaré terminé.

## Phase 5 — frontend relié aux API

Design system, navigation/layout, authentification et changement initial, tableaux de bord par rôle, départements, responsables, membres, encaissements, objectifs, notifications, audit et rapports. Construire les écrans par parcours utilisable avec les vraies API ; ne pas remplir l'interface de données de démonstration de production.

Les fondations Dexie et les contrats offline sont intégrés aux formulaires membres/paiements dès leur création ; la certification complète du mode hors ligne intervient en phase 6. Aucun bouton actif ne reste sans action. Les actions non encore disponibles sont omises jusqu'à leur raccordement.

Critère de sortie : parcours administrateur et responsable en ligne exécutés, formulaires validés, chargements et erreurs lisibles, mobile et clavier vérifiés.

## Phase 6 — PWA et offline-first

Manifest, icônes, installation, service worker Workbox, cache de ressources, bootstrap Dexie, écritures locales atomiques, moteur commun fenêtre/worker, reprise réseau, conflicts UI et migrations locales. Tester la file avant/après fermeture de l'application, avec et sans Background Sync.

Critère de sortie : une collecte hors ligne persiste puis donne exactement un paiement validé après reconnexion, y compris après une perte de réponse ; les conflits restent visibles sans écrasement.

## Phase 7 — sécurité et qualification

Exécuter les suites complètes, la matrice des rôles et les scénarios de concurrence sur PostgreSQL. Vérifier la récupération, la sécurité des exports, les migrations et les mises à jour de PWA avec file non vide. Effectuer des tests de charge sur volumes validés et contrôler les dépendances. Les anomalies essentielles sont corrigées avant qualification.

Critère de sortie : aucune erreur essentielle connue sur authentification, isolation, exactitude financière ou synchronisation ; résultats reproductibles et limites documentées.

## Phase 8 — finalisation et déploiement préparé

README complet, configuration, guide utilisateur par rôle, OpenAPI, exploitation, sauvegarde/restauration effectivement essayées, déploiement HTTPS et vérification de santé. Produire la liste des fonctionnalités prouvées et des limites restantes. L'hébergement réel et la publication nécessitent une cible définie ; l'analyse ne les présume pas.

## Matrice des tests essentiels

| Référence | Cas à exécuter | Niveau / outils | Preuve de réussite |
|---|---|---|---|
| AUTH-01 | Login valide, invalide et compte inactif | Jest + Supertest + PostgreSQL | Statuts attendus, aucune donnée sensible |
| AUTH-02 | Premier login bloqué sur route métier, changement puis ancien secret rejeté | Supertest + Playwright | Garde serveur et parcours UI effectifs |
| AUTH-03 | Changement personnel, reset, révocation et réutilisation d'un refresh consommé | Intégration HTTP | Anciennes sessions et secrets rejetés |
| PERM-01 | RD A utilise IDs de B dans lecture, mutation, liste, sync, rapport et relations | Supertest | Aucun détail de B, aucune écriture inter-périmètre |
| PERM-02 | RD appelle les routes SA ou falsifie rôle/département/appareil | Supertest | Refus et absence de mutation |
| PERM-03 | Transfert de membre puis lecture des paiements et coordonnées | PostgreSQL + HTTP | Historique financier figé, aucune fuite de fiche courante |
| MEM-01 | Création, changement, archive et réactivation | Unitaires + intégration | Versions exactes, historique conservé |
| MEM-02 | Deux départements/périodes simultanés et transfert non autorisé | SQL direct + HTTP | Contraintes et permissions imposées |
| MEM-03 | Deux mises à jour avec même version | Intégration concurrente | Un succès, un conflit explicite |
| PAY-01 | Paiement simple, plusieurs paiements même semaine, 0, négatif, fractionnaire, bornes | Jest + PostgreSQL | Entiers positifs exacts, versements multiples possibles |
| PAY-02 | Cumuls membre/département/global et corrections successives | Intégration | 10 000 → 8 000 → 9 000 → 0 sans double comptage |
| PAY-03 | Justification requise, annulation répétée, modification/suppression directe | SQL + HTTP | Journal complet, compensation unique, protection SQL |
| PAY-04 | Échec d'audit au milieu de l'écriture | Intégration avec panne ciblée | Aucun paiement partiellement validé |
| PAY-05 | Paiement et archivage concurrents ; double correction | Intégration concurrente | Invariants maintenus par les verrous/versions |
| OBJ-01 | Cible unique avec 5 départements, atteinte et dépassement | Unitaires + intégration | 10 M reste 10 M ; reste nul ; progression >100 % |
| OBJ-02 | Année bissextile, débuts/fins partiels, prolongation, clôture | Jest + PostgreSQL | Semaines calculées sur les dates réelles |
| SYNC-01 | Saisie hors ligne puis fermeture/réouverture | Vitest Dexie + Playwright | Opération et projection persistantes |
| SYNC-02 | Reconnexion, membre créé puis paiement dépendant | HTTP + navigateur | Ordre cohérent, numéro canonique et paiement unique |
| SYNC-03 | Même lot envoyé deux fois et en concurrence | PostgreSQL + Supertest | Un paiement, un audit métier, une notification par événement |
| SYNC-04 | Commit réussi puis réponse perdue | Test réseau + HTTP | Reçu rejoué sans deuxième écriture |
| SYNC-05 | Timeout avant commit, 503, 429 et arrêt en PROCESSING | Vitest + Playwright | Reprise avec même clé et bail expiré |
| SYNC-06 | Même clé avec autre payload, ancien membre, campagne clôturée | Intégration | Refus/conflit visible, aucune fusion financière |
| SYNC-07 | Deux onglets et worker traitent la même file | Playwright | Verrou local, idempotence serveur indépendante |
| SYNC-08 | Pull concurrent à des transactions ; page rejouée ; curseur expiré | PostgreSQL concurrent + Dexie | Aucun changement perdu, curseur atomique, file conservée |
| SYNC-09 | Révocation/réaffectation pendant déconnexion | HTTP + navigateur | Pas d'acceptation au retour ; données verrouillées et opérations conservées |
| SYNC-10 | Migration IndexedDB et mise à jour SW avec file non vide | Playwright | Aucune opération perdue, compatibilité contrôlée |
| UI-01 | Navigation et formulaires par rôle | RTL + Playwright | Parcours complets sur API réelle |
| UI-02 | Mobile/tablette/desktop, clavier et erreurs réseau | RTL + Playwright | Actions accessibles et états compréhensibles |
| EXP-01 | Exports global/département/individu en PDF, XLSX et CSV | Intégration + lecture des fichiers | Totaux exacts, accents/pagination et périmètre vérifiés |
| EXP-02 | Texte CSV commençant par formule, très grand entier | Tests de génération | Aucune formule active, aucun arrondi silencieux |
| OPS-01 | Sauvegarde, restauration et migration | Environnement isolé PostgreSQL | Données et invariants retrouvés |

## Principes d'exécution

Jest couvre le domaine backend, Supertest les frontières HTTP sur PostgreSQL réel, Vitest et React Testing Library le frontend, et Playwright les parcours et comportements PWA. Une base dédiée est réinitialisée pour chaque suite ; aucune commande de test ne cible la production. Les doubles réseau ne remplacent pas les tests d'intégration financière réels.

Chaque phase consigne dans [PROGRESS](../PROGRESS.md) les fichiers, commandes, résultats, corrections, limites et décisions. Un test non exécuté est indiqué comme tel. Un test essentiel échoué empêche de déclarer le module terminé ; aucune couverture chiffrée n'est annoncée sans mesure.
