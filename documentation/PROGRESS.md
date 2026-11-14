# Avancement de SUIVI

Dernière mise à jour : 14 novembre 2026.

## État général

| Phase | État |
|---|---|
| 1 — Analyse et conception | Terminée ; conception générale validée par « ok continue » |
| 2 — Initialisation | Terminée : applications et PostgreSQL démarrent ; tests du socle réussis ; limite faible de l'outillage documentée |
| 3 — Base de données | Socle terminé : 17 modèles ; cinq migrations actuelles appliquées et client Prisma opérationnel |
| 4 — Backend | Périmètre métier des phases 4 à 10 du cahier joint testé ; synchronisation et rapports restent à venir |
| 5 — Frontend | Pages métier reliées aux API ; recette Chrome desktop/mobile réussie dans ce périmètre |
| 6 — PWA et offline | En cours : première partie installable et fondations du stockage testées ; données privées hors connexion non activées |
| 7 — Tests et sécurité | Qualification globale à venir ; tests progressifs du socle et de la base exécutés |
| 8 — Finalisation | Non commencée |

## Phase 1 — réalisé

- Lecture du prompt et du cahier des charges existant ; examen du dossier et des instructions locales.
- Vérification du système, des outils, des services et du port PostgreSQL usuel ; [preuves et commandes](ENVIRONNEMENT.md).
- Identification des invariants financiers, du contrôle des rôles et des risques d'isolation après transfert.
- Proposition du monorepo, des modules, des contrats API, de la base et du protocole offline-first.
- Rédaction de quatre sources de diagrammes et du plan de développement/tests.
- Questions posées sur l'identifiant de connexion, la durée hors ligne et le traitement des opérations tardives ; aucune réponse supposée.

## Fichiers créés ou modifiés

Le cahier des charges initial reste inchangé. Tous les nouveaux fichiers sont documentaires :

- [Index](README.md), [diagnostic](ENVIRONNEMENT.md), [décisions](DECISIONS.md) et présent journal.
- [Analyse](architecture/ANALYSE.md), [architecture](architecture/ARCHITECTURE.md), [diagrammes](architecture/DIAGRAMMES.md), [synchronisation](architecture/SYNCHRONISATION.md) et [plan/tests](architecture/PLAN_ET_TESTS.md).
- [Modèle relationnel](database/MODELE_RELATIONNEL.md), [contrats API](api/CONTRATS.md) et [sécurité](security/SECURITE.md).
- Sources Mermaid : [composants](architecture/diagrammes/composants.mmd), [cas d'utilisation](architecture/diagrammes/cas-utilisation.mmd), [classes](architecture/diagrammes/classes.mmd), [relationnel](architecture/diagrammes/relationnel.mmd).
- Diagrammes SVG rendus : [composants](architecture/diagrammes/composants.svg), [cas d'utilisation](architecture/diagrammes/cas-utilisation.svg), [classes](architecture/diagrammes/classes.svg), [relationnel](architecture/diagrammes/relationnel.svg).

## Vérifications et résultats

- Diagnostic local terminé : Node/npm.cmd/Git/VS Code fonctionnent ; moteur Docker indisponible ; PostgreSQL non détecté et port usuel fermé ; WSL absent.
- Lecture des engines de Vite/Nest/Prisma : registre accessible ; Prisma retourné en préversion, aucune version applicative retenue.
- Problème npm.ps1 identifié ; npm.cmd vérifié avec succès sans modification de sécurité système.
- Analyse de diagnostics VS Code : aucune erreur signalée au moment du contrôle documentaire.
- Quatre sources Mermaid compilées en SVG avec succès ; rendus ouverts dans Chrome, capturés temporairement puis inspectés visuellement. Les boîtes de contenu restent dans les viewBox, sans découpage détecté.
- Contrôles automatisés Node terminés avec code de sortie 0 : 12 documents Markdown, 4 sources Mermaid, 4 SVG, 61 liens relatifs valides, 17 classes concordantes avec les 17 entités relationnelles et présence des 13 modèles obligatoires. Empreinte du cahier initial inchangée ; aucun fichier applicatif créé.
- Tests applicatifs Jest/Supertest/Vitest/RTL/Playwright : **non exécutés**, car l'application n'est pas initialisée.

## Commandes de production et vérification documentaire

Les documents et sources Mermaid ont été créés par patchs, uniquement sous documentation. Un outil de rendu temporaire a été installé hors du dépôt ; aucun package.json, lockfile ou node_modules applicatif n'a été créé.

```powershell
# $diagramToolsPath désigne un sous-dossier temporaire hors du projet.
$env:PUPPETEER_SKIP_DOWNLOAD = 'true'
npm.cmd install --prefix $diagramToolsPath --no-save --no-package-lock --ignore-scripts --fetch-timeout=20000 --fetch-retries=1 @mermaid-js/mermaid-cli
# Version de l'outil documentaire constatée : 12.2.0.
node $diagramCliPath --version
# Commande répétée pour les quatre sources, avec Chrome déjà installé :
node $diagramCliPath -p $browserConfigPath -i documentation/architecture/diagrammes/composants.mmd -o documentation/architecture/diagrammes/composants.svg -t neutral -b white
```

Des scripts Node ponctuels, exécutés depuis l'entrée standard sans ajout de code applicatif, ont contrôlé les liens et le hash. Puppeteer fourni par l'outil documentaire a ouvert les SVG pour mesurer les limites et produire des captures PNG temporaires destinées à la vérification visuelle.

Le premier essai de rendu a échoué avec un NetworkError pendant que l'installation temporaire n'était pas encore terminée. Après sa fin, la relance des quatre rendus s'est terminée avec un code de sortie 0. Les liens des quatre SVG initialement absents ont alors été résolus. Les messages de nettoyage de processus Chrome affichés par l'outil n'ont pas empêché la seconde commande de réussir ; une nouvelle ouverture des quatre SVG a confirmé leur lisibilité.

## Problèmes et limites

Au début de la mission, il n'y avait pas de code applicatif existant. Docker reste indisponible, mais PostgreSQL natif permet désormais les tests d'intégration. Les tests du socle sont réussis ; la sécurité des modules métier, l'exactitude financière et la capacité hors ligne ne sont pas encore qualifiées.

Les principales décisions métier sont dans [DECISIONS](DECISIONS.md). Les choix proposés restent soumis à validation. Les questions d'hébergement et de capacité seront affinées avec des données réelles.

## Point d'arrêt de la phase 1 — résolu

L'utilisateur a répondu « ok continue », ce qui valide la conception générale et autorise l'initialisation. Les choix métier non précisés restent ouverts. Le point d'arrêt initial provenait directement des sections 19 et 22 du prompt utilisateur.

## Phase 2 — réalisée

- Git initialisé sur main ; npm workspaces frontend/backend/contracts créés.
- Versions stables sélectionnées à partir du registre et des compatibilités déclarées ; voir ADR-15.
- Configuration locale générée avec des secrets aléatoires, ignorée par Git.
- React/Vite/TypeScript strict, Tailwind, Router, Query, Axios, Zustand et Zod configurés ; accueil/diagnostic connectés à l'API réelle.
- NestJS ESM/NodeNext, configuration validée, erreurs HTTP structurées, en-têtes de sécurité, endpoints de santé et Swagger opérationnels.
- Prisma 7.10.1 configuré et validé pour PostgreSQL ; modèles/migrations/client métier prévus en phase 3.
- PostgreSQL 18.7 installé localement depuis EDB, hors OneDrive, sans service Windows. Démarrage, arrêt/redémarrage et vraie requête avec suivi_app non superutilisateur réussis.
- Configuration Docker Compose validée avec `docker compose --env-file .env config --quiet` ; aucun moteur Docker démarré.
- Builds des trois packages et contrôle TypeScript strict réussis ; ESLint et Prettier réussis.
- Jest/Supertest : 9 tests réussis ; Vitest/Testing Library : 4 tests réussis ; Playwright : 4 parcours Chrome desktop/émulation mobile réussis avec PostgreSQL réel.
- Swagger JSON généré, routes de santé et documentation répondant HTTP 200 ; inspection visuelle desktop/mobile effectuée.
- Swagger ouvert dans Chrome via le proxy frontend : deux opérations visibles et aucune erreur JavaScript détectée. Contrôle de 91 liens locaux sans lien manquant.
- Cahier initial inchangé, configuration réelle ignorée par Git, aucun compte utilisateur SUIVI ni donnée financière de démonstration créé.

## Phase 2 — fichiers et commandes

Principaux fichiers : [README de démarrage](../README.md), [manifeste racine](../package.json), [lockfile](../package-lock.json), [configuration d'exemple](../.env.example), [Compose](../docker-compose.yml), [tâches VS Code](../.vscode/tasks.json), [frontend](../frontend), [backend](../backend), [contrats](../packages/contracts) et [tests navigateur](../tests/e2e).

Les versions précises, commandes exécutées et corrections sont consignées dans le [compte rendu d'initialisation](INITIALISATION.md). Le premier build CommonJS et la première configuration ts-jest ont échoué, puis ont été corrigés et revérifiés. Le blocage des flux Windows au démarrage natif a été corrigé et le cycle de redémarrage vérifié.

## Limites restantes après phase 2

- Audit production : aucune vulnérabilité connue signalée. Audit complet après corrections : 6 entrées faibles liées à deepmerge dans Jest/ts-jest, 0 modérée/élevée/critique. Pas de correctif amont publié ; suivi explicite dans le compte rendu. Le code de sortie 1 de cet audit n'est pas masqué.
- Docker Compose validé syntaxiquement, mais non exécuté faute de moteur ; PostgreSQL natif réellement testé à sa place.
- Authentification, rôles métier, membres, encaissements, objectifs, exports et PWA/synchronisation restent à réaliser.
- Les types métier ne sont pas encore générés depuis OpenAPI ; seul le contrat technique de santé est partagé pour l'instant.
- Git est initialisé, sans commit ou publication distante.

## Phase 3 — réalisée

- [Schéma Prisma](../backend/prisma/schema.prisma) : 17 modèles relationnels, UUID, montants BIGINT, versions, sessions, appareils et structures de synchronisation.
- [Migrations](../backend/prisma/migrations) : tables, intégrité, ledger financier, audit obligatoire, privilèges et index de FK. Quatre migrations appliquées à suivi_dev ; checksums conformes aux fichiers.
- [Bootstrap](../backend/prisma/seed.ts) et [démonstration](../backend/prisma/seed-demo.ts) séparés, testés sur deux bases isolées. Argon2id, aucun secret universel, aucun reset implicite, refus du jeu de démonstration dans une base réelle.
- [Tests PostgreSQL](../backend/database-tests) : 34 cas réussis. Rôle applicatif non superutilisateur ; concurrence et rollback exercés sur PostgreSQL réel.
- Calendrier de fixtures couvrant périodes partielles et année bissextile ; choix des dates réelles et convention métier laissés ouverts.
- Prisma intégré au pool backend ; lecture ORM et santé du service vérifiées sur la base de développement.
- Sauvegardes réalisées hors OneDrive avant migrations. Aucun utilisateur, objectif ou paiement ajouté dans suivi_dev.
- Correction du build React pour forcer le mode production ; watcher Windows restreint à dist pour éviter les redémarrages provoqués par les dépendances.

## Phase 3 — vérifications finales

| Vérification | Résultat |
|---|---|
| Prisma format/validate/generate | Réussis |
| Build des trois packages | Réussi ; bundle React de production confirmé |
| TypeScript strict, ESLint, Prettier | Réussis |
| Jest backend | 12 tests réussis |
| Vitest frontend | 4 tests réussis |
| PostgreSQL dédié | 34 tests réussis ; runner terminé avec code 0 et instance arrêtée |
| Playwright | 4 parcours Chrome desktop/émulation mobile réussis |
| Migrations de développement | 4 appliquées, aucun checksum divergent, aucune donnée de démonstration |
| API et frontend locaux | HTTP 200 après redémarrage du mode développement |
| Audit production | Aucune vulnérabilité connue signalée |

Les corrections intermédiaires et les commandes sont détaillées dans le [compte rendu de phase 3](database/PHASE_3.md). Un cycle dont les assertions passaient mais dont l'arrêt dépassait le délai a été considéré en échec ; le délai et la vérification d'arrêt ont été corrigés, puis la commande entière a réussi.

## Livraison actuelle — phases 4 à 9 du cahier joint

L'utilisateur cite maintenant le tableau à quatorze phases de la section 19 du cahier joint. La table historique ci-dessus conserve le découpage en huit grandes phases du prompt maître. Le [compte rendu des phases 4 à 9](PHASES_4_9.md) décrit cette livraison et ses fichiers.

| Phase du cahier joint | État actuel |
|---|---|
| 4 — Authentification et permissions | Terminée dans le périmètre en ligne ; API, formulaires, sessions, reset, révocations et bootstrap vérifiés |
| 5 — Départements | Terminée ; API et interface testées, statuts/version et isolation vérifiés |
| 6 — Responsables | Terminée ; affectation unique, premier changement, reset/révocation et réaffectation testés |
| 7 — Membres | Terminée avec restriction explicite Q07 ; création, isolation, versions, archivage, réactivation administrative et transfert testés |
| 8 — Encaissements | Terminée ; idempotence/concurrence, montants exacts, révisions/audit et annulations testés |
| 9 — Objectifs et tableaux de bord | Terminée dans les politiques explicites disponibles ; API/Recharts et recette navigateur réussies |
| 10 — Notifications et audit | Terminée ; qualification et bilan détaillés ci-dessous |
| 11 à 14 | PWA, synchronisation, exports, qualification et déploiement à venir |

### Vérifications intermédiaires

- 57 tests PostgreSQL/API réussis après correction du verrou financier, sans élargir les privilèges SQL.
- TypeScript strict et builds réussis ; pages chargées à la demande, bundle initial inférieur à 500 Ko.
- Tests frontend : 8 réussis après correction du libellé et du message de changement de mot de passe.
- Parcours navigateur encore en cours : le premier cycle a détecté une erreur de création de campagne ; le suivant a franchi cette étape et détecté le libellé ambigu du nouveau mot de passe. Les échecs restent consignés, les phases ne sont pas annoncées validées avant une exécution complète réussie.
- De nouveaux cas de validation/sécurité et la route paginée des semaines ont été ajoutés ; leur dernière exécution reste à confirmer.

### Prochaine étape

Après la phase 10, les phases 11/12 concernent la PWA et la synchronisation, puis viennent les exports et la qualification de production. Les choix métier non explicitement renseignés restent dans [DECISIONS](DECISIONS.md).

### Bilan final des phases 4 à 9

- **95 tests distincts réussis** : 16 Jest du socle, 10 Vitest/RTL, 63 PostgreSQL/API et 6 Playwright. Dernière recette complète terminée avec code 0 et instance temporaire arrêtée.
- `npm.cmd run check` réussi : lint, format, types stricts, tests et builds. Contrats partagés et Swagger disponibles : 35 opérations, 38 schémas.
- Annulation SQL côté serveur prouvée (57014), puis connexion réutilisable ; le timeout client court n'est plus appliqué aux écritures métier.
- Rejeu d'un paiement annulé conservant son statut, et refus d'accès par rejeu après réaffectation du responsable, couverts par les tests.
- Rendus Chrome desktop/mobile inspectés et absence de débordement de page vérifiée ; graphiques issus des vraies données de test isolées.
- Audit production sans vulnérabilité connue ; audit complet avec 6 alertes faibles d'outillage et code 1 explicitement conservé. Aucun problème modéré/élevé/critique signalé.
- Aucun compte réel ou jeu de démonstration injecté dans suivi_dev. Premier compte à créer personnellement avec le bootstrap documenté ; aucune identité imposée.
- Redémarrage local par la tâche VS Code réussi : écran /connexion et santé PostgreSQL HTTP 200, liste des membres sans session HTTP 401, Swagger HTTP 200. Application disponible sur http://127.0.0.1:5173/connexion.
- 136 liens documentaires locaux contrôlés, aucun lien manquant ; cahier d'origine inchangé. La validation ciblée de configuration rejette aussi la clé JWT d'exemple, après quoi le build/OpenAPI a été régénéré.
- [Compte rendu détaillé](PHASES_4_9.md), [guide utilisateur](user-guide/PREMIERS_PAS.md), [API implémentée](api/MODULES_METIER.md) et [sécurité effective](security/AUTHENTIFICATION_IMPLEMENTEE.md).

Les restrictions métier ouvertes, l'absence de mode hors ligne et les travaux restant avant production sont décrits explicitement dans le compte rendu. Cette livraison ne les déclare pas réalisés.

## Phase 10 — notifications et consultation d'audit

- Modules NestJS d'événements, notifications et audit ; contrats partagés et écrans React intégrés à la navigation selon le rôle.
- Notifications et audit atomiques, déduplication, alertes de nouvel appareil, filtrage des anciennes alertes après réaffectation et protection des historiques par PostgreSQL.
- Sept nouvelles opérations REST protégées ; aucune suppression ni modification d'audit, aucun endpoint de création arbitraire de notification.
- Migration additive numéro cinq : deux index de parcours, contraintes de contenu et triggers des notifications. Sauvegarde de développement préalable hors OneDrive.
- Tests ajoutés : deux unitaires backend, trois frontend et treize PostgreSQL/API ; les deux parcours métier navigateur existants sont étendus aux notifications et à l'audit.
- Les erreurs intermédiaires ont été conservées : migration oubliée de la nouvelle base de test puis corrigée, validation-only DTO signalé par ESLint, formatage, sélecteur Playwright du filtre audit corrigé pour utiliser son rôle accessible, puis attente explicite de la réponse de création du calendrier dans le test mobile.
- Le [compte rendu de phase 10](PHASE_10.md) précise les résultats finaux, commandes et limites. Les anciennes alertes ne sont pas recréées ; le producteur de synchronisation réelle reste à la phase 12.
- Publication GitHub demandée explicitement par l'utilisateur ; dépôt cible public inspecté, contrôle des fichiers et exclusion des secrets avant le premier commit.
- **Bilan final : 113 tests réussis** (18 Jest, 13 Vitest/RTL, 76 PostgreSQL/API et 6 Playwright). Les 76 cas de base/API ont repassé ; les six parcours navigateur ont ensuite réussi en reprise ciblée. Écrans desktop/mobile inspectés, schéma et cinq migrations vérifiés, aucun diagnostic d'éditeur.
- Données de suivi_dev inchangées après migration : aucune donnée métier ni notification ajoutée, un audit préexistant conservé. OpenAPI : 42 opérations, 44 schémas ; sept nouvelles opérations protégées.
- Prochaine étape : phase 11 PWA puis phase 12 synchronisation. Q02/Q03/Q11/Q18 restent à valider pour l'autorisation hors ligne et les appareils ; aucun choix métier manquant n'a été présumé.

## Phase 11 — installation et stockage local, première partie

- Manifest, icônes, worker Workbox, cache statique fermé, écran d'installation et mise à jour sur confirmation implémentés et testés sur Chrome desktop/mobile.
- Dexie utilisé pour le nom d'appareil réellement transmis aux prochaines connexions. Primitives de chiffrement et de file atomique ajoutées et soumises aux tests.
- Aucun membre ou paiement privé téléchargé dans IndexedDB ; aucune synchronisation réseau ni validation financière hors ligne annoncée.
- Q02 (durée autorisée hors ligne) demandée explicitement à l'utilisateur : 72 h, 24 h ou 7 jours. Réponse toujours attendue ; aucun choix automatique.
- **131 tests distincts réussis** : 18 Jest, 25 Vitest/RTL, 76 PostgreSQL/API et 12 Playwright. Deux anomalies de première recette corrigées : renommage d'appareil connu et rechargement explicite après mise à jour ; la saisie d'un autre onglet reste préservée. La création locale ne peut pas écraser un paiement existant.
- [Compte rendu de cette livraison](PHASE_11.md). Cette partie ne suffit pas à déclarer la phase 11 entière terminée. Prochaine étape : autorisation hors ligne bornée et préparation chiffrée du département, puis synchronisation par lots.
