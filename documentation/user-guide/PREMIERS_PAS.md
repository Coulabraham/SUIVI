# Premiers pas — version métier des phases 4 à 10

## Créer le premier accès

Dans votre terminal personnel, à la racine du projet :

```powershell
npm.cmd run db:local:start
npm.cmd run auth:bootstrap
npm.cmd run dev
```

Le bootstrap demande votre identifiant, prénom, nom et la durée de validité du secret initial. Il indique la base ciblée et demande de taper CREER avant l'insertion. Il génère un secret aléatoire affiché une seule fois dans votre terminal. Il refuse de remplacer un Super Administrateur existant. Aucun identifiant ou mot de passe universel n'existe.

Ouvrez [la connexion locale](http://127.0.0.1:5173/connexion), puis remplacez immédiatement ce secret par votre mot de passe personnel. Vous devrez ensuite vous reconnecter. Les sessions antérieures sont révoquées après tout changement de mot de passe.

## Préparer la collecte — Super Administrateur

1. Créez les départements et choisissez explicitement leur statut.
2. Créez les responsables en les affectant chacun à un département. Un seul responsable actif est accepté par département.
3. Choisissez la validité du secret initial entre 1 et 168 heures. Remettez les accès après vérification d'identité, directement ou par un canal privé approuvé par votre organisation. La fermeture du dialogue efface l'affichage du secret ; une réinitialisation sera nécessaire pour en générer un autre.
4. Créez la campagne : nom, objectif global en FCFA, dates réelles, fuseau et calendrier. Le montant n'est pas multiplié par le nombre de départements.
5. Activez la campagne lorsque la collecte peut commencer. Les semaines sont générées à partir de ses dates réelles, y compris les périodes partielles.

## Enregistrer une contribution — Responsable

1. Changez votre secret initial à la première connexion.
2. Ajoutez le membre dans votre département avec un numéro unique, son identité, contact et quartier.
3. Dans Encaissements, choisissez le membre, un montant entier strictement positif, la date/heure, la semaine et le mode réellement utilisé.
4. Vérifiez le récapitulatif et confirmez. Le message « validé par le serveur » n'apparaît qu'après confirmation de l'API.
5. Si la requête échoue, conservez le dialogue et réessayez : la même clé est conservée pour éviter un doublon. Vérifiez l'historique avant de créer une autre saisie.

Les versements multiples sont permis. Un membre archivé ne peut recevoir de nouveaux paiements ; sa réactivation est actuellement réservée au Super Administrateur en attendant la validation des permissions élargies.

## Corriger, annuler, transférer

Seul le Super Administrateur peut corriger le montant ou le mode d'un paiement, ou l'annuler, avec justification. L'original reste conservé. Le détail du paiement affiche les révisions et leurs motifs. Un conflit de version demande une actualisation ; aucune révision concurrente n'est écrasée.

Le transfert d'un membre requiert aussi une justification administrative. Les anciens paiements restent dans le département d'origine. Les responsables consultent seulement les détails de leur département ; la progression globale est visible en lecture seule.

## Campagnes et bilans

Le tableau de bord présente la campagne courante, les sommes validées, le reste, le dépassement éventuel et les statistiques autorisées. Le bilan d'une ancienne campagne s'ouvre depuis Objectifs. La clôture conserve les membres, semaines, paiements et révisions ; elle ferme les encaissements de la campagne.

## Notifications et journal d'audit

Dans **Notifications**, consultez votre boîte personnelle, filtrez par catégorie ou état et utilisez la recherche. Le compteur et la liste se rafraîchissent toutes les trente secondes dans l'application ouverte. Vous pouvez marquer une alerte comme lue, ou confirmer « Tout marquer comme lu » : cette action concerne toute votre boîte autorisée, pas seulement le filtre affiché. Les liens ouvrent la rubrique concernée avec vos droits actuels. Aucun message externe ou push n'est envoyé.

Le Super Administrateur reçoit les alertes métier et de sécurité. Le responsable reçoit les changements de son département réalisés par un autre acteur, ainsi que ses alertes personnelles de compte. Une nouvelle connexion sur un autre appareil déclenche une alerte ; vérifiez son origine. Les anciennes alertes départementales ne restent pas accessibles après réaffectation.

Dans **Journal d'audit**, le Super Administrateur peut filtrer par action, résultat, département et période, puis consulter les valeurs avant/après et le motif d'une correction. Les heures des filtres sont celles de l'appareil ; les instants transmis au serveur incluent le fuseau. Ce journal est en lecture seule, sans suppression ni modification. Les responsables n'ont pas accès à cet écran.

## Connexion interrompue

Cette livraison couvre les phases 4 à 10 du document joint. Le stockage hors ligne et la synchronisation durable ne sont pas encore implémentés. Le bandeau de connexion l'indique ; une saisie non confirmée n'est jamais présentée comme validée. Consultez [l'avancement](../PROGRESS.md) avant un usage opérationnel.
