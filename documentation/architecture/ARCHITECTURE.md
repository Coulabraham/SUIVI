# Architecture proposée

Statut : proposition technique soumise à validation. Stack exigée conservée.

## 1. Organisation et déploiement

Un monorepo npm workspaces héberge un frontend React/Vite, un backend NestJS et un paquet de contrats. Le dossier actuel est la racine du projet SUIVI ; aucun sous-dossier supplémentaire nommé suivi n'est nécessaire.

Le backend est un monolithe modulaire. Cette organisation permet des transactions financières et un déploiement simples sans ajouter de microservices, de Redis ou de broker. PostgreSQL demeure l'unique base centrale. L'installation PWA ne nécessite pas de serveur local sur les appareils.

En production, un même domaine HTTPS sert les fichiers statiques et transmet /api/v1 à NestJS. Le choix de l'hébergeur et du reverse proxy reste ouvert. En développement, Vite transmet /api à NestJS. Les volumes PostgreSQL ne résident pas dans OneDrive. Docker Compose est prévu pour les services locaux après validation et disponibilité du moteur ; PostgreSQL natif reste possible dans la même stack.

```text
app_gest_conv/
  frontend/
    public/
    src/
      app/                 routeur, providers, gardes d'interface
      components/          formulaires, tableaux, graphiques, layout
      features/            authentication, dashboard, departments, managers,
                           members, payments, objectives, reports,
                           notifications, audit, synchronization
      services/api/        Axios, erreurs, contrats, refresh coordonné
      services/offline/    Dexie, projections, file, migrations locales
      stores/              état d'interface Zustand et identité en mémoire
      hooks/ types/ utils/ styles/
  backend/
    src/
      auth/ users/ departments/ members/ payments/ objectives/
      collection-weeks/ notifications/ audit/ synchronization/
      reports/ devices/ dashboard/
      database/ common/ config/
    prisma/schema.prisma
    prisma/migrations/
    prisma/seed.ts
    test/
  packages/contracts/      types de transport sans dépendance Prisma/Nest
  tests/e2e/               parcours Playwright
  documentation/
  docker-compose.yml
  .env.example
  package.json
  package-lock.json
  README.md
```

Cette arborescence est une cible : seuls les documents existent à la fin de la phase 1.

## 2. Responsabilités frontend

| Technologie | Usage précis |
|---|---|
| React, TypeScript strict, Vite | Interface typée, compilation et découpage par fonctionnalités |
| React Router | Pages, routes selon le rôle, redirection de changement de mot de passe |
| Tailwind CSS | Tokens de couleurs, typographie, espacements et composants accessibles |
| Zustand | État d'interface, filtres persistables non sensibles et session en mémoire |
| TanStack Query | Requêtes serveur, agrégats, invalidation après synchronisation, actions administratives |
| React Hook Form + Zod | Formulaires, messages en français, validation des contrats côté client |
| Axios | Transport REST, bearer en mémoire, cookies et gestion centralisée des erreurs |
| Dexie.js | Données métier locales, projections optimistes et file durable |
| Recharts | Tendances hebdomadaires, contributions et progression à partir de données réelles |
| vite-plugin-pwa + Workbox | Manifest, cache de ressources versionnées et service worker personnalisé |

Pour les membres et les encaissements des responsables, Dexie est la source de lecture de l'interface après bootstrap. Une mutation en ligne utilise le même mécanisme de file qu'une mutation hors ligne. TanStack Query n'entretient pas une deuxième copie modifiable concurrente de ces collections. Les tableaux de bord serveur sont horodatés ; les montants provisoires sont affichés à part.

Les composants communs comprennent bouton avec chargement, champ avec label et erreur, tableau paginé/recherchable, fenêtre de confirmation accessible, alerte, badge de statut et indicateur de synchronisation. Sidebar et barre supérieure s'adaptent au rôle et au mobile. Les erreurs de validation, de permission, de conflit, de quota et de réseau ont des messages distincts.

Les confirmations financières récapitulent le membre, le montant et la semaine. Une correction demande aussi la justification et montre l'effet sur le total. La navigation au clavier, le focus des dialogues, le contraste, les zones tactiles et les alternatives textuelles des graphiques font partie des critères de test.

## 3. Modules backend

| Module | Responsabilité et dépendances |
|---|---|
| Auth | Passport JWT, login, mot de passe initial, refresh, sessions, logout |
| Users | Comptes, statut, rôle et affectation ; les routes /managers sont une façade du même domaine |
| Departments | Cycle de vie, unicité du responsable actif, périmètre départemental |
| Members | Identité, numéro, archivage, version et périodes d'affectation |
| Payments | Validation, idempotence, révisions, ajustements et agrégats |
| Objectives | Campagne globale, cible, dates et clôture |
| CollectionWeeks | Calendrier réel, bornes et rattachement à la campagne |
| Notifications | Notifications internes et destinataires, pas de notification sur lecture |
| Audit | Écriture interne obligatoire, consultation administrateur, redaction des secrets |
| Synchronization | Bootstrap, push par lot, pull incrémental et résolutions autorisées |
| Devices | Enregistrement, révocation, dernière activité, supervision |
| Reports | Projections autorisées ; ExcelJS, PDFKit et CSV |
| Dashboard | Agrégats globaux minimisés et statistiques autorisées |
| Database | PrismaService, unité transactionnelle et accès SQL spécifiques |
| Common / Config | DTO communs, erreurs, gardes, corrélation, configuration validée |

Chaîne de traitement : contrôleur → DTO validé → contexte de sécurité → service métier → repository Prisma. La logique ne réside pas dans les contrôleurs. Les commandes synchronisées réutilisent les mêmes services que les commandes REST ordinaires, avec un contexte transactionnel explicite.

Une mutation sensible écrit dans **la même transaction PostgreSQL** la donnée métier, son audit, les notifications métier, les changements à synchroniser et le reçu idempotent. Une panne à cette étape annule l'ensemble. Les refus de sécurité sont journalisés par un canal séparé sans prétendre que la mutation a réussi.

## 4. Contrats partagés

OpenAPI produit par NestJS est la description normative de l'API. Le paquet contracts expose les DTO de transport générés à partir d'OpenAPI, les codes d'erreur et les énumérations validées. Les DTO Nest utilisent class-validator ; les formulaires utilisent Zod. Un contrôle CI détectera les divergences entre le schéma généré et le code consommateur.

Les types de transport ne dépendent pas de Prisma. Ils représentent les montants comme des chaînes décimales entières, les dates métier en YYYY-MM-DD et les instants en ISO 8601 UTC. Le domaine TypeScript utilise bigint pour les calculs monétaires. On ne convertit jamais un montant en Number pour le sommer. Les ratios destinés à Recharts sont calculés et arrondis séparément ; les libellés monétaires gardent la valeur exacte.

Les versions précises des dépendances seront choisies et verrouillées en phase 2 après examen des moteurs Node, peer dependencies, notes de migration et installation propre. La compatibilité déclarée d'un paquet ne prouve pas son fonctionnement dans l'application.

## 5. Exploitation et qualité

Prévoir des scripts de lint, vérification TypeScript, tests, build, génération OpenAPI et migrations. ESLint et Prettier assurent la cohérence ; le lockfile est versionné. L'intégration continue utilise la même version LTS Node que le développement et PostgreSQL réel pour les tests d'intégration.

Les journaux structurés comportent requestId, code et contexte minimal ; aucun secret, cookie ou payload personnel complet. /health/live et /health/ready distinguent vie du processus et disponibilité de la base, sans exposer les détails d'infrastructure publiquement.

La livraison finale inclura les procédures de sauvegarde chiffrée, restauration testée, migrations sans perte de données, déploiement HTTPS, rotation des clés, mise à jour PWA et retour à une version compatible. Les objectifs RPO/RTO doivent être fixés avec l'organisation.
