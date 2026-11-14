# Premiers pas — SUIVI

## Créer le premier accès

Dans votre terminal personnel, à la racine du projet :

```powershell
npm.cmd run db:local:start
npm.cmd run preview:pwa
```

Ouvrez [la connexion locale](http://localhost:4173/connexion). Au premier lancement, choisissez **Administrateur** et indiquez votre prénom, nom, adresse e-mail, mot de passe et sa confirmation. Utilisez au moins 12 caractères. Votre compte est créé et votre espace s'ouvre. Aucun compte ni campagne n'est créé automatiquement. L'inscription est ensuite fermée ; le bouton Administrateur propose votre connexion.

Un responsable choisit **Responsable**, puis saisit l'identifiant et le code remis par son administrateur. Au premier accès, il remplace le code provisoire par son mot de passe personnel et se reconnecte. Toute nouvelle connexion ferme la session précédente du compte, y compris sur un autre appareil. Une saisie incorrecte n'expulse pas la session légitime.

Le [bootstrap terminal](../../README.md#autre-méthode--bootstrap-terminal) reste disponible pour l'opérateur qui préfère initialiser le premier compte ainsi. Les comptes historiques sans e-mail conservent leur identifiant. L'inscription ne certifie pas la possession de la boîte e-mail et n'envoie pas de message.

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

## Installer l'application sur un appareil

Avec PostgreSQL démarré, lancer `npm.cmd run preview:pwa`, puis ouvrir [l'aperçu installable](http://localhost:4173/installation). Ce mode est distinct du serveur Vite de développement ; vos connexions et réglages de navigateur y sont séparés. Pour un hébergement public, l'installation nécessite une configuration HTTPS de production, encore à qualifier.

Dans **Installer SUIVI**, vérifier que les fichiers de l'application sont prêts. Utiliser le bouton d'installation s'il est proposé ; sinon, passer par le menu du navigateur ou le partage sur iPhone/iPad. Le navigateur peut ne pas proposer cette fonction dans tous les contextes.

Vous pouvez nommer l'appareil : le nom sera transmis lors de vos prochaines connexions. Vous pouvez aussi demander la protection du stockage local ; le navigateur décide de l'accorder. Même accordée, cette protection ne remplace pas une sauvegarde.

Lorsqu'une nouvelle version est prête, terminer les saisies dans tous les onglets puis confirmer la mise à jour. **Plus tard** conserve la version courante et les saisies ; aucun rechargement n'est imposé automatiquement. Les données déjà enregistrées dans IndexedDB ne sont pas supprimées par le changement de worker.

## Connexion interrompue

L'application préparée peut se rouvrir sans réseau, notamment sur l'écran d'installation. Les phases 4 à 10 restent le périmètre métier en ligne validé : l'accès privé hors connexion et la synchronisation durable ne sont pas encore activés. Le bandeau l'indique ; une saisie non confirmée n'est jamais présentée comme validée. Consultez [l'avancement](../PROGRESS.md) et le [périmètre de phase 11](../PHASE_11.md) avant un usage opérationnel.
