# CAHIER DES CHARGES FONCTIONNEL ET TECHNIQUE
# PROJET SUIVI

**Application de gestion des cotisations et des encaissements hebdomadaires**

Version : 2.0  
Type de projet : Application Web Progressive (PWA)  
Architecture : Full-Stack TypeScript  
Devise : Franc CFA (FCFA)

---

# 1. PRÉSENTATION GÉNÉRALE DU PROJET

## 1.1. Contexte

La gestion des cotisations et des contributions financières d'une organisation répartie en plusieurs départements nécessite un système fiable permettant de centraliser les informations, de suivre les encaissements et de contrôler l'évolution des objectifs financiers.

La gestion manuelle de ces opérations peut entraîner des erreurs de calcul, des pertes d'informations, des difficultés de vérification et un manque de visibilité sur les contributions des différents départements.

Le projet SUIVI consiste à concevoir et développer une application permettant de gérer efficacement les membres, les départements, les responsables et les encaissements financiers.

L'application devra être accessible depuis un ordinateur, une tablette ou un smartphone et fonctionner même lorsque la connexion Internet est indisponible.

## 1.2. Objectif général

Concevoir une application centralisée, sécurisée et évolutive permettant de gérer les contributions financières hebdomadaires d'une organisation, de suivre la progression d'un objectif financier global et de produire des rapports fiables.

## 1.3. Objectifs spécifiques

L'application devra permettre de :

- Organiser les membres en différents départements.
- Attribuer un responsable à chaque département.
- Enregistrer les encaissements hebdomadaires.
- Accepter les versements libres et partiels.
- Calculer automatiquement les contributions individuelles et départementales.
- Définir un objectif financier global.
- Suivre la progression de l'objectif.
- Contrôler les activités des responsables.
- Conserver un historique complet des opérations.
- Générer des rapports PDF, Excel et CSV.
- Fonctionner hors connexion.
- Synchroniser automatiquement les données lorsque la connexion Internet revient.

## 1.4. Résultat attendu

À la fin du projet, l'organisation devra disposer d'une plateforme permettant au Super Administrateur de superviser toutes les opérations financières et aux responsables de gérer leurs départements respectifs, sans compromettre la sécurité ni l'intégrité des données.

---

# 2. PÉRIMÈTRE FONCTIONNEL

## 2.1. Utilisateurs concernés

L'application comporte deux catégories d'utilisateurs :

1. Super Administrateur.
2. Responsable de département.

Les membres sont enregistrés dans l'application, mais ne disposent pas nécessairement d'un compte de connexion.

### 2.1.1. Super Administrateur

Le Super Administrateur dispose d'un accès global à l'application.

Il peut :

- Créer, modifier, activer et désactiver les départements.
- Créer les comptes des responsables.
- Générer les mots de passe initiaux des responsables.
- Modifier ou réinitialiser les accès des responsables.
- Affecter un responsable à un département.
- Consulter tous les membres.
- Consulter tous les encaissements.
- Définir l'objectif financier global.
- Définir la période de collecte.
- Consulter les statistiques générales.
- Consulter les contributions par département.
- Consulter les notifications importantes.
- Consulter les journaux d'audit.
- Corriger ou annuler un encaissement avec justification et traçabilité.
- Archiver ou réactiver un membre.
- Exporter les rapports.
- Consulter l'état de synchronisation des appareils.

### 2.1.2. Responsable de département

Chaque responsable est rattaché à un seul département.

Il dispose uniquement des autorisations correspondant à son département.

Il peut :

- Se connecter à son espace personnel.
- Modifier son propre mot de passe.
- Consulter le tableau de bord de son département.
- Ajouter des membres.
- Modifier les informations des membres.
- Archiver des membres.
- Réactiver les membres selon les autorisations définies.
- Enregistrer les encaissements.
- Consulter les historiques de paiement.
- Consulter le cumul des contributions de chaque membre.
- Consulter les statistiques départementales.
- Consulter la progression de l'objectif global en lecture seule.
- Travailler hors connexion.
- Consulter l'état de synchronisation de ses opérations.

Il ne peut pas :

- Créer ou supprimer un département.
- Créer un responsable.
- Modifier l'objectif financier global.
- Consulter les informations détaillées des autres départements.
- Modifier les encaissements d'un autre département.
- Consulter les journaux d'audit globaux.
- Modifier les autorisations de son compte.

## 2.2. Règles d'affectation

- Un membre appartient obligatoirement à un seul département à la fois.
- Un responsable est affecté à un seul département dans la première version.
- Un département possède un responsable actif dans la première version.
- Un membre ne peut pas être inscrit simultanément dans plusieurs départements.
- Tout changement de département doit être autorisé par le Super Administrateur et enregistré dans le journal d'audit.
- La désactivation d'un département ne doit pas supprimer son historique financier.

---

# 3. GESTION DES DÉPARTEMENTS

Le Super Administrateur est chargé de la création et de la gestion des départements.

## 3.1. Informations d'un département

Chaque département possède :

- Identifiant unique.
- Nom.
- Description.
- Date de création.
- Responsable affecté.
- Statut : actif ou inactif.
- Nombre de membres actifs.
- Total des contributions.
- Date de dernière activité.

## 3.2. Fonctionnalités

Le Super Administrateur peut :

- Ajouter un département.
- Modifier ses informations.
- Affecter un responsable.
- Remplacer un responsable.
- Désactiver un département.
- Réactiver un département.
- Consulter les statistiques du département.

Un département désactivé conserve ses membres, ses transactions et ses rapports historiques.

---

# 4. GESTION DES RESPONSABLES

## 4.1. Création d'un responsable

Lorsqu'un département est créé ou lorsqu'un responsable doit être affecté, le Super Administrateur peut créer son compte.

Informations nécessaires :

- Identifiant utilisateur.
- Nom.
- Prénom.
- Contact.
- Département affecté.
- Statut du compte.
- Date de création.

L'identifiant de connexion sera unique.

## 4.2. Mot de passe initial

Le système génère automatiquement un mot de passe initial aléatoire et suffisamment robuste.

Ce mot de passe est communiqué au responsable par le Super Administrateur.

Règles :

1. Le mot de passe initial sert de premier mot de passe de connexion.
2. Il ne constitue pas un second facteur d'authentification.
3. Le responsable doit obligatoirement le modifier à sa première connexion.
4. Le responsable peut ensuite changer son mot de passe depuis son profil.
5. Le Super Administrateur peut déclencher une réinitialisation.
6. Les mots de passe sont stockés uniquement sous forme de hash sécurisé.
7. Les mots de passe en clair ne sont jamais conservés dans la base de données.

## 4.3. Gestion des accès

Le Super Administrateur peut :

- Activer un compte.
- Désactiver un compte.
- Réactiver un compte.
- Réinitialiser le mot de passe.
- Modifier l'affectation départementale.
- Consulter la dernière connexion.

Une désactivation empêche toute nouvelle authentification et doit révoquer les sessions actives lorsque le serveur est disponible.

---

# 5. GESTION DES MEMBRES

## 5.1. Informations d'un membre

Chaque membre possède les informations suivantes :

| Champ | Description |
|---|---|
| ID | Identifiant unique |
| Nom | Nom du membre |
| Prénom | Prénom du membre |
| Contact | Numéro de téléphone |
| Quartier | Lieu de résidence |
| Département | Département d'appartenance |
| Date d'inscription | Date d'enregistrement |
| Statut | Actif ou archivé |
| Total versé | Calcul automatique |

Le total versé ne doit jamais être saisi manuellement.

Il est calculé à partir des encaissements validés du membre.

## 5.2. Fonctionnalités

Le responsable peut :

- Ajouter un membre.
- Modifier ses informations.
- Consulter sa fiche.
- Rechercher un membre.
- Filtrer les membres.
- Consulter son historique financier.
- Archiver un membre.

## 5.3. Archivage

L'archivage ne supprime pas le membre de la base de données.

Il permet de :

- Le retirer des listes de membres actifs.
- Empêcher les nouveaux encaissements tant qu'il est archivé.
- Conserver ses anciens paiements.
- Conserver ses rapports historiques.
- Réactiver son compte si nécessaire.

L'archivage doit être enregistré dans le journal d'audit.

---

# 6. GESTION DES ENCAISSEMENTS

Ce module constitue le cœur financier de l'application.

## 6.1. Principe de fonctionnement

La collecte est organisée chaque dimanche.

Les membres sont libres de verser le montant qu'ils souhaitent.

L'application accepte les contributions :

- Faibles.
- Élevées.
- Partiellement versées.
- Complètes.
- Supérieures à une contribution habituelle.

Aucun montant fixe obligatoire ne doit être imposé aux membres.

## 6.2. Informations d'un encaissement

Chaque transaction doit contenir :

- Identifiant UUID.
- Membre concerné.
- Département concerné.
- Responsable ayant enregistré le paiement.
- Montant en FCFA.
- Date et heure d'enregistrement.
- Semaine de collecte concernée.
- Mode de paiement éventuel.
- Statut de validation.
- Statut de synchronisation.
- Référence de l'appareil ayant enregistré l'opération.

## 6.3. Règles financières

- Un montant doit être strictement positif.
- Les montants sont enregistrés sous forme d'entiers FCFA.
- Chaque encaissement est une transaction indépendante.
- Le cumul individuel est calculé automatiquement.
- Le total départemental est calculé automatiquement.
- Le total général correspond à la somme des paiements validés de tous les départements.
- Les encaissements ne sont pas bloqués lorsque l'objectif global est atteint.
- Le dépassement de l'objectif doit être affiché.

## 6.4. Correction et annulation

Une transaction financière ne doit jamais être supprimée silencieusement.

En cas d'erreur :

- Une correction doit être autorisée.
- Une justification doit être obligatoire.
- L'ancienne valeur doit être conservée.
- La nouvelle valeur doit être enregistrée.
- L'identité de l'auteur doit être conservée.
- La date et l'heure doivent être enregistrées.

Pour les opérations sensibles, privilégier un système de révisions ou de transactions compensatoires afin de conserver une piste financière complète.

---

# 7. GESTION DE L'OBJECTIF FINANCIER GLOBAL

## 7.1. Définition

Le Super Administrateur définit un objectif financier global pour l'ensemble de l'organisation.

L'objectif n'est pas multiplié par le nombre de départements.

Exemple :

- Objectif global : 10 000 000 FCFA.
- Nombre de départements : 5.
- Objectif global à atteindre : 10 000 000 FCFA, et non 50 000 000 FCFA.

## 7.2. Paramètres de l'objectif

L'objectif comprend :

- Montant cible.
- Date de début.
- Date de fin.
- Durée de la campagne.
- Date de création.
- Auteur de la création.
- Statut : à venir, actif, clôturé ou suspendu.

La durée initialement envisagée est de 12 mois.

Les semaines de collecte doivent être générées à partir des dates réelles de début et de fin, et non supposées être exactement 52 semaines.

## 7.3. Calculs automatiques

**Total encaissé :**

Somme de tous les encaissements validés, tous départements confondus.

**Reste à atteindre :**

Reste = max(0, Objectif global - Total encaissé).

**Progression :**

Progression = (Total encaissé / Objectif global) × 100.

L'application doit également afficher le dépassement éventuel de l'objectif.

Le taux de progression peut dépasser 100 %.

## 7.4. Gestion de la clôture

À la date de fin de campagne, le système doit signaler la clôture.

Le Super Administrateur peut consulter les résultats historiques et décider d'une prolongation ou de la création d'une nouvelle campagne.

Les anciennes campagnes ne doivent jamais être effacées.

---

# 8. TABLEAUX DE BORD

## 8.1. Tableau de bord Super Administrateur

Le tableau de bord général présente :

- Nombre total de départements.
- Nombre de responsables actifs.
- Nombre de membres actifs.
- Nombre de membres archivés.
- Objectif financier global.
- Total encaissé.
- Reste à atteindre.
- Pourcentage de progression.
- Total encaissé par département.
- Historique des derniers encaissements.
- Notifications importantes.
- Alertes de synchronisation.
- État général de l'application.

Des graphiques doivent permettre de visualiser :

- L'évolution des encaissements.
- Les contributions par département.
- La progression de l'objectif.
- Les performances par semaine.

## 8.2. Tableau de bord Responsable

Le responsable visualise :

- Nombre de membres actifs.
- Total des contributions de son département.
- Historique des encaissements.
- Contributions individuelles.
- Encaissements de la semaine.
- Opérations en attente de synchronisation.
- Progression globale de l'objectif.

Les données globales sont accessibles uniquement en lecture seule et ne doivent pas exposer les informations confidentielles des autres départements.

---

# 9. NOTIFICATIONS

Le système doit gérer des notifications internes pour informer les utilisateurs des événements importants.

## 9.1. Événements concernés

Le Super Administrateur peut recevoir une notification lors de :

- Nouvel encaissement.
- Correction d'un encaissement.
- Annulation d'un encaissement.
- Ajout d'un membre.
- Archivage d'un membre.
- Modification d'informations sensibles.
- Changement de responsable.
- Connexion inhabituelle.
- Échec de synchronisation.

Les consultations ordinaires ne génèrent pas de notifications.

## 9.2. Types de notifications

- Information.
- Avertissement.
- Erreur.
- Alerte de sécurité.

Les notifications doivent être conservées et consultables dans un espace dédié.

Les notifications cross-device et Web Push nécessitent une connexion au serveur. Les événements produits hors ligne sont remontés après synchronisation.

---

# 10. JOURNAL D'AUDIT

Le journal d'audit assure la traçabilité des opérations sensibles.

Chaque événement doit enregistrer :

- Utilisateur.
- Rôle.
- Département.
- Type d'action.
- Entité concernée.
- Identifiant de l'entité.
- Anciennes valeurs pertinentes.
- Nouvelles valeurs pertinentes.
- Date et heure.
- Résultat de l'opération.
- Appareil ou session, lorsque disponible.

Le journal doit être protégé contre les modifications et suppressions par les responsables.

Le Super Administrateur dispose d'un accès en consultation à l'ensemble des journaux.

---

# 11. FONCTIONNEMENT HORS CONNEXION — PWA

Le fonctionnement hors connexion est une exigence majeure de SUIVI.

## 11.1. Objectif

L'application doit permettre aux responsables de poursuivre leur travail lorsque la connexion Internet est indisponible.

## 11.2. Technologies

- React.
- TypeScript.
- Service Worker.
- vite-plugin-pwa.
- Workbox.
- IndexedDB.
- Dexie.js.
- API REST NestJS.

## 11.3. Fonctionnalités hors ligne

Le responsable doit pouvoir :

- Consulter les données déjà synchronisées.
- Consulter les membres de son département.
- Ajouter un membre.
- Modifier les informations d'un membre.
- Archiver un membre.
- Enregistrer un encaissement.
- Consulter les historiques locaux.
- Consulter les opérations en attente.

Les données globales ne peuvent être actualisées qu'après synchronisation.

## 11.4. Synchronisation

Chaque appareil possède une file d'attente locale d'opérations.

Lors du retour de la connexion :

1. Vérifier la disponibilité du serveur.
2. Identifier les opérations en attente.
3. Envoyer les opérations à l'API.
4. Vérifier leur validité.
5. Traiter les opérations.
6. Confirmer leur réception.
7. Actualiser les données locales.
8. Marquer les opérations comme synchronisées.

Les états possibles sont :

- En attente.
- En cours.
- Synchronisée.
- En conflit.
- En échec.

## 11.5. Prévention des doublons

Chaque opération hors ligne doit posséder un identifiant UUID stable et une clé d'idempotence.

Une même opération envoyée plusieurs fois ne doit être traitée qu'une seule fois.

## 11.6. Gestion des conflits

Les opérations financières ne doivent jamais utiliser une simple règle de dernière modification gagnante.

Les corrections financières doivent être contrôlées et auditées.

Pour les données des membres, utiliser un mécanisme de versionnement et signaler les conflits nécessitant une résolution.

## 11.7. Limites du mode hors ligne

- La création initiale d'un compte nécessite Internet.
- Une nouvelle authentification nécessite une connexion.
- Les données non synchronisées ne sont pas immédiatement visibles par le Super Administrateur.
- Les notifications distantes nécessitent Internet.
- La désactivation d'un compte ne peut pas être connue immédiatement par un appareil déconnecté.

Pour limiter les risques, l'application doit gérer les sessions hors ligne, leur durée de validité et la révocation dès le retour en ligne.

Les données locales sensibles doivent être minimisées et protégées.

---

# 12. RAPPORTS ET EXPORTATIONS

Le système doit permettre de générer plusieurs types de rapports.

## 12.1. Rapport global

Contenu :

- Nom de la campagne.
- Objectif financier.
- Total encaissé.
- Reste à atteindre.
- Progression.
- Résultats par département.
- Nombre de membres actifs.
- Historique des opérations.

## 12.2. Rapport départemental

Contenu :

- Nom du département.
- Responsable.
- Liste des membres.
- Contributions individuelles.
- Total départemental.
- Historique des encaissements.

## 12.3. Rapport individuel

Contenu :

- Nom et prénom.
- Contact.
- Quartier.
- Département.
- Date d'inscription.
- Historique des contributions.
- Total versé.
- Nombre de semaines avec versement.

## 12.4. Formats

Les rapports doivent être exportables en :

- PDF.
- Excel (.xlsx).
- CSV.

Les rapports doivent indiquer la date de génération et, lorsque nécessaire, la date de dernière synchronisation des données.

---

# 13. ARCHITECTURE TECHNIQUE

## 13.1. Stack technologique officielle

### Frontend

- React.
- TypeScript.
- Vite.
- Tailwind CSS.
- React Router.
- Zustand.
- TanStack Query.
- React Hook Form.
- Zod.
- Recharts.
- Axios.
- Dexie.js.
- vite-plugin-pwa.
- Workbox.

### Backend

- Node.js.
- NestJS.
- TypeScript.
- API REST.
- Passport.
- JWT.
- class-validator.
- Prisma ORM.
- Swagger / OpenAPI.

### Base de données

- PostgreSQL.

### Services complémentaires

- PDFKit ou pdfmake pour les PDF.
- ExcelJS pour les fichiers Excel.
- Socket.IO pour les communications temps réel si nécessaire.
- Jest et Supertest pour les tests backend.
- Vitest et React Testing Library pour les tests frontend.
- Playwright pour les tests de bout en bout.

## 13.2. Architecture générale

L'application est organisée en quatre couches principales :

1. Frontend React : interface et interactions.
2. Stockage local : fonctionnement hors ligne.
3. Backend NestJS : logique métier, sécurité et API.
4. PostgreSQL : stockage central des données.

Le frontend ne doit jamais accéder directement à PostgreSQL.

Toutes les opérations sensibles passent par l'API NestJS.

## 13.3. Organisation du frontend

```text
frontend/
├── public/
├── src/
│   ├── app/
│   │   ├── router.tsx
│   │   ├── providers.tsx
│   │   └── guards/
│   ├── components/
│   │   ├── common/
│   │   ├── forms/
│   │   ├── tables/
│   │   ├── charts/
│   │   └── layout/
│   ├── features/
│   │   ├── authentication/
│   │   ├── dashboard/
│   │   ├── departments/
│   │   ├── managers/
│   │   ├── members/
│   │   ├── payments/
│   │   ├── objectives/
│   │   ├── reports/
│   │   ├── notifications/
│   │   ├── audit/
│   │   └── synchronization/
│   ├── services/
│   │   ├── api/
│   │   ├── offline/
│   │   └── exports/
│   ├── stores/
│   ├── hooks/
│   ├── types/
│   ├── utils/
│   ├── styles/
│   └── main.tsx
├── package.json
└── vite.config.ts
```

## 13.4. Organisation du backend

```text
backend/
├── src/
│   ├── auth/
│   ├── users/
│   ├── departments/
│   ├── members/
│   ├── payments/
│   ├── objectives/
│   ├── collection-weeks/
│   ├── notifications/
│   ├── audit/
│   ├── synchronization/
│   ├── reports/
│   ├── devices/
│   ├── database/
│   ├── common/
│   ├── config/
│   ├── app.module.ts
│   └── main.ts
│
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
│
├── test/
├── package.json
└── tsconfig.json
```

---

# 14. CONCEPTION DE LA BASE DE DONNÉES

La base de données PostgreSQL doit garantir l'intégrité des données financières et organisationnelles.

## 14.1. Tables principales

### users

Gestion des comptes utilisateurs.

Champs principaux :

- id.
- username.
- first_name.
- last_name.
- phone.
- password_hash.
- role.
- department_id.
- must_change_password.
- is_active.
- created_at.
- updated_at.

### departments

- id.
- name.
- description.
- status.
- created_at.
- updated_at.

### members

- id.
- member_number.
- first_name.
- last_name.
- phone.
- neighborhood.
- department_id.
- registration_date.
- status.
- version.
- created_at.
- updated_at.

### objectives

- id.
- name.
- target_amount.
- start_date.
- end_date.
- status.
- created_by.
- created_at.

### collection_weeks

- id.
- objective_id.
- week_number.
- start_date.
- collection_date.
- end_date.
- status.

### payments

- id.
- member_id.
- department_id.
- collected_by.
- amount.
- payment_date.
- collection_week_id.
- payment_method.
- status.
- idempotency_key.
- device_id.
- created_at.

### payment_revisions

- id.
- payment_id.
- previous_amount.
- new_amount.
- reason.
- modified_by.
- created_at.

### payment_adjustments

- id.
- payment_id.
- adjustment_type.
- amount.
- reason.
- authorized_by.
- created_at.

### devices

- id.
- user_id.
- device_identifier.
- device_name.
- last_sync_at.
- status.
- created_at.

### sync_operations

- id.
- operation_uuid.
- device_id.
- user_id.
- operation_type.
- entity_type.
- entity_id.
- payload.
- status.
- created_at.
- processed_at.

### notifications

- id.
- user_id.
- type.
- title.
- message.
- is_read.
- created_at.

### audit_logs

- id.
- user_id.
- department_id.
- action.
- entity_type.
- entity_id.
- old_values.
- new_values.
- result.
- device_id.
- created_at.

## 14.2. Relations

- Un département possède plusieurs membres.
- Un département possède un responsable actif en V1.
- Un responsable appartient à un seul département.
- Un membre appartient à un seul département.
- Un membre peut posséder plusieurs paiements.
- Un paiement appartient à un membre et à un département.
- Un responsable peut enregistrer plusieurs paiements.
- Un objectif possède plusieurs semaines de collecte.
- Un paiement peut avoir plusieurs révisions.
- Un utilisateur peut posséder plusieurs appareils.
- Un appareil peut produire plusieurs opérations de synchronisation.
- Un utilisateur peut produire plusieurs événements d'audit.

## 14.3. Contraintes

- Utiliser UUID pour les identifiants techniques.
- Utiliser des montants entiers pour les FCFA.
- Interdire les montants négatifs.
- Garantir l'unicité des identifiants de connexion.
- Garantir l'affectation unique d'un membre.
- Garantir l'affectation unique d'un responsable en V1.
- Interdire la suppression physique des transactions financières validées.
- Utiliser des transactions SQL pour les opérations financières.
- Préserver les historiques après archivage.

Les totaux doivent être calculés à partir des transactions validées, et non conservés comme des valeurs indépendantes susceptibles de devenir incohérentes.

---

# 15. API REST

L'API doit être versionnée.

Préfixe proposé :

`/api/v1/`

## 15.1. Authentification

- POST /auth/login
- POST /auth/logout
- POST /auth/refresh
- POST /auth/change-password
- POST /auth/forgot-password ou mécanisme de réinitialisation administré
- GET /auth/profile

## 15.2. Départements

- GET /departments
- POST /departments
- GET /departments/:id
- PATCH /departments/:id
- PATCH /departments/:id/status

## 15.3. Responsables

- GET /managers
- POST /managers
- GET /managers/:id
- PATCH /managers/:id
- POST /managers/:id/reset-password

## 15.4. Membres

- GET /members
- POST /members
- GET /members/:id
- PATCH /members/:id
- PATCH /members/:id/archive
- PATCH /members/:id/reactivate

## 15.5. Encaissements

- GET /payments
- POST /payments
- GET /payments/:id
- POST /payments/:id/revisions
- POST /payments/:id/cancellations

## 15.6. Objectifs

- GET /objectives
- POST /objectives
- PATCH /objectives/:id
- GET /objectives/:id/progress

## 15.7. Synchronisation

- POST /sync/push
- GET /sync/pull
- GET /sync/status
- POST /sync/acknowledgement

## 15.8. Rapports

- GET /reports/global
- GET /reports/departments/:id
- GET /reports/members/:id
- GET /reports/export/pdf
- GET /reports/export/excel
- GET /reports/export/csv

Les autorisations doivent être contrôlées sur chaque endpoint.

Les responsables ne doivent jamais pouvoir accéder aux données d'un autre département en modifiant simplement un identifiant dans une requête.

---

# 16. SÉCURITÉ

L'application doit appliquer les bonnes pratiques suivantes :

- Hashage des mots de passe avec Argon2id ou bcrypt correctement configuré.
- Authentification sécurisée.
- Gestion des sessions et des jetons d'accès.
- Protection contre les accès non autorisés.
- Validation des données côté frontend et backend.
- Protection contre les injections SQL.
- Protection contre les attaques XSS et CSRF selon le mécanisme d'authentification retenu.
- HTTPS obligatoire en production.
- Gestion des tentatives de connexion.
- Journalisation des opérations sensibles.
- Sauvegardes régulières de PostgreSQL.
- Gestion des permissions par rôle et département.
- Protection des données locales.
- Révocation des sessions après désactivation d'un compte.

Les contrôles de sécurité ne doivent jamais dépendre uniquement de l'interface React.

---

# 17. EXIGENCES NON FONCTIONNELLES

## 17.1. Ergonomie

- Interface moderne et professionnelle.
- Navigation simple.
- Design responsive.
- Adaptation aux smartphones, tablettes et ordinateurs.
- Formulaires faciles à utiliser.
- Tableaux filtrables et recherchables.
- Retours visuels sur les opérations.

## 17.2. Performance

- Chargement rapide des pages.
- Pagination des grandes listes.
- Requêtes optimisées.
- Indexation des champs fréquemment recherchés.
- Calculs financiers fiables.
- Synchronisation par lots.

## 17.3. Disponibilité

- Installation comme application sur les appareils compatibles.
- Utilisation hors connexion.
- Synchronisation après reconnexion.
- Conservation des données locales en cas de fermeture de l'application.

## 17.4. Maintenabilité

- Code TypeScript strict.
- Architecture modulaire.
- Séparation des responsabilités.
- Documentation des API.
- Tests automatisés.
- Gestion des erreurs centralisée.
- Versionnement Git.
- Migrations de base de données.

---

# 18. TESTS ET VALIDATION

Les tests suivants sont obligatoires avant la mise en production.

## 18.1. Tests fonctionnels

- Création d'un département.
- Création d'un responsable.
- Connexion avec mot de passe initial.
- Changement obligatoire du mot de passe.
- Changement du mot de passe depuis le profil.
- Création d'un membre.
- Modification d'un membre.
- Archivage d'un membre.
- Réactivation d'un membre.
- Enregistrement d'un encaissement.
- Consultation de l'historique.
- Génération des rapports.

## 18.2. Tests de sécurité

- Un responsable ne peut pas accéder au département d'un autre responsable.
- Un responsable ne peut pas modifier l'objectif global.
- Un responsable ne peut pas créer un autre responsable.
- Un membre ne peut pas être affecté à plusieurs départements.
- Un compte désactivé ne peut plus se connecter.
- Les mots de passe ne sont jamais stockés en clair.

## 18.3. Tests financiers

- Enregistrer un paiement de 10 000 FCFA.
- Enregistrer plusieurs paiements pour un même membre.
- Vérifier le cumul individuel.
- Vérifier le total départemental.
- Vérifier le total global.
- Vérifier le calcul du reste à atteindre.
- Vérifier le dépassement de l'objectif.
- Vérifier une correction de paiement.
- Vérifier une annulation avec audit.

## 18.4. Tests hors ligne

- Enregistrer un paiement sans Internet.
- Fermer puis rouvrir l'application.
- Vérifier la conservation de l'opération.
- Rétablir Internet.
- Vérifier la synchronisation.
- Envoyer deux fois la même opération.
- Vérifier l'absence de doublon.
- Simuler un conflit.
- Vérifier son traitement.

---

# 19. PLAN DE DÉVELOPPEMENT

Le développement sera effectué par phases.

| Phase | Travail à réaliser |
|---|---|
| 1 | Initialisation du monorepo |
| 2 | Configuration PostgreSQL et Prisma |
| 3 | Modélisation de la base de données |
| 4 | Authentification et permissions |
| 5 | Gestion des départements |
| 6 | Gestion des responsables |
| 7 | Gestion des membres |
| 8 | Gestion des encaissements |
| 9 | Objectifs et tableaux de bord |
| 10 | Notifications et audit |
| 11 | PWA et stockage hors ligne |
| 12 | Synchronisation multi-appareils |
| 13 | Rapports et exports |
| 14 | Tests, sécurité et déploiement |

Chaque phase doit être testée et validée avant de passer à la suivante.

---

# 20. LIVRABLES ATTENDUS

À la fin du projet, les livrables comprendront :

1. Code source complet du frontend React.
2. Code source complet du backend NestJS.
3. Base de données PostgreSQL.
4. Schéma Prisma et migrations.
5. API REST documentée.
6. Application PWA installable.
7. Système de synchronisation hors ligne.
8. Documentation technique.
9. Documentation utilisateur.
10. Suite de tests automatisés.
11. Fichier d'exemple de configuration `.env.example`.
12. Procédure de sauvegarde et de restauration.
13. Instructions de déploiement.

---

# 21. CRITÈRES DE RÉUSSITE

Le projet sera considéré comme fonctionnel lorsque :

- Le Super Administrateur pourra gérer l'ensemble de l'organisation.
- Chaque responsable pourra gérer exclusivement son département.
- Les membres seront correctement affectés.
- Les encaissements seront enregistrés et calculés sans erreur.
- Les objectifs financiers seront correctement suivis.
- Les corrections seront traçables.
- Les rapports seront générés correctement.
- La PWA fonctionnera hors connexion.
- Les opérations hors ligne seront synchronisées sans doublons.
- Les données financières seront protégées.
- Les tests de sécurité et de validation seront concluants.

---

# 22. ÉVOLUTIONS FUTURES

Les fonctionnalités suivantes pourront être envisagées après la première version :

- Gestion de plusieurs responsables par département.
- Espace personnel pour les membres.
- Consultation individuelle des contributions.
- Notifications WhatsApp.
- Notifications Web Push avancées.
- Reçus numériques.
- QR Code pour identifier rapidement un membre.
- Gestion avancée des remboursements.
- Application mobile native.
- Statistiques prédictives.
- Historique comparatif entre plusieurs campagnes.

Ces évolutions ne doivent pas retarder la livraison du premier produit fonctionnel.

---

# 23. DÉCISIONS MÉTIER À FINALISER

Certains paramètres nécessitent encore une validation explicite avant leur implémentation définitive :

1. **Identifiant de connexion :** nom d'utilisateur généré automatiquement ou numéro de téléphone ?
2. **Versements multiples :** autoriser plusieurs versements d'un même membre le même dimanche ? Proposition : oui.
3. **Encaissement hors dimanche :** autoriser l'enregistrement un autre jour tout en rattachant le paiement à une semaine de collecte ? Proposition : oui.
4. **Correction des paiements :** autoriser le Super Administrateur à corriger ou annuler directement les paiements ? Proposition : oui, avec justification et audit.
5. **Responsables :** conserver un seul responsable par département dans la première version ? Proposition : oui.
6. **Clôture de campagne :** clôturer automatiquement à la date de fin, avec possibilité de prolongation par le Super Administrateur ? Proposition : oui.
7. **Modes de paiement :** espèces, Orange Money, MTN Money, Moov Money, Wave et autres ? À confirmer.

---

# CONCLUSION

SUIVI est une application de gestion financière centralisée, conçue pour améliorer le suivi des contributions, la transparence des encaissements et le contrôle des opérations.

Son architecture repose sur React et TypeScript pour le frontend, Node.js et NestJS pour le backend, Prisma pour l'accès aux données et PostgreSQL pour le stockage central.

L'approche PWA Offline-first permet aux responsables de poursuivre les opérations même sans connexion Internet, tout en assurant la synchronisation et la traçabilité des données.

Le développement devra respecter les règles métier, les exigences de sécurité et les critères de validation définis dans ce cahier des charges.

**FIN DU CAHIER DES CHARGES — PROJET SUIVI**