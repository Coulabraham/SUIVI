# Registre des décisions

Date initiale : 12 novembre 2026. L'utilisateur a validé la conception générale et autorisé la phase 2 par « ok continue ». Les questions métier sans réponse explicite restent ouvertes ; cette validation ne choisit pas leurs valeurs à sa place.

## Exigences déjà fixées

- Stack du prompt conservée ; TypeScript strict de bout en bout.
- Deux rôles ; un département par responsable ; au plus un responsable actif par département.
- Versements libres, partiels et multiples ; montants entiers FCFA.
- Objectif unique pour l'organisation à un instant donné ; dépassement autorisé.
- Corrections et annulations réservées au Super Administrateur, avec justification et audit.
- Historique conservé ; pas de suppression physique des paiements validés.
- Création de comptes et nouvelle authentification en ligne ; changement initial obligatoire.
- Véritable file hors ligne, idempotence serveur et résolution explicite des conflits financiers.
- La phase 1 précède toute implémentation ; la phase 2 attend la validation utilisateur.

## Choix techniques proposés

| ID | Proposition | Motivation | État |
|---|---|---|---|
| ADR-01 | Monorepo npm workspaces dans le dossier existant | Pas d'outillage d'orchestration supplémentaire nécessaire | Proposé |
| ADR-02 | Monolithe NestJS modulaire | Transactions simples et exploitation proportionnée au besoin V1 | Proposé |
| ADR-03 | BIGINT PostgreSQL, bigint TypeScript, chaînes décimales JSON | Exactitude des paiements et des cumuls sans limite Number implicite | Proposé |
| ADR-04 | OpenAPI normatif et paquet de contrats générés | Éviter les copies de types Prisma côté navigateur | Proposé |
| ADR-05 | Journal d'ajustements monétaires et révisions immuables | Conservation de l'original et absence de double comptage | Proposé |
| ADR-06 | Périodes d'affectation des membres | Préserver département historique et isolation après transfert | Proposé |
| ADR-07 | Dexie comme source locale, file même en ligne pour les responsables | Un seul circuit métier pour connexion normale et reprise | Proposé |
| ADR-08 | Transactions par opération dans un lot, résultats individuels | Une erreur n'annule pas les opérations indépendantes ; dépendances explicites | Proposé |
| ADR-09 | Flux de changements avec séquence transactionnelle par périmètre | Éviter de perdre un changement à cause d'un ordre de commit différent | Proposé |
| ADR-10 | JWT court en mémoire + refresh rotatif en cookie HttpOnly + sessions serveur | Révocation vérifiée à chaque requête et moindre exposition des tokens | Proposé |
| ADR-11 | Argon2id pour le hash, secret initial aléatoire à affichage unique | Aucun mot de passe récupérable en base, communication contrôlée | Proposé |
| ADR-12 | PDFKit pour PDF, ExcelJS pour XLSX, CSV généré par le serveur | Respect de la stack, même filtre d'autorisation pour tous les formats | Proposé |
| ADR-13 | Cache statique Workbox ; données privées uniquement dans Dexie cloisonné | Éviter les réponses privées exposées dans un cache HTTP partagé | Proposé |
| ADR-14 | Publication et hébergement définis après validation fonctionnelle | Aucun choix de fournisseur imposé durant l'analyse | Proposé |
| ADR-15 | TypeScript 6.0.3 et Prisma 7.10.1 stables | TypeScript 7 dépasse les peer dependencies de Swagger/ts-jest/typescript-eslint ; Prisma latest retournait une RC. Aucun remplacement de technologie | Retenu pour phase 2 |
| ADR-16 | PostgreSQL 18.7 natif local hors OneDrive, port 5433, avec Compose alternatif | Docker ne dispose pas de moteur actif ; éviter une installation WSL et un redémarrage pour développer | Retenu pour phase 2 |
| ADR-17 | Initialisation NestJS explicite avec tsc et décorateurs, sans CLI permanente | Les fichiers restent minimaux ; aucun outillage CLI inutilisé dans les dépendances | Retenu pour phase 2 |
| ADR-18 | Aucun modèle métier dans le schéma initial de phase 2 | Les modèles, migrations et génération du client arrivent en phase 3. La santé technique utilise le pilote pg requis par l'adaptateur Prisma | Retenu pour phase 2 |
| ADR-19 | Backend ESM, résolution NodeNext et tests Jest ESM | NestJS 12 distribue des modules ESM ; le premier build a détecté l'incompatibilité de la configuration CommonJS initiale. Alignement du serveur et du futur client Prisma sans changement de stack | Retenu après contrôle de compilation |
| ADR-20 | Overrides ciblés glob 14.0.6 et minimatch 11.0.8 pour l'outillage | Versions transitives corrigées ; tests et lint revérifiés. Pas de rétrogradation forcée de Jest. Alerte faible deepmerge sans correctif suivie séparément | Retenu et documenté en phase 2 |
| ADR-21 | Ledger SQL : trigger d'ajustement/projection, audit différé obligatoire | Une seule écriture de révision produit l'écart ; pas de double compensation ni de mutation financière sans audit au commit | Implémenté et testé en phase 3 |
| ADR-22 | Deux bases de test dans une instance PostgreSQL temporaire indépendante | Tester contraintes et seeds sans comptes fictifs ni nettoyage destructif dans suivi_dev | Implémenté en phase 3 |
| ADR-23 | Bootstrap sans identité/secret par défaut ; démonstration contrôlée par nom réel de base et environnement | Préserver les choix métier ouverts et séparer strictement données réelles/démonstration | Implémenté en phase 3 |
| ADR-24 | Semaines dimanche–samedi utilisées uniquement dans les fixtures tant que Q05 reste ouverte | Tester périodes partielles et années bissextiles sans imposer la convention aux campagnes réelles | Implémenté en phase 3 |
| ADR-25 | Génération Prisma dans les précommandes backend ; mode de build frontend explicitement production | Fonctionner après installation propre et ne pas livrer React de développement si le terminal hérite de NODE_ENV | Implémenté en phase 3 |
| ADR-26 | Indexation explicite des préfixes de toutes les FK dans une migration additive | PostgreSQL n'indexe pas automatiquement les références ; préserver la supervision et les jointures sans réécrire les trois migrations initiales | Ajouté après revue en phase 3 |
| ADR-27 | Numérotation de la livraison actuelle selon la section 19 du cahier joint | L'utilisateur demande explicitement les phases 4 à 9 en citant ce fichier ; elles correspondent à authentification → objectifs/tableaux de bord | Retenu le 13 novembre ; ne renumérote pas l'historique |
| ADR-28 | Identifiant générique unique, NFKC et comparaison sans distinction de casse | Supporter nom d'utilisateur ou téléphone saisi explicitement sans choisir à la place de l'organisation ; contact distinct | Implémenté ; convention organisationnelle Q01 ouverte |
| ADR-29 | JWT dix minutes, session en ligne huit heures, refresh opaque rotatif et cookie protégé | Durées techniques de session en ligne ; ne définissent aucune autorisation hors ligne Q02 | Implémenté et testé ; secret JWT stable généré localement, obligatoire en production |
| ADR-30 | Secret initial aléatoire de 192 bits, affichage unique, validité choisie de 1 à 168 heures | Aucun secret universel ni envoi à un tiers ; expiration explicite dans formulaire/CLI | Implémenté ; canal organisationnel Q17 à choisir |
| ADR-31 | Réactivation des membres réservée à l'administrateur tant que Q07 n'est pas confirmée | Ne pas étendre implicitement les autorisations du responsable ; le besoin prévoit des règles autorisées sans les fixer | Restriction visible dans l'API et l'interface |
| ADR-32 | Calendrier dimanche–samedi sélectionné explicitement à chaque création de campagne | Dates réelles et fuseau obligatoires ; aucune campagne réelle inventée ; semaines partielles conservées | Implémenté ; Q05/Q06 restent ouvertes pour une autre convention ou une prolongation |
| ADR-33 | Paiements saisis par responsables ; corrections/annulations par administrateur | Reprendre les permissions explicitement décrites ; ne pas ajouter le droit de saisie à l'administrateur sans Q13 | Implémenté et testé |
| ADR-34 | Verrous consultatifs API et verrou de ligne dans le trigger financier privilégié | SELECT FOR UPDATE sur payments exigerait un droit UPDATE absent du rôle applicatif ; conserver les privilèges minimaux | Corrigé après échec d'intégration et retesté |
| ADR-35 | Trois bases de test séparées, quatrième pour Chrome | Isoler intégrité, démonstration, API et navigateur ; données factices exclusivement dans les bases éphémères nommées suivi_test_* | Implémenté dans le runner |
| ADR-36 | Contrats de transport partagés et DTO de réponses Swagger implémentant leurs interfaces | Couvrir entrées/sorties et enveloppes ; les types ne sont pas encore générés automatiquement depuis OpenAPI | Étape actuelle d'ADR-04, limite explicitement conservée |
| ADR-37 | Timeout de santé deux secondes, SQL dix secondes et verrou cinq secondes côté PostgreSQL, transaction trente secondes | Le query_timeout client initial de deux secondes interrompait des lots métier et pouvait perturber la connexion ; conserver l'annulation SQL transactionnelle | Implémenté après échec de qualification, nouvelle recette requise |
| ADR-38 | Caches Query cloisonnés par identité/rôle/département ; changement de contexte au refresh imposant une reconnexion | Ne pas afficher un ancien périmètre et ne pas rejouer une mutation sous l'identité d'un autre onglet | Implémenté avec tests de régression frontend |

## Phase 10 — décisions complémentaires

| ID | Décision | Motif et limites |
|---|---|---|
| ADR-39 | Enregistrement centralisé d'un audit et publication des notifications dans la même transaction PostgreSQL | Aucun événement sensible confirmé sans trace ; rollback commun, unicité destinataire/UUID d'audit, messages génériques sans secret ni coordonnées |
| ADR-40 | Boîte personnelle, tous les administrateurs actifs et responsables du département sauf l'acteur | Alertes utiles sans notifier chaque lecture ; alertes de compte personnelles conservées après réaffectation, anciennes alertes départementales masquées ; transfert signalé aux départements source/cible |
| ADR-41 | Journal d'audit réservé au Super Administrateur, uniquement consultable | Métadonnées paginées séparées des snapshots ; expurgation récursive des secrets à l'écriture et à la lecture ; aucune route de modification |
| ADR-42 | Nouveau dispositif après au moins un appareil connu comme signal de connexion inhabituelle | Signal explicable et testable ; le premier appareil est normal, aucun suivi géographique ni attestation matérielle supposé |
| ADR-43 | Première date de lecture immuable et conservation des notifications | Droit UPDATE limité à read_at et trigger d'intégrité ; marquage idempotent, suppression interdite, pas de remise à non lu |
| ADR-44 | Polling interne toutes les trente secondes, sans push externe | Réponse au besoin de notifications internes ; Background Sync et producteur réel SYNC_FAILED attendent la phase 12 ; aucun rétro-remplissage d'alertes historiques |
| ADR-45 | Quatrième base isolée dédiée aux événements, cinquième avec navigateur | Complète ADR-35 ; qualification de diffusion, rollback, périmètres, immutabilité et réaffectation sans données de test dans suivi_dev |

## Phase 11 — installation et stockage

| ID | Décision | Motif et limites |
|---|---|---|
| ADR-46 | Vite PWA 2.0.0, injectManifest et Workbox 7.4.1 | Compatibilité Vite 8 déclarée par le registre ; worker propre au projet sans file de requêtes brutes |
| ADR-47 | Préchargement des seuls fichiers statiques et liste fermée de navigations React | Toute route API reste réseau uniquement ; ni réponse privée en Cache Storage, ni shell HTML à la place d'une API |
| ADR-48 | Nouvelle version en attente, confirmation de rechargement et possibilité de report | Préserver les saisies ; aucun skipWaiting ou rechargement spontané ; formulaires ouverts vérifiés avant application |
| ADR-49 | Dexie chargé à la demande ; base stable suivi-local avec version de schéma distincte | Éviter de charger le SDK dans le bundle initial ; conserver les futurs journaux lors des migrations ; persistance décidée par le navigateur |
| ADR-50 | Enveloppes AES-GCM et file projection/commande atomique, inactives pour les données réelles tant que l'autorisation manque | Préparer les garanties testables sans confondre cache technique, autorisation locale et validation serveur ; KDF Web Crypto, clé non extractible en mémoire |
| ADR-51 | Aperçu compilé sur localhost:4173, API locale sur 127.0.0.1:3001 | Vite dev ne fournit pas les garanties du worker de production ; séparer l'origine et les cookies du développement 127.0.0.1:5173 |
| ADR-52 | Rechargement suivi par une demande explicite du client, avec observation native de controllerchange | Le SDK ne déclenchait pas de rechargement lors d'une mise à jour sur la toute première page ; un autre onglet doit conserver sa saisie et demander son propre rechargement |
| ADR-53 | Nom d'appareil actualisé seulement après authentification réussie, même UUID/propriétaire et audit avant/après | Relier le réglage Dexie aux prochaines connexions sans recréer un appareil ou étendre des permissions |

## Décisions métier nécessaires

Évolution explicitement demandée le 14 novembre : le premier administrateur utilise son e-mail, son prénom/nom et un mot de passe personnel ; un responsable conserve son identifiant et son code. Une nouvelle connexion remplace la session précédente du compte. Cela précise Q01 pour le nouvel administrateur et Q18 pour la simultanéité des accès ; Q02 (durée privée hors ligne) reste sans réponse. Voir [le comportement implémenté](CONNEXION_ET_SESSIONS.md).

| ID | Décision complémentaire | Justification |
|---|---|---|
| ADR-54 | Inscription du premier administrateur seulement, même verrou PostgreSQL que le bootstrap terminal | Interdire une deuxième initialisation concurrente et ne pas rouvrir la création après désactivation |
| ADR-55 | Nouvelle connexion prioritaire ; révocation transactionnelle de toutes les sessions antérieures sous verrou utilisateur | Une session active par compte, y compris entre deux connexions simultanées ; refus immédiat des anciens JWT/refresh côté API |
| ADR-56 | Champ website vide obligatoire, masqué pour l'utilisateur, contrôlé par Zod et class-validator | Compléter la limitation des tentatives sans prétendre bloquer tous les robots ; aucun rôle accordé par un choix d'interface |
| ADR-57 | Georgia/Cambria pour les titres, Segoe UI/system-ui pour les textes et formulaires | Choix initial remplacé par ADR-58 après réception du modèle visuel utilisateur |

## Refonte selon le modèle visuel du 14 novembre

| ID | Décision | Motif et limites |
|---|---|---|
| ADR-58 | Identité bleue et blanche, logo SVG local, titres Segoe UI Variable Display gras et textes Segoe UI/system-ui | Reprendre le modèle fourni, conserver une hiérarchie lisible sans téléchargement de polices ; remplace ADR-57 |
| ADR-59 | Menu latéral dès 768 px et menu modal/navigation basse sur mobile | Adapter les vrais parcours métier à la tablette et au téléphone ; aucun lien vers une fonctionnalité absente |
| ADR-60 | Séries hebdomadaires calculées sur la projection financière SQL dans la transaction dashboard existante | Inclure corrections, annulations et semaines à zéro ; filtre départemental côté serveur ; montants exacts, géométrie normalisée seulement |
| ADR-61 | Mémorisation facultative du seul identifiant, jamais du secret | Donner un sens précis à l'option du modèle ; ne change ni la durée de session ni la révocation sur nouvelle connexion |
| ADR-62 | Recherche membre par prénom et nom combinés, dans les deux ordres, avec conservation des recherches par numéro/contact | La recette du champ de recherche supérieur a révélé qu'une recherche multichamp était nécessaire ; filtre départemental obligatoire conservé autour de l'ensemble des critères |
| ADR-63 | Amorçage PostgreSQL et budget global navigateur bornés séparément des assertions | Expiration initdb à trois minutes observée sous Windows : limite à dix minutes pour cette initialisation et 90 secondes pour pg_ctl. Après expiration du lot navigateur à dix minutes, son budget global passe à vingt minutes ; délais individuels des scénarios/assertions, authentification SCRAM et permissions conservés |

## Décisions métier restant ouvertes

Les questions Q01 à Q03 ont été présentées pendant l'analyse ; aucune réponse n'a été présumée. Les propositions suivantes permettent de discuter un résultat concret sans inventer les règles définitives.

| ID | Question | Proposition / possibilités | Quand trancher |
|---|---|---|---|
| Q01 | Identifiant de connexion ? | E-mail confirmé pour le premier administrateur créé par interface le 14 novembre ; identifiant unique conservé pour les responsables et comptes historiques. Téléphone comme identifiant non demandé | Administrateur tranché ; évolution téléphone éventuelle |
| Q02 | Durée d'autorisation hors ligne après connexion en ligne ? | 7 jours, 72 h ou 24 h ; durée choisie visible à l'utilisateur | Avant authentification/offline |
| Q03 | Paiement arrivé après clôture, archivage ou transfert ? | Mise en conflit pour arbitrage administrateur, ou rejet conservé localement ; jamais abandon silencieux | Avant validation financière et sync |
| Q04 | Calendrier exact de la première campagne ? | Dates et nom à fournir ; 12 mois envisagés, sans dates inventées | Avant seed de campagne réelle |
| Q05 | Convention de semaine, encaissements hors dimanche et rétroactivité ? | Dimanche–samedi ; saisie hors dimanche autorisée avec semaine explicite, bornée par la campagne | Avant génération des semaines |
| Q06 | Fin automatique ou clôture administrative ? | Clôture automatique à la date de fin, prolongation explicite et auditée ; impact sur files en attente via Q03 | Avant module objectifs |
| Q07 | Réactivation de membres par un responsable ? | Autoriser dans son département tant que celui-ci est actif ; sinon décision administrateur | Avant module membres |
| Q08 | Numéro de membre ? | Numéro global attribué au serveur ; référence provisoire UUID hors ligne. Si numéro définitif nécessaire hors ligne, format incluant appareil à valider | Avant contraintes membre |
| Q09 | Modes de paiement ? | Liste à confirmer : espèces, Orange Money, MTN Money, Moov Money, Wave, autre ; préciser référence obligatoire ou facultative | Avant paiement et rapports |
| Q10 | Département désactivé : que faire des nouvelles opérations ? | Bloquer les nouvelles écritures ; conserver les lectures autorisées ; traiter la file déjà saisie selon Q03 | Avant permissions |
| Q11 | Compte responsable désactivé ou remplacé : reprise d'anciennes opérations ? | Aucune importation automatique sous le nouveau compte ; récupération supervisée puis arbitrage | Avant sync |
| Q12 | Historique après transfert d'un membre ? | Chaque responsable voit les paiements de son département ; seul l'administrateur voit le cumul inter-départements et les coordonnées globales | Avant membres/rapports |
| Q13 | Super Administrateur autorisé à saisir un encaissement ? | Le besoin ne le précise pas ; autorisation à confirmer, distincte de la correction | Avant routes paiement |
| Q14 | Rapports exportables par un responsable ? | Départemental et individuel dans son périmètre ; jamais rapport global détaillé | Avant rapports |
| Q15 | Champs corrigeables d'un paiement ? | Montant et mode en V1 ; changement de membre/département par annulation et remplacement liés, jamais déplacement silencieux | Avant révisions |
| Q16 | Montants maximaux et monnaie exacte ? | FCFA ; préciser XOF ou XAF et limite opérationnelle par versement. Capacité technique BIGINT ≠ plafond métier | Avant validation financière |
| Q17 | Communication du secret initial et délai d'utilisation ? | Affichage unique, remise directe ou canal privé vérifié choisi par l'organisation ; aucun envoi automatisé sans instruction | Avant création de comptes |
| Q18 | Plusieurs appareils et appareil partagé ? | Une seule session active par compte, demandée le 14 novembre ; une nouvelle connexion révoque la précédente. Politique d'effacement et partage physique toujours à préciser | Simultanéité tranchée ; effacement privé avant offline |
| Q19 | Comment reconnaître une même personne saisie deux fois ? | Numéro membre existant et recherche de rapprochements ; ne pas imposer l'unicité du nom ou du téléphone sans validation | Avant gestion des doublons membres |

## Paramètres d'exploitation à préciser sans bloquer l'initialisation

- Nombre de départements, membres, responsables, appareils et encaissements attendus ; historique nécessaire hors ligne.
- Fuseau métier : Africa/Abidjan proposé d'après le poste, à confirmer pour l'organisation.
- Hébergeur, domaine HTTPS, accès réseau, sauvegardes, rétention et objectifs de restauration.
- Confidentialité sur appareils personnels, consentements et durées de conservation des coordonnées/audits.
- Seuil de notification « connexion inhabituelle » : nouveau dispositif et événement pertinent plutôt qu'une géolocalisation non fiable.
- Responsable de l'exploitation, comptes de secours et procédure de récupération du dernier Super Administrateur.

## Journal de validation

| Date | Événement | Conséquence |
|---|---|---|
| 2026-11-12 | Analyse initiale, aucun code existant | Création du dossier documentaire uniquement |
| 2026-11-12 | Architecture proposée | Approbation de phase 1 attendue avant phase 2 |
| 2026-11-12 | Réponse utilisateur « ok continue » | Conception générale validée ; phase 2 autorisée. Questions métier Q01 à Q19 toujours à confirmer individuellement |
| 2026-11-12 | Nouvelle réponse « ok continue », puis « continue » | Phase 3 poursuivie ; pas de nouvelle règle métier présumée |
| 2026-11-13 | Demande « fait de la phase 4 à la phase 9 » avec le cahier joint | Développement des six modules et interfaces correspondantes autorisé ; aucune publication ni décision métier manquante supposée |
| 2026-11-13 | Question groupée sur les règles métier envoyée pendant le développement | Sans réponse explicite à ce stade ; dates/calendrier et validité des accès saisis par l'opérateur, permissions non confirmées conservatrices |
| 2026-11-13 | Nouvelle demande « continue » | Phase 10 notifications/audit poursuivie ; Q01 à Q19 ne sont pas considérées approuvées par cette seule instruction |
| 2026-11-13 | Demande de pousser vers github.com/Coulabraham/SUIVI | Publication du code et de la documentation autorisée sur ce dépôt public ; configuration secrète, données locales et résultats temporaires exclus |
| 2026-11-13 | Nouvelle réponse « ok continue » après publication de la phase 10 | Partie installable et fondations du stockage de phase 11 poursuivies ; question précise sur Q02 présentée, durée toujours non confirmée |
| 2026-11-14 | Nouvelle instruction « continue » | Qualification reprise, anomalies de nom d'appareil et de cycle de mise à jour corrigées ; aucune réponse à Q02 présumée |
| 2026-11-14 | Modèle visuel responsive bleu fourni par l'utilisateur | Refonte des écrans existants autorisée, avec identité locale SVG, navigation adaptée et données réelles ; aucune règle financière ou d'autorisation hors ligne modifiée |
| 2026-11-15 | Demande explicite de continuer, pousser sur GitHub et lancer | Publication de la refonte et démarrage local autorisés ; l'échec PWA à deux onglets desktop reste consigné et n'est pas déclaré résolu |
