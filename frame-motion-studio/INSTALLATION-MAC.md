# Installer Frame sur le Mac

Ce paquet contient le code Next.js/Remotion, les prompts Claude, les tests et trois projets Shopify avec leurs images. Les dépendances et les caches Windows sont exclus : ils seront installés pour ton Mac. La clé API reste à renseigner localement.

## Lancer le studio

1. Installer Node.js 22 ou 24 depuis le [site officiel de Node.js](https://nodejs.org/en/download), si ce n’est pas déjà fait.
2. Décompresser `frame-motion-studio-mac.zip`. Le dossier principal s’appelle `frame-motion-studio`.
3. Ouvrir Terminal dans ce dossier. Si tu l’as décompressé dans Téléchargements :

```sh
cd ~/Downloads/frame-motion-studio
npm ci
cp .env.example .env.local
```

4. Ouvrir `.env.local`, renseigner `ANTHROPIC_API_KEY`, enregistrer, puis lancer :

```sh
npm run dev
```

5. Ouvrir [le studio local](http://127.0.0.1:3000). Garder ce terminal ouvert pendant les créations et exports.

Sans clé, le mode démo fonctionne. Avec une clé, les briefs et retouches sont transmis à Claude. Le modèle et l’envoi des images sont configurables dans `.env.local`. Après modification de ce fichier, arrêter le serveur avec Ctrl+C puis relancer `npm run dev`.

Si le port 3000 est déjà utilisé, arrêter l’autre application ou lancer `npm run dev -- --port 3001`, puis utiliser `http://127.0.0.1:3001` pour les liens ci-dessous.

## Retrouver Shopify

Ces projets sont inclus dans `data/projects/`, avec leurs visuels dans `data/assets/` :

- [Storyboard réellement généré par Claude](http://127.0.0.1:3000/?project=74d682ba-ca9f-45e1-9aed-e840973d3870).
- [Essai Shopify de l’utilisateur](http://127.0.0.1:3000/?project=822d4ae9-228d-4d35-81bb-7a323f1e793e).
- [Film Shopify préparé initialement](http://127.0.0.1:3000/?project=766536e5-4411-4b66-a5df-bd2f00fa5bd0).

Le premier projet comprend la retouche du CTA « Créer ma boutique » testée avec Claude. Les fichiers vidéo de démonstration sont dans `exemples/`. Les anciens jobs de rendu Windows ne sont pas importés ; cliquer sur « Exporter la vidéo » pour créer un nouvel export sur le Mac.

## Préparer l’export MP4

Avant le premier export, dans un deuxième terminal ouvert dans le même dossier :

```sh
npm run browser:install
```

Remotion télécharge le navigateur de rendu adapté à la machine. Conserver `REMOTION_BROWSER_EXECUTABLE` commenté dans `.env.local` pour utiliser ce navigateur automatiquement. Les chemins Chrome/Edge Windows des commentaires ne s’appliquent pas au Mac.

## Vérifier ou poursuivre le développement

```sh
npm run typecheck
npm test
npm run eval:prompts
```

Ces vérifications ne font aucun appel Claude. La commande `npm run eval:prompts -- --live --case=shopify` utilise réellement l’API et consomme du quota. Voir [le guide de prompting](prompts/README.md).

Le code a été compilé et testé sur Windows. L’archive et les références d’images ont été vérifiées ; l’exécution sur macOS reste à confirmer sur ton Mac.
