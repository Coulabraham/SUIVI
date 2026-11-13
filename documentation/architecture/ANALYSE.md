# Analyse fonctionnelle et technique

## 1. Périmètre V1

SUIVI est une PWA de suivi des encaissements libres d'une organisation composée de départements. Deux rôles disposent de comptes : Super Administrateur et Responsable. Les membres sont des personnes suivies, sans espace de connexion en V1. La collecte habituelle est le dimanche ; il ne s'agit pas d'un abonnement imposant un montant hebdomadaire fixe.

Le serveur fait autorité pour les permissions, les paiements validés et les rapports officiels. Un appareil peut saisir des opérations provisoires sans Internet, puis demander leur validation. Une opération locale n'est jamais présentée comme définitivement encaissée par le serveur.

Sont hors périmètre initial : paiement en ligne auprès d'opérateurs, transferts d'argent, comptabilité générale, remboursements effectifs automatisés, comptes membres, WhatsApp, application mobile native et Web Push avancé. Enregistrer « Wave » comme mode ne déclenche aucune opération Wave.

## 2. Règles métier acquises

| Référence | Invariant | Garantie attendue |
|---|---|---|
| MET-01 | Un responsable travaille sur un seul département ; au plus un responsable actif par département | Contraintes SQL, services d'affectation et révocation des sessions |
| MET-02 | Un membre a un seul département courant | FK obligatoire et périodes d'affectation cohérentes |
| MET-03 | Seul le Super Administrateur autorise les transferts | Permission serveur, transaction et audit |
| MET-04 | Un membre archivé ne reçoit pas de nouveau paiement validé | Vérification dans la transaction, verrou partagé avec l'archivage |
| MET-05 | Versements libres, partiels et multiples pour le même membre et la même semaine | Aucune unicité membre/semaine ; chaque transaction a son UUID |
| MET-06 | Montants positifs entiers FCFA ; aucun flottant monétaire | PostgreSQL BIGINT et calculs TypeScript bigint |
| MET-07 | Un objectif est global à une campagne, jamais multiplié par les départements | Une ligne Objective par campagne et un seul calcul global |
| MET-08 | Un objectif peut être dépassé | Aucun blocage à 100 % ; progression et dépassement affichés |
| MET-09 | Les historiques survivent aux archivages, désactivations et clôtures | Pas de suppression en cascade des données métier |
| MET-10 | Correction/annulation : Super Administrateur, justification, ancienne et nouvelle valeur | Révision et ajustement immuables, transaction et audit |
| MET-11 | Une opération répétée ne crée pas un deuxième paiement | Identifiant stable, hash de requête et unicités PostgreSQL |
| MET-12 | Les conflits financiers ne sont pas écrasés automatiquement | Résultat CONFLICT et décision explicite autorisée |
| MET-13 | Premier mot de passe à remplacer avant toute utilisation métier | Session restreinte et garde globale |
| MET-14 | Aucun accès détaillé inter-départements pour un responsable | Filtrage des requêtes, relations, exports, synchronisation et notifications |
| MET-15 | Les consultations ordinaires ne notifient pas | Événements métier explicites uniquement |
| MET-16 | Les membres et paiements locaux survivent à une fermeture normale | Écriture atomique IndexedDB avant confirmation locale |

Le total individuel n'est pas un champ éditable. Les totaux départementaux et globaux sont des agrégats de paiements effectifs validés. Le nombre de semaines contribuées est un COUNT DISTINCT des semaines ayant un montant effectif positif, et non le nombre de transactions.

La contrainte d'un département s'applique à l'enregistrement identifié par UUID/numéro membre. Elle ne suffit pas à reconnaître deux saisies de la même personne réelle sur deux appareils. Aucun nom ou téléphone n'est présumé unique sans règle métier ; un éventuel rapprochement doit être contrôlé par l'administrateur, avec conservation de tous les paiements.

Pour une campagne : total = somme des montants effectifs validés ; reste = max(0, cible − total) ; dépassement = max(0, total − cible) ; progression = total / cible × 100. La cible doit être strictement positive. La valeur du pourcentage peut dépasser 100 %, même si une jauge graphique s'arrête visuellement à 100 %.

## 3. Matrice des autorisations

| Action | Super Administrateur | Responsable |
|---|---|---|
| Départements, comptes, affectations, réinitialisations | Oui | Non |
| Membres : consultation et gestion | Tous | Département courant uniquement |
| Transfert de membre | Oui, en ligne, audité | Non |
| Saisie d'encaissement | Modalité à confirmer | Son département, en ligne et hors ligne |
| Lecture des encaissements | Tous | Département historique du paiement uniquement |
| Correction/annulation financière | Oui, en ligne, justification | Non |
| Objectif et dates | Modification | Progression globale agrégée en lecture seule |
| Audit | Lecture globale | Aucun accès global ; pas d'écriture directe |
| Rapports | Globaux, départementaux, individuels | Son périmètre uniquement, droit d'export à confirmer |
| Appareils et synchronisation | Supervision globale | Ses appareils et opérations |
| Mot de passe et sessions personnelles | Ses propres accès | Ses propres accès |

Le droit de saisir un paiement en tant que Super Administrateur n'est pas explicitement défini ; il ne sera pas ajouté implicitement. Un export individuel par un responsable ne pourra pas révéler les contributions réalisées dans un autre département.

## 4. Temporalité et historique

Les dates de campagne sont des dates métier dans un fuseau configuré, proposé : Africa/Abidjan. Les instants sont stockés en timestamptz UTC. Un paiement conserve distinctement la date de collecte déclarée par l'appareil et la date de réception serveur. L'horloge d'un appareil n'est pas une preuve d'antériorité.

Les semaines seront calculées à partir de la période réelle de campagne. La convention proposée est dimanche–samedi, avec première et dernière périodes éventuellement partielles. Un dimanche n'est pas inventé dans une période initiale qui n'en contient pas. La politique des versements hors dimanche et des rattachements rétroactifs doit être validée.

Le département d'un paiement reste celui de son encaissement. Un changement de département du membre ne réattribue jamais ses paiements historiques. Le périmètre d'accès suit le département historique des paiements ; le périmètre des coordonnées courantes du membre suit son département courant.

## 5. Risques et réponses prévues

| Risque | Conséquence | Mesure et preuve attendue |
|---|---|---|
| Perte de réponse après commit | Doublon à la reprise | Transaction métier + reçu idempotent ; test réponse perdue |
| Deux appareils modifient un membre | Données écrasées | Version attendue, update conditionnel, conflit visible |
| Archivage simultané à un paiement | Paiement sur membre inactif | Même verrou membre pour les deux opérations ; test concurrent |
| Révocation pendant déconnexion | Appareil temporairement encore utilisable | Autorisation hors ligne bornée, nouvelle vérification serveur avant envoi |
| Transfert membre/responsable avec file en attente | Fuite de données ou mauvais département | Versions de périmètre, rebootstrap et opérations mises en quarantaine |
| Clôture avant réception d'une collecte | Perte ou validation arbitraire | Conservation de l'opération et arbitrage selon règle à confirmer |
| Mauvais curseur incrémental | Changements définitivement manqués | Séquence sérialisée par périmètre, écrite dans le même commit |
| Mode privé, quota, suppression du stockage | Perte locale non synchronisée | Persistance demandée, contrôle des erreurs, avertissement explicite, aucune promesse de sauvegarde locale absolue |
| XSS sur appareil connecté | Lecture du stockage local | CSP stricte, minimisation, pas de JWT persistant ; chiffrement navigateur à portée limitée |
| Ancien service worker | Client incompatible ou queue cassée | Contrat versionné, migrations Dexie, mise à jour différée jusqu'à état sûr |
| Sommes supérieures aux limites JavaScript | Totaux inexacts | bigint, chaînes décimales JSON, tests aux bornes |
| Export CSV malveillant | Formule exécutée dans un tableur | Neutralisation des cellules textuelles commençant par =, +, -, @ |
| Poste sous OneDrive | Verrous ou conflits de fichiers | Éviter les copies concurrentes ; stockage PostgreSQL et secrets hors dossier synchronisé |

Les volumes réels, la durée de conservation, le nombre d'appareils et l'hébergement ne sont pas connus. Les budgets de performance seront définis avant les tests de charge ; aucun chiffre de capacité n'est annoncé sans mesure.

## 6. Couverture des exigences

| Exigences du prompt | Conception de référence | Phase de réalisation |
|---|---|---|
| 3–4 : stack et architecture | [Architecture](ARCHITECTURE.md) | 2 |
| 5–6 : rôles et authentification | [Sécurité](../security/SECURITE.md) | 3–4 |
| 7–10 et 14 : domaine et base | [Modèle relationnel](../database/MODELE_RELATIONNEL.md) | 3–4 |
| 11 et 16 : tableaux de bord, UX | [Architecture](ARCHITECTURE.md) | 5 |
| 12 : notifications et audit | [Contrats](../api/CONTRATS.md), [sécurité](../security/SECURITE.md) | 4 |
| 13 : offline-first | [Synchronisation](SYNCHRONISATION.md) | 3–4 puis 6 |
| 15 : API | [Contrats](../api/CONTRATS.md) | 4 |
| 17 : exports | [Contrats](../api/CONTRATS.md) | 4–5 |
| 18 et 20 : tests et qualité | [Plan et tests](PLAN_ET_TESTS.md) | Toutes phases |
| 19 et 21 : progression et décisions | [Avancement](../PROGRESS.md), [décisions](../DECISIONS.md) | Toutes phases |
| 22 : première mission | [Index du dossier](../README.md) | 1 uniquement |
