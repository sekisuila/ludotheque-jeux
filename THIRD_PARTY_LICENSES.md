# Logiciels tiers

## Stockfish 19 / Stockfish.js 19.0.0

Strathasard utilise la version **lite single-threaded WebAssembly** de Stockfish.js
19.0.0 pour le mode Joueur contre IA aux échecs.

- Licence du moteur : GNU General Public License version 3 (GPLv3)
- Paquet distribué : `stockfish@19.0.0`
- Fichiers : `stockfish-19-lite-single.js` et `stockfish-19-lite-single.wasm`
- Source Stockfish.js correspondant à Stockfish 19 :
  https://github.com/nmrugg/stockfish.js/commit/54fde71d90c7c403964f6cacef48f7bbec495df1
- Source Stockfish 19 indiquée par ce port :
  https://github.com/official-stockfish/Stockfish/commit/edb0d9db6731067ec50ce619ff372b463bc4dd5d

Au déploiement, `scripts/copy-stockfish.mjs` copie également `Copying.txt`
du paquet npm dans `public/vendor/stockfish/Copying.txt`, afin que le texte
complet de la GPLv3 soit livré avec le moteur.

Le moteur tiers n'est pas modifié. Le code propre à Strathasard dialogue avec
lui par le protocole UCI.
