# Connexion, premier administrateur et session unique

Date : 14 novembre 2026. Évolution demandée explicitement par l'utilisateur après la première partie de phase 11. **Parcours de connexion et sessions testés** ; résultats finaux et limites de qualification PWA ci-dessous.

## Comportement

- Une visite sans session à la racine ouvre la connexion, avec deux choix : Administrateur et Responsable. La présentation générale reste accessible à /presentation.
- Administrateur : lorsque l'organisation ne possède encore aucun Super Administrateur, le formulaire demande prénom, nom, adresse e-mail, mot de passe et confirmation. Le mot de passe choisi comporte de 12 à 256 caractères. La création ouvre une session ; il ne s'agit pas d'un secret provisoire à changer immédiatement.
- Après initialisation, cet espace propose la connexion. Une désactivation du compte initial ne rouvre jamais l'inscription. Les anciens administrateurs créés par le terminal peuvent toujours utiliser leur identifiant historique ; les nouveaux utilisent leur e-mail.
- Responsable : identifiant et code de connexion remis par l'administrateur. Le code initial reste temporaire et son changement est obligatoire au premier accès. Ensuite, le secret personnel sert à se reconnecter. Aucun compte responsable ne peut être créé depuis la page publique.
- Un changement d'espace démonte le formulaire et efface sa saisie. Les mots de passe et codes ne sont pas conservés dans le stockage du navigateur.
- Les titres utilisent Georgia/Cambria avec une taille et une composition distinctes ; les textes, champs et commandes conservent Segoe UI/system-ui. Ces polices système ne nécessitent aucun téléchargement pour la PWA.

## API et garanties serveur

GET /api/v1/auth/registration-status renvoie uniquement registrationOpen, sans identité, avec Cache-Control: no-store. POST /api/v1/auth/register-admin est public uniquement pour l'initialisation fonctionnelle : il refuse une création dès qu'un administrateur existe, actif ou non. Le même verrou transactionnel PostgreSQL que le bootstrap terminal (726384901) sérialise les initialisations concurrentes ; le contrôle est répété sous verrou. Compte, périmètre GLOBAL, appareil, session et audits sont validés ensemble ou annulés ensemble. Le rôle est fixé par le serveur et ne peut pas être fourni dans le formulaire.

L'e-mail devient l'identifiant unique normalisé du premier administrateur, dans les colonnes existantes (100 caractères maximum). Le serveur valide sa syntaxe ; aucun message n'est envoyé et la possession de la boîte mail n'est pas certifiée par ce formulaire. Les mots de passe sont hachés avec Argon2id et ne figurent ni dans les réponses ni dans l'audit.

POST /auth/login accepte un portail attendu facultatif pour préserver les clients existants. L'interface le fournit toujours et le serveur refuse un compte qui ne correspond pas à l'espace choisi. Le choix d'un bouton ne confère aucun rôle.

Une authentification valide verrouille la ligne utilisateur, révoque ses sessions précédentes puis crée la nouvelle session dans la même transaction. Deux connexions simultanées aboutissent à une seule session non révoquée ; la dernière connexion validée prend la main. Les anciens JWT et refresh sont refusés côté serveur. Une erreur de mot de passe, un mauvais portail ou un formulaire piège rempli ne révoquent pas la session légitime. L'audit PREVIOUS_SESSIONS_REVOKED conserve le motif et le nombre de sessions remplacées, sans supprimer leur historique. Plusieurs onglets du même navigateur peuvent partager la session courante ; aucun identifiant matériel fiable n'est présumé.

Le champ website est absent du parcours clavier et des lecteurs d'écran, masqué visuellement et exclu de l'autocomplétion. Il doit rester vide. Zod et les DTO class-validator le vérifient sur la connexion, l'inscription et le changement de mot de passe ; une requête directe avec un contenu non vide est rejetée. Ce piège complète la limitation existante des tentatives ; il ne bloque pas un robot capable de le reconnaître. La limitation actuelle reste locale au processus et devra être partagée avant une exploitation sur plusieurs instances.

L'initialisation donne le contrôle de l'organisation au premier compte créé : terminer cette étape dans un environnement contrôlé avant d'ouvrir l'instance au public. Le bootstrap terminal documenté reste une autre méthode d'initialisation ; aucune identité réelle n'est créée pendant la recette.

## Fichiers principaux

- [Connexion et inscription React](../frontend/src/features/authentication/LoginPage.tsx), [champ piège](../frontend/src/features/authentication/Honeypot.tsx), [profil](../frontend/src/features/authentication/AuthPages.tsx), [navigation](../frontend/src/app/App.tsx) et [typographie](../frontend/src/styles.css).
- [Contrats partagés](../packages/contracts/src/index.ts), [DTO](../backend/src/auth/auth.dto.ts), [contrôleur](../backend/src/auth/auth.controller.ts), [service transactionnel](../backend/src/auth/auth.service.ts) et [réponses Swagger](../backend/src/common/response.dto.ts).
- [Tests React](../frontend/src/features/authentication/AuthPages.test.tsx), [tests PostgreSQL/API](../backend/database-tests/auth.spec.ts), [initialisation navigateur](../tests/e2e/auth-setup.spec.ts) et [session sur deux contextes](../tests/e2e/auth-session.spec.ts).
- [Configuration Playwright](../playwright.config.ts) et [bases de recette](../backend/scripts/test-database.mjs) : le projet initialisation crée le premier compte par la vraie interface avant les profils desktop/mobile ; les bases sont temporaires.

## Vérifications

```powershell
npm.cmd run check
node backend/scripts/test-database.mjs --e2e
node backend/scripts/test-database.mjs --e2e-only
node backend/scripts/test-database.mjs --e2e-only -- --grep mise
npm.cmd run api:openapi
```

La première passe a détecté des sélecteurs correspondant à l'ancien écran, une option Playwright utilisée à tort dans Testing Library et un nom accessible de champ incluant son texte d'aide. Ils sont corrigés et les suites sont reprises. Une insertion de texte via le pipeline PowerShell a aussi altéré des accents dans les tests ; les fichiers ont été corrigés en UTF-8 avant la qualification finale. Les échecs ne sont pas considérés comme des validations.

La première recette navigateur a réussi la création réelle du premier administrateur et le remplacement d'une session sur deux contextes séparés. Le parcours métier a ensuite rencontré une assertion qui attendait encore le titre « Connexion à SUIVI » après changement de mot de passe, au lieu du nouvel accueil avec choix d'espace. Ce sélecteur est corrigé, puis la recette navigateur entière est reprise sans relancer inutilement les tests PostgreSQL déjà réussis.

Le scénario mobile de mise à jour PWA a également atteint son ancienne limite globale de 30 secondes après rechargement. Son budget passe à 90 secondes pour couvrir deux onglets et plusieurs attentes locales de 20 secondes ; les assertions de résultat, les limites par action et le délai d'activation de l'application ne sont pas relâchés. La reprise vérifie encore la valeur persistée et la saisie de l'autre onglet.

La seconde passe réussit 14 parcours, puis la même mise à jour mobile échoue encore sur son assertion de cinq secondes : augmenter le budget global ne résolvait donc pas la cause. La trace montre le composant de page demandé environ 20 secondes après rechargement, alors que l'autre onglet créé par la recette restait au premier plan. Le scénario replace désormais explicitement l'onglet de confirmation au premier plan et vérifie document.visibilityState avant l'action, comme lors d'un clic utilisateur réel. L'autre onglet reste ouvert, avec sa saisie à préserver. La reprise cible cette mise à jour sur les deux profils, sans recompilation ni nouvelle modification du produit.

Cette première reprise ciblée passe sur desktop, mais l'émulation mobile à deux onglets se bloque ensuite dans la demande de mise à jour, avant toute activation. La mise au premier plan n'a donc pas suffi à qualifier ce scénario ; aucune correction produit n'est prétendue à partir de cette hypothèse. La recette finale qualifie une fenêtre PWA sur mobile et deux onglets sur desktop, avec les mêmes contrôles de confirmation, persistance et absence de rechargement spontané. **La mise à jour avec deux onglets dans l'émulation mobile reste non qualifiée** et exige une investigation distincte ; ce n'est pas présenté comme une réussite ni masqué par une relance automatique.

Le parcours dans une fenêtre mobile réussit ensuite. Sur desktop, une reprise révèle toutefois un bandeau absent après la demande de mise à jour. Le client ajoute donc un observateur natif du worker déjà en attente et de l'état installed lorsque la page possède un contrôleur ; la détection ne repose plus seulement sur le relais des événements du SDK entre onglets. Aucun rechargement automatique n'est ajouté. Deux tests unitaires vérifient le worker déjà en attente et la distinction entre première installation et nouvelle version ; le scénario navigateur contrôle séparément la présence du worker en attente puis celle du bandeau.

Résultats déjà confirmés : npm run check se termine avec le code 0 (lint, format, types stricts, 31 tests frontend, 18 tests backend, builds). Les 83 tests PostgreSQL/API passent sur les cinq migrations existantes ; aucun changement de schéma n'est nécessaire. Le contrat OpenAPI régénéré compte 44 opérations et 46 schémas. Les ajustements finaux de faible largeur et les libellés d'audit français sont recompilés avant le démarrage du navigateur. Bundle initial : 499,42 Ko ; cache PWA limité aux 32 ressources statiques.

L'aperçu local est redémarré sur http://localhost:4173/connexion : connexion et santé PostgreSQL renvoient HTTP 200, les membres sans session HTTP 401. L'initialisation est ouverte pour l'utilisateur (registrationOpen: true) ; aucun compte réel n'est créé par l'agent. Vérification en lecture seule : zéro utilisateur et paiement dans suivi_dev, audit préexistant unique conservé. Le contrôle de publication ne détecte aucun secret dans les 210 fichiers parcourus ; 243 liens locaux sont valides et le cahier des charges reste inchangé.

Après la reprise de l'environnement, PostgreSQL a effectué une récupération normale après interruption. Le premier appel de démarrage a dépassé la limite d'attente de 30 secondes du wrapper ; les journaux ont ensuite confirmé la fin de récupération et l'API a été revérifiée avec HTTP 200. Aucun fichier de données n'a été supprimé et aucune base n'a été réinitialisée.

### Bilan final

**149 tests distincts validés : 18 Jest, 33 Vitest/React Testing Library, 83 PostgreSQL/API et 15 Playwright.** Ce total décrit les cas distincts, pas une exécution unique de l'ensemble. La dernière recette complète a validé 14 parcours ; la reprise finale des sept cas d'initialisation/PWA réussit après ajout de l'observateur natif. Elle conserve les contrôles de worker en attente, confirmation, persistance et absence de rechargement automatique. Aucun test n'est ignoré dans cette reprise. Les mises à jour sont qualifiées dans une fenêtre mobile et deux onglets desktop ; l'émulation mobile à deux onglets reste une limite explicite.

Les 33 tests frontend repassent après le changement du client PWA. Le build final, les types stricts et les contrôles ciblés de lint/format réussissent ; bundle initial 499,62 Ko, worker 17,16 Ko, 32 ressources statiques préchargées. Les rendus de création d'administrateur, de choix d'espace et de connexion responsable ont été inspectés ; le parcours mobile vérifie aussi l'absence de débordement à 320 px. Aucun diagnostic d'éditeur n'est signalé.

Les erreurs intermédiaires restent consignées ci-dessus ; elles ne sont pas annoncées comme des succès. La suite de développement revient à l'autorisation hors ligne et à la synchronisation, après choix de la durée et des règles encore ouvertes. La phase 11 entière et la préparation complète de production ne sont pas déclarées terminées par cette évolution.

## Limites et suite

Cette évolution ne clôt pas la phase 11 entière : données privées hors ligne et synchronisation restent non activées, comme dans le [bilan PWA](PHASE_11.md). Une session révoquée est refusée à sa prochaine requête ; un appareil sans réseau ne peut pas recevoir instantanément une révocation distante. Aucune nouvelle durée d'autorisation hors connexion n'est présumée.
