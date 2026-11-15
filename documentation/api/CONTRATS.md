# Contrats REST prévisionnels

Préfixe : **/api/v1**. Ce document conserve la conception initiale, y compris les modules futurs. Pour les routes, DTO et conventions effectivement livrés, consulter [l'API métier actuelle](MODULES_METIER.md) et [OpenAPI](openapi.json).

## 1. Conventions communes

- UUID valides pour les identifiants ; chaînes décimales pour les FCFA ; dates YYYY-MM-DD et instants UTC ISO 8601.
- Réponse de succès : { data, meta? }. Une liste ajoute curseur de pagination ou page/limit/total selon le besoin.
- Erreur : { error: { code, message, details?, requestId } }. Aucun stack trace ni secret dans la réponse.
- Authentification Bearer JWT pour les routes métier. Session, appareil, version d'autorisation, rôle et périmètre vérifiés côté serveur.
- DTO de body, query et paramètres validés. Tri et filtres sur liste blanche, limites bornées ; toute liste est paginée sauf snapshot explicitement borné.
- Version attendue obligatoire dans les mutations d'entités versionnées ; défaut de version refusé, pas d'écrasement implicite.
- POST de création financière et commandes offline : clé Idempotency-Key stable. Réutilisation avec une autre charge utile : 409 IDEMPOTENCY_KEY_REUSED.
- 201 création, 200 lecture/modification/commande avec résultat, 400 DTO invalide, 401 session absente ou invalide, 403 action interdite, 404 ressource absente ou hors périmètre, 409 conflit métier/version, 413 taille excessive, 429 limitation et 503 indisponibilité temporaire.
- Une action externe déjà committée n'est pas décrite comme annulée parce que sa réponse a été perdue.

Tous les endpoints sensibles sont protégés par défaut. Les exceptions d'authentification, de CSRF et de santé ont des contrôles explicites. Swagger est destiné aux environnements autorisés, sans exposer des secrets d'exemple réels.

## 2. Catalogue des routes et DTO

Notation : SA = Super Administrateur ; RD = Responsable de département ; SOI = identité courante. Les paramètres UUID utilisent un DTO/pipe de validation commun. Chaque commande sensible génère l'audit prévu. Les DTO ne sont pas encore du code.

| Méthode et route | DTO / validation principale | Autorisation et résultat |
|---|---|---|
| POST /auth/login | LoginDto : identifiant, mot de passe, appareil | Public limité par débit ; session complète ou restreinte au changement initial |
| GET /auth/csrf | Lecture de même origine, contexte cookie autorisé | Jeton anti-CSRF éphémère ; aucune mutation |
| POST /auth/refresh | RefreshDto, cookie rotatif et anti-CSRF | Session active et appareil autorisé ; nouveau bearer |
| GET /auth/me | Aucun body | SOI ; profil minimal, permissions, versions et échéances |
| POST /auth/change-password | ChangePasswordDto : ancien et nouveau secrets bornés | SOI, autorisé en session restreinte ; remplace le secret et révoque les anciennes sessions |
| POST /auth/logout | Contexte session, anti-CSRF si cookie utilisé | SOI ; révocation et suppression du cookie |
| GET /auth/sessions | SessionsQueryDto : pagination | SOI ; liste de ses sessions, jamais les hashes |
| POST /auth/sessions/:id/revoke | RevokeSessionDto : id | SOI ou SA selon cible ; révocation auditée |
| GET /users | UserQueryDto : statut, rôle, pagination | SA ; liste sans secrets |
| GET /users/:id | UUID | SA ou SOI ; projection adaptée |
| PATCH /users/:id | UpdateUserDto : champs autorisés, version | SA ; pas de changement de rôle via mass assignment |
| POST /users/:id/status | UserStatusDto : ACTIVE/INACTIVE, version, motif | SA ; révoque les sessions si désactivation |
| GET /managers | ManagerQueryDto : département/statut/pagination | SA ; façade métier du domaine Users |
| POST /managers | CreateManagerDto : login, identité, département | SA ; secret initial à affichage unique, hash en base |
| POST /managers/:id/assignment | AssignManagerDto : département, version, motif | SA ; unicité, sessions révoquées, audit |
| POST /managers/:id/reset-password | ResetPasswordDto : motif | SA ; nouveau secret unique et changement obligatoire |
| GET /departments | DepartmentQueryDto | SA : tous ; RD : projection de son département |
| GET /departments/:id | UUID | SA ou RD du département |
| POST /departments | CreateDepartmentDto : nom, description | SA ; création, statut selon règle de cycle de vie |
| PATCH /departments/:id | UpdateDepartmentDto : nom, description, version | SA |
| POST /departments/:id/status | DepartmentStatusDto : statut, version, motif | SA ; conserve les historiques |
| GET /members | MemberQueryDto : recherche, statut, pagination | SA : périmètre explicite ; RD : département imposé |
| GET /members/:id | UUID | SA ou RD du département courant |
| POST /members | CreateMemberDto : UUID stable, affiliation initiale, identité, contact, quartier | RD dans son département ; SA selon matrice ; idempotence |
| PATCH /members/:id | UpdateMemberDto : champs permis, version attendue | SA/RD autorisé ; jamais de departmentId libre |
| POST /members/:id/archive | ArchiveMemberDto : version, motif éventuel | SA/RD autorisé ; bloque les nouvelles collectes |
| POST /members/:id/reactivate | ReactivateMemberDto : version | SA ; RD après décision Q07 |
| POST /members/:id/transfer | TransferMemberDto : département cible, version, motif | SA en ligne ; périodes d'affectation, audit, changement de périmètre |
| GET /members/:id/payments | MemberPaymentsQueryDto : campagne/date/pagination | SA : historique complet ; RD : paiements de son département uniquement |
| GET /payments | PaymentQueryDto : membre/semaine/campagne/statut/date/pagination | SA : tous ; RD : département historique imposé |
| GET /payments/:id | UUID | SA ou RD du département du paiement |
| POST /payments | CreatePaymentDto : UUID, membre, période, semaine, montant entier, mode, date, appareil | RD autorisé ; SA selon Q13 ; transaction et idempotence |
| POST /payments/:id/revisions | RevisePaymentDto : version, nouveau montant/mode autorisé, justification | SA en ligne ; révision et delta, pas de suppression |
| POST /payments/:id/cancel | CancelPaymentDto : version, justification | SA en ligne ; compensation du solde et statut CANCELLED |
| GET /payments/:id/revisions | RevisionQueryDto : pagination | SA ou RD du département, valeurs sans secrets |
| GET /objectives | ObjectiveQueryDto : statut/pagination | SA : gestion ; RD : informations globales minimisées |
| GET /objectives/current | Aucun body | SA/RD ; campagne courante et progression agrégée |
| POST /objectives | CreateObjectiveDto : nom, cible, dates, fuseau | SA ; cible positive, calendrier cohérent, unicité courante |
| PATCH /objectives/:id | UpdateObjectiveDto : paramètres, version, motif | SA ; restrictions si semaines/paiements existent |
| POST /objectives/:id/close | CloseObjectiveDto : version, motif | SA ; historique conservé ; règle automatique via service interne |
| POST /objectives/:id/extend | ExtendObjectiveDto : nouvelle fin, version, motif | SA ; conserve les semaines existantes |
| GET /collection-weeks | CollectionWeeksQueryDto : campagne | SA/RD ; semaines autorisées |
| GET /dashboard | DashboardQueryDto : campagne, intervalle | SA : détail global ; RD : département + progression globale minimale |
| GET /notifications | NotificationQueryDto : lues/non lues, pagination | SOI ; jamais un recipientId arbitraire |
| POST /notifications/:id/read | UUID, aucune donnée métier modifiable | Destinataire ; marquage de lecture idempotent |
| GET /audit | AuditQueryDto : département/action/date/pagination | SA exclusivement, lecture |
| GET /devices | DeviceQueryDto | SA : supervision ; RD : ses propres appareils |
| POST /devices | RegisterDeviceDto : UUID et libellé borné | SOI authentifié ; propriété fixée au serveur |
| POST /devices/:id/revoke | RevokeDeviceDto : motif | SA ou propriétaire selon politique ; révocation des sessions liées |
| GET /sync/bootstrap | BootstrapQueryDto : version contrat/couverture demandée | SOI ; snapshot cohérent et borné dans le périmètre actuel |
| POST /sync/push | SyncBatchDto : opérations typées, dépendances, versions, clés | SOI ; limites de lot, transaction par opération, résultats détaillés |
| GET /sync/pull | SyncPullQueryDto : curseur opaque, limite | SOI ; changements autorisés et watermark |
| GET /sync/operations | SyncOperationQueryDto : état/appareil/pagination | SA : supervision ; RD : ses opérations |
| POST /sync/operations/:id/resolve | ResolveSyncConflictDto : décision, justification, nouvelle commande | SA pour conflit financier ; RD seulement pour modification membre autorisée |
| GET /reports/global | GlobalReportQueryDto : campagne, format PDF/XLSX/CSV, dates | SA ; objectif unique et historique global |
| GET /reports/departments/:id | DepartmentReportQueryDto : campagne, format, dates | SA ou RD autorisé selon Q14 |
| GET /reports/members/:id | IndividualReportQueryDto : campagne, format, dates | SA ou RD dans son périmètre selon Q12/Q14 |
| GET /health/live | Aucun body | Public minimal, sans détails internes |
| GET /health/ready | Aucun body | Public minimal ou infrastructure ; état prêt/indisponible |

Les opérations d'activation/suspension de campagne pourront être regroupées dans une commande de statut dédiée si le cycle métier validé le nécessite ; aucun changement de statut libre ne sera introduit par un PATCH générique.

## 3. Contrat du lot de synchronisation

La commande contient contractVersion, deviceId et operations[]. Chaque opération expose id, type, entityId, baseVersion si applicable, dependsOn, createdAt et payload. Le userId est obtenu de la session ; un champ déclaré n'est jamais une délégation.

Une réponse HTTP 200 à un lot signifie que son enveloppe a été traitée, **pas que toutes les opérations ont été validées**. results[] contient pour chaque UUID : statut, code, replay éventuel, version serveur et projection canonique autorisée. La réception d'une opération en CONFLICT ne permet pas de marquer son paiement comme validé.

Les opérations dépendantes non confirmées restent en attente. Un rejet global de session n'applique aucune nouvelle opération ; un lot partiellement traité avant une coupure se rejoue avec les mêmes clés. Le [protocole détaillé](../architecture/SYNCHRONISATION.md) décrit reprise, curseurs et transitions d'états.

## 4. Rapports

Le serveur réutilise les mêmes services de périmètre et de calcul que les tableaux de bord. Les rapports globaux précisent campagne, objectif unique, total, reste, dépassement, progression, départements et historique. Les rapports départementaux précisent responsable, membres et contributions. Les rapports individuels affichent identité autorisée, versements, total et nombre de semaines distinctes avec versement.

Le calcul du rapport s'effectue sur un snapshot cohérent pour que le détail corresponde au total. Chaque fichier indique la date de génération, la campagne, les filtres, le périmètre et la dernière synchronisation connue si nécessaire. Les fichiers officiels ne mélangent pas les opérations locales non confirmées aux recettes validées.

ExcelJS produit les valeurs entières exactes ; si un montant excède la précision numérique d'Excel, il est écrit comme texte explicite pour éviter un arrondi silencieux. PDFKit utilise une police embarquée couvrant les accents français, des tableaux paginés et des en-têtes répétés. Le CSV est UTF-8 avec une convention de séparateur documentée et neutralisation des formules dans les textes.

Les exports hors ligne officiels ne sont pas exigés : l'interface explique qu'une connexion est nécessaire pour produire un rapport serveur complet. Les erreurs de génération sont visibles et ne déclenchent pas le téléchargement d'un fichier vide présenté comme réussi.
