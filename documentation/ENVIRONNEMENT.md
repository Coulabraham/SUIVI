# Diagnostic du dossier et de l'environnement

Contrôle en lecture seule le 12 novembre 2026, depuis PowerShell. Ce relevé distingue présence d'un outil, accessibilité d'un service et capacité réellement testée.

## 1. Dossier initial

Racine : C:/Users/Abraham/OneDrive/Documentos/projet/app_gest_conv.

| Élément au début de la mission | Résultat |
|---|---|
| Fichier existant | [cahier_des_charges.md](../cahier_des_charges.md), version 2.0, 35 287 octets |
| Code applicatif ou package.json | Aucun trouvé dans le dossier initial |
| Dépôt Git | Absent ; git status indique « not a git repository » |
| Instructions AGENTS.md | Aucune détectée dans le dossier ni ses répertoires parents |
| Synchronisation du dossier | Emplacement OneDrive ; fichier marqué ReparsePoint |

Empreinte SHA-256 du cahier initial : 361DE5F8DCB684087B6D51816F18386C1B30A92139D87F5F4FC2C0C5AD7D4074. Il est conservé sans modification. Seul le dossier documentaire est ajouté pendant cette phase.

## 2. Logiciels et services

| Élément | Version / résultat observé | Conclusion |
|---|---|---|
| Windows | Windows 11 Professionnel, 10.0.26300, 64 bits | Environnement attendu présent |
| Node.js | 26.13.0 | Exécutable fonctionnel |
| npm.cmd | 11.20.0 | Fonctionne sans changer la politique PowerShell |
| npx.cmd | 11.20.0 | Accessible |
| npm via npm.ps1 | Exécution refusée par PowerShell | Utiliser npm.cmd ; aucune politique modifiée |
| Git | 2.56.0.windows.4 | Installé, dépôt à initialiser en phase 2 |
| VS Code | 1.144.1, x64 | Installé |
| Docker CLI | 29.9.2, build a82e528 | Client installé |
| Docker Compose | v5.6.1 | Client installé |
| Docker Desktop | 4.97.0 | Présent dans les logiciels installés |
| Moteur Docker | Pipe dockerDesktopLinuxEngine introuvable ; service com.docker.service arrêté | Aucun conteneur ni service PostgreSQL lancé |
| WSL | La commande indique que WSL n'est pas installé | Prérequis manquant pour le backend WSL2 habituel de Docker Desktop ; autre backend Windows non évalué |
| PostgreSQL / psql / pg_isready | Pas de commande dans PATH, de service détecté, d'entrée de registre d'installation ou de dossier standard PostgreSQL | Installation locale non détectée ; pas de version vérifiable |
| Port 127.0.0.1:5432 | ECONNREFUSED | Aucun service joignable sur le port PostgreSQL local usuel |
| Corepack | Commande non trouvée | Non requis pour le choix npm workspaces proposé |
| Chrome | 156.0.8078.82 | Disponible pour le rendu documentaire et les tests navigateur futurs |
| Edge | 157.0.4341.46 | Disponible ; certification PWA à effectuer ultérieurement |

Ces recherches ne prouvent pas l'absence d'un PostgreSQL distant ou d'une installation personnalisée ailleurs sur le disque. Aucune connexion à une base n'a été établie et aucune donnée métier n'a été créée.

## 3. Compatibilité et sources consultées

Le [calendrier officiel Node.js](https://github.com/nodejs/Release/blob/main/schedule.json), consulté par HTTPS, indique une entrée en LTS de la famille 26 au 28 octobre 2026 et une fin de support au 30 avril 2029. La famille 24 est également une branche maintenue à la date du diagnostic. Le choix de version précise sera figé avec les dépendances de la phase 2 ; ce calendrier ne remplace pas un test de build de l'application.

Le registre npm a répondu aux consultations suivantes :

| Paquet interrogé | Version retournée par le registre | engines.node déclaré |
|---|---|---|
| vite | 8.3.8 | ^20.19.0 ou >=22.12.0 |
| @nestjs/core | 12.5.0 | >=20 |
| prisma | 8.0.0-rc.33 | ^22.18.0 ou ^24.11.0 ou >=26.0.0 |

**La version Prisma retournée est une préversion.** Elle n'est pas retenue automatiquement. La phase 2 devra sélectionner une version stable, examiner sa configuration et ses dépendances PostgreSQL puis figer un ensemble compatible. Aucune substitution d'ORM ou de base de données n'est proposée. Les autres bibliothèques ne sont pas installées ni certifiées pour l'application à ce stade.

## 4. Commandes de diagnostic

Commandes exécutées, regroupées par objectif :

```powershell
Get-Location
Get-ChildItem -Force
rg --files --hidden -g AGENTS.md -g '!node_modules' -g '!.git' -g '!dist' -g '!build'
git status --short --branch
Get-Content -Raw -Encoding UTF8 cahier_des_charges.md
Get-Command node,npm,npx,git,psql,pg_isready,docker,code,corepack
node --version
npm --version
npm.cmd --version
npx.cmd --version
git --version
code --version
Get-CimInstance Win32_OperatingSystem
Get-Service -Name '*postgres*','*docker*'
Get-ExecutionPolicy -List
docker --version
docker compose version
docker info --format '{{.ServerVersion}}'
wsl --list --verbose
npm.cmd view vite version engines --json
npm.cmd view @nestjs/core version engines --json
npm.cmd view prisma version engines --json
Get-FileHash -Algorithm SHA256 cahier_des_charges.md
```

Des lectures ciblées des répertoires standards, du registre des logiciels installés et des versions de navigateurs complètent le diagnostic. Un test TCP Node.js borné à deux secondes a vérifié le port local 5432. Le calendrier Node a été lu via Invoke-RestMethod. Les commandes sont rapportées ici pour traçabilité ; certaines sont volontairement en échec car elles vérifient une absence ou une indisponibilité.

## 5. Actions à prévoir après validation

1. Choisir le mode PostgreSQL : Docker opérationnel ou PostgreSQL natif. Une éventuelle installation de WSL et son redémarrage Windows seront traités comme une action système explicite à cette étape.
2. Figer Node LTS et les versions stables de la stack, puis créer le lockfile.
3. Initialiser Git, npm workspaces et les applications ; utiliser npm.cmd dans ce terminal tant que la politique reste inchangée.
4. Vérifier les démarrages et la connexion PostgreSQL réelle, sans annoncer de succès à partir de la seule présence des clients CLI.

Aucun changement de politique PowerShell, installation PostgreSQL, activation WSL, démarrage de moteur Docker, initialisation Git ou installation de dépendances applicatives n'a été réalisé pendant l'analyse. Les outils temporaires de rendu Mermaid sont distincts et ne sont pas des dépendances de SUIVI.

## 6. Évolution après validation — phase 2

Le diagnostic ci-dessus conserve l'état initial de la phase 1. Après la réponse « ok continue », Git et le monorepo ont été initialisés, les dépendances installées et PostgreSQL **18.7** mis en service dans un répertoire utilisateur hors OneDrive. Le serveur répond sur **127.0.0.1:5433**, base **suivi_dev**, avec un rôle applicatif **non superutilisateur**. L'arrêt puis le redémarrage ont été testés. Aucun service Windows ou WSL n'a été installé et la politique PowerShell reste inchangée.

Le frontend démarre sur 127.0.0.1:5173 et le backend sur 127.0.0.1:3000. Les versions, commandes, tests et limites de l'état courant sont dans le [compte rendu d'initialisation](INITIALISATION.md).
