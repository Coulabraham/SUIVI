# SUIVI

Application de gestion des cotisations et encaissements hebdomadaires en FCFA.

**Interface :** identité bleue inspirée du modèle responsive fourni, connexion avec illustration et vagues, menu latéral sur tablette/ordinateur, navigation basse sur mobile et tableaux de bord avec séries hebdomadaires réelles. Voir le [bilan de la refonte](documentation/REFONTE_INTERFACE.md).

**Première ouverture :** ouvrir /connexion et choisir Administrateur ou Responsable. Si aucun administrateur n'existe, le choix Administrateur permet de créer le premier compte avec prénom, nom, e-mail et mot de passe. Ensuite, l'inscription se ferme et cet espace propose la connexion. Le responsable utilise l'identifiant et le code remis par son administrateur. Une nouvelle connexion révoque la précédente, et les formulaires d'authentification possèdent un champ piège vérifié par le serveur. Voir le [bilan connexion et sessions](documentation/CONNEXION_ET_SESSIONS.md).

**État au 15 novembre : refonte bleue et modules métier en ligne vérifiés ; 161 tests distincts réussis et un scénario PWA en échec.** Départements, responsables, membres, encaissements, objectifs, tableaux de bord, notifications internes et consultation d'audit utilisent PostgreSQL réel. Les parcours métier passent sur ordinateur, mobile et tablette. Voir le [bilan actuel](documentation/REFONTE_INTERFACE.md), les comptes rendus [phases 4 à 9](documentation/PHASES_4_9.md), [phase 10](documentation/PHASE_10.md) et le [guide de prise en main](documentation/user-guide/PREMIERS_PAS.md). Le mode métier hors ligne, la synchronisation et les exports restent aux phases suivantes. Aucun compte réel ou jeu de données de démonstration n'est créé automatiquement.

**Phase 11 en cours :** installation et fondations IndexedDB chiffrées disponibles. Bilan actuel : 18 Jest, 41 Vitest/RTL, 85 PostgreSQL/API et 17 Playwright réussis. Sur les 18 scénarios navigateur, la mise à jour avec deux onglets desktop échoue encore à la détection du worker en attente ; ce scénario reste à corriger. La mise à jour dans une fenêtre mobile passe ; deux onglets dans l'émulation mobile restent non qualifiés. L'accès privé aux membres et encaissements hors connexion reste non activé en attente de la durée d'autorisation. Voir le [périmètre initial](documentation/PHASE_11.md) et le [bilan actuel](documentation/REFONTE_INTERFACE.md).

## Prérequis

- Windows 11 pour le script PostgreSQL natif fourni ; Node.js **26.13.x**, npm **11.x**, Git.
- Chrome installé pour les tests Playwright locaux. Sur un autre poste, adapter le canal navigateur ou installer celui de Playwright.
- PostgreSQL **18.7**, soit via le script natif, soit via Docker Compose avec un moteur opérationnel. Les deux modes utilisent le port local **5433** : choisir un seul mode à la fois.

Le terminal PowerShell de ce poste bloque npm.ps1. Les commandes utilisent donc **npm.cmd**, sans modification de la politique système.

## Installation

```powershell
npm.cmd ci
npm.cmd run setup:env
```

La deuxième commande crée la configuration locale avec des secrets aléatoires. Sur un fichier existant, elle préserve les valeurs et ajoute seulement AUTH_JWT_SECRET si cette clé manque. Les identifiants du rôle applicatif et du rôle de migration sont distincts ; ils ne sont pas des comptes utilisateurs SUIVI. Le fichier réel est ignoré par Git. Ne jamais utiliser les secrets locaux pour la production ni publier ce fichier.

Le modèle des variables est dans [.env.example](.env.example). Le backend lit la configuration depuis la racine du projet ; les commandes npm workspaces fixent son répertoire de travail. Aucune variable VITE_ ne contient de secret.

### PostgreSQL natif sous Windows

```powershell
npm.cmd run db:local:start
npm.cmd run db:check
npm.cmd run db:migrate
```

Le script télécharge l'archive Windows officielle EDB, extrait seulement les binaires, bibliothèques et ressources PostgreSQL puis crée une instance propre à ce projet sous **%LOCALAPPDATA%/SUIVI**, hors OneDrive. Il ne crée pas de service Windows, ne change pas le PATH et ne modifie pas d'autre installation PostgreSQL. Le serveur écoute seulement sur 127.0.0.1. Les données persistent après arrêt.

```powershell
npm.cmd run db:local:status
npm.cmd run db:local:stop
```

Le démarrage ne supprime jamais une base existante. Une réinitialisation de données n'est pas incluse dans le script. En cas de port occupé ou d'amorçage interrompu, consulter l'erreur avant toute action sur les fichiers.

### PostgreSQL avec Docker

Alternative à utiliser lorsque le moteur Docker fonctionne :

```powershell
docker compose up -d db
npm.cmd run db:check
docker compose stop db
```

Le [fichier Compose](docker-compose.yml) est destiné au développement local, avec volume persistant et rôles séparés. Il ne remplace pas une configuration d'exploitation de production. Son initialisation ne s'exécute que sur un volume neuf ; changer les secrets du fichier local ne change pas ceux d'un volume déjà initialisé. Éviter toute commande supprimant le volume pour résoudre un simple problème de connexion.

## Démarrage

```powershell
npm.cmd run dev
```

- Interface : <http://127.0.0.1:5173>.
- Connexion : <http://127.0.0.1:5173/connexion>. Pour créer le premier accès, voir le bootstrap ci-dessous.
- API vivante : <http://127.0.0.1:3000/api/v1/health/live>.
- Connexion PostgreSQL : <http://127.0.0.1:3000/api/v1/health/ready>.
- Swagger en développement : <http://127.0.0.1:3000/api/v1/docs>.

Le frontend transmet les requêtes /api au backend. Un contrôle de disponibilité renvoie HTTP 503 si PostgreSQL n'est pas joignable ; la page diagnostic l'affiche. Le mode « réseau connecté » du navigateur ne garantit pas à lui seul l'accès à l'API.

Le client Prisma est généré automatiquement avant compilation, tests et contrôle de types du backend. Le build frontend force NODE_ENV=production, même si le terminal hérite d'une configuration de développement.

### Aperçu PWA installable

Le service worker est désactivé sur le serveur Vite de développement. Pour tester la version compilée et son installation :

```powershell
npm.cmd run preview:pwa
```

Ouvrir <http://localhost:4173/installation>. Cette commande compile les packages puis démarre une API locale sur 127.0.0.1:3001 et le frontend compilé sur localhost:4173, avec une origine d'authentification correspondante. PostgreSQL doit déjà tourner ; aucun seed ni compte n'est créé. Ctrl+C arrête les deux services de l'aperçu. Les ports occupés provoquent une erreur explicite. La session et IndexedDB sont distincts de ceux du serveur de développement sur 127.0.0.1:5173.

La préparation télécharge uniquement les fichiers statiques de l'application. Une nouvelle version attend une confirmation avant rechargement ; sauvegarder les saisies dans tous les onglets. Les réponses API ne sont jamais mises en cache par le worker. Le [bilan de phase 11](documentation/PHASE_11.md) précise ce qui reste nécessaire avant les opérations métier hors ligne.

La tâche VS Code « SUIVI: aperçu PWA (build existant) » démarre les deux services à partir du dernier build, sans le reconstruire. Les tâches sont définies dans [tasks.json](.vscode/tasks.json).

Le serveur preview sert uniquement à vérifier le build local. Le déploiement de production sera documenté avec HTTPS, reverse proxy, migrations et sauvegardes aux phases suivantes.

## Vérifications

```powershell
npm.cmd run check
npm.cmd run prisma:validate
npm.cmd run db:check
npm.cmd run test:e2e
npm.cmd run test:database
npm.cmd run api:openapi
```

- check : ESLint, Prettier, TypeScript strict, Jest/Supertest, Vitest/Testing Library et builds.
- prisma:validate : configuration et 17 modèles PostgreSQL ; les contraintes SQL complémentaires sont versionnées dans les migrations.
- db:check : vraie requête PostgreSQL et refus d'un rôle applicatif superutilisateur.
- test:e2e : builds, qualification PostgreSQL/API, puis parcours complets Super Administrateur/Responsable dans Chrome desktop/mobile, API dédiée sur 3101 et frontend sur 4174. Une cinquième base temporaire dédiée est créée pour les données navigateur ; les encaissements ne sont pas simulés. Les binaires PostgreSQL Windows doivent être installés, mais l'instance de développement n'a pas besoin de tourner.
- test:database : quatre bases PostgreSQL temporaires distinctes, migrations, bootstrap, démonstration, intégrité/concurrence, parcours HTTP métier et événements/notifications/audit. Aucune écriture de test dans suivi_dev. Les fichiers temporaires sont conservés et l'instance est arrêtée à la fin.
- api:openapi : génération de la description des routes effectivement implémentées dans [openapi.json](documentation/api/openapi.json).

Les tests HTTP couvrent l'authentification, les permissions, les membres, les paiements, les objectifs, les notifications et l'audit ; les comptes rendus [métier](documentation/PHASES_4_9.md) et [phase 10](documentation/PHASE_10.md) précisent les résultats. Les tests PWA de [phase 11](documentation/PHASE_11.md) couvrent le manifest, les icônes, la réouverture sans réseau, IndexedDB et les mises à jour explicites. Les tests d'accès privé hors ligne et de synchronisation restent à réaliser avec leurs modules. Le [compte rendu de phase 3](documentation/database/PHASE_3.md) conserve les preuves SQL initiales.

## Migrations et sauvegarde locale

```powershell
npm.cmd run db:backup
npm.cmd run db:migrate
npm.cmd run db:status
```

La sauvegarde utilise pg_dump custom et est placée hors du projet, sous le profil utilisateur SUIVI/backups. Les migrations ne font aucun reset et préservent l'historique. Ne pas utiliser db push ou migrate reset pour contourner une erreur ; les triggers et contraintes SQL doivent rester versionnés et testés.

## Premier administrateur

Dans l'application, choisir **Administrateur** puis remplir le formulaire proposé : prénom, nom, e-mail, mot de passe et confirmation. Le mot de passe choisi doit contenir au moins 12 caractères. La création ouvre votre espace ; elle est disponible uniquement avant l'initialisation de l'organisation, même si un ancien administrateur a ensuite été désactivé. Terminer cette première création avant de rendre une nouvelle instance accessible au public.

Le formulaire ne crée aucune campagne ni donnée de démonstration. Les responsables sont ensuite créés depuis l'espace administrateur. L'adresse e-mail du nouvel administrateur sert à sa connexion ; aucun e-mail de validation n'est envoyé.

### Autre méthode : bootstrap terminal

Le bootstrap n'est pas exécuté automatiquement. Il reste utilisable pour initialiser le premier compte depuis votre terminal personnel :

```powershell
npm.cmd run auth:bootstrap
```

La commande indique la base ciblée, demande votre identifiant, prénom, nom et la durée de validité choisie, puis une confirmation CREER. Elle génère un secret aléatoire affiché une seule fois, stocke uniquement son hash Argon2id et impose son changement à la connexion. Elle refuse un Super Administrateur existant et ne crée aucune campagne. Aucune saisie de mot de passe n'est inscrite dans l'historique de commandes. Le seed non interactif reste disponible pour l'exploitation supervisée ; voir la [procédure de phase 3](documentation/database/PHASE_3.md).

## Données de démonstration

La commande `npm.cmd run db:seed:demo` est distincte du bootstrap. Elle exige une connexion vers une base dédiée suivi_demo, NODE_ENV différent de production, ALLOW_DEMO_SEED=true et un secret fourni pour l'administrateur de démonstration. Elle refuse suivi_dev et vérifie aussi le nom réel de la base. Les comptes responsables de démonstration utilisent des secrets aléatoires distincts et devront être réinitialisés pour se connecter. Voir la [procédure détaillée](documentation/database/PHASE_3.md).

## Organisation du code

- [frontend](frontend) : React, Router, Tailwind, Query, Axios, Zustand, React Hook Form/Zod, pages métier et Recharts.
- [backend](backend) : NestJS, Passport/JWT, permissions, services métier transactionnels, Swagger, Prisma et PostgreSQL.
- [Contrats](packages/contracts) : types de transport partagés, sans modèle Prisma exposé.
- [Tests navigateur](tests/e2e) : parcours utilisant les services réels.
- [Documentation](documentation/README.md), [avancement](documentation/PROGRESS.md), [décisions](documentation/DECISIONS.md).

Les dépendances des prochains modules seront ajoutées lorsqu'elles seront utilisées, en conservant la stack imposée. Les versions actuelles sont verrouillées par le lockfile ; éviter les mises à jour majeures automatiques avant vérification des compatibilités et des tests.
