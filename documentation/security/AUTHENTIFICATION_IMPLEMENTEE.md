# Authentification et autorisations effectivement implémentées

Ce document décrit les phases 4 à 10 du cahier joint. La [conception de sécurité cible](SECURITE.md) comprend aussi des fonctions hors ligne et d'exploitation encore futures.

## Cycle d'accès

Le premier administrateur est créé par le CLI interactif exécuté personnellement par l'opérateur. Le CLI refuse une exécution redirigée et un compte administrateur déjà présent. Aucun compte de démonstration, secret connu ou identité d'organisation n'est inventé. Les responsables sont créés dans l'espace administrateur ; leur secret est généré avec randomBytes(24), affiché une seule fois et absent des réponses de consultation.

La validité du secret initial est choisie explicitement entre une heure et sept jours. Argon2id utilise 64 MiB, trois itérations et un parallélisme de un. Le nouveau mot de passe contient de 12 à 256 caractères et doit différer du précédent. Les mots de passe ne sont pas enregistrés dans les journaux ni conservés dans le navigateur.

Un premier accès émet une session limitée aux actions profil/changement/déconnexion. Le changement retire le statut initial, change le hash, incrémente la version de credentials et révoque toutes les sessions. Le responsable se reconnecte avec son nouveau secret. Une réinitialisation administrateur impose de nouveau le changement initial et révoque les accès antérieurs.

## Session et navigateur

- JWT HS256 de dix minutes avec issuer et audience vérifiés ; clé aléatoire locale, au moins 32 caractères exigés en production.
- Session absolue de huit heures, rattachée au propriétaire de l'appareil. La base reste l'autorité de révocation.
- Refresh aléatoire de 384 bits ; uniquement son SHA-256 est conservé. Le cookie est HttpOnly, SameSite Strict, Secure en production et limité au chemin d'authentification. Chaque utilisation consomme le refresh et le remplace. La réutilisation d'un refresh consommé révoque la session, dans une transaction qui conserve cette révocation même si la réponse est 401.
- L'en-tête X-SUIVI-CLIENT et le contrôle d'origine protègent les actions d'authentification utilisant le cookie. Les mutations métier exigent un Bearer ; une restriction React ne les autorise jamais.
- Le JWT et le profil courant sont dans Zustand en mémoire. Le seul identifiant technique d'appareil est conservé pour les connexions ultérieures ; ni JWT ni refresh ni secret ne sont placés dans localStorage. Web Locks sérialise les rotations entre onglets lorsque disponible ; la déduplication en mémoire couvre les appels simultanés d'un onglet.
- Le cache Query est effacé au changement d'identité, changement de mot de passe et déconnexion confirmée. L'API envoie Cache-Control no-store. Une déconnexion dont le serveur n'a pas confirmé la révocation affiche son erreur.
- Les clés Query comprennent le périmètre de l'identité. Si le cookie renouvelé appartient à une autre identité ou un autre rôle/département, le cache est purgé et une reconnexion est imposée ; la requête précédente n'est pas rejouée sous les nouveaux droits. Les révocations à la déconnexion et les réutilisations de refresh sont auditées.

## Contrôle des ressources et transactions

Les guards JWT/permissions sont appliqués aux contrôleurs métier. Chaque requête relit session, compte, appareil, versions et département. Chaque mutation reverrouille et revérifie l'identité dans sa transaction ; un compte révoqué ne peut valider un paiement sur la seule foi d'un JWT ancien.

Les services filtrent toutes les ressources détaillées par le département du responsable. Le serveur déduit les champs d'autorité des paiements. Les DTO rejettent les champs supplémentaires ; le client ne choisit pas un autre encaisseur, rôle ou appareil d'origine.

Les versions évitent les modifications perdues. Les paiements sont immuables pour le rôle applicatif ; les corrections passent par une révision privilégiée, le ledger et l'audit obligatoire au commit. Les transferts conservent les paiements dans leur département historique et utilisent un libellé d'identité figé pour les anciennes transactions.

## Notifications et consultation d'audit

L'audit et les notifications associées sont insérés dans la transaction métier : l'échec de l'une des insertions annule l'ensemble. La contrainte unique destinataire/événement empêche une seconde notification pour le même événement. Un filtrage récursif enlève les champs de secrets avant stockage, puis à nouveau lors de la lecture du détail. Les métadonnées de liste n'incluent pas les snapshots.

Tous les administrateurs actifs reçoivent les alertes ; les responsables actifs du département reçoivent les changements effectués par un autre acteur. Les alertes personnelles de sécurité suivent leur compte sans détail d'un autre département. Les notifications départementales anciennes deviennent inaccessibles après réaffectation, y compris par UUID ou marquage en lot. Le journal d'audit est réservé au Super Administrateur, en lecture seule. Les triggers PostgreSQL et les privilèges du rôle applicatif protègent son historique et le contenu des notifications ; seule la première date de lecture peut être ajoutée.

Une connexion depuis un nouvel UUID d'appareil alors que le compte possède déjà un appareil génère une alerte interne ; le tout premier appareil n'est pas inhabituel. Ce signal n'est ni une géolocalisation ni une preuve d'intrusion. Les connexions ordinaires, consultations et marquages de lecture ne déclenchent aucune notification. Les messages ne contiennent ni montants ni coordonnées ni secret initial. La boîte et son compteur se rafraîchissent toutes les trente secondes lorsque l'application est ouverte et visible.

## Limites d'exploitation restantes

La limitation des tentatives est en mémoire d'un processus et ne remplace pas la qualification multi-instance de la phase 14. Les identités d'appareils sont des références de session, sans prétention d'attestation matérielle. En l'absence de Web Locks, la coordination de plusieurs onglets peut conduire à une révocation conservatrice si un refresh est réutilisé.

Le déploiement HTTPS, la configuration du reverse proxy, les sauvegardes/restaurations de production, les politiques de rétention, la supervision et la revue globale restent à qualifier avant production. Les sessions hors ligne, la protection IndexedDB et la synchronisation restent dans les phases 11 et 12 ; aucun JWT courant n'est présenté comme une validation serveur d'un événement déconnecté.

Références : [NestJS Passport/JWT](https://docs.nestjs.com/recipes/passport), [OWASP Session Management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html).
