# Protocole offline-first proposé

Ce document fixe les garanties à implémenter et à tester. Aucun mécanisme n'est encore opérationnel en phase 1.

## 1. Données locales et limites

Une base Dexie est cloisonnée par organisation, utilisateur et génération de périmètre. Elle contient : profil minimal sans mot de passe, autorisation hors ligne signée, département, campagne et semaines, membres autorisés, paiements déjà synchronisés, projections provisoires, file d'opérations et curseurs de synchronisation.

Les données détaillées d'autres départements ne sont jamais téléchargées. La progression globale est une projection agrégée horodatée. La période d'historique disponible hors ligne reste à définir selon les volumes ; les filtres de date ne doivent jamais être présentés comme un historique complet si une partie n'a pas été synchronisée.

La première connexion, l'enrôlement de l'appareil et le téléchargement initial nécessitent Internet. Les changements administratifs, transferts, corrections/annulations financières et modifications d'objectifs restent en ligne en V1. La réactivation hors ligne d'un membre n'est pas présumée autorisée.

IndexedDB n'est pas une sauvegarde : le navigateur, le mode privé, l'utilisateur ou une panne de disque peuvent supprimer les données. Demander navigator.storage.persist() lorsqu'il existe, surveiller le quota, avertir de la file non synchronisée et ne jamais confirmer une écriture locale dont la transaction a échoué.

## 2. Structure de la file

Chaque opération contient :

| Champ | Rôle |
|---|---|
| id / idempotencyKey | UUID stables, produits une seule fois avant enregistrement |
| contractVersion | Version du format de commande |
| type | MEMBER_CREATE, MEMBER_UPDATE, MEMBER_ARCHIVE ou PAYMENT_CREATE |
| entityId | UUID du membre ou paiement, stable sur tous les essais |
| userId, departmentId, deviceId | Contexte déclaré, contrôlé au serveur ; aucun pouvoir d'autorisation autonome |
| scopeGeneration, authzVersion | Détecter un ancien périmètre ou une ancienne affectation |
| baseVersion | Version serveur attendue pour modifier un membre |
| dependsOn | UUID des opérations à confirmer avant celle-ci |
| payload | Données validées et montants sous forme de chaînes entières |
| createdAt | Horodatage client informatif |
| state | PENDING, PROCESSING, SYNCED, CONFLICT ou FAILED |
| attempts, nextAttemptAt, lastError | Reprise bornée et explication visible |
| processingLeaseUntil | Reprise après fermeture d'onglet ou arrêt du worker |
| serverReceipt, serverVersion | Preuve de confirmation après commit |

La création du membre local, sa projection et son opération sont enregistrées dans une seule transaction Dexie. Même garantie pour la saisie d'un paiement : l'interface montre « enregistré sur cet appareil, en attente » seulement après commit IndexedDB.

Un membre créé hors ligne reçoit un UUID stable et un initialAffiliationId stable. Son numéro définitif peut être attribué au serveur selon la décision Q08 ; la référence provisoire reste visible jusqu'à confirmation. Un paiement lié dépend de l'opération de création de ce membre.

Les modifications successives d'un même membre forment une chaîne : l'opération suivante n'est matérialisée pour envoi qu'après réception de la version canonique précédente. Le payload et la version d'une opération déjà envoyée sont immuables. On ne réécrit pas une requête après un timeout sous la même clé.

## 3. Ordre et moteur d'envoi

Déclencheurs : ouverture de l'application, retour de connexion, action « Synchroniser » et Background Sync lorsque disponible. navigator.onLine n'est qu'un signal ; /health/ready puis une vérification authentifiée de la session établissent si un envoi est possible.

1. Acquérir un verrou par base/utilisateur, partagé entre onglets et service worker. Utiliser Web Locks si disponible, sinon un bail atomique IndexedDB avec expiration.
2. Récupérer les PROCESSING dont le bail a expiré et les remettre en attente sans changer leur clé.
3. Vérifier session, utilisateur actif, appareil non révoqué, département et génération de périmètre. En cas de révocation ou changement d'affectation, suspendre la file et fermer l'accès aux données concernées.
4. Sélectionner les opérations PENDING et FAILED récupérables dont les dépendances sont confirmées. Tri topologique, puis ordre de création pour une même entité.
5. Marquer le lot PROCESSING atomiquement, avec bail ; envoyer un lot borné. Proposition initiale : 50 opérations et 1 Mio, à ajuster après mesure.
6. Appliquer les résultats individuels dans une transaction Dexie : données canoniques, versions, reçus et états de la file.
7. Effectuer le pull incrémental, puis reconstruire les projections locales des opérations restantes sur la nouvelle base serveur.
8. Libérer le verrou et actualiser les agrégats TanStack Query.

Une dépendance non confirmée n'est pas envoyée aveuglément. Le serveur répond DEPENDENCY_NOT_CONFIRMED si un client contourne l'ordre. Le lot n'est pas entièrement atomique : chaque opération est transactionnelle ; les opérations indépendantes peuvent réussir. Ce comportement est documenté dans le contrat et visible à l'utilisateur.

## 4. Traitement serveur et idempotence

Pour chaque opération, le serveur :

1. Valide DTO, taille, type et version de contrat.
2. Construit le contexte autorisé depuis la session, sans faire confiance au rôle ou département du payload.
3. Vérifie que le reçu appartient au même acteur/appareil autorisé avant toute restitution.
4. Ouvre une transaction et réserve l'identifiant de l'opération par une contrainte unique. Une réservation concurrente attend le commit de la première, puis relit son résultat ; le traitement ne dépend pas d'un simple « chercher puis créer » vulnérable à la course.
5. Compare le hash canonique si l'identifiant existe. Même requête : retourner le reçu déjà committé. Autre requête : IDEMPOTENCY_KEY_REUSED, sans mutation.
6. Verrouille dans un ordre stable les ressources métier nécessaires et vérifie l'état, la version, le périmètre, la campagne et l'affectation du membre.
7. Écrit la mutation, l'audit, les notifications, les changements de synchronisation et le reçu dans le même commit.
8. Retourne la version serveur et les données canoniques.

Le verrou de la session/du compte est coordonné avec les opérations de révocation afin qu'une écriture concurrente ne passe pas avec un contexte déjà invalidé. Les commandes de révocation prennent un verrou incompatible ; les commandes métier gardent un verrou de lecture approprié jusqu'au commit.

Une perte de réponse après commit laisse l'opération locale en attente. Le renvoi du même UUID retrouve le reçu et ne recrée ni paiement, ni ajustement, ni audit métier, ni notification. Une collision d'UUID d'entité avec une autre opération est un conflit distinct, jamais une raison de changer automatiquement l'identité du paiement.

Un échec technique qui provoque un rollback n'est pas enregistré comme succès. Les refus métier déterministes peuvent avoir un reçu de refus. Une résolution ou nouvelle tentative avec un payload changé utilise une **nouvelle opération**, liée à l'ancienne pour la traçabilité. Une reprise réseau de la même requête conserve son UUID.

## 5. Versions, conflits et refus

MEMBER_UPDATE et MEMBER_ARCHIVE utilisent une version attendue ; le serveur effectue une écriture conditionnelle. Si la version diffère : CONFLICT, avec une projection autorisée de l'état serveur et les champs concernés. L'interface montre les valeurs locales et serveur ; l'utilisateur choisit une modification autorisée, produisant une nouvelle opération sur la version courante. Aucun last-write-wins implicite.

Un paiement en attente peut être en conflit si le membre a été archivé ou transféré, si le département est inactif, si la campagne est clôturée ou si la semaine n'est plus autorisée. Q03 fixe si ces cas sont arbitrables ou refusés définitivement. L'ancienne charge utile reste conservée ; elle n'est ni écrasée ni attribuée silencieusement à un autre département.

Si un arbitrage administratif est retenu, le serveur exposera une commande en ligne dédiée, justification obligatoire, qui contrôle les droits courants et produit une nouvelle écriture liée. L'horodatage client seul ne peut pas justifier une validation rétroactive. Le responsable ne peut pas approuver ses propres conflits financiers.

Un doublon réel saisi deux fois avec deux UUID différents n'est pas détectable par l'idempotence technique. On peut signaler une proximité membre/montant/date à l'utilisateur, mais pas fusionner automatiquement deux versements libres autorisés.

## 6. Reprise et états

| Situation | État / action |
|---|---|
| Création locale réussie | PENDING, visible comme provisoire |
| Envoi commencé | PROCESSING avec bail |
| Reçu de commit ou reçu déjà committé | SYNCED |
| Version ou règle métier nécessitant une décision | CONFLICT, pas de réessai automatique |
| Timeout, indisponibilité, 429, 502/503 | FAILED récupérable, reprise exponentielle avec jitter et Retry-After |
| 401 | Tentative de refresh coordonnée ; sinon suspension et réauthentification du même utilisateur |
| 403 / appareil révoqué / ancien périmètre | Suspension, accès local fermé, récupération supervisée si opérations non transmises |
| Payload invalide définitivement | FAILED non récupérable, raison visible ; modification explicite via nouvelle opération |
| Arrêt pendant PROCESSING | Expiration du bail puis renvoi avec la même clé |

Les opérations confirmées ne sont pas retransmises par le moteur normal. Les reçus sont conservés pour l'audit de l'appareil. La rétention des clés serveur doit être au moins aussi longue que celle des opérations susceptibles de réapparaître ; les clés financières ne sont pas recyclées lors d'une purge de la file locale.

## 7. Bootstrap et pull sans perte

Le premier bootstrap utilise une lecture PostgreSQL REPEATABLE READ : données autorisées et compteurs de périmètre sont lus dans le même snapshot, puis enregistrés atomiquement dans Dexie avant activation du mode hors ligne. Pour la V1, une réponse de bootstrap est bornée et cohérente ; il ne faut pas ajouter une pagination naïve entre plusieurs transactions sur un état mouvant.

Si les volumes dépassent ce budget, il faudra produire un snapshot matérialisé temporaire avec pages immuables et expiration, puis reprendre le journal après son watermark. Ce besoin dépend des volumes à confirmer et devra être résolu avant toute certification de capacité hors ligne. L'historique des paiements peut être téléchargé par fenêtres explicites, avec indication de couverture.

Le pull utilise un curseur opaque contenant les séquences des périmètres départemental et global autorisés, leur génération et la version de contrat. Les lignes SyncScope sont verrouillées et incrémentées au cours des transactions qui publient SyncChange : un numéro ultérieur ne peut pas devenir visible avant le commit d'un précédent dans le même périmètre.

Chaque page comporte un watermark fixé pour ce cycle. Le client applique les changements et avance le curseur dans une même transaction Dexie. Réappliquer une page est sans effet supplémentaire grâce aux UUID et versions. Les tombstones retirent les fiches hors périmètre ; les paiements historiques autorisés restent conservés selon les projections définies.

Un curseur trop ancien ou de génération différente renvoie REBOOTSTRAP_REQUIRED ; la file locale n'est jamais effacée pour résoudre ce problème. Elle est isolée, puis rapprochée du nouveau snapshot après vérification de l'identité. Les projections globales ne contiennent ni coordonnées ni détail des contributions d'un autre département.

## 8. Service worker et compatibilité

Workbox met en cache les ressources statiques et le shell de navigation. Les routes /api/v1, /auth et les exports privés ne sont pas servis par un cache runtime général. Le journal applicatif n'est pas dupliqué dans une deuxième file Workbox de requêtes brutes.

Dans les navigateurs compatibles, un handler Background Sync réveille le moteur de file commun. Le worker peut obtenir une session courte via le refresh HttpOnly autorisé et protégé contre le CSRF ; il garde le bearer seulement en mémoire. Les erreurs de session suspendent l'envoi. Le transport Axios avec adaptateur fetch est partagé lorsque compatible avec le worker. Cette compatibilité devra être prouvée par un test réel avant validation.

Le fallback fonctionne dans tous les navigateurs ciblés : ouverture de l'application, événement online et bouton manuel. Une notification de succès n'est émise qu'après réception du reçu serveur. L'absence de Background Sync n'est pas un échec fonctionnel du mode hors ligne, mais la synchronisation peut attendre la réouverture.

Les mises à jour du service worker sont proposées à l'utilisateur ; elles ne provoquent pas un rechargement pendant une saisie. Les migrations Dexie conservent la file et les anciennes versions de payload. Le serveur accepte une fenêtre de versions contractuelles documentée, puis bloque explicitement les versions trop anciennes sans perdre les opérations.
