# Vérification du MVP — 7 octobre 2026

- TypeScript : validation réussie.
- Production : compilation Next.js 16.4.0 réussie.
- Tests : **10 réussis**, couvrant les 36 combinaisons de durée/format/style, les durées exactes, les assets, les patches atomiques, le filtrage des URL, les origines HTTP et le contrat JSON de l’adaptateur IA.
- Parcours complet réel : upload PNG → storyboard → retouche CTA → sauvegarde/relecture → export → téléchargement MP4.
- URL publique : extraction réussie du titre de `https://example.com/`.
- Interface : création, édition manuelle, sauvegarde, retouche couleur/format/durée/CTA, reprise du projet et suivi de rendu vérifiés dans le navigateur.
- Affichage mobile : vérifié à 390 px, sans débordement horizontal.
- Export paysage : MP4 H.264, **1920 × 1080, 8 secondes, 30 fps**, sans audio, lecture et recherche temporelle prises en charge.
- Export vertical depuis l’interface : MP4 H.264, **1080 × 1920, 8 secondes, 30 fps**, sans audio, rendu terminé et téléchargement disponible.

L’intégration OpenAI a été vérifiée avec des réponses simulées, dont des réponses invalides/incomplètes. Aucun appel avec une vraie clé n’a été effectué. Le mode local a été utilisé pour les parcours réels.

Les deux vidéos de démonstration et une capture du studio sont livrées à côté du dossier source. Le paquet ZIP contient le code et le lockfile ; les dépendances, caches et données des tests n’y sont pas inclus.

## Deuxième itération — contrôle des animations

- **16 tests réussis**, avec compatibilité des anciens projets, paramètres d’animation bornés, retouches ciblées et transitions qui conservent la durée totale.
- Compilation de production réussie après ajout des contrôles d’apparition du texte, de rythme, de transition, de zoom et de cadrage.
- Nouveau parcours complet réel réussi avec retouches du zoom, du rythme, du fondu et du CTA, suivi de rendu et téléchargement MP4.
- Projet Shopify créé et repris via son lien local. Logo public importé et capture de la présentation du commerce sur [Shopify France](https://www.shopify.com/fr).
- Film Shopify : MP4 H.264, **1920 × 1080, 15 secondes, 30 fps**, sans audio. Les trois scènes et le CTA à 14,9 secondes ont été inspectés visuellement.
- Contrôle du rythme, sauvegarde et lecture vérifiés dans l’interface. Le film utilise le mode local et une sélection éditoriale des textes ; aucun appel IA réel n’a été effectué.

## Troisième itération — Claude et prompting

- **28 tests réussis**. Les réponses Claude/OpenAI sont simulées : protocole structuré, deux étapes, transmission de la direction, correction bornée, refus/troncature/authentification, patches ciblés et atomiques, métadonnées non fiables et préparation réelle d’une image locale réduite.
- TypeScript et compilation de production réussis.
- Huit briefs chargés et validés avec le banc d’évaluation hors ligne. Cette vérification utilise le moteur local et ne mesure pas la qualité créative des prompts Claude.
- Génération locale, audit de provenance, explication de retouche et persistance vérifiés via l’API locale après compilation.
- Projet Shopify repris dans l’interface et preview vérifiée avec le statut « Mode démo · Claude à connecter ». Capture `studio-claude.png` livrée à côté du code.
- Prompts de direction, storyboard, retouches et réparation éditables, huit cas et grille de relecture documentés dans `prompts/README.md`.
- Aucune clé Anthropic disponible : connexion réelle et qualité des réponses Claude **à vérifier après configuration**. Le film Shopify livré précédemment reste un film préparé en mode local.

## Quatrième itération — connexion Claude réelle

- Accès Internet autorisé pour le serveur exécuté dans Codex, puis serveur relancé. L’API Anthropic a accepté la clé configurée et confirmé la disponibilité de `claude-sonnet-5-5`.
- Génération réelle à partir du brief Shopify du projet utilisateur, avec ses deux images. Direction créative et storyboard sauvegardés ; 15 secondes exactes, trois scènes et provenance `anthropic` vérifiées. Une correction de validation a été utilisée.
- Retouche réelle « Change uniquement le CTA en “Créer ma boutique” » réussie : un seul patch, autres champs strictement identiques.
- Preview et direction créative inspectées dans le navigateur. Le modèle a signalé que l’image importée est un fond abstrait, plutôt qu’une preuve d’interface produit.
- **30 tests réussis** et compilation de production réussie, avec couverture des erreurs réseau/DNS/certificat/délai et réponses illisibles. Aucun détail de clé n’est inclus dans les messages d’erreur.
- Résultat du test dans `claude-test-result.json` et capture dans `studio-claude-live.png`, livrés à côté du dossier source. Ce test établit le fonctionnement de l’intégration ; l’évaluation éditoriale des huit briefs reste un travail distinct.
