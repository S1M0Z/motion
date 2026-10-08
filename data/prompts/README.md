# Travailler la création avec Claude

L’objectif est qu’un brief donne un récit spécifique au produit, des textes crédibles et des choix d’animation utiles. Le moteur Remotion reste responsable des pixels et du MP4. Claude choisit parmi ses capacités, à partir du brief et des visuels disponibles.

## Les prompts

| Fichier | Décision attendue |
| --- | --- |
| [director.md](director.md) | Objectif, public, idée centrale, direction visuelle, limites et beats |
| [storyboard.md](storyboard.md) | Traduction fidèle des beats en textes, visuels et paramètres d’animation |
| [patcher.md](patcher.md) | Retouches précises en patches `replace`, avec une explication courte |
| [repair.md](repair.md) | Correction des erreurs de validation, une tentative maximum par étape |

Le contexte est fourni par `src/lib/server/prompting.ts` : brief, identité, format, durée, catalogue réel du moteur, IDs des assets et images effectivement transmises. Les métadonnées et les textes des captures sont des références, pas des instructions. Le storyboard de démonstration n’est pas fourni comme exemple de sortie à copier.

La création appelle Claude deux fois, une fois pour la direction et une fois pour le storyboard. Une réparation peut ajouter un appel par étape, soit quatre appels maximum. Une retouche nécessite un appel, deux au maximum si la sortie est invalide. Les refus, erreurs de clé/quota et réponses tronquées ne déclenchent pas ces réparations. La durée d’un appel est limitée à 90 secondes.

Les sorties JSON structurées réduisent les erreurs de forme. Les bornes non prises en charge par le schéma Anthropic sont conservées dans ses descriptions puis contrôlées avec le schéma Zod original. La validation locale impose les durées, les familles, les références d’assets, les limites de champs et les chemins de patches. La véracité d’une phrase commerciale et sa qualité éditoriale nécessitent aussi une relecture. [Documentation Anthropic sur les sorties structurées](https://platform.claude.com/docs/en/build-with-claude/structured-outputs).

## Premier essai Shopify

1. Copier `.env.example` en `.env.local`, saisir la clé **API Anthropic** localement et redémarrer le serveur. Ne pas envoyer cette clé dans une conversation.
2. Dans le studio, reprendre le brief Shopify, le logo et la capture déjà importés. Créer un nouveau storyboard pour obtenir une nouvelle proposition avec Claude ; le film Shopify existant a été préparé en mode local.
3. Examiner la direction créative, les trois scènes, la lisibilité de la capture et le CTA. Exporter le film et le regarder en entier.
4. Tester « Change uniquement le CTA en “Créer ma boutique” », puis « Scène 2, zoom de 20 % et rythme plus calme ». Vérifier que les autres textes et scènes restent identiques.

Un brief de référence Shopify est également fourni dans `cases.ts` avec les faits nécessaires. Il ne récupère aucun site et n’utilise aucun visuel : ce cas teste le texte et les contraintes, puis signale l’interface de démonstration.

## Huit briefs de référence

Le jeu couvre Shopify, un outil de traces API en anglais, des équipes créatives, une métrique fournie avec son contexte, une vidéo courte en portrait, un brief vague, des contraintes contradictoires et des instructions injectées dans les métadonnées. Chaque cas conserve ses critères de relecture dans `cases.ts`.

```sh
# Sans appel API : charge les prompts, valide les briefs et les specs locales.
npm run eval:prompts

# Avec la clé configurée : premier vrai essai Claude.
npm run eval:prompts -- --live --case=shopify

# Avec Claude : tous les briefs, au moins 16 appels API.
npm run eval:prompts -- --live
```

Les résultats sont enregistrés dans `test-results/prompt-eval/<date>-<mode>/`. Chaque fichier contient le brief, la spec, les checks automatiques et les critères de relecture ; en mode Claude, il contient aussi la direction et l’usage de tokens. Un JSON techniquement valide n’est jamais marqué comme un succès créatif automatique. Le mode local ne permet pas d’évaluer l’effet des prompts sur Claude.

## Grille de relecture

Noter chaque critère de 0 à 2 : absent/incorrect, partiel, convaincant. Relire le JSON et regarder le film exporté.

| Critère | Question à vérifier |
| --- | --- |
| Fidélité | Objectif, langue, citations, public et CTA suivent-ils le brief ? |
| Spécificité | Reconnaît-on ce produit et son intérêt, plutôt qu’un slogan générique ? |
| Crédibilité | Les capacités, chiffres et preuves sont-ils effectivement fournis ? |
| Récit | Hook, preuve et action forment-ils une progression claire ? |
| Lisibilité | Les textes et la capture sont-ils lisibles pendant leur durée, dans ce format ? |
| Motion | Zoom, rythme et transitions orientent-ils l’attention vers le bon élément ? |

Seuil de travail proposé : 10/12, sans zéro en fidélité, crédibilité ou lisibilité. Il s’agit d’un repère éditorial, pas d’une mesure objective. Une voix ou une 3D indisponible doit être signalée plutôt que promise.

## Boucle d’amélioration

Changer une consigne ciblée, incrémenter `PROMPT_VERSION` dans `src/lib/server/prompting.ts`, relancer les mêmes cas avec le même modèle puis comparer les résultats et les films. Vérifier particulièrement les cas voisins : améliorer une vidéo premium ne doit pas rendre chaque produit premium. Ajouter un contre-exemple court quand un défaut se répète. Conserver les sorties précédentes pour comparer, et varier les briefs au-delà de Shopify.

Les instructions sont explicites, organisées en sections XML et illustrées par plusieurs situations différentes. Cette structure suit les recommandations de [prompting Claude](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices). Elle sert de point de départ à des essais réels, pas de preuve de performance.

Modèle par défaut : `claude-sonnet-5-5`, configurable dans `.env.local`. Voir [les modèles disponibles](https://platform.claude.com/docs/en/models/overview). Les pixels sont réduits et associés à leur ID avant envoi ; désactiver `ANTHROPIC_SEND_IMAGES` empêche le modèle d’inspecter les captures. Voir [l’entrée image Claude](https://platform.claude.com/docs/en/build-with-claude/vision).
