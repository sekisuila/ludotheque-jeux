# Strathasard — comptes, D1 et multijoueur

Ce dépôt contient le site Strathasard et sa couche serveur Cloudflare.

## Moteur d’échecs Stockfish 19

Le mode **Joueur contre IA** des Échecs peut utiliser Stockfish 19 en WebAssembly,
version `lite single-threaded`, avec limitation de force UCI entre environ
1320 et 3000 Elo, plus un mode maximum. Les trois anciennes IA légères restent
disponibles pour les joueurs débutants.

Le paquet `stockfish@19.0.0` est installé par npm. Le script
`scripts/copy-stockfish.mjs` copie au moment de l’installation les fichiers
du moteur dans `public/vendor/stockfish/`, afin qu’ils soient servis comme
assets statiques par Cloudflare.

La licence GPLv3 complète est disponible dans
`public/vendor/stockfish/Copying.txt`, et les références vers le code source
exact sont dans `public/vendor/stockfish/SOURCE.txt` et
`THIRD_PARTY_LICENSES.md`.


## Fonctions ajoutées

- comptes utilisateurs par pseudo + mot de passe ;
- session conservée dans un cookie HttpOnly ;
- mots de passe dérivés avec PBKDF2/SHA-256 et sel aléatoire ;
- sauvegardes Abalone en ligne dans Cloudflare D1 ;
- salons Abalone privés avec code de 6 caractères ;
- partie temps réel entre deux navigateurs avec WebSocket ;
- un Durable Object SQLite par salon ;
- validation des coups Abalone côté serveur avant diffusion ;
- conservation des anciennes sauvegardes locales dans le navigateur.

> Cette V6 est un **socle de test**. Avant une ouverture publique importante, il faudra encore ajouter récupération de mot de passe/e-mail, protection anti-abus (Turnstile/rate limiting), politique de confidentialité et outils d'administration.

---

## Structure du dépôt

```text
ludotheque-jeux/
├── public/                 # le site visible par les visiteurs
│   ├── index.html
│   ├── app.js
│   ├── online.js           # client API / WebSocket
│   ├── abalone.js
│   └── ...
├── src/
│   ├── index.js            # Worker : API comptes/sauvegardes/salons
│   ├── abalone-room.js     # Durable Object WebSocket
│   └── abalone-engine.js   # règles Abalone côté serveur
├── migrations/
│   └── 0001_initial.sql    # tables D1
├── wrangler.jsonc
├── package.json
└── README.md
```

---

# Installation dans Cloudflare — méthode tableau de bord

## 1. Créer la base D1

Dans Cloudflare :

1. Ouvrir **Storage & Databases** / **D1 SQL Database**.
2. Cliquer sur **Create Database**.
3. Nommer la base exactement :

```text
ludotheque-jeux-db
```

4. Facultatif : choisir une localisation/juridiction adaptée à votre projet.
5. Cliquer sur **Create**.

## 2. Copier l'identifiant D1

Dans la page de la base, récupérer son **Database ID** (UUID).

Ouvrir ensuite `wrangler.jsonc` dans GitHub et remplacer :

```text
00000000-0000-0000-0000-000000000000
```

par le vrai identifiant de la base.

Ne modifiez pas :

```jsonc
"binding": "DB",
"database_name": "ludotheque-jeux-db"
```

## 3. Créer les tables

Dans Cloudflare :

1. ouvrir la base `ludotheque-jeux-db` ;
2. ouvrir l'onglet **Console** ;
3. ouvrir dans GitHub le fichier `migrations/0001_initial.sql` ;
4. copier tout son contenu ;
5. le coller dans la console D1 ;
6. cliquer sur **Execute**.

Les tables suivantes doivent apparaître :

```text
users
sessions
saves
rooms
```

## 4. Envoyer la V6 dans GitHub

À la racine du dépôt GitHub `ludotheque-jeux`, il faut désormais avoir :

```text
public/
src/
migrations/
wrangler.jsonc
package.json
README.md
```

Attention : `src` et `migrations` doivent être à la racine, au même niveau que `public`.

## 5. Laisser Cloudflare redéployer

Le projet GitHub étant déjà connecté à Cloudflare, le nouveau commit doit déclencher le déploiement.

La commande de déploiement peut rester :

```text
npx wrangler deploy
```

Le fichier `wrangler.jsonc` :

- publie `public/` comme fichiers statiques ;
- envoie `/api/*` au Worker ;
- relie D1 sous le nom `DB` ;
- relie les salons sous le nom `ABALONE_ROOMS` ;
- déclare `AbaloneRoom` comme Durable Object avec stockage SQLite.

## 6. Premier test des comptes

Sur le site publié :

1. ouvrir **Compte** dans le menu ;
2. créer un pseudo ;
3. utiliser un mot de passe d'au moins 10 caractères ;
4. vérifier que le pseudo apparaît ensuite dans le menu.

## 7. Tester une sauvegarde en ligne

1. ouvrir **Jouer → Abalone** ;
2. jouer quelques coups ;
3. saisir éventuellement un nom ;
4. cliquer **Enregistrer en ligne** ;
5. recharger la page ;
6. la partie doit apparaître dans la liste **Sauvegardes D1**.

Les sauvegardes locales restent disponibles séparément.

## 8. Tester le multijoueur sur deux appareils

Il faut deux comptes différents.

### Joueur 1

1. se connecter ;
2. ouvrir Abalone ;
3. choisir **Multijoueur en ligne** ;
4. cliquer **Créer un salon** ;
5. noter le code de 6 caractères affiché ;
6. transmettre ce code au joueur 2.

Le créateur joue **Noir**.

### Joueur 2

1. ouvrir le même site sur un autre navigateur/appareil ;
2. se connecter avec un autre compte ;
3. ouvrir Abalone ;
4. choisir **Multijoueur en ligne** ;
5. saisir le code ;
6. cliquer **Rejoindre**.

Le second joueur joue **Blanc**.

Les coups transitent ensuite par WebSocket. Le Durable Object vérifie le coup côté serveur puis envoie la nouvelle position aux deux joueurs.

---

# Méthode Wrangler facultative

Pour travailler depuis le PC :

```bash
npm install
```

Appliquer la base locale :

```bash
npm run db:local
```

Lancer le site + Worker localement :

```bash
npm run dev
```

Pour appliquer les migrations à la vraie base Cloudflare :

```bash
npm run db:remote
```

Puis déployer :

```bash
npm run deploy
```

---

# Sécurité de cette première version

Déjà inclus :

- cookie de session `HttpOnly`, `Secure`, `SameSite=Lax` ;
- token de session aléatoire ;
- seul le hash SHA-256 du token est stocké en base ;
- mots de passe salés et dérivés avec PBKDF2/SHA-256 ;
- requêtes de sauvegarde liées au compte courant ;
- WebSocket accessible seulement aux deux comptes inscrits dans le salon ;
- règles Abalone revérifiées côté serveur.

À ajouter avant une ouverture publique importante :

- vérification d'adresse e-mail ;
- récupération/changement de mot de passe ;
- Cloudflare Turnstile sur inscription/connexion ;
- limitation des tentatives de connexion ;
- outils de modération et suppression de compte ;
- mentions légales et politique de confidentialité ;
- expiration/nettoyage automatique des anciens salons et sessions.

---

# Étape suivante proposée

Tester d'abord Abalone entre deux comptes et deux appareils. Une fois ce circuit validé, la même architecture pourra être appliquée aux Échecs, Dames, Go et Awélé sans refaire toute l'infrastructure.
