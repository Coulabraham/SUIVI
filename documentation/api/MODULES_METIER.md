# API métier implémentée — phases 4 à 10

Préfixe commun : `/api/v1`. La [description OpenAPI générée](openapi.json) décrit les DTO, paramètres, enveloppes et schémas effectivement exposés. La [conception initiale](CONTRATS.md) décrit aussi des modules futurs : leur présence dans ce document initial ne signifie pas qu'ils sont implémentés.

## Authentification

| Route | Usage |
|---|---|
| POST /auth/login | Identifiant, mot de passe, UUID et libellé d'appareil ; retourne JWT et profil public |
| POST /auth/refresh | Rotation du cookie ; réutilisation révoquant la session |
| GET /auth/profile | Profil public courant |
| POST /auth/change-password | Mot de passe actuel et nouveau ; révoque toutes les sessions |
| POST /auth/logout | Révoque la session courante et efface son cookie |

Les POST d'authentification exigent `X-SUIVI-CLIENT: web`. L'origine du navigateur doit correspondre à FRONTEND_ORIGIN. Le cookie refresh n'est jamais renvoyé dans le JSON. Les appels métier utilisent `Authorization: Bearer <JWT>` ; ils ne s'authentifient pas avec le cookie.

Pendant le changement initial obligatoire, seuls profil, changement de mot de passe et déconnexion sont ouverts au JWT. Les autres routes restent interdites. Les erreurs de connexion ne distinguent pas compte inexistant, désactivation ou secret erroné.

## Ressources métier

| Ressource | Méthodes | Portée |
|---|---|---|
| /departments | GET, POST | GET limité au département pour responsable ; création administrateur |
| /departments/:id | GET, PATCH | Consultation autorisée ; modification administrateur avec version |
| /managers | GET, POST | Administrateur ; création retournant le secret initial une seule fois |
| /managers/:id | GET, PATCH | Administrateur ; modification motivée et révocation des sessions |
| /managers/:id/reset-password | POST | Administrateur ; version, justification et validité explicite |
| /members | GET, POST | Filtré et contrôlé par département |
| /members/:id | GET, PATCH | Ressource du périmètre ; version obligatoire pour modifier |
| /members/:id/archive | PATCH | Archivage motivé dans le périmètre |
| /members/:id/reactivate | PATCH | Réactivation administrateur en attente de validation de Q07 |
| /members/:id/transfer | POST | Administrateur ; département cible, version et motif |
| /payments | GET, POST | Liste du périmètre ; saisie par responsable seulement |
| /payments/:id | GET | Détail du périmètre et révisions |
| /payments/:id/revisions | POST | Correction administrateur, version et justification |
| /payments/:id/cancellations | POST | Annulation administrateur, version et justification |
| /objectives | GET, POST | Lecture globale ; création administrateur |
| /objectives/:id | GET, PATCH | Lecture globale ; modification administrateur avec version et motif |
| /objectives/:id/progress | GET | Sommes et progression globales sans détails d'autres départements |
| /collection-weeks | GET | Calendrier paginé d'une campagne explicitement identifiée |
| /dashboard | GET | Campagne courante ou objectiveId fourni ; détails filtrés selon rôle |

Les listes acceptent page et pageSize, bornée à 100 ; les ressources concernées acceptent q et un filtre département explicite. Un responsable ne peut élargir ce filtre. Les paiements acceptent aussi memberId, objectiveId et status. Le filtre historique memberId ne donne pas accès aux coordonnées actuelles d'un membre transféré.

## Contrats monétaires et concurrence

Les montants sont des **chaînes décimales entières** JSON, par exemple `"10000"`. Les requêtes refusent float, notation scientifique, montant nul/négatif ou dépassement de BIGINT. Les cumuls utilisent numeric/BigInt, donc peuvent dépasser la capacité d'un versement individuel sans perdre de précision.

Un paiement exige une clé UUID d'idempotence, un membre, une semaine, un montant, un mode et un instant ISO 8601 avec fuseau explicite. Le serveur déduit le responsable, le département, la campagne et l'appareil. Il vérifie que le membre est actif et actuellement affecté, que la campagne et la semaine sont ouvertes, et que la date appartient à la semaine dans le fuseau de campagne.

Le renvoi de la même clé et de la même charge utile par le même utilisateur/appareil retourne le paiement existant. Une charge utile différente donne HTTP 409, même si la clé existe déjà. Une correction ou annulation ne réutilise jamais une mutation du paiement original : elle ajoute une révision et l'écart du ledger, avec audit dans la transaction.

Les modifications de ressources utilisent leur version actuelle. HTTP 409 impose une relecture et une décision explicite ; les données financières ne sont pas écrasées automatiquement.

## Réponses et erreurs

Le succès contient `data`. Une liste contient `data.items`, `data.total`, `data.page` et `data.pageSize`. Les dates sont des chaînes ISO. Les erreurs contiennent `error.code`, `error.message` et `error.requestId` ; les requêtes reçoivent aussi X-Request-Id. Les valeurs SQL, hashes, mots de passe et piles internes ne sont pas exposés.

| HTTP | Signification |
|---|---|
| 400 | Valeur ou champ invalide, montant/date non conforme |
| 401 | Authentification invalide, session/appareil révoqué ou compte non autorisé à se connecter |
| 403 | Permission insuffisante ou changement initial obligatoire |
| 404 | Ressource inexistante ou hors périmètre pour les membres/paiements |
| 409 | Version périmée, unicité, état métier incompatible ou clé d'idempotence réutilisée différemment |
| 429 | Limitation de tentatives |
| 503 | Base indisponible |

## Notifications internes et audit

| Route | Usage et autorisation |
|---|---|
| GET /notifications | Boîte personnelle paginée ; filtres q, readState (ALL/UNREAD/READ), type et département autorisé |
| GET /notifications/unread-count | Nombre personnel de notifications non lues encore autorisées |
| GET /notifications/:id | Notification personnelle ; 404 hors périmètre |
| PATCH /notifications/:id/read | Corps `{ "read": true }` ; première date de lecture conservée lors d'un rejeu |
| PATCH /notifications/read-all | Même corps ; marque la boîte personnelle actuellement autorisée, indépendamment du filtre de liste |
| GET /audit | Super Administrateur ; liste paginée sans snapshots ; filtres action, entityType, entityId, actorId, outcome, departmentId, from, to et q |
| GET /audit/:id | Super Administrateur ; détail et anciennes/nouvelles valeurs expurgées de secrets |

Les dates from/to exigent un instant ISO avec fuseau ; une période inversée est refusée. Les notifications n'exposent ni destinataire ni clé interne de déduplication. Un responsable ne voit que sa boîte du département courant et ses alertes personnelles de compte ; une réaffectation masque les anciennes alertes départementales. Les contenus et premières dates de lecture sont immuables ; aucune API ne permet suppression, fabrication ou remise à « non lu ». L'audit ne possède aucune route de modification. Les lectures ne produisent pas de nouvelle notification.

Les routes devices/synchronisation et exports restent aux phases suivantes. Le JWT en ligne ne constitue pas une autorisation hors ligne.
