# SUIVI — dossier de conception

Mise à jour : 13 novembre 2026. Statut : **modules métier des phases 4 à 10 du cahier joint implémentés et testés ; 113 tests réussis** ; résultats de qualification dans le [compte rendu actuel](PHASE_10.md).

Ce dossier décrit l'architecture cible et suit sa réalisation. Les fonctionnalités métier en ligne sont reliées aux API. Le mode hors ligne et les modules des phases 11 à 14 restent à développer. Les tests ne constituent pas à eux seuls une qualification de production de l'application complète.

## Lecture recommandée

Pour l'état actuel, consulter d'abord le [README de démarrage](../README.md), le [compte rendu de phase 10](PHASE_10.md), le [guide utilisateur](user-guide/PREMIERS_PAS.md) et le [journal d'avancement](PROGRESS.md). Les comptes rendus de [phase 2](INITIALISATION.md), [phase 3](database/PHASE_3.md) et [phases 4 à 9](PHASES_4_9.md) conservent l'historique.

1. [État du poste et du dossier](ENVIRONNEMENT.md).
2. [Analyse des règles, ambiguïtés et risques](architecture/ANALYSE.md).
3. [Architecture et modules](architecture/ARCHITECTURE.md).
4. [Quatre diagrammes](architecture/DIAGRAMMES.md).
5. [Modèle relationnel et contraintes](database/MODELE_RELATIONNEL.md).
6. [API métier implémentée](api/MODULES_METIER.md) et [contrats cibles](api/CONTRATS.md).
7. [Protocole de synchronisation](architecture/SYNCHRONISATION.md).
8. [Authentification implémentée](security/AUTHENTIFICATION_IMPLEMENTEE.md) et [sécurité cible](security/SECURITE.md).
9. [Plan, tests et critères de sortie](architecture/PLAN_ET_TESTS.md).
10. [Décisions à valider](DECISIONS.md) et [avancement](PROGRESS.md).

## Sources et ordre de priorité

La demande « PROMPT MAÎTRE » fixe les invariants. Le [cahier des charges version 2.0](../cahier_des_charges.md), cité dans la dernière instruction, fixe la numérotation de la livraison actuelle : ses phases 4 à 9 correspondent aux modules métier. En cas de différence de règle, les instructions explicites de la conversation prévalent. Ainsi, les versements multiples et le rôle unique par département sont déjà imposés, même si le document les présentait encore comme propositions.

Les mentions **exigé**, **proposé** et **à confirmer** distinguent les règles acquises des choix soumis à validation. L'approbation de la conception n'est pas une autorisation de publier, d'acheter un hébergement ou d'envoyer des identifiants à des tiers.
