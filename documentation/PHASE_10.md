# Phase 10 — notifications internes et consultation d'audit

Date : 13 novembre 2026. Découpage : phase 10 du tableau à quatorze phases du [cahier joint](../cahier_des_charges.md). Le [bilan précédent](PHASES_4_9.md) conserve les résultats des phases 4 à 9.

## Réalisation

Les événements métier produisent une trace d'audit et les notifications associées dans la même transaction PostgreSQL. Un rollback annule l'ensemble. Une contrainte unique par destinataire et UUID d'audit empêche les doublons. La liste blanche couvre les encaissements, corrections/annulations, membres, responsables, départements, campagnes et événements sensibles d'accès. Les consultations ordinaires et les marquages comme lus n'émettent aucune notification.

Tous les Super Administrateurs actifs reçoivent les événements. Les responsables actifs du département reçoivent les changements effectués par un autre acteur ; les transferts concernent les départements source et cible. Les alertes personnelles de compte suivent leur utilisateur. Après réaffectation, les anciennes notifications départementales deviennent inaccessibles, y compris par identifiant direct et marquage en lot. Les messages restent génériques, sans coordonnées, montants ni secrets. Une notification n'accorde aucun accès supplémentaire à sa ressource.

Une connexion avec un nouvel UUID d'appareil, après un premier appareil connu, crée une alerte de sécurité. Le tout premier appareil n'est pas considéré inhabituel. La réutilisation d'un refresh révoque la session et produit une alerte dans sa transaction. Ces signaux ne prouvent pas une intrusion.

La boîte personnelle propose recherche, pagination, filtres, compteur de non-lus, lecture individuelle et marquage de toute la boîte après confirmation. Liste et compteur se rafraîchissent toutes les trente secondes dans l'application ouverte. Le journal d'audit est réservé au Super Administrateur : filtres, métadonnées paginées puis détail avant/après, acteur, rôle, département, appareil et référence de requête. Aucune modification ni suppression n'est proposée ou exposée par l'API.

## Fichiers créés ou modifiés

- [Événements](../backend/src/events) : politique de diffusion, expurgation des champs secrets, enregistrement et publication transactionnels.
- [Notifications backend](../backend/src/notifications) et [audit backend](../backend/src/audit) : modules, contrôleurs, DTO validés, réponses Swagger et services.
- [Authentification](../backend/src/auth/auth.service.ts), [module commun](../backend/src/common), [responsables](../backend/src/users/managers.service.ts) et [assemblage](../backend/src/app.module.ts) : intégration des événements sans cycle de dépendance ; contact du responsable présent dans l'audit sécurisé.
- [Contrats](../packages/contracts/src/index.ts), [notifications React](../frontend/src/features/notifications), [audit React](../frontend/src/features/audit), [application](../frontend/src/app/App.tsx) et [hook de listes](../frontend/src/hooks/business.ts) : types et parcours réels.
- [Schéma Prisma](../backend/prisma/schema.prisma) et [cinquième migration](../backend/prisma/migrations/20261113000100_notifications_and_audit/migration.sql) : index par destinataire/date et chronologie audit, contenu non vide, date de lecture cohérente, notifications conservées et première lecture immuable.
- [Tests événements unitaires](../backend/test/events.spec.ts), [tests événements PostgreSQL/API](../backend/database-tests/events.spec.ts), [tests frontend](../frontend/src/features/notifications/NotificationsPage.test.tsx), [recette métier](../tests/e2e/business.spec.ts), [runner PostgreSQL](../backend/scripts/test-database.mjs) et [contrôles d'intégrité](../backend/database-tests/integrity.spec.ts).
- [README](../README.md), [avancement](PROGRESS.md), [décisions](DECISIONS.md), [API](api/MODULES_METIER.md), [sécurité effective](security/AUTHENTIFICATION_IMPLEMENTEE.md) et [guide utilisateur](user-guide/PREMIERS_PAS.md).

## Qualification

**113 tests distincts réussis** : 18 unitaires backend Jest, 13 frontend Vitest/RTL, 76 PostgreSQL/API et 6 parcours Playwright desktop/mobile. La suite PostgreSQL/API a passé deux fois ; après les corrections des tests navigateur, les six parcours ont passé lors de la reprise ciblée. Les échecs intermédiaires ne sont pas comptés comme validations.

| Contrôle | Résultat |
|---|---|
| ESLint, Prettier, TypeScript strict et builds | Réussis ; lint/format/types de la recette revérifiés après correction du runner |
| Événements PostgreSQL/API | 13 nouveaux cas réussis, plus les 63 cas antérieurs |
| Notifications React | 3 nouveaux cas réussis, plus les 10 antérieurs |
| Événements unitaires backend | 2 nouveaux cas réussis, plus les 16 antérieurs |
| Recette navigateur | 6 parcours réussis ; contrôle visuel des écrans de notifications et d'audit sur ordinateur et mobile ; absence de débordement horizontal vérifiée |
| Développement local | Connexion et santé PostgreSQL 200 ; notifications/audit anonymes 401 |
| Migration | Cinq migrations à jour, données conservées et checksums conformes |

Les avertissements existants sur les modules VM de Jest et la mise en file interne de requêtes pg restent visibles. Aucune dépendance n'a été ajoutée dans cette phase ; le bilan des dépendances du compte rendu précédent reste applicable.

Contrôles déjà confirmés : schéma Prisma valide ; cinq migrations appliquées et checksums identiques aux fichiers ; données de développement conservées avec les mêmes comptages qu'avant migration. OpenAPI régénéré : 42 opérations et 44 schémas, dont sept nouvelles opérations toutes protégées par Bearer. Les diagnostics d'éditeur ne signalent aucune erreur et les 186 liens documentaires locaux vérifiés existent.

Les sondes locales retournent 200 sur l'écran de connexion et la santé PostgreSQL, 401 sur notifications/audit sans session. Le contrôle avant publication ne trouve aucune valeur secrète locale, clé privée ou jeton d'accès dans les fichiers candidats ; les données, sauvegardes et configurations réelles sont ignorées par Git.

Commandes principales utilisées ou de reproduction :

```powershell
npm.cmd run db:backup
npm.cmd run check
npm.cmd run test:e2e
npm.cmd run db:migrate
npm.cmd run db:status
npm.cmd run prisma:validate
npm.cmd run api:openapi
```

L'export OpenAPI a été produit directement par `node dist/export-openapi.js` depuis le backend déjà compilé. Pour une reprise ciblée des seuls six parcours navigateur après compilation, le runner accepte `node backend/scripts/test-database.mjs --e2e-only` : il crée encore des bases éphémères et exécute les vraies API, en omettant la suite PostgreSQL/API déjà qualifiée. La commande normale test:e2e conserve la qualification complète.

La sauvegarde locale préalable porte le nom suivi_dev-2026-11-13T19-10-53-759Z-829cac8b.dump, sous le répertoire utilisateur SUIVI/backups, hors dépôt et OneDrive. Avant migration, les tables métier de développement contiennent zéro utilisateur, département, membre, campagne, paiement et notification ; un ancien événement d'audit est présent. Aucun compte réel n'est créé pour la recette.

Le runner possède quatre bases isolées (intégrité, démonstration, API métier et événements), cinq avec Playwright. En mode PostgreSQL externe, fournir en plus les paires SUIVI_TEST_EVENTS_MIGRATION_URL / SUIVI_TEST_EVENTS_DATABASE_URL : bases distinctes, vides, au préfixe suivi_test_. La suite vérifie diffusion, rejeu sans doublon, rollback, lectures silencieuses, dates de lecture stables, isolation, réaffectation, détection d'appareil, expurgation des secrets, filtres et interdictions SQL.

Erreurs corrigées pendant la qualification : la nouvelle base événements était créée mais initialement non migrée ; le runner applique désormais toutes les migrations avant les tests. Les contrôles ESLint/Prettier ont signalé un DTO de validation inutilisé et du formatage. La première recette navigateur complète a passé 76 tests PostgreSQL/API mais échoué dans deux parcours sur le sélecteur exact du filtre Action : le test utilise maintenant le rôle combobox et le nom accessible. Le cycle suivant a repassé les 76 tests et le parcours desktop, mais le mobile s'arrêtait après cinq secondes avec la création de campagne encore en cours. Le test attend maintenant la réponse HTTP de génération du calendrier, vérifie son statut 201, puis le rendu de la campagne. Les échecs n'ont pas été masqués.

## Limites et suite

- Notifications internes uniquement ; pas de Web Push ni d'envoi externe. Pas de reconstruction des anciennes alertes depuis l'audit historique.
- La politique SYNC_FAILED et son routage sont testés sur une fixture dédiée. Le producteur réel dépend de la synchronisation, non encore implémentée ; aucun endpoint public ne permet de simuler cet événement.
- Pas encore de stockage hors ligne, service worker ou file durable. Une saisie déconnectée n'est jamais déclarée validée par le serveur.
- Les décisions métier ouvertes sont conservées dans [DECISIONS](DECISIONS.md), notamment durée hors ligne, appareil partagé et traitement des opérations tardives. La demande « continue » n'est pas interprétée comme une réponse à ces questions.
- Prochaine étape : phase 11 PWA, puis phase 12 synchronisation. Les exports et la qualification de déploiement restent aux phases 13 et 14.

L'utilisateur autorise la publication sur le dépôt public [Coulabraham/SUIVI](https://github.com/Coulabraham/SUIVI). Les secrets locaux, bases, sauvegardes, dépendances installées, builds et traces de tests restent hors Git.

L'identité du commit utilise le pseudonyme GitHub et son adresse noreply. Les cinq fichiers SQL en index correspondent exactement aux migrations appliquées ; le cahier fourni conserve ses octets originaux grâce à une règle Git dédiée.
