# Phases 4 à 9 — modules métier

Date : 13 novembre 2026. **Modules des phases 4 à 9 livrés et recette en ligne réussie**, avec les restrictions métier explicites ci-dessous. Ce résultat ne qualifie pas encore le mode hors ligne ni la production.

## Périmètre et numérotation

La demande « fait de la phase 4 à la phase 9 » cite le cahier joint. Son tableau de la section 19 comporte quatorze phases. Ce compte rendu suit donc **ce tableau** : authentification, départements, responsables, membres, encaissements, objectifs et tableaux de bord. Le prompt maître utilise huit grandes phases ; les deux numérotations ne sont pas interchangeables.

Le travail hors connexion, les notifications et l'interface d'audit, les exports et la mise en production restent dans les phases 10 à 14 du document joint. Les écritures d'audit nécessaires aux mutations métier et financières font déjà partie des transactions actuelles.

## Réalisation par phase

| Phase du cahier joint | Fonctionnalités |
|---|---|
| 4 | Connexion Passport/JWT, Argon2id, changement initial obligatoire, profil, changement personnel, renouvellement rotatif, révocation, guards et contrôle du département |
| 5 | Création, modification, désactivation/réactivation des départements ; contrôle de version et historique conservé |
| 6 | Création et affectation des responsables, secret aléatoire à affichage unique, expiration choisie explicitement, modification et réinitialisation avec justification et révocation |
| 7 | Création, recherche et pagination des membres, modification versionnée, archivage motivé, réactivation administrateur, transfert administratif et cumul calculé |
| 8 | Encaissements par responsable, confirmation, montants entiers, idempotence, historique, correction/annulation administrateur avec justification et audit atomique |
| 9 | Campagnes, objectif global unique, calendrier explicitement sélectionné, génération des semaines réelles, suspension/reprise/clôture, progression et dépassement, tableaux de bord par rôle et Recharts |

Les pages utilisent les API réelles. Les tableaux paginés, recherches, formulaires React Hook Form/Zod, messages d'erreur, dialogues natifs accessibles et confirmations sont reliés aux mutations correspondantes. Les pages métier sont chargées à la demande.

## Fichiers principaux

- Backend : [auth](../backend/src/auth), [services communs](../backend/src/common), [départements](../backend/src/departments), [responsables](../backend/src/users), [membres](../backend/src/members), [paiements](../backend/src/payments), [objectifs](../backend/src/objectives), [tableaux de bord](../backend/src/dashboard), [semaines](../backend/src/collection-weeks).
- Frontend : [navigation et protections](../frontend/src/app/App.tsx), [composants réutilisables](../frontend/src/components/BusinessUi.tsx), [pages métier](../frontend/src/features), [session en mémoire](../frontend/src/stores/auth.ts), [transport HTTP](../frontend/src/services/api.ts).
- [Contrats de transport partagés](../packages/contracts/src/index.ts), [DTO OpenAPI](../backend/src/common/response.dto.ts).
- [Bootstrap interactif](../backend/scripts/bootstrap-admin.mjs), [runner PostgreSQL isolé](../backend/scripts/test-database.mjs).
- [Intégration HTTP/PostgreSQL](../backend/database-tests/auth.spec.ts), [tests monétaires](../backend/test/money.spec.ts), [tests de formulaires](../frontend/src/features/authentication/AuthPages.test.tsx), [parcours Chrome](../tests/e2e/business.spec.ts).

Aucune nouvelle migration n'est nécessaire pour ces modules : ils utilisent les 17 modèles et les quatre migrations existants. Aucun compte réel ni campagne de démonstration n'est créé automatiquement dans la base de développement.

## Garanties mises en œuvre

- Les JWT durent dix minutes ; la session en ligne a une durée absolue de huit heures. L'identité, le statut, le département, les versions de droits et de credentials, la révocation de session et l'appareil sont relus côté serveur.
- Le refresh est aléatoire, stocké sous forme de SHA-256, rotatif et transmis dans un cookie HttpOnly, SameSite Strict, Secure en production. Sa réutilisation révoque la session. Les actions d'authentification à cookie imposent un en-tête explicite et vérifient l'origine lorsqu'elle est présente.
- Les mutations revérifient l'identité dans la transaction. Les recherches et ressources des responsables sont filtrées par département. Un transfert conserve les paiements dans le département d'encaissement et n'expose pas les coordonnées actuelles au précédent responsable.
- Le rôle PostgreSQL applicatif n'a toujours aucun droit UPDATE/DELETE sur les paiements. Les révisions passent par le ledger et ses triggers, avec audit requis au commit. Les verrous et versions empêchent la concurrence d'écraser une correction.
- Les montants et cumuls utilisent BIGINT/numeric et des chaînes décimales JSON ; aucune conversion en Number pour les calculs financiers. Les barres Recharts utilisent seulement un pourcentage relatif borné pour le rendu.
- Une même clé de paiement et une même charge utile renvoient la transaction existante ; une autre charge utile renvoie un conflit. L'écran conserve cette clé pendant les nouvelles tentatives du dialogue de confirmation.

## Commandes

```powershell
npm.cmd run setup:env
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run format:check
npm.cmd test
npm.cmd run build
npm.cmd run test:database
npm.cmd run test:e2e
npm.cmd run api:openapi
npm.cmd audit --omit=dev
```

Le runner de base crée trois bases temporaires distinctes : intégrité, démonstration et API. Le mode E2E ajoute une quatrième base dédiée au navigateur, avec identités et secrets aléatoires de test transmis au processus, sans comptes universels. Les cibles externes doivent être vides et préfixées suivi_test_. Les instances temporaires sont arrêtées et les fichiers de diagnostic conservés.

## Vérifications intermédiaires et corrections

- Premier cycle d'authentification : délai d'initialisation du compilateur Prisma dépassé ; considéré comme échec. Augmentation du délai de préparation de test, puis 40 tests PostgreSQL/HTTP réussis et code de sortie 0.
- Premier cycle métier : le verrou FOR UPDATE de la correction exigeait un privilège volontairement absent sur payments. Le verrou applicatif est devenu consultatif ; le trigger privilégié conserve le verrou de ligne et la vérification de version. Aucun droit SQL financier supplémentaire accordé.
- L'unicité de l'objectif courant est précontrôlée sous verrou global et reste garantie par l'index SQL. Le conflit retourne une erreur métier compréhensible.
- Cycle API suivant : 57 tests réussis. Le parcours Chrome a néanmoins détecté une erreur de création de campagne dans le serveur compilé ; la phase 9 n'est pas validée à ce stade. Le diagnostic conserve les identifiants de requête et les frames de pile, sans journaliser les valeurs SQL ni les secrets.
- Build initial trop volumineux : séparation des pages par imports dynamiques. Le bundle initial passe sous 500 Ko ; Recharts est chargé avec le tableau de bord.
- Un délai client PostgreSQL de deux secondes, prévu au départ pour la santé du socle, interrompait par intermittence la génération des semaines. Les requêtes métier utilisent maintenant des délais SQL et de verrou côté PostgreSQL, bornés par une transaction de trente secondes. Le contrôle de santé garde son délai court. Les interruptions sont classées indisponibilité temporaire, sans déclarer l'écriture validée.
- Les tests de formulaires ont corrigé le nom accessible du nouveau mot de passe et la conservation du message après changement confirmé. Deux régressions supplémentaires couvrent la purge du cache lors d'un changement d'identité et sa conservation lors d'un renouvellement ordinaire.
- Le cache Query est aussi cloisonné par utilisateur/rôle/département. Un refresh qui change ce contexte impose une reconnexion ; aucune mutation n'est rejouée automatiquement sous une autre identité.

## Résultats finaux

| Vérification | Résultat |
|---|---|
| TypeScript strict, ESLint, Prettier | Réussis |
| Builds contracts, backend et frontend | Réussis ; bundle initial 494 Ko, pages chargées à la demande |
| Jest unitaire/HTTP du socle | 16 tests réussis |
| Vitest/React Testing Library | 10 tests réussis, dont cloisonnement des caches et changement initial |
| PostgreSQL et API métier | 63 tests réussis sur trois bases isolées |
| Playwright Chrome desktop/mobile émulé | 6 parcours réussis avec quatrième base dédiée |
| Ensemble des cas automatisés distincts | **95 tests réussis** |
| Arrêt du runner PostgreSQL/E2E | Code de sortie 0 ; instance temporaire arrêtée |
| Annulation SQL côté serveur | SQLSTATE 57014 obtenu au délai configuré ; connexion réutilisable ensuite |
| Bootstrap redirigé | Refus vérifié ; aucun secret ni compte généré |
| OpenAPI | 35 opérations et 38 schémas ; réponses structurées et sécurité documentées |
| Diagnostics VS Code | Aucune erreur signalée |
| Audit npm production | Aucune vulnérabilité connue signalée |
| Audit npm complet | 6 entrées faibles d'outillage ; code de sortie 1 conservé, aucune modérée/élevée/critique |

La commande de recette finale a exécuté `npm.cmd run check`, puis `node backend/scripts/test-database.mjs --e2e` sur le build obtenu. La commande autonome `npm.cmd run test:e2e` effectue aussi le build au préalable. Les résultats d'échec intermédiaires ci-dessus ne sont pas comptés comme réussites.

Les parcours navigateur passent par les formulaires de création de département, responsable et campagne, le premier changement de mot de passe, le rechargement avec renouvellement de session, l'ajout d'un membre, l'encaissement de 12 000 FCFA pour un objectif de 10 000, la correction à 9 000, l'annulation auditée et la clôture. Les captures desktop/mobile ont été inspectées ; le contrôle de largeur ne détecte pas de débordement de page.

La revue a aussi ajouté deux contrôles financiers : un paiement annulé reste annulé lorsqu'on rejoue sa clé ; un responsable réaffecté ne peut récupérer les détails de son ancien département par rejeu d'idempotence. Les messages de confirmation utilisent le statut actuel du serveur. Le test HTTP de réaffectation est compris dans les 63 cas PostgreSQL/API.

Les avertissements de couleur des processus de test et de VM Modules Jest ne sont pas des échecs. pg 8 signale aussi une dépréciation de file de requêtes dans le chemin Prisma ; la compatibilité avec une future version majeure pg 9 devra être revue avant mise à jour. La version actuelle reste verrouillée et les tests passent.

La base suivi_dev conserve **zéro utilisateur, membre, paiement et objectif** à la fin des contrôles : aucune donnée de recette n'y a été injectée. Le cahier original garde son empreinte SHA-256 `361DE5F8DCB684087B6D51816F18386C1B30A92139D87F5F4FC2C0C5AD7D4074`.

## Décisions métier encore ouvertes et limites

La demande de confirmation des règles proposée pendant ce travail reste sans réponse au moment de cette rédaction. Elle ne constitue pas une approbation implicite.

- L'identifiant demeure un champ libre unique, normalisé NFKC et sans distinction de casse. L'organisation choisit et communique sa convention nom d'utilisateur ou téléphone. Aucune convention de téléphone n'est déduite d'un contact.
- Le calendrier dimanche–samedi est sélectionné explicitement lors de chaque création de campagne. Les dates et le fuseau sont saisis, jamais injectés par un seed réel.
- Le numéro de membre est fourni explicitement et unique, sans format inventé. Les modes de paiement sont des libellés fournis par l'utilisateur en attendant un catalogue approuvé.
- La réactivation par un responsable n'est pas activée sans validation de Q07 ; elle fonctionne pour le Super Administrateur. Les encaissements sont réservés aux responsables tant que Q13 ne leur ajoute pas le rôle administrateur.
- Les départements désactivés ne permettent pas de nouvelles écritures. Les opérations tardives ou d'affiliation périmée sont refusées avec conflit explicite ; aucune importation ou réaffectation silencieuse n'est réalisée.
- Clôture administrative disponible ; pas de changement silencieux des dates de campagne, de prolongation ni de réouverture d'une campagne clôturée. Ces politiques attendent la décision métier correspondante.
- La limitation de connexion est en mémoire d'un processus (10 essais par identifiant, 100 par IP, sur quinze minutes). La qualification multi-instance et l'exploitation du reverse proxy restent en phase 14.
- La file durable et l'idempotence des opérations après fermeture hors ligne restent dans les phases 11/12. La clé conservée dans le dialogue actuel ne remplace pas une file IndexedDB. Les écrans ne déclarent un paiement validé qu'après réponse serveur.
- Aucune publication n'est effectuée. La version n'est pas annoncée prête pour la production avant les phases restantes et leur recette.

## Références techniques consultées

- [NestJS — Passport et JWT](https://docs.nestjs.com/recipes/passport).
- [OWASP — gestion des sessions](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html).

Ces références orientent les mécanismes ; elles ne remplacent pas les preuves de test ni une revue de sécurité de déploiement.
