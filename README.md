# Ludothèque de jeux de société — version Cloudflare

Cette version est prête à être déposée dans le dépôt GitHub `ludotheque-jeux` puis publiée avec **Cloudflare Workers Static Assets**.

## Structure

```text
ludotheque-jeux/
├── public/
│   ├── index.html
│   ├── styles.css
│   ├── app.js
│   ├── games-data.js
│   ├── chess.js
│   ├── checkers.js
│   ├── go.js
│   └── abalone.js
├── .gitignore
├── package.json
├── README.md
└── wrangler.jsonc
```

Le dossier `public/` contient le site envoyé aux visiteurs. Les autres fichiers servent au développement et au déploiement Cloudflare.

## 1. Tester sans Cloudflare

Depuis le dossier du projet :

```bash
py -m http.server 8000 --directory public
```

Puis ouvrir :

```text
http://localhost:8000
```

## 2. Tester avec Wrangler

Node.js doit être installé. Depuis le dossier du projet :

```bash
npm install
npm run dev
```

Wrangler affiche alors l'adresse locale à ouvrir dans le navigateur.

## 3. Mettre les fichiers dans GitHub

Si le dépôt `ludotheque-jeux` est encore vide, le plus simple est de copier **le contenu de ce dossier** à la racine du dépôt puis d'utiliser GitHub Desktop, ou les commandes suivantes :

```bash
git add .
git commit -m "Premiere version Cloudflare de la Ludotheque"
git push
```

Le fichier `wrangler.jsonc` doit rester à la racine du dépôt, et non dans `public/`.

## 4. Connecter GitHub à Cloudflare

Dans le tableau de bord Cloudflare :

1. Ouvrir **Workers & Pages**.
2. Cliquer **Create application**.
3. Choisir **Import a repository**.
4. Autoriser l'accès à GitHub si nécessaire.
5. Sélectionner le dépôt **ludotheque-jeux**.
6. Choisir la branche de production `main`.
7. Ne pas ajouter de commande de compilation : le site n'en a pas besoin.
8. Conserver comme commande de déploiement :

```text
npx wrangler deploy
```

9. Enregistrer et lancer le déploiement.

Cloudflare utilisera `wrangler.jsonc` et publiera tout le contenu de `public/`.

## 5. Adresse publique

Après le premier déploiement, Cloudflare fournit une adresse ressemblant à :

```text
https://ludotheque-jeux.<votre-sous-domaine>.workers.dev
```

Chaque nouveau `git push` sur la branche de production pourra ensuite déclencher automatiquement un nouveau déploiement.

## 6. Déploiement manuel facultatif

Si vous préférez publier depuis votre PC :

```bash
npm install
npx wrangler login
npm run deploy
```

La commande `wrangler login` ouvre le navigateur pour autoriser votre compte Cloudflare.

## Étapes futures prévues

La structure est volontairement prête à évoluer. Plus tard, nous pourrons ajouter :

- Cloudflare D1 pour les comptes, sauvegardes, classements et statistiques ;
- Workers pour les API serveur ;
- Durable Objects + WebSockets pour les parties multijoueurs en temps réel ;
- un contrôle des coups côté serveur afin que le navigateur ne soit pas l'arbitre de la partie.

Pour l'instant, les sauvegardes Abalone restent stockées localement dans le navigateur via `localStorage`.
