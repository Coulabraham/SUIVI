# Phase 11 — installation PWA et fondations du stockage local

Début : 13 novembre 2026 ; poursuite : 14 novembre 2026. **Première partie testée ; phase en cours** : cette livraison prépare le fonctionnement hors connexion, sans activer les données privées avant le choix de la politique d'accès. La [phase 10](PHASE_10.md) reste le dernier périmètre métier intégralement validé.

## Périmètre réalisé

- Manifest français, icônes PNG 192/512 et maskable, affichage standalone, nom, couleurs et démarrage à la racine.
- Service worker Workbox construit par vite-plugin-pwa en mode injectManifest. Préchargement du shell, des styles, icônes et chunks des pages ; aucune réponse API privée dans le cache. Navigation de secours limitée à une liste fermée de routes React.
- Demande d'installation proposée lorsque le navigateur la fournit, aide pour le menu de partage, statut de préparation des fichiers et recherche de mise à jour.
- Nouvelle version laissée en attente. Aucun rechargement automatique : confirmation explicite, possibilité de reporter et protection supplémentaire lorsqu'un dialogue de formulaire est ouvert.
- Écran d'installation : état réel d'IndexedDB, quota indiqué, usage et demande de persistance lorsque le navigateur la propose. Un refus ou une erreur reste visible.
- Nom d'appareil enregistré dans Dexie et utilisé lors des connexions suivantes. Cet usage réel du stockage local ne contient ni compte ni transaction privée.
- Le serveur met à jour ce nom après une authentification réussie, y compris pour un appareil déjà connu ; le changement est conservé dans l'audit de connexion, sans créer un autre appareil ni modifier son propriétaire.
- Fondations de file locale : enveloppes chiffrées, UUID stable, périmètre utilisateur/département/appareil/versions, dépendances et transaction atomique projection/commande. Seul l'état PENDING peut être produit ; aucun reçu serveur n'est fabriqué.
- Une nouvelle création ne peut pas remplacer la projection d'un paiement existant, même en déclarant une dépendance. Le rejeu exact de la même opération conserve son UUID ; toute correction financière attend une décision serveur explicite.

## Frontière de sécurité

**L'installation PWA et le cache des pages ne constituent pas encore un accès métier hors connexion.** Les membres et paiements ne sont pas téléchargés dans IndexedDB. Aucun formulaire métier ne prétend enregistrer durablement un paiement hors ligne. Les nouvelles opérations continuent d'exiger la confirmation du serveur ; la connexion initiale exige le réseau.

Les primitives de chiffrement et de file sont exercées avec des fixtures de test. Elles ne sont pas branchées à une autorisation autonome du navigateur. Avant leur activation pour des données réelles, il reste à implémenter l'autorisation serveur bornée, son contrôle d'expiration et de révocation, le bootstrap cohérent, le cycle de protection/récupération de clé et de sel, puis les interfaces et le protocole de synchronisation. Aucune durée n'est présumée depuis la session en ligne de huit heures.

Le chiffrement préparé utilise AES-GCM 256 bits, IV aléatoire de 96 bits et périmètre comme donnée authentifiée. La dérivation Web Crypto utilise PBKDF2-HMAC-SHA256 à 600 000 itérations et un sel aléatoire de 128 bits ; la clé dérivée est non extractible et conservée seulement en mémoire. Aucun secret d'authentification, clé brute ou mot de passe en clair n'est écrit par cette couche. Le futur fournisseur de session devra conserver le sel et l'enveloppe de déverrouillage avant toute donnée privée ; perdre IndexedDB ou le secret local reste une limite à traiter. Cette cryptographie ne protège pas d'un appareil compromis ou d'un script malveillant s'exécutant dans l'origine.

L'empreinte d'idempotence locale porte sur l'enveloppe chiffrée et ses métadonnées, jamais sur un montant seul. Elle ne remplace pas le hash canonique et les contrôles d'autorisation/idempotence du serveur de phase 12. Les opérations de chiffrement sont effectuées avant la transaction Dexie, afin de ne pas laisser une attente Web Crypto fermer prématurément la transaction IndexedDB.

## Fichiers

- [Configuration Vite/PWA](../frontend/vite.config.ts), [worker](../frontend/src/pwa/sw.ts), [politique de cache](../frontend/src/pwa/cache-policy.ts) et [client d'installation](../frontend/src/pwa/client.ts).
- [Écran d'installation](../frontend/src/pwa/InstallationPage.tsx), [proposition de mise à jour](../frontend/src/pwa/PwaUpdateNotice.tsx) et [stockage des préférences](../frontend/src/pwa/storage.ts).
- [Base Dexie](../frontend/src/features/synchronization/local-database.ts), [primitives cryptographiques](../frontend/src/features/synchronization/local-crypto.ts) et leurs tests.
- [Icônes](../frontend/public/icons), [générateur déterministe depuis le favicon](../frontend/scripts/generate-icons.mjs), [HTML](../frontend/index.html), [assemblage React](../frontend/src/app/App.tsx), [entrée](../frontend/src/main.tsx) et [connexion](../frontend/src/features/authentication/AuthPages.tsx).
- [Recette PWA](../tests/e2e/pwa.spec.ts), [prévisualisation locale](../scripts/preview-pwa.mjs), [paquets frontend](../frontend/package.json) et [lockfile](../package-lock.json).
- [Authentification serveur](../backend/src/auth/auth.service.ts) et [recette PostgreSQL/API](../backend/database-tests/auth.spec.ts) : actualisation du nom après connexion réussie, conservation du propriétaire/UUID et audit du changement.

## Exécution et qualification

La qualification comprend **131 tests distincts réussis** : 18 Jest, 25 Vitest/React Testing Library, 76 PostgreSQL/API et 12 Playwright (six par profil Chrome desktop/mobile). Lint, format, TypeScript strict, les 43 tests unitaires et les builds contrats/backend ont réussi lors de la dernière exécution de npm run check. La génération finale du worker a ensuite rencontré EBUSY sous Windows pendant une lecture de contrôle concomitante du fichier sw.js : code 1 conservé, puis reprise du seul build frontend avant toute lecture du résultat. Les cinq migrations ont été appliquées sur des bases temporaires de recette ; aucune migration ni route API n'est ajoutée par cette livraison (42 opérations et 44 schémas OpenAPI conservés).

La reprise frontend se termine avec le code 0 : bundle initial 491,31 Ko, worker 17,14 Ko et 32 entrées préchargées (1 047,40 Kio). Le worker final conserve exactement l'empreinte SHA-256 du build passé en recette navigateur, 967773eb1b453304dce9e352097926f7e454f4f3b4fccd834f328152d2297dc4. Le dernier durcissement de la primitive de file locale est couvert par ses tests et n'est pas inclus dans le code de production tant que l'accès privé hors ligne reste inactif.

Le rapport Playwright final contient 12 résultats attendus, zéro échec, zéro test instable et zéro test ignoré ; la réouverture sans réseau et les rendus desktop/mobile ont été inspectés. Ces essais utilisent Chrome avec émulation mobile : une installation depuis l'interface du système et la compatibilité Safari/Firefox ne sont pas certifiées par cette recette.

Le contrôle de publication parcourt 205 fichiers et 218 liens documentaires locaux : aucun secret détecté et aucun lien absent. Le cahier des charges conserve son empreinte SHA-256 d'origine. La vérification en lecture seule de suivi_dev retrouve zéro utilisateur, département, membre, objectif, paiement et notification ; l'audit préexistant unique est conservé. Aucun compte réel n'est créé : le premier administrateur doit être initialisé personnellement par la commande auth:bootstrap documentée.

Une première vérification de types a été lancée trop tôt, pendant l'installation des dépendances, et a signalé les modules PWA/fake-indexeddb absents. Elle ne constitue pas une validation ; le contrôle est repris après installation. L'installation npm a attendu des métadonnées du registre/audit : reprise du seul processus identifié avec des délais réseau bornés, sans changer la stack.

Deux cas IndexedDB ont d'abord dépassé cinq secondes pendant une recette concurrente : leurs fixtures redérivaient la même clé coûteuse pour chaque brouillon. Elles dérivent désormais deux vraies clés une seule fois dans beforeAll, comme un espace local déverrouillé ; les 600 000 itérations restent inchangées et les six tests de stockage sont réexécutés. Cette optimisation ne masque pas d'erreur de stockage.

La première recette complète du build a passé le manifest, les icônes et la réouverture sans réseau, mais détecté deux anomalies sur desktop et mobile : nom d'appareil connu non actualisé par le serveur, et activation du nouveau worker sans rechargement de la toute première page. L'authentification conserve maintenant l'historique du changement de nom. La demande de rechargement est explicitement suivie par le client, y compris pour une page ouverte avant la première installation du worker. Un autre onglet conserve sa saisie ; il attend sa propre confirmation pour charger le nouveau code.

Le graphe npm initial retenait des versions transitives de glob/minimatch contraires aux overrides de sécurité existants. Les réinstallations simples ne suffisaient pas ; le retrait manuel du cache ciblé a été refusé par la revue automatique. Le lockfile a donc été reconstruit par npm depuis le dernier état validé, puis réconcilié avec l'installation. npm ls confirme glob 14.0.6 et minimatch 11.0.8 ; aucune version de paquet déjà verrouillée dans la phase 10 n'a changé. L'override explicite de glob sous workbox-build documente ce périmètre.

Audit des dépendances de production : zéro vulnérabilité connue. Audit complet : neuf alertes faibles, uniquement dans l'outillage, liées à la même dépendance deepmerge déjà suivie en phase 10 ; aucune alerte modérée, élevée ou critique. Le code de sortie 1 de l'audit complet est conservé. La rétrogradation automatique proposée de Jest/PWA n'a pas été appliquée. Le build de worker émet aussi un avertissement interne du plugin concernant inlineDynamicImports ; il reste visible, sans remplacement de stack.

```powershell
npm.cmd run check
npm.cmd run build --workspace @suivi/frontend
npm.cmd run test --workspace @suivi/frontend -- src/features/synchronization/local-database.test.ts
node backend/scripts/test-database.mjs --e2e-only
node backend/scripts/test-database.mjs --e2e
npm.cmd run preview:pwa
```

Le serveur de développement Vite ne possède pas de service worker actif. Pour vérifier l'installation réelle, utiliser le build puis l'aperçu PWA : frontend http://localhost:4173/installation, API locale sur 127.0.0.1:3001 avec cette origine explicitement autorisée. Cette origine distincte de 127.0.0.1:5173 évite de mélanger les cookies et données IndexedDB avec le mode développement. Les deux aperçus peuvent utiliser la même base de développement, sans ajouter de compte ou donnée de test. Les ports sont fixes et une occupation de port provoque un échec explicite.

La tâche VS Code « SUIVI: aperçu PWA (build existant) » démarre le dernier build vérifié ; la commande npm preview:pwa reconstruit d'abord les fichiers. Après un arrêt de l'environnement, redémarrer PostgreSQL avec db:local:start puis cette tâche ou commande.

L'aperçu est strictement local et ne remplace pas un déploiement HTTPS. En production, servir le worker et le manifest avec une politique de revalidation appropriée ; les fichiers hashés peuvent bénéficier d'un cache long. Conserver le fallback SPA uniquement pour les routes de l'application, et transmettre les URL API au serveur.

La recette simule deux versions du worker via un proxy HTTP temporaire sur une origine de test distincte. Elle ne remplace pas les fichiers du build et n'ajoute aucun endpoint de test à l'application. Les profils Chrome de test et la base PostgreSQL restent éphémères.

La reprise finale utilise la suite complète PostgreSQL/API et navigateur, car le traitement de connexion a été modifié. Les suites de chiffrement, rollback local et déduplication ne sont pas prises pour une validation du protocole financier hors ligne futur.

## Décisions attendues et suite

Q02 est indispensable pour activer un accès privé hors ligne : **72 heures, 24 heures ou 7 jours après la dernière vérification en ligne**. La question a été présentée à l'utilisateur ; aucune option préselectionnée n'est considérée comme une réponse. Q03/Q11/Q18 restent à préciser pour les conflits tardifs, un responsable remplacé et l'appareil partagé. Les détails non bloquants n'empêchent pas la partie installable.

Après ce choix : autorisation hors ligne, préparation chiffrée du périmètre, consultation et saisies provisoires ; puis phase 12 pour l'envoi par lots, les reçus, reprises et conflits. La phase 11 n'est pas annoncée terminée par la seule mise en cache du shell.

## Références vérifiées

- [Vite PWA, worker personnalisé](https://vite-pwa-org.netlify.app/guide/inject-manifest.html) et [mise à jour sur confirmation](https://vite-pwa-org.netlify.app/guide/prompt-for-update.html). Le registre npm indique vite-plugin-pwa 2.0.0 avec Vite 8 et Workbox 7.4.1 dans ses peer dependencies ; aucune technologie n'a été remplacée.
- [Workbox Routing](https://developer.chrome.com/docs/workbox/modules/workbox-routing) : ordre et méthodes des routes.
- [Dexie avec React](https://dexie.org/docs/Tutorial/React) et [transactions Dexie](https://dexie.org/docs/Dexie/Dexie.transaction()).
- [StorageManager.persist](https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/persist) : disponibilité et décision du navigateur ; IndexedDB ne remplace pas une sauvegarde.
- [OWASP Password Storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html) : facteur PBKDF2-HMAC-SHA256 ; le hash des mots de passe serveur reste Argon2id.
