# Interface inspirée du modèle fourni

Demande du 14 novembre 2026 ; bilan du 15 novembre : reprendre la présentation responsive bleue de l'image SUIVI fournie dans la conversation. La refonte s'applique à l'application React existante.

## Réalisation

- Identité bleue et blanche, logo vectoriel à barres et flèche, illustration de groupe et vagues sur l'écran d'accès. Ressources SVG locales, sans service de police ou d'image distant.
- Connexion mobile centrée ; à partir de 640 px, présentation en deux colonnes. Choix Administrateur/Responsable, inscription du premier administrateur, champ piège et changement initial obligatoire conservés.
- Affichage/masquage des mots de passe avec bouton accessible. Mémorisation facultative de l'identifiant uniquement, distincte pour chaque espace ; aucune prolongation de session ni sauvegarde du mot de passe.
- Menu latéral bleu à partir de 768 px, barre supérieure avec recherche de membres, notifications réelles et profil. Sur mobile : menu modal, fermeture par Échap, liens et barre de navigation basse.
- Titres sans sérif gras et bleu foncé, textes et formulaires Segoe UI/system-ui ; tailles, poids et espacements différenciés. Ce choix remplace les titres Georgia de la livraison précédente pour suivre le nouveau modèle.
- Cartes administrateur et responsable, objectif financier unique avec jauge, dépassement explicite, graphiques hebdomadaires, répartition des contributions, notifications récentes et encaissements réels. États vides, erreurs et reprises conservés.
- Liste dépliable des montants hebdomadaires disponible au clavier et au toucher ; aucune information financière exacte ne dépend uniquement du survol d'un graphique.
- Icônes PWA et couleurs du manifest alignées sur l'identité bleue.

## Données et permissions

Le graphique hebdomadaire utilise un nouvel agrégat de l'API dashboard, dans la transaction de lecture cohérente existante. Les semaines sans versement sont présentes avec zéro. Les paiements annulés sont exclus ; les corrections sont prises en compte via la projection financière SQL existante. Un responsable ne reçoit que les totaux hebdomadaires de son département. La progression globale reste consultable selon le périmètre déjà autorisé.

Les montants restent des BIGINT PostgreSQL et des chaînes décimales JSON. Seule la géométrie du graphique est normalisée ; les infobulles et tableaux présentent les valeurs exactes. Aucun chiffre du modèle visuel n'est injecté dans l'application. Les données de recette restent dans des bases PostgreSQL éphémères.

La recherche supérieure transmet le filtre à la vraie liste de membres. Les restrictions d'accès restent vérifiées par l'API. Aucun bouton fictif de rapports ou de synchronisation n'a été ajouté pour remplir le menu du modèle.

La première recette a détecté qu'un prénom et un nom saisis ensemble ne correspondaient à aucun champ individuel de la recherche existante. La recherche serveur accepte désormais les mots du nom complet dans les deux ordres, sans perdre les recherches par numéro/contact ni l'isolation départementale. Un test API vérifie également qu'un nom complet d'un autre département ne remonte pas. La recette de reprise a validé les parcours métier sur les trois formats.

Le menu conserve un état explicite « Indisponibles » en cas d'erreur du compteur de notifications, avec test de régression. Le changement de compte, rôle ou département réinitialise le menu et la saisie de recherche.

## Principaux fichiers

- [Identité graphique](../frontend/src/components/Brand.tsx), [champ mot de passe](../frontend/src/components/PasswordInput.tsx), [structure responsive](../frontend/src/components/WorkspaceLayout.tsx), [styles](../frontend/src/styles.css).
- [Connexion](../frontend/src/features/authentication/LoginPage.tsx), [tableau de bord](../frontend/src/features/dashboard/DashboardPage.tsx), [graphiques](../frontend/src/features/dashboard/visuals.tsx), [géométrie exacte](../frontend/src/features/dashboard/chart-values.ts).
- [Agrégat serveur](../backend/src/dashboard/dashboard.service.ts), [DTO](../backend/src/common/response.dto.ts), [contrats](../packages/contracts/src/index.ts), [OpenAPI](api/openapi.json).
- [Recherche des membres](../backend/src/members/members.service.ts), avec critères autorisés et pagination inchangée.
- [Tests de navigation](../frontend/src/components/WorkspaceLayout.test.tsx), [authentification](../frontend/src/features/authentication/AuthPages.test.tsx), [montants](../frontend/src/features/dashboard/visuals.test.ts), [isolation serveur](../backend/database-tests/auth.spec.ts), [parcours navigateur](../tests/e2e/business.spec.ts), [configuration tablette](../playwright.config.ts).
- [Runner PostgreSQL](../backend/scripts/test-database.mjs) : sortie de l'initialisation native visible, délai d'amorçage borné à dix minutes et attente de démarrage à 90 secondes. Les délais des assertions et les permissions SQL restent ceux des tests existants.
- [Routage](../frontend/src/app/App.tsx), [icônes](../frontend/src/components/Icon.tsx), [filtre de membres](../frontend/src/features/members/MembersPage.tsx), [hook de listes](../frontend/src/hooks/business.ts) et [pages publiques](../frontend/src/features/system/SystemPages.tsx).
- [Parcours de première ouverture](../tests/e2e/auth-setup.spec.ts), [sessions sur deux appareils](../tests/e2e/auth-session.spec.ts) et [icônes PNG](../frontend/public/icons/).
- [README principal](../README.md), [index documentaire](README.md), [avancement](PROGRESS.md), [décisions](DECISIONS.md) et [API actuelle](api/MODULES_METIER.md).
- [Favicon](../frontend/public/favicon.svg), [génération des icônes](../frontend/scripts/generate-icons.mjs), [configuration PWA](../frontend/vite.config.ts), [HTML](../frontend/index.html).

## Commandes et qualification

```powershell
node frontend/scripts/generate-icons.mjs
npm.cmd run lint
npm.cmd run typecheck
npm.cmd test
npm.cmd run test --workspace @suivi/frontend -- --maxWorkers=1
npm.cmd run api:openapi
npm.cmd run build
node backend/scripts/test-database.mjs --e2e
```

Reprises finales par lancement direct des CLI, sans pipeline PowerShell de capture :

```powershell
# Depuis frontend :
node ../node_modules/vitest/vitest.mjs run --reporter=verbose
# Depuis la racine :
node backend/scripts/test-database.mjs --e2e
```

Le pool Vitest par défaut est conservé dans le projet. Les essais avec un seul processus ou le pool VM n'ont pas été retenus dans la configuration.

Qualification de la livraison : **161 tests distincts réussis ; un scénario PWA en échec**. La recette ajoute le format tablette 1024 × 768 aux parcours métier et de connexion, en plus de Chrome desktop et de l'émulation Pixel 7 existants.

| Vérification | Résultat |
|---|---|
| Jest serveur | 18 réussis |
| Vitest/React Testing Library | 41 réussis, dix fichiers |
| PostgreSQL/API | 85 réussis, quatre suites |
| Playwright, reprise du 15 novembre | 17 réussis sur 18 ; commande terminée en échec, code 1 |
| TypeScript strict et compilation | Réussis |
| ESLint et Prettier | Réussis |
| API locale et manifest bleu | HTTP 200, vérifiés |

Les deux parcours complets de rôles réussissent sur ordinateur, mobile et tablette : connexion, changement initial, gestion, encaissement, correction, annulation, notifications, audit et clôture. Les captures ont été inspectées ; l'absence de débordement horizontal est vérifiée automatiquement. Les captures reviennent en haut de page pour que les barres fixes apparaissent correctement.

L'échec restant concerne la mise à jour PWA avec **deux onglets desktop** : aucun worker en attente n'est observé dans le délai du scénario. Sa cause n'est pas isolée ; ce cas n'est pas déclaré terminé. La tentative de reprise du contrôle d'update n'a pas résolu l'échec ; le scénario original est conservé. Aucun rechargement forcé ni contournement de confirmation n'a été ajouté au produit.

Correction intermédiaire : accès à une couleur de graphique potentiellement indéfinie détecté par TypeScript strict ; couleur de repli explicite ajoutée. Les fonctions de calcul graphique ont aussi été extraites du fichier de composants pour respecter la règle Fast Refresh.

Contrôles réussis après corrections : **41 tests Vitest/RTL** (dix fichiers, 83,93 s), **18 Jest serveur** et **85 PostgreSQL/API** (quatre suites, 107,20 s) ; TypeScript strict et compilation des trois packages. ESLint sur les derniers fichiers modifiés et Prettier complet sont réussis. Les index existants des semaines, paiements et ajustements ont été revus avec le guide PostgreSQL disponible : aucune migration nécessaire. OpenAPI contient 44 opérations et 47 schémas.

Les essais intermédiaires sont conservés dans le bilan : un fichier de tests mal formaté corrigé ; échec de recherche complète corrigé côté serveur ; tentative Vitest ciblée sans démarrage de worker, puis exécution à un seul processus avec 19 tests réussis et sept erreurs de démarrage. L'essai VM n'a produit aucun résultat et a été arrêté. **Ces essais ne sont pas comptés comme validés.** La reprise directe avec le pool standard a ensuite exécuté et réussi les 41 tests. Aucune cause système précise n'est affirmée sur la seule base de cette différence de lancement.

Un autre essai a expiré pendant l'exécutable natif initdb avant les migrations. La nouvelle exécution utilise un cluster neuf, l'authentification SCRAM et les mêmes rôles SQL restreints ; les délais d'amorçage ont été ajustés. Après expiration du budget global navigateur de dix minutes, ce budget passe à vingt minutes, distinct des délais individuels des scénarios et assertions. L'ancien cluster de recette et la base de développement n'ont subi aucune réinitialisation ni modification d'authentification.

La recette a également détecté un sélecteur ambigu entre la recherche globale de membres et celle des notifications : correspondance exacte ajoutée. La clôture attend désormais la réponse PATCH HTTP 200 avant de vérifier le statut affiché ; aucune réussite n'est déduite du seul clic.

L'aperçu local répond HTTP 200 pour la disponibilité PostgreSQL. L'écran de connexion a été inspecté à 320, 390 et 1024 px, sans débordement horizontal. Le contrôle initial de la base de développement relevait zéro utilisateur, zéro paiement et son unique audit préexistant ; aucun compte réel ou seed n'a été ajouté par cette livraison. La création initiale par interface reste ouverte au contrôle du 15 novembre.

La compilation finale émet un avertissement de taille pour le fichier initial, environ 505,60 Ko minifiés (160,82 Ko gzip), légèrement au-dessus du seuil de 500 Ko. Les pages métier et Recharts restent chargés à la demande ; le seuil n'a pas été relevé pour masquer l'avertissement. Le build termine correctement. Le plugin PWA signale aussi son option interne `inlineDynamicImports` dépréciée. Les avertissements VM Modules et concurrence de requêtes pg des tests existants ne constituent pas des erreurs d'assertion ; la qualification de charge de production reste à réaliser.

## Limites et suite

Cette livraison adapte les écrans fonctionnels existants. Le modèle métier hors ligne, la synchronisation réelle et les exports restent aux phases suivantes. La durée d'autorisation hors ligne Q02 n'a toujours pas été choisie ; cette refonte n'en fixe aucune.

La mise à jour PWA dans une fenêtre mobile réussit. Le scénario à deux onglets desktop est actuellement en échec, et deux onglets dans l'émulation mobile restent non qualifiés. Le [bilan précédent](CONNEXION_ET_SESSIONS.md) conserve ses résultats historiques ; ils ne remplacent pas le résultat actuel. Une émulation navigateur ne constitue pas une recette sur appareil physique.

Le serveur de prévisualisation local n'est pas un hébergement public. Après lancement de la tâche VS Code d'aperçu, ouvrir <http://localhost:4173/connexion>. Si une ancienne PWA est déjà installée, accepter la nouvelle version depuis l'écran d'installation pour afficher les nouveaux fichiers statiques.

Prochaine étape : isoler l'échec de mise à jour desktop à deux onglets, puis autorisation hors ligne bornée et préparation privée du département, suivies de la synchronisation par lots après validation des politiques métier concernées.
