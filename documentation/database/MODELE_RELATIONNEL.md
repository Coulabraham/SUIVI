# Modèle relationnel

Ce modèle logique a été défini en phase 1 puis implémenté en phase 3 dans le [schéma Prisma](../../backend/prisma/schema.prisma). Les noms physiques utilisent snake_case via @map et @@map. Le [compte rendu de phase 3](PHASE_3.md) décrit les migrations, tests, protections et limites de l'implémentation.

Les révisions comportent désormais aussi previousAmount/newAmount et previousMethod/newMethod typés. Le delta et la projection du paiement sont produits par un trigger contrôlé, pas par une seconde écriture manuelle du service. Le numéro de révision est la version attendue du paiement avant correction. Les autres règles ci-dessous conservent leur portée de conception ; la sécurité HTTP et les workflows administratifs seront implémentés en phase 4.

## 1. Conventions

- PK techniques UUID. Les UUID de membres et paiements peuvent être produits sur l'appareil ; le serveur contrôle leur validité et leur non-réutilisation.
- Instants timestamptz UTC ; dates de campagne et de semaine date ; fuseau métier configurable.
- Montants PostgreSQL BIGINT signés, cible et versement original strictement positifs. Les bornes BIGINT sont validées avant insertion. Un SUM(bigint) PostgreSQL produit un numeric exact : le transport garde une chaîne entière, y compris si le cumul dépasse BIGINT.
- JSON de transport : les montants sont des chaînes décimales canoniques. Les champs de version sont des entiers positifs ; les séquences longues sont transportées comme chaînes.
- Pas de suppression en cascade des paiements, membres, utilisateurs, objectifs, révisions, ajustements, périodes ou audits. Désactivation et archivage remplacent la suppression métier.
- updatedAt ne constitue pas un mécanisme de conflit : les entités modifiables ont une version incrémentée atomiquement.
- Les CHECK, index partiels, exclusions et triggers non exprimables par Prisma seront ajoutés dans des migrations SQL versionnées et testées.

## 2. Tables et attributs

| Modèle | Attributs principaux | Relations / règles |
|---|---|---|
| User | id, loginIdentifier, loginNormalized, firstName, lastName, phone, passwordHash, role, status, departmentId?, mustChangePassword, initialPasswordExpiresAt?, credentialVersion, authzVersion, version, createdAt, updatedAt, lastLoginAt? | Login normalisé unique. MANAGER implique département non nul ; SUPER_ADMIN implique département nul. Aucun secret initial en clair |
| Department | id, name, description?, status, version, createdAt, updatedAt | Le responsable courant est le User actif de rôle MANAGER ; pas de managerId redondant |
| Member | id, memberNumber, firstName, lastName, contact?, neighborhood?, departmentId, registeredAt, status, version, createdAt, updatedAt | Département courant obligatoire ; numéro global unique après confirmation serveur |
| MemberDepartmentPeriod | id, memberId, departmentId, startsAt, endsAt?, createdById | Une seule période courante par membre ; historique des transferts ; combinaison (id, memberId, departmentId) unique |
| Objective | id, name, targetAmount, startsOn, endsOn, timezone, status, createdById, version, createdAt, updatedAt, closedAt? | Une ligne par campagne ; au plus une campagne courante ACTIVE ou SUSPENDED ; cible > 0 et fin >= début |
| CollectionWeek | id, objectiveId, number, startsOn, endsOn, collectionOn?, status | Numéro unique par campagne ; collectionOn est le dimanche de collecte s'il appartient à la période |
| Payment | id, memberId, departmentId, affiliationId, collectedById, objectiveId, collectionWeekId, originalAmount, method, reference?, collectedAt, receivedAt, status, version, idempotencyKey, originDeviceId, memberLabelSnapshot | Original immuable ; statut serveur VALIDATED ou CANCELLED ; aucun statut local PENDING ici |
| PaymentRevision | id, paymentId, revisionNumber, actorId, deviceId?, reason, kind, beforeValue, afterValue, createdAt, replacementPaymentId? | Journal immuable ; numéro unique par paiement ; version attendue obligatoire |
| PaymentAdjustment | id, paymentId, revisionId, deltaAmount, createdAt | Ajustement monétaire signé ; revisionId unique ; même paiement que la révision |
| Device | id, userId, label, status, createdAt, lastSeenAt?, lastSyncedAt?, revokedAt? | Propriétaire fixe, unicité (id, userId) ; référence appareil non considérée comme preuve de confiance |
| Session | id, userId, deviceId, credentialVersion, authzVersion, expiresAt, revokedAt?, lastSeenAt, createdAt | Famille de refresh et révocation ; couple appareil/utilisateur cohérent |
| RefreshToken | id, sessionId, tokenHash, createdAt, expiresAt, consumedAt? | Hash unique ; tokens consommés conservés pendant la durée de détection de réutilisation ; aucun token brut en base |
| SyncOperation | id, userId, departmentId, deviceId, type, entityId, baseVersion?, payload, requestHash, status, resultCode?, resultData?, createdAtClient, receivedAt, completedAt? | UUID opération unique ; reçu idempotent ; charge utile métier minimale pour arbitrage, aucun secret ; utilisateur et département dérivés/contrôlés au serveur |
| SyncScope | id, key, departmentId?, sequence, generation, minAvailableSequence | Clé GLOBAL unique, ou clé de département unique ; compteur transactionnel et version de périmètre |
| SyncChange | id, scopeId, sequence, entityType, entityId, changeType, entityVersion, projection, createdAt | Couple (scopeId, sequence) unique ; projection autorisée, tombstones et replay incrémental |
| Notification | id, recipientId, departmentId?, eventKey, type, title, message, entityType?, entityId?, createdAt, readAt? | Une ligne par destinataire ; couple destinataire/eventKey unique pour éviter les répétitions |
| AuditLog | id, actorId?, actorRole?, departmentId?, action, entityType, entityId?, beforeValue?, afterValue?, occurredAt, outcome, deviceId?, requestId | Append-only ; acteur nul pour un échec d'authentification non identifié ; secrets exclus |

Les statuts de comptes et départements distinguent ACTIVE et INACTIVE ; celui des membres ACTIVE et ARCHIVED. Les enums définitifs seront documentés dans OpenAPI. Les états de file locale sont PENDING, PROCESSING, SYNCED, CONFLICT et FAILED ; le reçu serveur décrit son résultat, sans faire croire qu'une donnée non reçue est validée.

MemberDepartmentPeriod, SyncScope, SyncChange et RefreshToken sont quatre modèles supplémentaires justifiés par l'historique des transferts, la fiabilité de la synchronisation et la détection de réutilisation des refresh tokens. Les autres correspondent aux modèles demandés.

## 3. Cardinalités et contraintes

### Comptes et départements

Department 1 → N User historiques, mais **index unique partiel sur User(departmentId) WHERE role = MANAGER AND status = ACTIVE**. Un responsable actif a un seul departmentId. Le statut INACTIVE des anciens responsables permet de conserver leurs paiements et audits sans empêcher leur remplacement.

Un CHECK impose le couple rôle/département. Lors d'une activation ou affectation, le service verrouille les départements concernés dans un ordre stable, contrôle leur état, désactive l'ancienne affectation si nécessaire, révoque les sessions et incrémente authzVersion. L'invariant « département actif avec responsable actif » doit être défini avec le cycle de création ; proposition : créer inactif, affecter, puis activer. Il ne faut pas imposer deux créations circulaires impossibles.

### Membres et transferts

Department 1 → N Member courants. Member 1 → N MemberDepartmentPeriod ; Department 1 → N périodes historiques.

Un index unique partiel sur memberId WHERE endsAt IS NULL garantit au plus une période ouverte. Un contrôle différé en fin de transaction garantit exactement une période ouverte correspondant au departmentId courant du membre ; les périodes fermées ne se chevauchent pas. Pour l'exclusion temporelle, privilégier une exclusion GiST avec btree_gist si disponible ; sinon un trigger protégé par verrou membre offre la même règle et doit être testé sous concurrence. Ce choix d'implémentation sera arrêté avec PostgreSQL cible.

Un transfert ferme la période courante, en ouvre une nouvelle, incrémente la version du membre et publie un retrait de la fiche courante dans l'ancien périmètre et un ajout dans le nouveau. Un membre archivé garde sa période d'affectation ; son statut bloque les encaissements.

### Campagnes et semaines

Objective 1 → N CollectionWeek ; CollectionWeek 1 → N Payment. Un index partiel constant garantit au plus une campagne courante ACTIVE ou SUSPENDED, sans empêcher plusieurs campagnes historiques ou futures. Les dates de deux campagnes utilisables ne doivent pas permettre un rattachement ambigu ; le paiement précise toujours objectiveId et collectionWeekId.

Les couples uniques (id, objectiveId) de CollectionWeek et la FK composite de Payment(collectionWeekId, objectiveId) empêchent un paiement de référencer une semaine d'une autre campagne. Les bornes des semaines sont validées par le service et un contrôle SQL inter-tables ; les périodes ne se chevauchent pas dans une campagne. Les prolongations créent les périodes manquantes sans renuméroter les semaines déjà référencées.

### Paiements

Member 1 → N Payment ; Department 1 → N Payment historiques ; User 1 → N Payment en tant qu'encaisseur ; Device 1 → N Payment d'origine.

La FK composite Payment(affiliationId, memberId, departmentId) → MemberDepartmentPeriod(id, memberId, departmentId) garantit l'identité et le département historiques. On ne lie pas le paiement au departmentId courant modifiable du membre. L'appartenance temporelle et l'état courant sont vérifiés lors de la transaction ; une date déclarée hors ligne ne suffit pas à contourner un transfert ou un archivage.

La clé d'idempotence du paiement est unique globalement dans cette organisation. Elle est liée à l'opération stable. Réutiliser une clé avec une charge utile différente retourne un conflit ; ce n'est pas un succès de déduplication. Le hash inclut le type, la version de contrat, l'entité, l'appareil et la charge utile canonique. Une même clé soumise par un autre utilisateur ne révèle jamais le reçu du premier.

Les champs d'origine du paiement sont protégés contre UPDATE/DELETE par le rôle SQL et/ou un trigger. Seuls la projection de statut et le compteur de version sont modifiés par la voie de révision autorisée. Pas de DELETE métier sur un paiement.

### Révisions et ajustements

Payment 1 → N PaymentRevision ; PaymentRevision 1 → 0..1 PaymentAdjustment. Une révision purement descriptive ne nécessite pas de delta ; une révision monétaire a exactement un ajustement. Une FK composite (revisionId, paymentId) vers PaymentRevision(id, paymentId) évite un ajustement accroché à la révision d'un autre paiement.

La transaction verrouille le paiement et vérifie sa version avant d'écrire la révision. Un contrôle vérifie que le montant effectif reste positif pour un paiement VALIDATED et vaut zéro pour CANCELLED. Les ajustements et révisions sont append-only. La procédure d'annulation est idempotente ; une seconde demande ne crée pas une deuxième compensation.

Payment.method et reference représentent les valeurs d'origine. Une correction de mode autorisée est portée par les snapshots typés beforeValue/afterValue de la révision ; la lecture projette le mode effectif de la dernière révision, sans réécrire l'origine. Le schéma du snapshot est validé et versionné. Les champs immuables membre, département, campagne et semaine ne peuvent pas être déplacés par ce mécanisme.

### Sessions, appareils, synchronisation

User 1 → N Device ; User 1 → N Session. FK composite Session(deviceId, userId) → Device(id, userId). Les opérations vérifient de même leur appareil et son propriétaire. Une session révoquée, un compte inactif ou une version d'autorisation différente bloquent la requête même si le JWT est encore cryptographiquement valide.

Session 1 → N RefreshToken. La rotation consomme atomiquement le token courant et crée son successeur. Une tentative utilisant le hash d'un token déjà consommé révoque la session/famille ; conserver ces hashes permet de distinguer une réutilisation d'une simple valeur aléatoire invalide.

Chaque changement métier destiné à un périmètre verrouille sa ligne SyncScope, incrémente sequence et insère SyncChange dans la transaction métier. Les périmètres multiples sont verrouillés dans un ordre stable. Le curseur n'est ni un timestamp client ni un auto-incrément indépendant de l'ordre des commits.

## 4. Source des totaux financiers

Pour un paiement p : **effectif(p) = originalAmount(p) + somme des deltaAmount(p)**.

Les deltas signés représentent des écarts de correction ou d'annulation, pas de nouveaux versements négatifs. Les versements d'origine et les soldes des paiements validés restent strictement positifs, conformément à la règle financière.

Une vue de lecture conceptuelle PaymentBalance regroupe d'abord les ajustements par paiement, puis joint une seule ligne de solde par paiement. Elle évite la multiplication du montant original par le nombre de révisions. Les totaux officiels additionnent les soldes des paiements VALIDATED dans le périmètre et la campagne demandés. Les paiements CANCELLED ont un solde nul et restent consultables.

Exemple vérifiable : versement 10 000 ; correction à 8 000 → delta −2 000 ; correction à 9 000 → delta +1 000 ; annulation → delta −9 000. Solde : 0. L'original 10 000 et les trois révisions restent présents. Aucun cumul individuel éditable n'existe.

Une correction financière ultérieure s'applique à la campagne du paiement original ; elle ne devient pas une recette d'une nouvelle campagne. Un rapport peut distinguer date de collecte et date de correction.

## 5. Indexation et protection SQL

- User(loginNormalized) unique ; index partiel responsable actif/département.
- Member(memberNumber) unique ; (departmentId, status, lastName, firstName, id).
- MemberDepartmentPeriod(memberId, startsAt), (departmentId, endsAt) et unicité de période ouverte.
- Payment(idempotencyKey) unique ; (departmentId, objectiveId, collectedAt, id), (memberId, collectedAt, id), (collectionWeekId, status).
- PaymentRevision(paymentId, revisionNumber) unique ; PaymentAdjustment(revisionId) unique.
- RefreshToken(tokenHash) unique ; (sessionId, consumedAt) ; Session(userId, revokedAt, expiresAt).
- SyncOperation(id) unique ; (userId, deviceId, receivedAt), (departmentId, status).
- SyncChange(scopeId, sequence) unique ; Notification(recipientId, readAt, createdAt) ; AuditLog(departmentId, occurredAt, id), (entityType, entityId).

Les clés étrangères utilisent RESTRICT pour les historiques. Un rôle de migration distinct possède le DDL ; le rôle applicatif n'est pas propriétaire du schéma et ne peut pas modifier/supprimer les audits et journaux immuables. Le SQL de protection doit être couvert par des tests directs, et pas seulement par des tests des services.

## 6. Seeds et migrations

Le bootstrap de production exige un secret administrateur fourni par l'opérateur ou généré une fois et remis explicitement. Aucun compte universel n'est codé en dur. Les données de démonstration sont chargées uniquement par une commande dédiée dans une base identifiée comme démonstration ; jamais automatiquement au démarrage de production.

Chaque migration est versionnée et revue. Les changements suivent si nécessaire « ajout compatible → migration des données → retrait ultérieur », avec sauvegarde préalable et test de restauration. La base d'intégration utilise PostgreSQL, pas SQLite, afin de vérifier les index partiels, verrous et contraintes réelles.
