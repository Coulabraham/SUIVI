# Conception de la sécurité

Statut : conception cible, comprenant des fonctions futures ; sans attestation globale de sécurité. Les mécanismes déjà réalisés et leurs limites figurent dans [l'authentification implémentée](AUTHENTIFICATION_IMPLEMENTEE.md).

## 1. Authentification et mots de passe

Le login est unique après normalisation. Le format final dépend de Q01 : nom d'utilisateur normalisé ou téléphone E.164. Un contact téléphonique n'est pas automatiquement un identifiant ou un second facteur. Les erreurs de connexion restent génériques pour éviter l'énumération des comptes.

Proposition : mot de passe initial produit avec crypto.randomBytes, au moins 128 bits d'entropie, encodé en caractères lisibles. Il est affiché une seule fois à l'administrateur sur une réponse HTTPS non mise en cache, masqué ensuite et exclu des logs, de l'audit et du stockage navigateur. Seul son hash Argon2id est conservé. Le canal de remise et la durée de validité restent à confirmer ; aucun envoi externe n'est automatique.

Une première connexion réussie ouvre une session limitée aux routes de changement du mot de passe, profil minimal et déconnexion. Un garde serveur global refuse toutes les routes métier tant que mustChangePassword est vrai. L'autorisation hors ligne n'est pas délivrée pendant cet état.

La modification vérifie l'ancien secret, refuse la réutilisation immédiate, écrit le nouveau hash et incrémente credentialVersion. Les sessions existantes sont révoquées ; une nouvelle session est émise au terme du changement. Le mot de passe initial ne fonctionne plus. Une réinitialisation administrative génère un autre secret initial, remet le changement obligatoire et révoque toutes les sessions, avec audit dépourvu de secret.

La politique de longueur des mots de passe personnels sera explicitée, avec une proposition de minimum 12 caractères et longueur maximale assez élevée mais bornée pour protéger la fonction de hash. Les paramètres Argon2id seront mesurés sur le serveur cible. Les tentatives sont limitées par compte et source, sans verrouillage permettant un déni de service trivial.

## 2. Sessions et révocation

Proposition initiale : JWT d'accès de 10 minutes, en mémoire uniquement. Le JWT comprend sub, sid, rôle indicatif, credentialVersion et authzVersion ; les champs ne dispensent jamais de relire l'état de session, du compte et du périmètre.

Un refresh token aléatoire est placé en cookie HttpOnly, Secure en production et SameSite approprié au déploiement de même origine. Son hash est conservé dans Session ; chaque refresh effectue une rotation atomique et la réutilisation d'un token consommé révoque sa famille. Le client coordonne les refresh entre onglets pour éviter les rotations concurrentes. La durée absolue et la durée d'inactivité seront configurées et documentées.

Les routes utilisant le cookie sont protégées contre le CSRF : validation Origin/Fetch Metadata, jeton anti-CSRF obtenu par une lecture de même origine et contrôle d'en-tête pour les mutations. CORS ne peut pas utiliser une origine générique avec credentials. Le refresh depuis le service worker suit le même protocole.

Les JWT et refresh tokens ne sont pas stockés dans localStorage ou IndexedDB. Un logout révoque la session serveur, supprime le cookie et verrouille le contexte local. Si la file contient des opérations non transmises, l'interface l'explique et applique une politique explicite de conservation protégée/récupération ; aucun effacement silencieux de saisie financière.

Désactivation, remplacement, réaffectation ou réinitialisation invalident les sessions et l'autorisation hors ligne au prochain contact serveur. Une requête métier vérifie la session et l'appareil à chaque fois, sans se contenter de l'expiration du JWT.

## 3. Autorisations et isolation

Les contrôleurs sont protégés par défaut. Les exceptions publiques sont explicites : login, endpoints de santé minimaux, et protocole de refresh/CSRF avec ses propres contrôles. Les décorateurs @Roles et guards NestJS vérifient le rôle ; un service de périmètre ajoute le departmentId autorisé aux requêtes et aux accès par identifiant.

Le responsable ne choisit jamais un département arbitraire dans une commande de création. Un UUID demandé est chargé avec son filtre de périmètre ; une ressource absente ou étrangère retourne un résultat qui ne révèle pas son existence. Les recherches, comptes, champs relationnels, exports, graphiques, notifications et synchronisation suivent la même règle.

Pour les paiements historiques, le filtre porte sur Payment.departmentId. Pour les coordonnées actuelles d'un membre, il porte sur Member.departmentId. Les jointures ne doivent pas dévoiler de nouvelles coordonnées après un transfert. Un libellé historique minimal est conservé sur le paiement pour le contrôle des anciennes écritures ; les règles de rétention des données personnelles doivent être arrêtées avec l'organisation.

L'appareil est une origine technique, pas une autorité. Un deviceId volé ou inventé ne donne aucun droit. Les permissions sont vérifiées à nouveau au moment du commit d'une opération hors ligne, y compris pour un UUID déjà connu dont le reçu serait demandé.

## 4. Autorisation hors ligne

Une autorisation signée délivrée après authentification complète contient utilisateur, appareil, département, authzVersion, génération de périmètre, date d'émission et échéance. Elle permet à l'interface de vérifier qu'une utilisation locale a été récemment autorisée ; **elle ne permet pas d'authentifier une requête API ni d'imposer l'acceptation d'une collecte au serveur**.

La durée est en attente de Q02. Après expiration, la saisie est verrouillée et une authentification en ligne est requise ; les opérations déjà enregistrées restent conservées. Un autre compte ne peut pas reprendre automatiquement une file existante.

La signature limite la falsification du document, mais ne protège ni contre un propriétaire d'appareil qui modifie le code, ni contre le recul de l'horloge hors ligne. Conserver le dernier instant serveur et détecter les reculs évidents réduit certains cas sans créer une preuve de temps fiable. Une révocation ne peut pas être connue immédiatement sans connexion.

Minimiser les champs stockés, cloisonner les bases locales et fermer l'accès lors d'un changement de compte. Un chiffrement Web Crypto peut protéger certains scénarios de copie de fichiers ; une clé stockée avec les données ne protège pas d'un XSS ou d'un appareil déverrouillé. Un verrou local fort nécessiterait une gestion de clé ou un secret local distinct à définir. Aucune protection absolue des données locales n'est annoncée.

## 5. Sécurité applicative et données

- HTTPS obligatoire en production et en-têtes de sécurité, CSP restrictive, absence de HTML utilisateur non assaini et contrôle des dépendances.
- Validation class-validator avec whitelist et refus des champs inattendus ; bornes de taille des listes, exports, lots et chaînes.
- Requêtes Prisma paramétrées ; SQL brut réservé aux besoins documentés et toujours paramétré.
- Secrets exclusivement dans l'environnement serveur ou un gestionnaire de secrets ; aucune clé serveur dans les variables VITE_.
- Journaux et audit : masquage des hashes, mots de passe, cookies, tokens et contacts non nécessaires.
- Notifications à destinataire explicite, sans fuite de détails inter-départements.
- Exports privés avec en-têtes non-cache ; contrôle du périmètre avant calcul et téléchargement ; prévention des formules CSV.
- SQL : rôle applicatif minimal, rôle de migration distinct, audits/révisions/ajustements append-only. Le Super Administrateur applicatif ne reçoit aucun droit SQL direct.
- Sauvegardes chiffrées et isolées du poste ; restauration vérifiée sur une base séparée, pas seulement contrôle de présence d'un fichier.

## 6. Audit et alertes

Les succès sensibles écrivent leur audit dans la transaction métier. L'échec d'audit annule la mutation financière. Les refus et erreurs de connexion utilisent une écriture séparée ou un journal de sécurité corrélé ; ils ne peuvent pas être perdus par le rollback de la transaction refusée.

Actions à couvrir : création/modification/désactivation de compte et département, affectation, connexion inhabituelle, reset, changement de mot de passe, révocation, membre ajouté/modifié/archivé/réactivé/transféré, collecte, correction, annulation, objectif modifié/clôturé et résolution de conflit. Les consultations ordinaires ne produisent pas de notification métier. L'audit ne conserve que les valeurs pertinentes et jamais de secret.

Les tests de sécurité sont détaillés dans le [plan de vérification](../architecture/PLAN_ET_TESTS.md). Une validation de production exige des tests effectifs sur PostgreSQL, HTTP et navigateur ; la seule présence de guards dans le code ne suffit pas.
