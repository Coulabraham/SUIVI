# Phase 2 — initialisation de SUIVI

Date : 12 novembre 2026. Autorisation utilisateur : « ok continue », après présentation de la conception.

## Périmètre réalisé

Le monorepo npm workspaces comporte frontend, backend et packages/contracts. Git est initialisé sur main, sans commit ni dépôt distant créé. Le cahier des charges d'origine est inchangé.

Le frontend React/Vite démarre avec un accueil responsive et une page de diagnostic. Les trois indicateurs représentent des états réels : liveness API, connexion PostgreSQL et signal réseau du navigateur. La navigation, le retour d'une route inconnue et le bouton de relance sont fonctionnels. Aucune statistique financière fictive ou connexion utilisateur simulée n'est affichée.

Le backend NestJS expose uniquement les routes techniques publiques prévues : GET /api/v1/health/live et GET /api/v1/health/ready. Il comporte la validation de configuration, une validation HTTP globale, des erreurs structurées et un requestId serveur, des en-têtes de sécurité, une origine CORS configurée et Swagger en développement. Les routes métier protégées viendront en phase 4 ; aucune route métier non protégée n'a été ajoutée.

Prisma utilise une datasource PostgreSQL, une configuration dédiée à la version 7 et une sortie ESM explicite pour le futur client. Le schéma de configuration est valide ; il ne contient encore aucun modèle métier. Migrations, génération du client et seeds restent en phase 3.

## Versions retenues

| Composant | Version |
|---|---|
| Node.js / npm | 26.13.0 / 11.20.0 |
| TypeScript | 6.0.3 |
| React / React DOM | 19.3.1 |
| Vite / plugin React | 8.3.8 / 6.3.0 |
| Tailwind CSS | 4.3.5 |
| React Router | 7.18.5 |
| TanStack Query / Zustand | 5.107.1 / 5.1.0 |
| Axios / Zod | 1.21.1 / 4.6.7 |
| NestJS | 12.5.0 |
| Prisma CLI / client / adaptateur pg | 7.10.1 |
| PostgreSQL / pilote pg | 18.7 / 8.23.1 |
| Jest / ts-jest | 30.5.2 / 29.4.15 |
| Vitest / Playwright | 5.1.0 / 1.65.0 |
| ESLint / typescript-eslint / Prettier | 10.14.0 / 8.72.2 / 3.10.1 |

Le lockfile fixe l'arbre complet. Les dépendances Passport/JWT, React Hook Form, Recharts, Dexie, PWA/Workbox et exports seront ajoutées avec les modules qui les utilisent ; elles ne sont remplacées par aucune autre technologie.

## PostgreSQL local

Le moteur Docker n'étant pas disponible, le mode natif a été utilisé. Archive provenant du [distributeur EDB référencé par PostgreSQL](https://www.postgresql.org/download/windows/) : [postgresql-18.7-1-windows-x64-binaries.zip](https://get.enterprisedb.com/postgresql/postgresql-18.7-1-windows-x64-binaries.zip).

Empreinte SHA-256 calculée localement : ead0bbc27fb678fa24dcf86b738981323042abd073c744103bf7f3aed23f9a33. Il s'agit d'une empreinte de traçabilité locale, pas d'une comparaison annoncée avec une signature d'éditeur.

- Binaires : %LOCALAPPDATA%/SUIVI/postgresql-18.7-1.
- Données propres à ce dossier : %LOCALAPPDATA%/SUIVI/instances/ef90cd0300e8/data.
- Écoute : 127.0.0.1:5433 ; fuseau serveur UTC.
- Base technique : suivi_dev. Aucun tableau métier créé pendant cette phase.
- Rôle de l'API : suivi_app, non superutilisateur, sans droits de création de rôle/base.
- Rôle des futures migrations : suivi_migrator, distinct du rôle d'exécution.
- Rôle d'amorçage : suivi_bootstrap, désactivé pour les nouvelles connexions après provisionnement.
- Secrets générés aléatoirement, configuration locale ignorée par Git ; aucun secret envoyé dans le frontend.

L'arrêt et le redémarrage par le script ont été essayés, suivis d'une nouvelle requête SQL réussie. Aucun service Windows, PATH, WSL ou politique PowerShell n'a été modifié. Le mode Docker est fourni et sa syntaxe Compose validée ; il n'a pas été démarré sur ce poste.

## Contrôles fonctionnels du socle

| Contrôle | Résultat obtenu |
|---|---|
| Build contrats, backend et frontend | Réussi |
| Typage strict sur les trois packages et tests navigateur | Réussi |
| ESLint et formatage Prettier | Réussis |
| Jest/Supertest | 9 tests réussis : configuration, santé HTTP, 503, 404 et erreur interne assainie |
| Vitest/Testing Library | 4 tests réussis : indicateurs, navigation, relance, erreur visible et retour d'une route inconnue |
| Playwright | 4 parcours réussis, Chrome desktop et mobile, API et PostgreSQL réels |
| Schéma/configuration Prisma | Valides |
| Rôle applicatif PostgreSQL | Connexion SQL réussie et superuser=false |
| Compose | Syntaxe valide, moteur non utilisé |
| OpenAPI | [Description générée](api/openapi.json) à partir des deux routes réelles |
| Swagger dans Chrome via le frontend | 2 opérations documentées visibles, aucun pageerror détecté |
| Inspection visuelle | Accueil desktop 1440 px et mobile 390 px ; pas de débordement horizontal détecté |
| Source initiale | Empreinte SHA-256 du cahier inchangée |
| Documentation | 91 liens locaux contrôlés, aucun lien manquant |

Ces tests ne couvrent pas encore l'authentification, les permissions métier, les finances ou la synchronisation, qui ne sont pas implémentées.

## Corrections techniques pendant l'initialisation

1. PowerShell bloque npm.ps1 : utilisation de npm.cmd, sans assouplir la politique.
2. TypeScript latest est en version 7, au-delà des peer dependencies déclarées par les outils choisis : sélection de la version stable 6.0.3.
3. Le dist-tag Prisma latest était une préversion : sélection de Prisma 7.10.1 stable.
4. Premier build CommonJS refusé par les déclarations ESM de NestJS 12 : passage du backend en ESM/NodeNext, imports .js, configuration Jest ESM et futur générateur Prisma aligné.
5. ts-jest avec TypeScript 6 exige un rootDir explicite : ajout d'une racine pour les tests, avec surcharge src pour le build.
6. Premier lancement PostgreSQL bloqué sur les flux hérités du processus serveur sous Windows : démarrage détaché des flux du parent, puis vérification d'un cycle complet arrêt/redémarrage.
7. ESLint a relevé un import inutilisé et la perte de cause des erreurs frontend : correction et nouvelle vérification.

## Sécurité des dépendances et scripts d'installation

npm 11 demande une politique explicite pour les scripts d'installation. Seuls ceux de prisma@7.10.1 et @prisma/engines@7.10.1 sont autorisés et épinglés. Le script de télémétrie @scarf/scarf est refusé. Le script de compilation de secours @parcel/watcher est refusé : le binaire Windows précompilé est installé et le build a été vérifié.

L'audit de production ne signale aucune vulnérabilité connue. L'audit complet initial signalait 29 entrées dans l'outillage de développement, principalement propagées par glob et minimatch. Des overrides ciblés vers glob 14.0.6 et minimatch 11.0.8 sont appliqués uniquement aux plages affectées. L'installation initiale a laissé les anciennes versions de glob dans l'arbre ; `npm update glob` a actualisé le lockfile et l'installation. `npm ls glob minimatch --all` confirme les versions corrigées sans entrée invalide. Aucun audit fix --force ni rétrogradation majeure de Jest n'est appliqué.

L'avis [deepmerge GHSA-gcqx-w48m-w2h4](https://github.com/advisories/GHSA-gcqx-w48m-w2h4) décrit une alerte faible sans version corrigée publiée, présente via la configuration Jest. Elle ne concerne pas une dépendance de production de l'API. Le suivi reste ouvert jusqu'à un correctif amont ou une résolution revue ; aucun prétendu audit global « zéro alerte » n'est annoncé.

Résultat de l'audit complet après correction : **6 signalements faibles, 0 modéré, 0 élevé et 0 critique**. Ces six entrées correspondent à deepmerge et à sa propagation dans les packages Jest/ts-jest, pas à six failles indépendantes. L'audit complet conserve donc son code de sortie 1 ; ce point reste visible. Les tests Jest ont été relancés après la mise à jour effective de glob.

Références des corrections transitives : [glob GHSA-3g3m-2fjr-6pw4](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4), [minimatch GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249).

## Commandes exécutées

Les scripts reproductibles sont détaillés dans le [README racine](../README.md). Principales commandes réellement utilisées :

```powershell
git init -b main
npm.cmd install --no-audit --fetch-timeout=30000 --fetch-retries=2
npm.cmd exec -- tsc --init
node scripts/setup-env.mjs
npm.cmd install-scripts approve prisma @prisma/engines
npm.cmd install-scripts deny @scarf/scarf @parcel/watcher
npm.cmd rebuild prisma @prisma/engines
npm.cmd run db:local:start
npm.cmd run db:check
npm.cmd run db:local:stop
npm.cmd run db:local:start
npm.cmd run prisma:validate
docker compose --env-file .env config --quiet
npm.cmd run format
npm.cmd run lint
npm.cmd run format:check
npm.cmd run typecheck
npm.cmd run build
npm.cmd test
npm.cmd run test --workspace @suivi/backend
npm.cmd exec -- playwright test
npm.cmd run api:openapi
npm.cmd audit --omit=dev --json
npm.cmd audit --json
npm.cmd update glob --no-audit --fetch-timeout=20000 --fetch-retries=1
npm.cmd ls glob minimatch --all
git check-ignore .env
```

Les tâches VS Code « SUIVI: build » et « SUIVI: développement » ont été créées et lancées. Les captures visuelles sont temporaires, hors du dépôt. L'ouverture par l'aperçu intégré a échoué ; les vérifications et captures ont été effectuées directement dans Chrome avec Playwright.

## Suite

La phase 3 porte sur les modèles métier, contraintes SQL, migrations et seeds séparés. Les questions métier du [registre](DECISIONS.md) restent ouvertes ; l'initialisation ne choisit pas silencieusement l'identifiant des responsables, les dates de campagne ou les règles de validation tardive.

Les sources techniques consultées comprennent la [configuration TypeScript](https://www.typescriptlang.org/tsconfig/), les [premiers pas NestJS](https://docs.nestjs.com/first-steps), l'[intégration Tailwind/Vite](https://tailwindcss.com/docs/installation/using-vite) et la [configuration Prisma 7](https://www.prisma.io/docs/orm/v7/prisma-client/setup-and-configuration/introduction). Les compatibilités de versions ont également été lues dans les métadonnées npm installées.
