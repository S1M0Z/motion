# Frame — Motion Studio MVP

Un prototype local de motion design pour les SaaS et les produits tech : URL et/ou images → brief libre → storyboard → aperçu Remotion → retouches → export MP4. Interface en français, Next.js + TypeScript, sans intégration Shopify.

## Lancement rapide

Prérequis : **Node.js 22 ou 24**, npm, et un navigateur récent. Ouvrir un terminal dans ce dossier :

```sh
npm install
npm run dev
```

Ouvrir **http://127.0.0.1:3000**. Le bouton « Essayer avec un brief exemple » crée un projet immédiatement. Aucune clé IA n’est nécessaire pour le mode local.

Sur Windows, si PowerShell bloque `npm.ps1`, utiliser `npm.cmd install` et `npm.cmd run dev`.

Pour préparer le navigateur de rendu sur une machine sans Chrome/Edge :

```sh
npm run browser:install
```

Le rendu détecte Chrome ou Edge à leur emplacement Windows habituel. Sinon Remotion utilise Chrome Headless Shell ; le premier export peut télécharger ce navigateur. Le téléchargement demande un accès Internet. Il est possible de définir `REMOTION_BROWSER_EXECUTABLE` dans `.env.local` pour utiliser un navigateur installé ailleurs.

Version optimisée :

```sh
npm run build
npm start
```

Garder le terminal ouvert pendant l’utilisation et les exports.

## Parcours

1. Coller une URL HTTPS publique, importer des images, écrire une demande, ou combiner ces entrées. La flèche du champ URL analyse les métadonnées de la page : nom, description et couleur `theme-color`. Modifier le nom, la promesse et les couleurs dans « Identité de marque ».
2. Importer jusqu’à 10 images PNG/JPEG/WebP : 10 Mo par image, 30 Mo par requête. Affecter le rôle logo, capture produit ou image. Les images sont normalisées en WebP ; la transparence est conservée. Sans capture, une interface de démonstration clairement indiquée apparaît.
3. Choisir 16:9 (1920×1080), 9:16 (1080×1920), ou 1:1 (1080×1080), puis 8, 15 ou 30 secondes et Premium, Tech, Minimal ou Dynamique.
4. Créer le storyboard. Claude propose une direction créative puis 3 à 5 scènes adaptées au brief ; le mode local utilise 3 scènes en 8/15 secondes et 5 en 30 secondes. Les trois familles sont hook/typographie, feature UI/capture et stat/bénéfice/CTA. La cadence est 30 images/seconde. La direction initiale et ses éventuelles limites sont consultables dans le panneau « Affiner ».
5. Cliquer sur une scène pour positionner l’aperçu et modifier ses textes, son image, son CTA ou un chiffre fourni par le client. Sauvegarder, ou décrire une retouche. L’export sauvegarde automatiquement les modifications valides.
   Le panneau « Animation de la scène » règle l’apparition du titre (entrée montante, révélation mot par mot ou texte tapé), le rythme et la transition (fondu, glissement ou balayage). Les scènes produit proposent aussi un zoom progressif de 0 à 35 % et son point de cadrage.
6. Exporter la vidéo. Un processus Node séparé calcule un vrai MP4 H.264, en pleine résolution. La progression et le téléchargement apparaissent sous le storyboard. L’export utilise un instantané immuable de la version sauvegardée.

Le brouillon et l’identifiant du dernier projet sont conservés dans ce navigateur. Projets, images, historique des patches et exports restent dans `data/`. Le projet courant est repris au rechargement. Le bouton « Nouveau projet » ouvre un nouveau brouillon ; les anciens fichiers restent sur disque. Il est désactivé tant que des modifications ne sont pas sauvegardées.

Chaque projet peut aussi être rouvert avec son lien local `http://127.0.0.1:3000/?project=<identifiant>`. Ce lien sélectionne le projet sauvegardé ; il ne publie rien sur Internet.

## Claude et prompting

Copier `.env.example` vers `.env.local` et renseigner :

```dotenv
AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=votre_cle_api_anthropic
ANTHROPIC_MODEL=claude-sonnet-5-5
ANTHROPIC_SEND_IMAGES=true
```

Redémarrer le serveur. La clé reste côté serveur, dans `.env.local`, jamais dans une variable `NEXT_PUBLIC_` ni dans un projet sauvegardé. L’interface indique « Claude configuré » lorsque la clé est présente ; cette indication ne vérifie pas les droits du compte. Le premier vrai appel vérifie la connexion. Sans clé, « Mode démo · Claude à connecter » s’affiche. Le modèle est configurable selon les droits du compte. L’accès API se configure séparément de l’utilisation du site Claude.

La chaîne utilise l’API Messages d’Anthropic avec `output_config.format` : direction créative → storyboard structuré → validation Zod et invariants locaux. Une retouche utilise un prompt distinct et produit des patches. Une sortie mal formée peut recevoir **une correction par étape**. Les erreurs API, refus et réponses tronquées sont affichés sans substitution par la démo.

Les erreurs de connexion distinguent accès réseau bloqué, DNS, certificat HTTPS et délai dépassé. Si le serveur est lancé depuis un environnement Codex dont l’accès Internet est restreint, autoriser cet accès puis redémarrer le serveur dans cet environnement. Sur une machine classique, vérifier la connexion et les éventuels réglages de proxy ou de pare-feu.

Les prompts sont dans [prompts/](prompts/) et s’éditent sans modifier l’interface. [Le guide de prompting](prompts/README.md) décrit leur rôle, les huit briefs de référence, la grille de relecture et les commandes d’évaluation.

Avec Claude activé, le brief, les métadonnées de marque, les noms des assets, la direction créative et les textes du storyboard sont transmis à Anthropic. Par défaut, jusqu’à quatre captures, une image et un logo sont également envoyés en WebP réduit, au maximum 1280 × 960 px, aux deux étapes de création. `ANTHROPIC_SEND_IMAGES=false` désactive les pixels et transmet les métadonnées seulement. Les retouches transmettent la spec courante et la direction initiale, sans pixels. Coller une URL ne permet pas à Claude de parcourir le site : la flèche récupère ses métadonnées et les images viennent des uploads.

L’ancien adaptateur OpenAI reste disponible en choisissant explicitement `AI_PROVIDER=openai`, `OPENAI_API_KEY` et `OPENAI_MODEL`. Il n’envoie pas les pixels. Une clé OpenAI seule n’active pas ce fournisseur par défaut.

**Sans clé**, la génération repose sur un moteur déterministe, pas sur une IA. Il reprend les slogans entre guillemets, le texte du brief et les visuels, et propose une structure simple. Les retouches locales comprennent notamment :

```text
Mets l’accent en bleu et le fond noir
Format vertical, 8 secondes
Style minimal
Titre scène 1 : "Votre prochaine grande idée"
CTA "Essayer gratuitement"
Sous-titre scène 2 : "Tout votre travail au même endroit"
Couleur #ad8cff
Accentue le zoom sur le dashboard
Scène 2, zoom 25%, cadrage en haut à droite
Plus rapide, transition en fondu
Scène 1, texte tapé
```

Une demande locale non reconnue affiche les possibilités disponibles. Avec une clé, les demandes libres passent par le même mécanisme de patches validés. Un bouton permet d’annuler les dernières retouches de la session.

## Architecture

```text
src/app/                 Next App Router, interface et API locales
src/components/Studio   Brief, storyboard, Player et suivi d’export
src/lib/spec.ts         Schéma versionné VideoSpec et invariants
src/lib/generator.ts    Générateur local et exemple
src/lib/patches.ts      Chemins autorisés, patches atomiques
src/lib/server/ai.ts    Direction, storyboard, retouches et validation
src/lib/server/ai-provider.ts API Anthropic / adaptateur OpenAI
src/lib/server/prompting.ts Contextes, catalogue et version des prompts
src/lib/server/vision.ts Préparation des assets pour Claude
prompts/                Prompts éditables, cas et grille d’évaluation
src/lib/server/brand.ts Métadonnées HTML et connexion HTTPS filtrée
src/lib/server/storage.ts Projets JSON, assets, instantanés
src/remotion/           Les trois familles d’animations partagées
scripts/render.ts      Processus de rendu MP4 indépendant
scripts/smoke.ts        Vérification complète avec upload et export
scripts/evaluate-prompts.ts Évaluation locale ou réelle avec Claude
tests/                  Validation, patches, URL et contrat IA
```

`VideoSpec` v1 est l’unique source de vérité pour l’aperçu et le rendu. `scenes[].durationInFrames` doit totaliser exactement `duration × fps`. Identifiants uniques, références d’assets existantes, textes bornés et trois familles de scènes sont validés. Les tailles de vidéo viennent du format, jamais d’une seconde configuration indépendante.

Le projet peut aussi conserver `creativePlan` (direction initiale) et `generation` (fournisseur, modèle, version des prompts, nombre de corrections, usage de tokens et IDs des images envoyées). Ces métadonnées expliquent l’origine du résultat ; elles ne pilotent pas le rendu. Les patches enregistrent une explication courte dans l’historique.

`scenes[].motion` stocke les choix d’animation : `entrance`, `pace`, `transition`, `zoom`, `focusX`, `focusY`. Les anciens projets v1 sans ce champ restent lisibles avec les presets du style. Un changement de direction artistique réinitialise ces presets ; les retouches suivantes peuvent les affiner. Les transitions superposent brièvement la scène précédente et la scène suivante sans raccourcir la durée totale. Le CTA reste visible jusqu’à la fin du film.

Les retouches produisent un sous-ensemble de **JSON Patch / RFC 6902** : `replace` uniquement, sur des chemins explicitement autorisés. Identifiants, sources des images, cadence et structure ne sont pas modifiables par l’IA. Le changement de durée redistribue les images entre scènes, avec au moins une seconde par scène. L’application est atomique : un patch invalide ne modifie pas le projet. Les mises à jour utilisent un numéro de révision ; une version obsolète reçoit HTTP 409. Les écritures d’un projet sont sérialisées dans l’instance locale.

### API

| Route | Usage |
| --- | --- |
| POST `/api/brand` | Analyser une URL HTTPS |
| POST `/api/assets` | Import multipart, champ `files` |
| GET `/api/assets/:id` | Lire une image normalisée |
| POST `/api/projects` | Générer et enregistrer le projet |
| GET `/api/projects/:id` | Reprendre le projet |
| PUT `/api/projects/:id` | Sauver `{spec, revision}` |
| PATCH `/api/projects/:id` | Retoucher `{instruction, revision}` |
| POST `/api/exports` | Exporter `{projectId, revision}` |
| GET `/api/exports/:id` | Lire la progression |
| GET `/api/exports/:id/download` | Télécharger le MP4 terminé |

## Vérification

```sh
npm run typecheck
npm test
npm run eval:prompts
npm run build
# Avec le serveur local lancé dans un autre terminal :
npm run smoke
```

Le test complet crée une image de test, l’importe, génère un storyboard, applique une retouche, vérifie la persistance et le refus d’une révision périmée, lance un rendu, puis télécharge et vérifie le conteneur MP4. Résultats dans `test-results/`. Les tests IA utilisent des réponses simulées ; le banc d’évaluation est local par défaut. Ils vérifient le contrat technique, sans établir la qualité créative réelle de Claude. Après configuration de la clé, `npm run eval:prompts -- --live --case=shopify` teste le premier brief avec Claude ; cette commande consomme du quota API. Relire le résultat puis le film selon la grille du guide.

## Périmètre du prototype

Application locale, mono-utilisateur et une instance Next. Un export à la fois. Les scripts écoutent seulement sur la boucle locale et l’API vérifie l’hôte et l’origine des requêtes. L’analyse d’URL refuse les adresses privées/locales, valide chaque redirection et fixe l’adresse DNS validée pour la connexion. Aucun contenu distant n’est exécuté.

Pas encore d’authentification, de facturation, de base de données multi-utilisateur, de file de rendu distribuée, de musique/voix, de vidéo générative, de capture automatique de site ou de timeline libre. Les exports sont silencieux. Le logo et les captures proviennent des uploads ; les sites protégés ou rendus uniquement en JavaScript peuvent nécessiter une saisie manuelle des métadonnées.

Avant un service public : remplacer les fichiers par du stockage persistant, ajouter comptes et permissions, quotas, file de rendu, supervision des processus et politique de suppression des assets. Les interfaces du moteur, du schéma et du rendu sont séparées pour permettre cette évolution.

Remotion possède ses propres conditions de licence pour l’usage commercial : [licence Remotion](https://www.remotion.dev/license).

Références utilisées : [Route Handlers Next.js](https://nextjs.org/docs/app/getting-started/route-handlers), [Player Remotion](https://www.remotion.dev/docs/player/player), [rendu MP4 Remotion](https://www.remotion.dev/docs/renderer/render-media), [JSON structuré Claude](https://platform.claude.com/docs/en/build-with-claude/structured-outputs), [prompts Claude](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices).
