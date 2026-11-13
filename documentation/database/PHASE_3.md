# Phase 3 — base de données et intégrité

La conception est matérialisée par [17 modèles Prisma](../../backend/prisma/schema.prisma), quatre migrations versionnées et la vue SQL de soldes payment_balances. Aucun compte réel, département réel ou paiement de démonstration n'est ajouté dans suivi_dev.

## Modèles et migrations

Les modèles sont User, Department, Member, MemberDepartmentPeriod, Objective, CollectionWeek, Payment, PaymentRevision, PaymentAdjustment, Device, Session, RefreshToken, SyncOperation, SyncScope, SyncChange, Notification et AuditLog.

Vérification finale du 13 novembre 2026 : 34 tests PostgreSQL, 12 tests backend, 4 tests frontend et 4 parcours navigateur réussis. Typage, lint, formatage, build et état des migrations vérifiés. Le runner PostgreSQL se termine avec code 0 après arrêt de son instance.

| Migration | Contenu |
|---|---|
| [20261112000100_initial_schema](../../backend/prisma/migrations/20261112000100_initial_schema/migration.sql) | Tables, enums, clés étrangères, index et UUID générables côté PostgreSQL |
| [20261112000200_integrity_and_ledger](../../backend/prisma/migrations/20261112000200_integrity_and_ledger/migration.sql) | CHECK, index partiels, exclusions GiST, triggers, audit différé et vue des soldes |
| [20261112000300_runtime_privileges](../../backend/prisma/migrations/20261112000300_runtime_privileges/migration.sql) | Droits minimaux de suivi_app ; fonctions techniques inaccessibles directement |
| [20261112000400_foreign_key_indexes](../../backend/prisma/migrations/20261112000400_foreign_key_indexes/migration.sql) | 16 index complémentaires couvrant les préfixes des clés étrangères et les jointures de supervision |

Chaque migration est transactionnelle. btree_gist est une extension PostgreSQL de confiance disponible dans les binaires utilisés ; elle protège les périodes d'affectation et les semaines contre les chevauchements. Les modèles complémentaires de sessions et de synchronisation sont présents dès cette étape, sans prétendre que les endpoints métier correspondants sont déjà disponibles.

Le client Prisma ESM est généré avant les builds, contrôles TypeScript et tests backend. Les fichiers générés ne sont pas versionnés. DatabaseService partage son pool PostgreSQL avec PrismaPg ; sa vérification de santé existante continue de fonctionner. Les requêtes ORM, y compris BigInt et transactions interactives, ont été exercées dans les tests d'intégration.

## Garanties financières

- Montant d'origine et cible : BIGINT strictement positif ; aucun cumul individuel modifiable.
- Clé d'idempotence UUID unique ; les courses concurrentes ne peuvent pas créer deux paiements avec la même clé. Le rejeu HTTP du reçu sera réalisé en phase 4.
- Département historique lié à une période d'affectation ; un transfert ne déplace pas les paiements antérieurs.
- État actif du membre, du département, du collecteur et de l'appareil vérifié à l'insertion ; le membre est verrouillé contre un archivage concurrent.
- Semaine et campagne reliées par une FK composite ; date de collecte vérifiée dans le fuseau de campagne et dans les bornes de semaine.
- Original du paiement protégé ; aucune suppression physique par l'application. Audit, révisions et ajustements sont append-only.
- Correction/annulation : auteur de référence Super Administrateur actif, raison non vide, version et ancien solde vérifiés sous verrou.
- Un trigger contrôlé écrit le delta et actualise la projection de statut/version. L'application n'a aucun droit d'insertion directe dans les ajustements ni d'UPDATE sur le paiement.
- Une correction de mode sans changement de montant n'invente pas d'ajustement monétaire.
- Paiement et révision doivent disposer de leur audit dans la même transaction ; l'absence d'audit annule également les effets du trigger.

La vue payment_balances regroupe les ajustements avant de joindre les paiements. Elle conserve un solde exact en numeric : original + somme des écarts, sans multiplier l'original par le nombre de révisions. Les rapports futurs devront filtrer les paiements validés, le département autorisé et la campagne concernée. Les montants seront transportés sous forme de chaînes entières.

Le scénario 10 000 → 8 000 → 9 000 → annulation conserve l'original et trois révisions, avec les deltas −2 000, +1 000 et −9 000, puis un solde nul. Les tests vérifient également une valeur supérieure à Number.MAX_SAFE_INTEGER sans perte de précision.

## Contrat des mutations pour les futurs services

Une entité versionnée doit être modifiée avec version = ancienne version + 1 et une condition WHERE sur la version attendue. Le trigger refuse une version non incrémentée ; il ne remplace pas le contrôle optimiste de la requête métier.

Pour PaymentRevision, revisionNumber correspond à la version du paiement attendue avant correction : première révision 1, nouvelle version de paiement 2. Les champs previousAmount/newAmount et previousMethod/newMethod sont typés. Les JSON beforeValue/afterValue complètent le contexte ; ils ne sont pas la source d'un calcul monétaire.

Le service doit insérer l'événement d'audit correspondant avant commit :

| Écriture | Action | entityType / entityId |
|---|---|---|
| Paiement | PAYMENT_CREATED | Payment / UUID paiement |
| Correction | PAYMENT_CORRECTED | PaymentRevision / UUID révision |
| Annulation | PAYMENT_CANCELLED | PaymentRevision / UUID révision |

L'acteur et le département doivent correspondre à l'écriture. Les snapshots d'audit refusent les noms de champs secrets connus ; les services restent responsables de la minimisation et de la rédaction des données sensibles.

SyncChange attribue sa séquence par mise à jour verrouillée de SyncScope dans la transaction. Une annulation de transaction annule aussi l'incrément. L'INSERT peut fournir sequence=0 : le trigger remplace cette valeur par le numéro autoritaire. Le contenu d'une demande SyncOperation et son reçu terminal sont immuables ; les reçus applicatifs et la reprise réseau restent à implémenter.

Un échec technique temporaire doit annuler la transaction sans laisser de reçu terminal : une nouvelle transmission garde alors sa clé. Un reçu FAILED persisté désigne un refus définitif ; sa résolution produit une nouvelle opération tracée. Les états locaux récupérables ne doivent pas être confondus avec ce reçu serveur terminal.

Ces vérifications ne prouvent pas l'identité de l'appelant HTTP : un identifiant d'acteur dans une écriture SQL n'est pas une authentification. Les guards NestJS, sessions, contrôles par ressource et filtres départementaux restent obligatoires en phase 4. Aucun droit applicatif de saisie administrative, de réactivation ou d'arbitrage tardif n'est implicitement décidé par le schéma.

## Seeds distincts

### Bootstrap réel

[seed.ts](../../backend/prisma/seed.ts) crée uniquement le premier Super Administrateur, le périmètre technique GLOBAL et un audit. L'opérateur doit fournir son identifiant, son identité et un secret de 12 à 256 caractères. Aucun mot de passe universel et aucune identité par défaut ne sont prévus. Argon2id utilise 64 Mio, trois passes et un parallélisme de 1 ; le secret n'est jamais écrit en base ou imprimé par le script.

Un second bootstrap est refusé dès qu'un Super Administrateur existe, y compris inactif. Il ne réinitialise aucun accès. Un verrou transactionnel empêche deux bootstraps concurrents. mustChangePassword reste vrai ; le parcours de changement initial sera implémenté avec l'authentification.

### Démonstration

[seed-demo.ts](../../backend/prisma/seed-demo.ts) exige ALLOW_DEMO_SEED=true, un environnement autre que production et une base nommée suivi_demo ou suivi_test_*. La logique de seed contrôle aussi le nom réel retourné par PostgreSQL, même si elle est appelée sans le wrapper CLI.

Le jeu contient deux départements explicitement nommés Démo, quatre membres, quatre encaissements, une campagne fictive et ses 53 périodes réelles pour 2026. La convention dimanche–samedi est réservée à ce jeu tant que Q05 n'est pas tranchée pour les campagnes réelles. Un second passage ne duplique pas les données.

Le secret fourni concerne uniquement l'administrateur de démonstration. Les responsables reçoivent des secrets aléatoires distincts dont seul le hash est conservé ; leur accès devra être réinitialisé explicitement par l'administrateur lorsque le module correspondant sera disponible.

## Tests PostgreSQL dédiés

```powershell
npm.cmd run test:database
```

Sous Windows, le [runner](../../backend/scripts/test-database.mjs) crée une instance temporaire sur un port libre avec secrets aléatoires, puis deux bases dédiées : une pour les contraintes et le bootstrap, une pour la démonstration. Il ne se connecte pas à suivi_dev. Les migrations sont déployées, puis redéployées pour vérifier l'absence d'opération en attente. L'instance est arrêtée en fin de test ; les fichiers restent dans le répertoire temporaire pour diagnostic.

Sur une infrastructure externe, fournir les quatre variables SUIVI_TEST_MIGRATION_URL, SUIVI_TEST_DATABASE_URL, SUIVI_TEST_DEMO_MIGRATION_URL et SUIVI_TEST_DEMO_DATABASE_URL. Les bases doivent être distinctes, vides, nommées suivi_test_* et disposer des rôles suivi_migrator/suivi_app. Le runner refuse une cible normale ou non vide ; il ne fait pas de reset destructif.

La suite compte 34 cas couvrant les migrations, seeds, clés, périodes, finances, audits, grands entiers, appareils, reçus, séquences et index des FK composites. Les courses de double envoi, double correction et archivage concurrent sont exercées sur PostgreSQL réel. Les tests du calendrier couvrent les périodes partielles et le 29 février.

## Application à la base de développement

Une sauvegarde au format pg_dump custom a été créée avant migration dans le répertoire utilisateur SUIVI/backups, hors OneDrive : suivi_dev-2026-11-12T23-37-48-358Z-54ad9da8.dump. La base était sans table métier à ce moment. Cette sauvegarde locale de développement ne remplace pas la future procédure chiffrée de sauvegarde/restauration de production.

Les trois migrations initiales ont ensuite été appliquées à suivi_dev. La revue d'indexation a produit une quatrième migration additive, sans modifier les fichiers déjà appliqués. Aucun seed réel ou de démonstration n'a été lancé sur cette base pendant la mission.

Une seconde sauvegarde, suivi_dev-2026-11-12T23-51-19-789Z-1694a64e.dump, a précédé la migration d'indexation. Les quatre migrations sont désormais appliquées et leurs checksums concordent avec les fichiers. Les comptes utilisateurs, paiements et objectifs réels restent à zéro.

```powershell
npm.cmd run db:backup
npm.cmd run db:migrate
npm.cmd run db:status
npm.cmd run db:check
```

Pour les évolutions : produire et relire une migration avec migrate diff, puis la tester depuis une base vierge avec l'historique complet. Ne pas utiliser db push, migrate reset ou modifier une migration déjà déployée pour contourner un problème. Le rôle de migration n'a pas CREATEDB : migrate dev avec création automatique de shadow database n'est pas nécessaire au workflow retenu.

## Corrections relevées pendant les vérifications

- Ajout de l'unicité composite révision/paiement exigée par la relation 1:1 Prisma.
- Renommage d'une variable SQL qui entrait en collision avec CURRENT_ROLE ; le contrôle du rôle d'audit a été revalidé par les tests.
- Première vérification de migration lancée avant la présence des fichiers de tests : migrations appliquées, exécution Jest refusée ; aucune qualification n'a été déclarée sur ce résultat. La suite complète a ensuite été exécutée.
- Build frontend rendu explicitement indépendant d'un NODE_ENV=development hérité du terminal ; vérification du bundle et des parcours navigateur après compilation.
- Revue avec le guide PostgreSQL best practices : ajout d'une migration pour les FK sans index couvrant leur préfixe, avec un test de non-régression. Les fonctions financières à privilèges élevés ont un search_path fixé et ne sont pas exécutables directement par l'application ; les transactions de concurrence sont testées.
- Arrêt du serveur de test : un cycle a dépassé le délai initial malgré des assertions réussies, et a conservé un code de sortie d'échec. Le délai est porté à 90 secondes avec vérification explicite de l'état arrêté ; le cycle complet suivant s'est terminé avec code 0.
- Surveillance de développement : Node surveillait les dépendances et redémarrait l'API sur leurs événements de fichiers. Le watcher est restreint au dossier dist sous Windows/macOS et le compilateur ne produit pas de fichiers en cas d'erreur. En production, le démarrage utilise node dist/main.js sans mode watch.

Commandes principales exécutées :

```powershell
npm.cmd run prisma:validate
npm.cmd run prisma:generate
npm.cmd run test:database
npm.cmd run db:backup
npm.cmd run db:migrate
npm.cmd run db:status
npm.cmd run db:check
npm.cmd run build
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run format:check
npm.cmd test
npm.cmd exec -- playwright test
npm.cmd audit --omit=dev --json
```

Les premiers fichiers SQL ont été générés avec migrate diff --from-empty --to-schema prisma/schema.prisma --script, puis complétés par les migrations d'intégrité. Argon2 0.45.2 a été installé et son script natif autorisé explicitement. Les captures, requêtes de vérification et données de test ne sont pas des données de production.

## Limites et prochaine étape

Les migrations et tests ne constituent pas une application métier complète. La phase 4 doit réaliser l'authentification, la révocation, les permissions et les modules REST, puis les tester progressivement. Les questions métier du [registre](../DECISIONS.md), notamment login, calendrier réel, modes de paiement, sessions hors ligne et arbitrages tardifs, restent ouvertes.

L'audit complet de l'outillage garde les alertes faibles liées à deepmerge/Jest documentées en phase 2 ; l'audit des dépendances de production reste sans vulnérabilité connue. La stratégie chiffrée de sauvegarde/restauration et les tests de charge restent à qualifier avant production.
