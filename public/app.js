const app = document.getElementById("app");
const menuButton = document.getElementById("menuButton");
const mainNav = document.getElementById("mainNav");

menuButton.addEventListener("click", () => {
  const isOpen = mainNav.classList.toggle("open");
  menuButton.setAttribute("aria-expanded", String(isOpen));
});

window.addEventListener("hashchange", router);
window.addEventListener("DOMContentLoaded", router);

function router() {
  mainNav.classList.remove("open");
  menuButton.setAttribute("aria-expanded", "false");

  const raw = location.hash.replace(/^#\/?/, "") || "accueil";
  const [route, id] = raw.split("/");

  if (route === "accueil") renderHome();
  else if (route === "catalogue") renderCatalogue();
  else if (route === "jeu" && id) renderGame(id);
  else if (route === "jouer") renderPlay(id);
  else if (route === "apropos") renderAbout();
  else if (route === "compte") renderAccount();
  else if (route === "recuperation") renderRecovery();
  else renderNotFound();

  requestAnimationFrame(() => {
    app.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "instant" });
  });
}

function renderHome() {
  app.innerHTML = `
    <div class="page">
      <section class="hero">
        <div>
          <div class="eyebrow">Une encyclopédie ludique et interactive</div>
          <h1>Les grands jeux de société, réunis au même endroit.</h1>
          <p>Apprenez les règles des jeux classiques, abstraits, de cartes, de dés et de plateau. Les fiches sont pensées pour accueillir des illustrations, des démonstrations animées et des versions jouables.</p>
          <div class="hero-actions">
            <a class="btn light" href="#/catalogue">Explorer les jeux</a>
            <a class="btn outline" style="color:white" href="#/jouer/echecs">Jouer aux Échecs</a>
          </div>
        </div>
        <div class="hero-visual" aria-hidden="true">
          <div class="hero-game-stack">
            <div class="game-token t1">♞</div>
            <div class="game-token t2">⚂</div>
            <div class="game-token t3">●</div>
          </div>
        </div>
      </section>

      <section class="section">
        <div class="section-head">
          <div>
            <div class="eyebrow">À découvrir</div>
            <h2>Quelques incontournables</h2>
          </div>
          <a class="btn outline small" href="#/catalogue">Voir tout le catalogue</a>
        </div>
        <div class="grid cards">${GAMES.slice(0, 6).map(gameCard).join("")}</div>
      </section>

      <section class="section">
        <div class="section-head">
          <div>
            <div class="eyebrow">Une base évolutive</div>
            <h2>Prévu pour apprendre, observer et jouer</h2>
          </div>
        </div>
        <div class="feature-list">
          <article class="feature"><div class="ico">📖</div><h3>Règles illustrées</h3><p>Chaque fiche combine explications, étapes numérotées et schémas visuels sans dépendre d'images externes.</p></article>
          <article class="feature"><div class="ico">🧠</div><h3>Jeux contre IA</h3><p>Le site inclut maintenant l’Awélé, les Échecs, deux variantes de Dames, le Go et Abalone jouables, avec plusieurs niveaux d’IA.</p></article>
          <article class="feature"><div class="ico">🌐</div><h3>Multijoueur extensible</h3><p>La structure est prête à recevoir plus tard un serveur WebSocket pour jouer à distance entre utilisateurs.</p></article>
        </div>
      </section>
    </div>
  `;
}

function renderCatalogue() {
  app.innerHTML = `
    <div class="page">
      <div class="section-head">
        <div>
          <div class="eyebrow">Ludothèque</div>
          <h1>Catalogue des jeux</h1>
          <p class="section-lead">Recherchez un jeu ou filtrez par grande famille.</p>
        </div>
      </div>
      <div class="filters">
        <input id="gameSearch" class="search-input" type="search" placeholder="Rechercher : échecs, cartes, Catan…" aria-label="Rechercher un jeu" />
        <select id="categoryFilter" aria-label="Filtrer par catégorie">
          <option value="">Toutes les catégories</option>
          ${[...new Set(GAMES.map(g => g.category))].map(cat => `<option>${cat}</option>`).join("")}
        </select>
      </div>
      <div id="catalogGrid" class="grid cards"></div>
    </div>
  `;

  const search = document.getElementById("gameSearch");
  const filter = document.getElementById("categoryFilter");
  const grid = document.getElementById("catalogGrid");

  const refresh = () => {
    const q = normalize(search.value);
    const cat = filter.value;
    const list = GAMES.filter(g => {
      const text = normalize(`${g.name} ${g.category} ${g.intro}`);
      return (!q || text.includes(q)) && (!cat || g.category === cat);
    });
    grid.innerHTML = list.length ? list.map(gameCard).join("") : `<div class="empty">Aucun jeu ne correspond à votre recherche.</div>`;
  };

  search.addEventListener("input", refresh);
  filter.addEventListener("change", refresh);
  refresh();
}

function renderGame(id) {
  const game = GAMES.find(g => g.id === id);
  if (!game) return renderNotFound();
  if (id === "echecs") return renderChessGamePage(game);
  if (id === "dames") return renderDraughtsGamePage(game);
  if (id === "go") return renderGoGamePage(game);
  if (id === "abalone") return renderAbaloneGamePage(game);

  app.innerHTML = `
    <div class="page">
      <div class="breadcrumb"><a href="#/accueil">Accueil</a><span>›</span><a href="#/catalogue">Catalogue</a><span>›</span><span>${game.name}</span></div>
      <section class="game-hero">
        <div class="game-hero-visual">${illustration(game.art, true)}</div>
        <div>
          <div class="eyebrow">${game.category}</div>
          <h1>${game.name}</h1>
          <p>${game.intro}</p>
          <div class="stats">
            <div class="stat"><strong>${game.players}</strong><span>Participants</span></div>
            <div class="stat"><strong>${game.duration}</strong><span>Durée</span></div>
            <div class="stat"><strong>${game.difficulty}</strong><span>Niveau</span></div>
          </div>
          ${game.demo ? `<div class="hero-actions"><a class="btn" href="#/jouer/${game.id}">Jouer à la démo</a></div>` : ""}
        </div>
      </section>

      <div class="content-grid">
        <article class="panel">
          <h2>But du jeu</h2>
          <p>${game.goal}</p>
          <div class="rule-illustration">${illustration(game.art, false)}</div>
          <h2>Règles essentielles</h2>
          <ol class="rule-list">${game.rules.map(r => `<li>${r}</li>`).join("")}</ol>
          <div class="note" style="margin-top:20px"><strong>Conseil :</strong> ${game.tips}</div>
        </article>
        <aside class="panel">
          <h3>Sur cette fiche</h3>
          <div class="sidebar-links">
            <a href="#/jeu/${game.id}">Règles illustrées</a>
            ${game.demo ? `<a href="#/jouer/${game.id}">Démo interactive</a>` : `<span class="tag">Démo à ajouter</span>`}
            <a href="#/catalogue">Retour au catalogue</a>
          </div>
          <hr style="border:0;border-top:1px solid var(--line);margin:20px 0">
          <h3>Évolution possible</h3>
          <p class="section-lead">Cette fiche pourra encore recevoir davantage d'animations, d'exercices guidés et un mode multijoueur en ligne.</p>
        </aside>
      </div>
    </div>
  `;
}


function renderGoGamePage(game) {
  app.innerHTML = `
    <div class="page">
      <div class="breadcrumb"><a href="#/accueil">Accueil</a><span>›</span><a href="#/catalogue">Catalogue</a><span>›</span><span>Go</span></div>

      <section class="game-hero go-game-hero">
        <div class="game-hero-visual">${illustration("go", true)}</div>
        <div>
          <div class="eyebrow">${game.category}</div>
          <h1>Le jeu de Go</h1>
          <p>Un jeu aux règles très courtes mais d’une profondeur exceptionnelle : on pose des pierres sur les intersections du goban pour construire des groupes vivants, capturer et contrôler davantage d’espace que l’adversaire.</p>
          <div class="stats">
            <div class="stat"><strong>19 × 19</strong><span>Goban traditionnel</span></div>
            <div class="stat"><strong>9 × 9 / 13 × 13</strong><span>Apprentissage</span></div>
            <div class="stat"><strong>2 joueurs</strong><span>Noir puis Blanc</span></div>
          </div>
          <div class="hero-actions">
            <a class="btn" href="#/jouer/go">Jouer au Go</a>
            <a class="btn outline" href="#goLiberties">Comprendre les libertés</a>
          </div>
        </div>
      </section>

      <div class="chess-toc panel go-toc">
        <strong>Sur cette page :</strong>
        <a href="#goBoardRules">Le goban</a>
        <a href="#goLiberties">Libertés & captures</a>
        <a href="#goKo">Ko & coups interdits</a>
        <a href="#goLife">Vie, yeux & territoire</a>
        <a href="#goEnd">Fin & score</a>
      </div>

      <section id="goBoardRules" class="section rule-section">
        <div class="section-head"><div><div class="eyebrow">1. Le plateau</div><h2>On joue sur les intersections</h2><p class="section-lead">Contrairement aux Échecs ou aux Dames, les pierres ne sont pas posées dans les cases mais à l’intersection des lignes.</p></div></div>
        <div class="go-rule-grid">
          <article class="panel">
            <h3>Le goban traditionnel</h3>
            <p>Le plateau standard comporte <strong>19 lignes horizontales et 19 lignes verticales</strong>, soit 361 intersections. Noir joue en premier, puis Blanc. Une pierre posée ne se déplace plus.</p>
            ${goRuleDiagram(7, [{r:1,c:1,color:"black"},{r:3,c:3,color:"white"},{r:5,c:5,color:"black"}], [{r:1,c:5},{r:5,c:1}])}
          </article>
          <article class="panel">
            <h3>9 × 9 et 13 × 13</h3>
            <p>Les petits gobans utilisent exactement les mêmes règles. Le <strong>9 × 9</strong> est idéal pour apprendre : les combats apparaissent plus vite et les parties sont beaucoup plus courtes.</p>
            <div class="mini-tip">Le jeu interactif permet de passer instantanément du 19 × 19 au 13 × 13 ou au 9 × 9.</div>
            <h3 style="margin-top:20px">But général</h3>
            <p>À la fin de la partie, le gagnant est celui qui contrôle le plus de points selon le système de comptage choisi, après ajout du <strong>komi</strong> accordé à Blanc.</p>
          </article>
        </div>
      </section>

      <section id="goLiberties" class="section rule-section">
        <div class="section-head"><div><div class="eyebrow">2. Libertés & captures</div><h2>La notion centrale du Go</h2><p class="section-lead">Une liberté est une intersection vide directement adjacente horizontalement ou verticalement à une pierre ou à un groupe.</p></div></div>
        <div class="go-lesson-cards">
          <article class="panel">
            <h3>Une pierre possède jusqu’à 4 libertés</h3>
            <p>Une pierre isolée au centre possède quatre libertés. Sur un bord elle en possède trois, et dans un coin seulement deux.</p>
            ${goRuleDiagram(5, [{r:2,c:2,color:"black"}], [{r:1,c:2},{r:2,c:1},{r:2,c:3},{r:3,c:2}])}
          </article>
          <article class="panel">
            <h3>Les pierres connectées forment un groupe</h3>
            <p>Deux pierres de même couleur reliées horizontalement ou verticalement partagent leurs libertés. Les diagonales ne connectent pas directement les pierres.</p>
            ${goRuleDiagram(5, [{r:2,c:1,color:"black"},{r:2,c:2,color:"black"},{r:3,c:2,color:"black"}], [{r:1,c:1},{r:1,c:2},{r:2,c:0},{r:2,c:3},{r:3,c:1},{r:3,c:3},{r:4,c:2}])}
          </article>
          <article class="panel">
            <h3>Atari : une seule liberté restante</h3>
            <p>Lorsqu’un groupe n’a plus qu’une seule liberté, il est en <strong>atari</strong>. Si l’adversaire occupe cette dernière liberté, tout le groupe est capturé.</p>
            ${goRuleDiagram(5, [{r:2,c:2,color:"white"},{r:1,c:2,color:"black"},{r:2,c:1,color:"black"},{r:3,c:2,color:"black"}], [{r:2,c:3}], [{r:2,c:3,type:"capture"}])}
          </article>
          <article class="panel">
            <h3>Capture</h3>
            <p>Après la pose d’une pierre, tout groupe adverse sans liberté est retiré du goban. Une seule pierre peut donc parfois capturer plusieurs pierres en même temps.</p>
            ${goRuleDiagram(5, [{r:2,c:2,color:"white"},{r:2,c:3,color:"white"},{r:1,c:2,color:"black"},{r:1,c:3,color:"black"},{r:2,c:1,color:"black"},{r:2,c:4,color:"black"},{r:3,c:2,color:"black"}], [{r:3,c:3}], [{r:3,c:3,type:"capture"}])}
          </article>
        </div>
      </section>

      <section id="goKo" class="section rule-section">
        <div class="section-head"><div><div class="eyebrow">3. Coups interdits</div><h2>Suicide et règle du ko</h2></div></div>
        <div class="lesson-grid">
          <article class="panel"><div class="rule-icon">⊘</div><h3>Suicide</h3><p>On ne peut pas poser une pierre si, après les captures éventuelles, son propre groupe ne possède aucune liberté. En revanche, un coup qui semble suicidaire mais capture d’abord des pierres adverses est légal.</p></article>
          <article class="panel"><div class="rule-icon">↺</div><h3>Ko</h3><p>Il est interdit de reprendre immédiatement une pierre si cela recrée exactement la position précédente. Le joueur doit d’abord jouer ailleurs ; il pourra éventuellement revenir ensuite.</p>${goRuleDiagram(5, [{r:1,c:2,color:"black"},{r:2,c:1,color:"black"},{r:3,c:2,color:"black"},{r:2,c:2,color:"white"},{r:1,c:3,color:"white"},{r:3,c:3,color:"white"},{r:2,c:4,color:"white"}], [{r:2,c:3}], [{r:2,c:3,type:"ko"}])}</article>
          <article class="panel"><div class="rule-icon">✓</div><h3>Le moteur vous protège</h3><p>Dans la version interactive, une intersection occupée, un suicide ou une reprise immédiate de ko ne peut pas être sélectionné. Les coups légaux sont contrôlés avant chaque pose.</p></article>
        </div>
      </section>

      <section id="goLife" class="section rule-section">
        <div class="section-head"><div><div class="eyebrow">4. Vie & territoire</div><h2>Construire des groupes que l’adversaire ne peut pas capturer</h2></div></div>
        <div class="go-rule-grid">
          <article class="panel">
            <h3>Deux yeux</h3>
            <p>Un groupe possédant deux espaces internes séparés — deux <strong>yeux</strong> — ne peut normalement pas être capturé : l’adversaire devrait jouer dans l’un des yeux sans pouvoir supprimer la dernière liberté du groupe.</p>
            ${goRuleDiagram(7, [{r:1,c:1,color:"black"},{r:1,c:2,color:"black"},{r:1,c:3,color:"black"},{r:1,c:4,color:"black"},{r:1,c:5,color:"black"},{r:2,c:1,color:"black"},{r:2,c:3,color:"black"},{r:2,c:5,color:"black"},{r:3,c:1,color:"black"},{r:3,c:2,color:"black"},{r:3,c:3,color:"black"},{r:3,c:4,color:"black"},{r:3,c:5,color:"black"}], [{r:2,c:2},{r:2,c:4}], [{r:2,c:2,type:"eye"},{r:2,c:4,type:"eye"}])}
          </article>
          <article class="panel">
            <h3>Territoire</h3>
            <p>Une zone vide complètement entourée par une seule couleur appartient à cette couleur lors du comptage. Les intersections neutres, bordées par les deux camps, ne sont attribuées à personne.</p>
            <div class="note"><strong>Important :</strong> déterminer si une pierre est réellement morte peut demander de poursuivre le jeu. Dans le prototype, il est préférable de capturer les groupes contestés avant de passer deux fois.</div>
          </article>
        </div>
      </section>

      <section id="goEnd" class="section rule-section">
        <div class="section-head"><div><div class="eyebrow">5. Fin et score</div><h2>Deux passes consécutives terminent la partie</h2></div></div>
        <div class="lesson-grid">
          <article class="panel"><h3>Passer</h3><p>Un joueur peut passer lorsqu’il estime qu’aucun coup utile ne reste. Lorsque les deux joueurs passent consécutivement, la partie s’arrête et le score est calculé.</p></article>
          <article class="panel"><h3>Comptage par aire</h3><p>Dans le mode par aire, on compte les pierres présentes sur le goban et les intersections vides entourées. C’est le mode par défaut de notre jeu interactif car il se prête bien à un comptage automatique.</p></article>
          <article class="panel"><h3>Territoire & prisonniers</h3><p>Le site propose aussi un comptage simplifié par territoire : territoire entouré + prisonniers capturés. Pour un résultat fiable, les pierres mortes doivent avoir été retirées par le jeu.</p></article>
        </div>
        <div class="play-cta panel"><div><div class="eyebrow">À vous de jouer</div><h2>9 × 9, 13 × 13 ou 19 × 19</h2><p>Jouez à deux sur le même écran ou contre l’IA. Le plateau, le komi et le système de comptage sont réglables.</p></div><a class="btn" href="#/jouer/go">Ouvrir le goban interactif</a></div>
      </section>
    </div>
  `;

  app.querySelectorAll('a[href^="#go"]').forEach(link => {
    link.addEventListener("click", event => {
      event.preventDefault();
      document.querySelector(link.getAttribute("href"))?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}


function renderAbaloneGamePage(game) {
  const setupBoard = abStandardBoard();
  const setupStones = AB_CELLS
    .map(([q,r]) => ({ q, r, value: setupBoard[abKey(q,r)] }))
    .filter(s => s.value)
    .map(s => ({ q:s.q, r:s.r, color:s.value === AB_BLACK ? "black" : "white" }));

  app.innerHTML = `
    <div class="page abalone-rules-page">
      <div class="breadcrumb"><a href="#/accueil">Accueil</a><span>›</span><a href="#/catalogue">Catalogue</a><span>›</span><span>Abalone</span></div>

      <section class="game-hero abalone-game-hero">
        <div class="game-hero-visual">${illustration("abalone", true)}</div>
        <div>
          <div class="eyebrow">${game.category}</div>
          <h1>Abalone</h1>
          <p>Un duel de placement et de poussée sur un plateau hexagonal. Le principe est simple : rester groupé, créer une supériorité numérique en ligne et repousser progressivement les billes adverses jusqu’au bord.</p>
          <div class="stats">
            <div class="stat"><strong>14 + 14</strong><span>Billes</span></div>
            <div class="stat"><strong>61</strong><span>Emplacements</span></div>
            <div class="stat"><strong>6 éjections</strong><span>pour gagner</span></div>
          </div>
          <div class="hero-actions">
            <a class="btn" href="#/jouer/abalone">Jouer à Abalone</a>
            <a class="btn outline" href="#abaloneSumito">Comprendre le Sumito</a>
          </div>
        </div>
      </section>

      <div class="chess-toc panel abalone-toc">
        <strong>Sur cette page :</strong>
        <a href="#abaloneSetup">Mise en place</a>
        <a href="#abaloneMoves">Déplacements</a>
        <a href="#abaloneSumito">Sumito</a>
        <a href="#abaloneLimits">Coups interdits</a>
        <a href="#abaloneStrategy">Premiers principes</a>
      </div>

      <section id="abaloneSetup" class="section rule-section">
        <div class="section-head"><div><div class="eyebrow">1. Objectif & préparation</div><h2>Pousser six billes hors du plateau</h2><p class="section-lead">Chaque joueur possède 14 billes. Noir commence. La partie est gagnée dès que six billes adverses ont été expulsées.</p></div></div>
        <div class="abalone-rule-grid">
          <article class="panel">
            <h3>Position standard</h3>
            <p>Les deux camps occupent des zones opposées du plateau. Cette position est utilisée dans notre jeu interactif.</p>
            ${abaloneRuleDiagram(setupStones, [], null, true)}
          </article>
          <article class="panel">
            <h3>Un plateau hexagonal</h3>
            <p>Les 61 emplacements forment neuf rangées de <strong>5, 6, 7, 8, 9, 8, 7, 6 et 5</strong> positions. Chaque emplacement possède jusqu’à six voisins.</p>
            <div class="mini-tip">D’autres positions de départ existent, notamment Belgian Daisy et German Daisy. Elles pourront être ajoutées comme variantes ultérieurement.</div>
          </article>
        </div>
      </section>

      <section id="abaloneMoves" class="section rule-section">
        <div class="section-head"><div><div class="eyebrow">2. Déplacer ses billes</div><h2>Une, deux ou trois billes — une seule case</h2><p class="section-lead">Deux ou trois billes doivent être adjacentes et alignées pour être déplacées ensemble.</p></div></div>
        <div class="abalone-lesson-grid">
          <article class="panel">
            <h3>Déplacement en ligne</h3>
            <p>Une ligne de 1, 2 ou 3 billes peut avancer ou reculer d’un emplacement dans son propre axe, si l’espace nécessaire est libre.</p>
            ${abaloneRuleDiagram([
              {q:-1,r:0,color:"black"},{q:0,r:0,color:"black"},{q:1,r:0,color:"black"}
            ], [{q:2,r:0}], {from:{q:1,r:0},to:{q:2,r:0}})}
          </article>
          <article class="panel">
            <h3>Déplacement latéral</h3>
            <p>Une ligne de 2 ou 3 billes peut glisser latéralement. Toutes les cases d’arrivée doivent être libres.</p>
            ${abaloneRuleDiagram([
              {q:-1,r:0,color:"black"},{q:0,r:0,color:"black"},{q:1,r:0,color:"black"}
            ], [{q:-1,r:1},{q:0,r:1},{q:1,r:1}], {from:{q:0,r:0},to:{q:0,r:1}})}
          </article>
          <article class="panel">
            <h3>Une bille seule</h3>
            <p>Une bille isolée peut se déplacer vers n’importe quel emplacement voisin libre, dans l’une des six directions.</p>
            ${abaloneRuleDiagram([{q:0,r:0,color:"white"}], AB_DIRS.map(([dq,dr])=>({q:dq,r:dr})), null)}
          </article>
        </div>
      </section>

      <section id="abaloneSumito" class="section rule-section">
        <div class="section-head"><div><div class="eyebrow">3. La poussée</div><h2>Le Sumito : être plus nombreux sur la ligne</h2><p class="section-lead">Une poussée n’est possible que dans l’axe de la ligne et seulement si le groupe qui pousse est numériquement supérieur.</p></div></div>
        <div class="abalone-sumito-grid">
          <article class="panel sumito-card">
            <span class="sumito-badge">2 contre 1</span><h3>Deux poussent une</h3>
            ${abaloneRuleDiagram([{q:-2,r:0,color:"black"},{q:-1,r:0,color:"black"},{q:0,r:0,color:"white"}], [{q:1,r:0}], {from:{q:-1,r:0},to:{q:1,r:0}})}
          </article>
          <article class="panel sumito-card">
            <span class="sumito-badge">3 contre 1</span><h3>Trois poussent une</h3>
            ${abaloneRuleDiagram([{q:-3,r:0,color:"black"},{q:-2,r:0,color:"black"},{q:-1,r:0,color:"black"},{q:0,r:0,color:"white"}], [{q:1,r:0}], {from:{q:-1,r:0},to:{q:1,r:0}})}
          </article>
          <article class="panel sumito-card">
            <span class="sumito-badge">3 contre 2</span><h3>Trois poussent deux</h3>
            ${abaloneRuleDiagram([{q:-3,r:0,color:"black"},{q:-2,r:0,color:"black"},{q:-1,r:0,color:"black"},{q:0,r:0,color:"white"},{q:1,r:0,color:"white"}], [{q:2,r:0}], {from:{q:-1,r:0},to:{q:2,r:0}})}
          </article>
        </div>
        <div class="note abalone-rule-note"><strong>Éjection :</strong> si la dernière bille adverse poussée se trouve au bord et qu’il n’existe plus d’emplacement derrière elle, elle sort du plateau. La sixième éjection donne immédiatement la victoire.</div>
      </section>

      <section id="abaloneLimits" class="section rule-section">
        <div class="section-head"><div><div class="eyebrow">4. Ce qui est interdit</div><h2>La force seule ne suffit pas</h2></div></div>
        <div class="abalone-rule-grid">
          <article class="panel">
            <h3>Force égale : impossible</h3>
            <p><strong>2 contre 2</strong> et <strong>3 contre 3</strong> ne permettent aucune poussée. Le groupe attaquant doit être strictement plus nombreux.</p>
            ${abaloneRuleDiagram([{q:-2,r:0,color:"black"},{q:-1,r:0,color:"black"},{q:0,r:0,color:"white"},{q:1,r:0,color:"white"}], [], null)}
          </article>
          <article class="panel">
            <h3>Poussée bloquée</h3>
            <p>Une poussée est impossible si une bille se trouve derrière la chaîne adverse et empêche son recul. On ne pousse jamais latéralement et on ne déplace jamais plus de trois de ses propres billes.</p>
            ${abaloneRuleDiagram([{q:-2,r:0,color:"black"},{q:-1,r:0,color:"black"},{q:0,r:0,color:"white"},{q:1,r:0,color:"black"}], [], null)}
          </article>
        </div>
      </section>

      <section id="abaloneStrategy" class="section rule-section">
        <div class="section-head"><div><div class="eyebrow">5. Bien débuter</div><h2>Quatre idées stratégiques</h2></div></div>
        <div class="feature-list abalone-principles">
          <article class="feature"><div class="ico">⬢</div><h3>Rester compact</h3><p>Un groupe connecté se défend mieux. Les billes isolées près du bord deviennent des cibles faciles.</p></article>
          <article class="feature"><div class="ico">◎</div><h3>Occuper le centre</h3><p>Le centre offre davantage de directions de déplacement et réduit le risque d’éjection immédiate.</p></article>
          <article class="feature"><div class="ico">3›2</div><h3>Créer des Sumitos</h3><p>Préparez des lignes de trois billes capables de menacer une ou deux billes adverses.</p></article>
          <article class="feature"><div class="ico">↔</div><h3>Garder de la mobilité</h3><p>Les déplacements latéraux sont essentiels pour réorganiser une formation sans casser sa cohésion.</p></article>
        </div>
        <div class="play-cta panel">
          <div><div class="eyebrow">À vous de jouer</div><h2>Le moteur applique les poussées automatiquement</h2><p>Sélectionnez une à trois billes adjacentes et alignées. Les directions légales sont immédiatement indiquées.</p></div>
          <a class="btn" href="#/jouer/abalone">Ouvrir Abalone interactif</a>
        </div>
      </section>
    </div>
  `;

  app.querySelectorAll('a[href^="#abalone"]').forEach(link => {
    link.addEventListener("click", event => {
      event.preventDefault();
      document.querySelector(link.getAttribute("href"))?.scrollIntoView({ behavior:"smooth", block:"start" });
    });
  });
}

function abaloneRuleDiagram(stones = [], targets = [], arrow = null, compact = false) {
  const W = 520, H = 450;
  const cx = W/2, cy = H/2;
  const stepX = 48, stepY = 41.55;
  const pos = (q,r) => [cx + (q + r/2)*stepX, cy + r*stepY];
  const stoneMap = new Map(stones.map(s => [abKey(s.q,s.r), s]));
  const targetSet = new Set(targets.map(t => abKey(t.q,t.r)));
  let holes = "", balls = "";
  for (const [q,r] of AB_CELLS) {
    const [x,y] = pos(q,r);
    holes += `<circle cx="${x}" cy="${y}" r="16" class="ab-rule-hole ${targetSet.has(abKey(q,r))?"target":""}"/>`;
    const stone = stoneMap.get(abKey(q,r));
    if (stone) balls += `<circle cx="${x}" cy="${y}" r="18.5" class="ab-rule-marble ${stone.color}"/>`;
  }
  let arrowSvg = "";
  if (arrow) {
    const [x1,y1] = pos(arrow.from.q,arrow.from.r), [x2,y2] = pos(arrow.to.q,arrow.to.r);
    arrowSvg = `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="ab-rule-arrow" marker-end="url(#abArrow)"/>`;
  }
  return `<svg class="abalone-rule-diagram ${compact?"compact":""}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Schéma de règle Abalone"><defs><marker id="abArrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L7,3 z" fill="#b13f32"/></marker></defs><polygon points="130,22 390,22 514,225 390,428 130,428 6,225" class="ab-rule-surface"/>${holes}${balls}${arrowSvg}</svg>`;
}

function renderAbalonePlay() {
  app.innerHTML = `
    <div class="page abalone-play-page">
      <div class="breadcrumb"><a href="#/accueil">Accueil</a><span>›</span><a href="#/jouer">Jouer</a><span>›</span><span>Abalone</span></div>
      <div class="section-head">
        <div><div class="eyebrow">Jeu interactif</div><h1>Abalone</h1><p class="section-lead">Sélectionnez une à trois billes adjacentes et alignées, puis choisissez une direction légale. Le moteur gère automatiquement les Sumitos et les éjections.</p></div>
        <a class="btn outline small" href="#/jeu/abalone">Voir les règles</a>
      </div>

      <div class="abalone-play-layout">
        <section class="game-shell abalone-shell">
          <div class="go-toolbar abalone-toolbar">
            <label><span>Mode</span><select id="abaloneMode"><option value="ai">Joueur contre IA</option><option value="local">2 joueurs sur le même écran</option><option value="online">Multijoueur en ligne</option></select></label>
            <div id="abaloneAiSettings" class="toolbar-group">
              <label><span>Niveau IA</span><select id="abaloneAiLevel"><option value="easy">Facile</option><option value="medium" selected>Intermédiaire</option><option value="hard">Difficile</option><option value="expert">Expert</option></select></label>
              <label><span>Votre couleur</span><select id="abaloneSide"><option value="1" selected>Noir</option><option value="2">Blanc</option></select></label>
            </div>
            <div id="abaloneOnlineSettings" class="toolbar-group abalone-online-settings" hidden>
              <button id="createAbaloneRoom" class="btn small">Créer un salon</button>
              <label><span>Code du salon</span><input id="abaloneRoomCode" maxlength="6" placeholder="ABC234" autocomplete="off"></label>
              <button id="joinAbaloneRoom" class="btn outline small">Rejoindre</button>
              <span id="abaloneRoomStatus" class="online-room-status">Connectez-vous pour jouer en ligne.</span>
            </div>
            <div class="toolbar-actions"><button id="newAbalone" class="btn small">Nouvelle partie</button><button id="undoAbalone" class="btn outline small">Annuler</button></div>
          </div>

          <div class="abalone-savebar">
            <label><span>Nom (facultatif)</span><input id="abaloneSaveName" type="text" maxlength="40" placeholder="Ex. Partie Expert 1"></label>
            <button id="saveAbalone" class="btn small">Sauvegarder</button>
            <label class="abalone-save-select"><span>Archives locales</span><select id="abaloneSaveList"><option value="">Parties sauvegardées…</option></select></label>
            <button id="loadAbalone" class="btn outline small">Charger</button>
            <button id="deleteAbaloneSave" class="btn ghost small">Supprimer</button>
            <small id="abaloneSaveStatus" class="abalone-save-status">Les sauvegardes restent dans ce navigateur.</small>
          </div>
          <div class="abalone-savebar online-savebar">
            <strong>☁ Sauvegardes en ligne</strong>
            <button id="saveAbaloneOnline" class="btn small">Enregistrer en ligne</button>
            <label class="abalone-save-select"><span>Mon compte</span><select id="abaloneOnlineSaveList"><option value="">Sauvegardes D1…</option></select></label>
            <button id="loadAbaloneOnline" class="btn outline small">Charger</button>
            <button id="deleteAbaloneOnline" class="btn ghost small">Supprimer</button>
            <small id="abaloneOnlineSaveStatus" class="abalone-save-status">Connexion requise.</small>
          </div>

          <div class="abalone-board-wrap">
            <div id="abaloneBoard" class="abalone-board" aria-label="Plateau Abalone interactif"></div>
          </div>

          <div class="abalone-move-controls" aria-label="Directions de déplacement">
            <div class="abalone-dir-pad">
              <button data-ab-dir="4" aria-label="Nord-ouest">↖</button><span></span><button data-ab-dir="5" aria-label="Nord-est">↗</button>
              <button data-ab-dir="3" aria-label="Ouest">←</button><strong>Directions</strong><button data-ab-dir="0" aria-label="Est">→</button>
              <button data-ab-dir="2" aria-label="Sud-ouest">↙</button><span></span><button data-ab-dir="1" aria-label="Sud-est">↘</button>
            </div>
            <p>Sélection : cliquez successivement sur 1, 2 ou 3 billes de votre couleur. Recliquez sur une bille sélectionnée pour la retirer du groupe.</p>
          </div>
          <div id="abaloneStatus" class="status abalone-status"></div>
        </section>

        <aside class="abalone-side-column">
          <section class="panel">
            <div class="turn-box"><span>Trait</span><strong id="abaloneTurn">Noir</strong></div>
            <div class="abalone-score-grid">
              <div><span>Noir — billes éjectées</span><strong id="abaloneEjectBlack">0 / 6</strong></div>
              <div><span>Blanc — billes éjectées</span><strong id="abaloneEjectWhite">0 / 6</strong></div>
            </div>
            <h3>Évaluation de la position</h3>
            <div class="abalone-evaluation" aria-label="Évaluation stratégique de la position">
              <div class="abalone-eval-card black"><div><span>Noir</span><strong id="abaloneEvalBlack">50.0 / 100</strong></div><div class="abalone-eval-track"><i id="abaloneEvalBlackBar" style="width:50%"></i></div></div>
              <div class="abalone-eval-card white"><div><span>Blanc</span><strong id="abaloneEvalWhite">50.0 / 100</strong></div><div class="abalone-eval-track"><i id="abaloneEvalWhiteBar" style="width:50%"></i></div></div>
              <small id="abaloneEvalRaw">Score stratégique brut : 0 pour Noir</small>
              <p class="evaluation-help">Indice Expert : 50/50 indique une position équilibrée. Ce n’est pas une probabilité de victoire, mais une note heuristique calculée à partir des éjections, du centre, de la cohésion, de la mobilité et des menaces.</p>
            </div>
            <h3>Historique et évaluations</h3><div id="abaloneHistory" class="abalone-history"></div>
          </section>
          <section class="panel"><h3>Règles gérées</h3><p>✓ 1 à 3 billes par mouvement</p><p>✓ Déplacement en ligne</p><p>✓ Déplacement latéral</p><p>✓ Sumito 2–1, 3–1 et 3–2</p><p>✓ Blocage des forces égales</p><p>✓ Éjection et victoire à 6</p><div class="note"><strong>Astuce :</strong> les cases vertes montrent les destinations possibles. Les billes adverses bordées de rouge sont celles qu’un Sumito sélectionné peut pousser.</div></section>
          <section class="panel"><h3>Les quatre IA</h3><p><strong>Facile :</strong> choisit un coup légal au hasard.</p><p><strong>Intermédiaire :</strong> valorise le centre, la cohésion et les poussées.</p><p><strong>Difficile :</strong> examine aussi les meilleures réponses immédiates de l’adversaire.</p><p><strong>Expert :</strong> utilise un barème stratégique non linéaire (billes éjectées, centre, cohésion, mobilité, isolement, danger au bord et menaces de Sumito) puis une recherche Minimax avec élagage alpha-bêta sur plusieurs demi-coups.</p><div class="note">Le niveau Expert privilégie fortement la 5e bille éjectée : il comprend ainsi qu’une position à 5–0 est beaucoup plus proche de la victoire qu’une simple progression linéaire ne le laisserait penser.</div></section>
        </aside>
      </div>
    </div>
  `;
  initAbalone();
}

function goRuleDiagram(size, stones = [], targets = [], markers = []) {
  const stoneMap = new Map(stones.map(p => [`${p.r},${p.c}`, p]));
  const targetMap = new Map(targets.map(p => [`${p.r},${p.c}`, p]));
  const markerMap = new Map(markers.map(p => [`${p.r},${p.c}`, p.type]));
  let html = `<div class="go-rule-board" style="--go-rule-size:${size}">`;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const stone = stoneMap.get(`${r},${c}`);
      const target = targetMap.has(`${r},${c}`);
      const marker = markerMap.get(`${r},${c}`) || "";
      const edge = [r === 0 ? "edge-top" : "", r === size - 1 ? "edge-bottom" : "", c === 0 ? "edge-left" : "", c === size - 1 ? "edge-right" : ""].filter(Boolean).join(" ");
      html += `<div class="go-rule-point ${edge} ${target ? "target" : ""} ${marker ? `marker-${marker}` : ""}">${goIsStarPoint(size, r, c) && !stone ? `<span class="go-star"></span>` : ""}${stone ? `<span class="go-stone ${stone.color}"></span>` : ""}</div>`;
    }
  }
  return html + `</div>`;
}


function renderDraughtsGamePage(game) {
  app.innerHTML = `
    <div class="page">
      <div class="breadcrumb"><a href="#/accueil">Accueil</a><span>›</span><a href="#/catalogue">Catalogue</a><span>›</span><span>Dames</span></div>

      <section class="game-hero draughts-game-hero">
        <div class="game-hero-visual">${illustration("checkers", true)}</div>
        <div>
          <div class="eyebrow">${game.category}</div>
          <h1>Le jeu de Dames</h1>
          <p>Deux variantes majeures sont présentées ici : les <strong>dames françaises / internationales</strong> sur damier 10 × 10 et les <strong>dames anglaises</strong> sur damier 8 × 8.</p>
          <div class="stats">
            <div class="stat"><strong>10 × 10</strong><span>20 pions par camp</span></div>
            <div class="stat"><strong>8 × 8</strong><span>12 pions par camp</span></div>
            <div class="stat"><strong>2 joueurs</strong><span>ou contre l’IA</span></div>
          </div>
          <div class="hero-actions">
            <a class="btn" href="#/jouer/dames">Choisir une variante</a>
            <a class="btn outline" href="#draughtsCompare">Comparer les règles</a>
          </div>
        </div>
      </section>

      <div class="chess-toc panel">
        <strong>Sur cette page :</strong>
        <a href="#draughtsCompare">Comparaison</a>
        <a href="#draughtsInternational">Dames 10 × 10</a>
        <a href="#draughtsEnglish">Dames 8 × 8</a>
        <a href="#draughtsEnd">Fin de partie</a>
      </div>

      <section id="draughtsCompare" class="section rule-section">
        <div class="section-head"><div><div class="eyebrow">Deux familles proches, mais différentes</div><h2>Les différences essentielles</h2></div></div>
        <div class="table-wrap panel">
          <table class="rules-compare-table">
            <thead><tr><th>Règle</th><th>Françaises / internationales</th><th>Anglaises</th></tr></thead>
            <tbody>
              <tr><th>Damier</th><td>10 × 10, 50 cases jouables</td><td>8 × 8, 32 cases jouables</td></tr>
              <tr><th>Pièces au départ</th><td>20 blanches + 20 noires</td><td>12 rouges + 12 blanches</td></tr>
              <tr><th>Premier joueur</th><td>Les Blancs</td><td>Les Rouges</td></tr>
              <tr><th>Déplacement du pion</th><td>1 case en diagonale vers l’avant</td><td>1 case en diagonale vers l’avant</td></tr>
              <tr><th>Prise du pion</th><td>Vers l’avant <strong>ou l’arrière</strong></td><td>Vers l’avant uniquement</td></tr>
              <tr><th>Choix d’une prise</th><td>La rafle qui capture le <strong>plus grand nombre</strong> est obligatoire</td><td>Une prise est obligatoire, mais on choisit librement entre plusieurs rafles possibles</td></tr>
              <tr><th>Dame</th><td>« Volante » : plusieurs cases en diagonale</td><td>1 case en diagonale</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <section id="draughtsInternational" class="section rule-section">
        <div class="section-head"><div><div class="eyebrow">Variante 1</div><h2>Dames françaises / internationales — 10 × 10</h2><p class="section-lead">C’est la variante jouée sur un damier de 100 cases. Seules les 50 cases foncées sont utilisées.</p></div><a class="btn small" href="#/jouer/dames-internationales">Jouer en 10 × 10</a></div>
        <div class="draughts-rule-layout">
          <article class="panel">
            <h3>Mise en place</h3>
            <p>Chaque joueur possède 20 pions. Les Noirs occupent les quatre premières rangées et les Blancs les quatre dernières. Les deux rangées centrales restent libres. <strong>Les Blancs commencent.</strong></p>
            ${draughtsSetupDiagram("international")}
          </article>
          <div class="draughts-rule-cards">
            <article class="panel"><h3>1. Déplacement</h3><p>Un pion avance d’une case en diagonale vers l’avant sur une case libre.</p>${draughtsMiniDiagram(6,[{r:4,c:1,side:"white"}],[{r:3,c:0},{r:3,c:2}])}</article>
            <article class="panel"><h3>2. Prise dans les deux sens</h3><p>Le pion peut capturer vers l’avant <strong>et vers l’arrière</strong>. Il saute une pièce adverse et atterrit sur la case libre située juste derrière.</p>${draughtsMiniDiagram(6,[{r:4,c:1,side:"white"},{r:3,c:2,side:"black"},{r:3,c:0,side:"black"}],[{r:2,c:3},{r:2,c:5},{r:5,c:0},{r:5,c:2}])}</article>
            <article class="panel"><h3>3. Rafle maximale</h3><p>Si plusieurs prises existent, il faut choisir une séquence qui capture le <strong>nombre maximal de pièces</strong>. Une dame ne vaut pas davantage qu’un pion pour ce calcul.</p><div class="mini-tip">Le jeu interactif calcule automatiquement toutes les rafles autorisées.</div></article>
            <article class="panel"><h3>4. La dame volante</h3><p>Une dame peut parcourir plusieurs cases libres sur une diagonale. Pour capturer, elle franchit une pièce adverse puis peut se poser sur n’importe quelle case libre située derrière, avant de poursuivre éventuellement la rafle.</p>${draughtsMiniDiagram(7,[{r:3,c:2,side:"white",king:true}],[{r:0,c:5},{r:1,c:4},{r:2,c:3},{r:4,c:1},{r:5,c:0},{r:4,c:3},{r:5,c:4},{r:6,c:5}])}</article>
            <article class="panel"><h3>5. Promotion</h3><p>Un pion devient dame lorsqu’il <strong>termine</strong> son coup sur la dernière rangée. S’il traverse cette rangée au cours d’une rafle mais termine ailleurs, il reste pion.</p></article>
          </div>
        </div>
      </section>

      <section id="draughtsEnglish" class="section rule-section">
        <div class="section-head"><div><div class="eyebrow">Variante 2</div><h2>Dames anglaises — 8 × 8</h2><p class="section-lead">Cette variante, appelée English draughts ou checkers, utilise 12 pièces par joueur.</p></div><a class="btn small" href="#/jouer/dames-anglaises">Jouer en 8 × 8</a></div>
        <div class="draughts-rule-layout">
          <article class="panel">
            <h3>Mise en place</h3>
            <p>Les Rouges occupent les 12 premières cases jouables et les Blancs les 12 dernières. <strong>Les Rouges jouent les premiers.</strong></p>
            ${draughtsSetupDiagram("english")}
          </article>
          <div class="draughts-rule-cards">
            <article class="panel"><h3>1. Le pion avance et prend vers l’avant</h3><p>Le pion se déplace d’une case en diagonale vers l’avant. Contrairement aux dames internationales, il ne peut capturer que vers l’avant.</p>${draughtsMiniDiagram(6,[{r:1,c:2,side:"red"}],[{r:2,c:1},{r:2,c:3}])}</article>
            <article class="panel"><h3>2. Prise obligatoire</h3><p>Lorsqu’une prise est possible, elle doit être jouée. S’il existe plusieurs rafles, le joueur peut choisir celle qu’il préfère : il n’est pas obligé de capturer le plus grand nombre.</p></article>
            <article class="panel"><h3>3. Rafle complète</h3><p>Après un saut, si la même pièce peut encore capturer, elle doit continuer. Une rafle ne peut pas être interrompue volontairement.</p>${draughtsMiniDiagram(6,[{r:1,c:0,side:"red"},{r:2,c:1,side:"white"},{r:4,c:3,side:"white"}],[{r:3,c:2},{r:5,c:4}])}</article>
            <article class="panel"><h3>4. La dame anglaise</h3><p>La dame se déplace d’<strong>une seule case</strong> en diagonale, vers l’avant ou l’arrière. Elle capture également dans les quatre directions, mais sans déplacement « volant ».</p>${draughtsMiniDiagram(5,[{r:2,c:1,side:"red",king:true}],[{r:1,c:0},{r:1,c:2},{r:3,c:0},{r:3,c:2}])}</article>
            <article class="panel"><h3>5. Promotion pendant une prise</h3><p>Si un pion atteint la rangée de promotion au cours d’une capture, il devient dame et son tour se termine immédiatement. Il ne poursuit pas la rafle en tant que dame au même tour.</p></article>
          </div>
        </div>
      </section>

      <section id="draughtsEnd" class="section rule-section">
        <div class="section-head"><div><div class="eyebrow">Victoire et nulle</div><h2>Comment se termine une partie ?</h2></div></div>
        <div class="lesson-grid">
          <article class="panel"><h3>Victoire</h3><p>Dans les deux variantes, un joueur gagne si son adversaire n’a plus de pièce ou si toutes ses pièces restantes sont bloquées et qu’aucun coup légal n’est possible.</p></article>
          <article class="panel"><h3>Répétition</h3><p>Une répétition de la même position peut conduire à la nulle. Le moteur interactif surveille les répétitions de position.</p></article>
          <article class="panel"><h3>Finales sans progrès</h3><p>Le moteur applique aussi un compteur de coups sans déplacement de pion ni capture afin d’éviter les parties interminables dans les finales de dames.</p></article>
        </div>
        <div class="play-cta panel"><div><div class="eyebrow">À vous de jouer</div><h2>Deux moteurs, deux règles</h2><p>Choisissez le 10 × 10 français/international ou le 8 × 8 anglais et jouez à deux ou contre l’IA.</p></div><a class="btn" href="#/jouer/dames">Choisir la variante</a></div>
      </section>
    </div>
  `;

  app.querySelectorAll('a[href^="#draughts"]').forEach(link => {
    link.addEventListener("click", event => {
      event.preventDefault();
      document.querySelector(link.getAttribute("href"))?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}

function draughtsSetupDiagram(variant) {
  const cfg = DRAUGHTS_VARIANTS[variant];
  const board = draughtCreateBoard(cfg);
  let html = `<div class="rules-draughts-board" style="--rule-board-size:${cfg.size}" aria-label="Position initiale ${cfg.shortTitle}">`;
  for (let r = 0; r < cfg.size; r++) {
    for (let c = 0; c < cfg.size; c++) {
      const playable = draughtPlayable(r,c);
      const piece = board[r][c];
      let pieceClass = "";
      if (piece) pieceClass = cfg.pieceClass[piece.side];
      html += `<div class="rules-draught-square ${playable ? "dark" : "light"}">${piece ? `<span class="rule-disc ${pieceClass}"></span>` : ""}</div>`;
    }
  }
  return html + `</div>`;
}

function draughtsMiniDiagram(size, pieces, highlights) {
  const pieceMap = new Map(pieces.map(p => [`${p.r},${p.c}`, p]));
  const highlightSet = new Set(highlights.map(p => `${p.r},${p.c}`));
  let html = `<div class="mini-draughts-board" style="--mini-draught-size:${size}">`;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const piece = pieceMap.get(`${r},${c}`);
      const playable = draughtPlayable(r,c);
      const sideClass = piece ? `draught-${piece.side}` : "";
      html += `<div class="mini-draught-square ${playable ? "dark" : "light"} ${highlightSet.has(`${r},${c}`) ? "target" : ""}">${piece ? `<span class="rule-disc ${sideClass} ${piece.king ? "king" : ""}">${piece.king ? "♛" : ""}</span>` : ""}</div>`;
    }
  }
  return html + `</div>`;
}

function renderChessGamePage(game) {
  app.innerHTML = `
    <div class="page">
      <div class="breadcrumb"><a href="#/accueil">Accueil</a><span>›</span><a href="#/catalogue">Catalogue</a><span>›</span><span>Échecs</span></div>

      <section class="game-hero chess-game-hero">
        <div class="game-hero-visual">${illustration("chess", true)}</div>
        <div>
          <div class="eyebrow">${game.category}</div>
          <h1>Échecs</h1>
          <p>${game.intro}</p>
          <div class="stats">
            <div class="stat"><strong>2 joueurs</strong><span>Participants</span></div>
            <div class="stat"><strong>8 × 8</strong><span>Échiquier</span></div>
            <div class="stat"><strong>6 types</strong><span>de pièces</span></div>
          </div>
          <div class="hero-actions">
            <a class="btn" href="#/jouer/echecs">Jouer aux Échecs</a>
            <a class="btn outline" href="#chessPieces">Apprendre les déplacements</a>
          </div>
        </div>
      </section>

      <div class="chess-toc panel">
        <strong>Sur cette page :</strong>
        <a href="#chessSetup">Mise en place</a>
        <a href="#chessPieces">Déplacement des pièces</a>
        <a href="#chessSpecial">Coups spéciaux</a>
        <a href="#chessEnd">Fin de partie</a>
        <a href="#chessStrategy">Premiers principes</a>
      </div>

      <section id="chessSetup" class="section rule-section">
        <div class="section-head"><div><div class="eyebrow">1 — Préparation</div><h2>Mise en place de l’échiquier</h2></div></div>
        <div class="lesson-grid">
          <article class="panel">
            <h3>Orientation</h3>
            <p>L’échiquier comporte 64 cases, 32 claires et 32 foncées. Chaque joueur doit avoir une <strong>case claire dans son coin inférieur droit</strong>.</p>
            <div class="mini-tip">Repère mnémotechnique : « blanc à droite ».</div>
          </article>
          <article class="panel">
            <h3>Placement des pièces</h3>
            <p>Sur la première rangée : tour, cavalier, fou, dame, roi, fou, cavalier, tour. La dame se place sur une case de sa propre couleur. Les huit pions occupent la rangée suivante.</p>
            <div class="setup-strip"><span>♖</span><span>♘</span><span>♗</span><span>♕</span><span>♔</span><span>♗</span><span>♘</span><span>♖</span></div>
          </article>
          <article class="panel">
            <h3>Premier coup</h3>
            <p>Les <strong>Blancs commencent toujours</strong>. Les joueurs jouent ensuite alternativement un seul coup.</p>
            <div class="mini-tip">Une pièce capturée est retirée de l’échiquier.</div>
          </article>
        </div>
      </section>

      <section id="chessPieces" class="section rule-section">
        <div class="section-head">
          <div><div class="eyebrow">2 — Les six pièces</div><h2>Comment se déplacent-elles ?</h2><p class="section-lead">Les cases en surbrillance indiquent les déplacements possibles depuis le centre du petit échiquier.</p></div>
        </div>
        <div class="piece-lessons">
          ${chessMoveCard("♔", "Le roi", "Une case dans n’importe quelle direction. Il ne peut jamais se placer sur une case attaquée.", "king")}
          ${chessMoveCard("♕", "La dame", "Autant de cases que souhaité en ligne droite : horizontalement, verticalement ou en diagonale.", "queen")}
          ${chessMoveCard("♖", "La tour", "Autant de cases que souhaité horizontalement ou verticalement.", "rook")}
          ${chessMoveCard("♗", "Le fou", "Autant de cases que souhaité en diagonale. Un fou reste donc toujours sur la même couleur de case.", "bishop")}
          ${chessMoveCard("♘", "Le cavalier", "Un mouvement en L : deux cases dans une direction puis une perpendiculairement. Il peut sauter au-dessus des pièces.", "knight")}
          ${chessMoveCard("♙", "Le pion", "Il avance d’une case, ou de deux depuis sa position initiale. Il capture une case en diagonale vers l’avant.", "pawn")}
        </div>
      </section>

      <section id="chessSpecial" class="section rule-section">
        <div class="section-head"><div><div class="eyebrow">3 — Règles particulières</div><h2>Roque, prise en passant et promotion</h2></div></div>
        <div class="lesson-grid special-rules">
          <article class="panel"><div class="rule-icon">♔↔♖</div><h3>Le roque</h3><p>Le roi se déplace de deux cases vers une tour et la tour vient se placer de l’autre côté du roi. Le roi et la tour ne doivent jamais avoir bougé, les cases intermédiaires doivent être libres et le roi ne peut être en échec, traverser une case attaquée ni finir sur une case attaquée.</p></article>
          <article class="panel"><div class="rule-icon">♙×♟</div><h3>La prise en passant</h3><p>Si un pion adverse avance de deux cases et arrive juste à côté du vôtre, votre pion peut le capturer comme s’il n’avait avancé que d’une case. Cette possibilité n’existe que <strong>immédiatement au coup suivant</strong>.</p></article>
          <article class="panel"><div class="rule-icon">♙→♕</div><h3>La promotion</h3><p>Un pion qui atteint la dernière rangée doit être remplacé par une dame, une tour, un fou ou un cavalier de sa couleur. Il n’est pas obligatoire de choisir une dame.</p></article>
        </div>
      </section>

      <section id="chessEnd" class="section rule-section">
        <div class="section-head"><div><div class="eyebrow">4 — Roi, échec et fin de partie</div><h2>Comment gagne-t-on ?</h2></div></div>
        <div class="content-grid chess-rule-grid">
          <article class="panel">
            <h3>Échec</h3><p>Le roi est en échec lorsqu’il est attaqué. Le joueur doit obligatoirement supprimer cette menace : déplacer le roi, capturer la pièce attaquante ou interposer une pièce lorsque c’est possible.</p>
            <h3>Échec et mat</h3><p>Si le roi est en échec et qu’aucun coup légal ne permet d’en sortir, il y a <strong>échec et mat</strong>. La partie est immédiatement terminée.</p>
            <h3>Pat</h3><p>Si un joueur n’est pas en échec mais ne possède aucun coup légal, la partie est nulle.</p>
          </article>
          <aside class="panel">
            <h3>Autres parties nulles</h3>
            <ul class="simple-list">
              <li>position répétée trois fois ;</li>
              <li>50 coups de chaque camp sans mouvement de pion ni capture ;</li>
              <li>matériel insuffisant pour donner mat ;</li>
              <li>accord entre les joueurs.</li>
            </ul>
            <div class="note"><strong>Important :</strong> on ne « capture » jamais le roi. La partie s’arrête au mat.</div>
          </aside>
        </div>
      </section>

      <section id="chessStrategy" class="section rule-section">
        <div class="section-head"><div><div class="eyebrow">5 — Bien débuter</div><h2>Quatre principes simples</h2></div></div>
        <div class="feature-list chess-principles">
          <article class="feature"><div class="ico">◎</div><h3>Contrôler le centre</h3><p>Les cases centrales donnent davantage de mobilité aux pièces et facilitent les attaques vers les deux ailes.</p></article>
          <article class="feature"><div class="ico">♘</div><h3>Développer les pièces</h3><p>Sortez rapidement cavaliers et fous. Évitez de déplacer plusieurs fois la même pièce sans raison.</p></article>
          <article class="feature"><div class="ico">♔</div><h3>Mettre le roi à l’abri</h3><p>Le petit roque est souvent une bonne façon de protéger le roi et d’activer une tour.</p></article>
          <article class="feature"><div class="ico">≋</div><h3>Observer les menaces</h3><p>Avant chaque coup, vérifiez ce que l’adversaire attaque et demandez-vous ce qui changera après votre déplacement.</p></article>
        </div>
        <div class="play-cta panel">
          <div><div class="eyebrow">À vous de jouer</div><h2>Testez directement les règles</h2><p>Le jeu interactif gère les coups légaux, l’échec, le mat, le roque, la prise en passant, la promotion et les principales règles de partie nulle.</p></div>
          <a class="btn" href="#/jouer/echecs">Ouvrir l’échiquier interactif</a>
        </div>
      </section>
    </div>
  `;

  // Les liens pédagogiques font défiler la page sans modifier le hash utilisé par le routeur.
  app.querySelectorAll('a[href^="#chess"]').forEach(link => {
    link.addEventListener("click", event => {
      event.preventDefault();
      document.querySelector(link.getAttribute("href"))?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}

function chessMoveCard(symbol, name, description, pattern) {
  return `<article class="piece-lesson panel"><div class="piece-title"><span class="piece-badge">${symbol}</span><div><h3>${name}</h3><p>${description}</p></div></div>${chessMiniBoard(symbol, pattern)}</article>`;
}

function chessMiniBoard(symbol, pattern) {
  const highlighted = new Set();
  const captures = new Set();
  const center = 12;
  const rc = i => [Math.floor(i / 5), i % 5];

  for (let i = 0; i < 25; i++) {
    const [r, c] = rc(i);
    const dr = r - 2, dc = c - 2;
    if (!dr && !dc) continue;
    if (pattern === "king" && Math.max(Math.abs(dr), Math.abs(dc)) === 1) highlighted.add(i);
    if (pattern === "queen" && (dr === 0 || dc === 0 || Math.abs(dr) === Math.abs(dc))) highlighted.add(i);
    if (pattern === "rook" && (dr === 0 || dc === 0)) highlighted.add(i);
    if (pattern === "bishop" && Math.abs(dr) === Math.abs(dc)) highlighted.add(i);
    if (pattern === "knight" && ((Math.abs(dr) === 2 && Math.abs(dc) === 1) || (Math.abs(dr) === 1 && Math.abs(dc) === 2))) highlighted.add(i);
  }
  if (pattern === "pawn") {
    highlighted.add(7);
    highlighted.add(2);
    captures.add(6);
    captures.add(8);
  }

  return `<div class="mini-chess-board">${Array.from({length: 25}, (_, i) => {
    const cls = ["mini-square", (Math.floor(i / 5) + i % 5) % 2 ? "dark" : "light", highlighted.has(i) ? "move" : "", captures.has(i) ? "capture" : ""].filter(Boolean).join(" ");
    return `<div class="${cls}">${i === center ? `<span>${symbol}</span>` : captures.has(i) ? `<span class="capture-mark">×</span>` : ""}</div>`;
  }).join("")}</div>`;
}


function renderAccount() {
  app.innerHTML = `
    <div class="page account-page">
      <div class="breadcrumb"><a href="#/accueil">Accueil</a><span>›</span><span>Compte</span></div>
      <div class="section-head"><div><div class="eyebrow">Ludothèque en ligne</div><h1>Votre compte joueur</h1><p class="section-lead">Le compte permet de conserver vos sauvegardes dans Cloudflare D1 et de rejoindre les parties multijoueurs.</p></div></div>
      <div id="accountContent" class="account-grid"><div class="panel"><p>Chargement…</p></div></div>
    </div>`;
  LudoOnline.me(true).then(user => renderAccountContent(user)).catch(err => {
    document.getElementById("accountContent").innerHTML = `<div class="panel"><h2>Service indisponible</h2><p>${escapeHtml(err.message)}</p><p>Vérifiez que la base D1 et le Worker sont configurés.</p></div>`;
  });
}

function recoveryKeyPanel(key, title = "Votre clé de récupération") {
  return `
    <section class="panel account-card recovery-key-card">
      <h2>${escapeHtml(title)}</h2>
      <p><strong>Conservez cette clé en lieu sûr.</strong> Elle permet de choisir un nouveau mot de passe si vous oubliez l'ancien.</p>
      <div class="recovery-key-value" id="recoveryKeyValue">${escapeHtml(key)}</div>
      <div class="account-actions">
        <button class="btn small" id="copyRecoveryKey" type="button">Copier la clé</button>
      </div>
      <div class="note"><strong>Important :</strong> ne partagez jamais cette clé. Une nouvelle clé rend automatiquement l'ancienne inutilisable.</div>
    </section>`;
}

function attachRecoveryCopy() {
  document.getElementById("copyRecoveryKey")?.addEventListener("click", async e => {
    const value=document.getElementById("recoveryKeyValue")?.textContent?.trim();
    if(!value) return;
    try {
      await navigator.clipboard.writeText(value);
      e.currentTarget.textContent="Clé copiée";
    } catch {
      e.currentTarget.textContent="Copie impossible — sélectionnez la clé";
    }
  });
}


const ELO_CATEGORY_LABELS={bullet:"Bullet",blitz:"Blitz",rapid:"Rapide",classical:"Classique"};

async function loadChessRatingsPanel() {
  const mine=document.getElementById("myChessRatings");
  const board=document.getElementById("eloLeaderboard");
  const select=document.getElementById("eloCategory");
  if(!mine || !board || !select || !window.LudoOnline?.ratings) return;

  try{
    const ratings=await LudoOnline.ratings.mine();
    mine.innerHTML=["bullet","blitz","rapid","classical"].map(category=>{
      const r=ratings[category]||{rating:1200,games:0,wins:0,draws:0,losses:0};
      return `<div class="elo-chip"><span>${ELO_CATEGORY_LABELS[category]}</span><strong>${Number(r.rating||1200)}</strong><small>${Number(r.games||0)} partie${Number(r.games||0)>1?"s":""}</small></div>`;
    }).join("");
  }catch(err){
    mine.innerHTML=`<p class="form-status">${escapeHtml(err.message)}</p>`;
  }

  const loadBoard=async()=>{
    board.innerHTML="<p>Chargement…</p>";
    try{
      const data=await LudoOnline.ratings.leaderboard(select.value,30);
      const players=Array.isArray(data.players)?data.players:[];
      if(!players.length){
        board.innerHTML="<p>Aucune partie classée dans cette cadence pour le moment.</p>";
        return;
      }
      board.innerHTML=`<div class="elo-table">
        <div class="elo-row elo-head"><span>#</span><span>Joueur</span><span>Elo</span><span>Parties</span></div>
        ${players.map((p,i)=>`<div class="elo-row"><span>${i+1}</span><strong>${escapeHtml(p.username)}</strong><span>${Number(p.rating)}</span><span>${Number(p.games)}</span></div>`).join("")}
      </div>`;
    }catch(err){
      board.innerHTML=`<p class="form-status">${escapeHtml(err.message)}</p>`;
    }
  };
  select.addEventListener("change",loadBoard);
  await loadBoard();
}


const CHESS_ARCHIVE_PIECES={K:"♔",Q:"♕",R:"♖",B:"♗",N:"♘",P:"♙",k:"♚",q:"♛",r:"♜",b:"♝",n:"♞",p:"♟"};
let chessArchiveReplay={game:null,ply:0};

function chessArchiveReasonLabel(reason){
  return ({checkmate:"Mat",timeout:"Temps",resign:"Abandon","draw-agreement":"Nulle convenue",stalemate:"Pat",repetition:"Répétition",fifty:"50 coups",material:"Matériel insuffisant"})[reason]||reason||"Partie terminée";
}
function chessArchiveTimeLabel(game){
  if(game.initialSeconds==null) return "Cadence ancienne";
  const mins=Math.round(Number(game.initialSeconds||0)/60*10)/10;
  return `${Number.isInteger(mins)?mins:mins.toFixed(1)}+${Number(game.incrementSeconds||0)}`;
}
function chessArchiveDate(value){
  if(!value) return "";
  const d=new Date(String(value).replace(" ","T")+(/Z|[+-]\d\d:?\d\d$/.test(String(value))?"":"Z"));
  return Number.isNaN(d.getTime())?String(value):d.toLocaleString("fr-FR",{dateStyle:"short",timeStyle:"short"});
}
function chessArchiveSnapshots(replay){
  if(!replay?.state) return [];
  const hist=Array.isArray(replay.history)?replay.history:[];
  const snaps=hist.map(entry=>entry?.state).filter(Boolean);
  snaps.push(replay.state);
  return snaps;
}
function renderChessArchiveBoard(){
  const panel=document.getElementById("chessArchiveReplay");
  if(!panel || !chessArchiveReplay.game?.replay) return;
  const replay=chessArchiveReplay.game.replay, snaps=chessArchiveSnapshots(replay);
  const max=Math.max(0,snaps.length-1);
  chessArchiveReplay.ply=Math.max(0,Math.min(max,chessArchiveReplay.ply));
  const state=snaps[chessArchiveReplay.ply];
  const board=state?.board||[];
  const moves=Array.isArray(replay.history)?replay.history:[];
  const lastSan=chessArchiveReplay.ply>0?moves[chessArchiveReplay.ply-1]?.san:"Position initiale";
  panel.querySelector(".archive-board").innerHTML=Array.from({length:64},(_,i)=>{
    const r=Math.floor(i/8),c=i%8,piece=board?.[r]?.[c]||"";
    return `<div class="archive-square ${(r+c)%2?"dark":"light"}">${CHESS_ARCHIVE_PIECES[piece]||""}</div>`;
  }).join("");
  panel.querySelector("[data-archive-ply]").textContent=`${chessArchiveReplay.ply}/${max} — ${escapeHtml(lastSan||"")}`;
  panel.querySelector('[data-step="start"]').disabled=chessArchiveReplay.ply===0;
  panel.querySelector('[data-step="prev"]').disabled=chessArchiveReplay.ply===0;
  panel.querySelector('[data-step="next"]').disabled=chessArchiveReplay.ply===max;
  panel.querySelector('[data-step="end"]').disabled=chessArchiveReplay.ply===max;
}
function closeChessArchiveReplay(){
  chessArchiveReplay={game:null,ply:0};
  const panel=document.getElementById("chessArchiveReplay"); if(panel) panel.hidden=true;
}
async function openChessArchiveReplay(id){
  const panel=document.getElementById("chessArchiveReplay"); if(!panel) return;
  panel.hidden=false; panel.innerHTML="<p>Chargement de la partie…</p>";
  try{
    const game=await LudoOnline.chessGames.get(id);
    if(!game.replay){
      panel.innerHTML=`<div class="archive-replay-head"><h3>Relecture indisponible</h3><button class="btn small outline" id="closeChessArchive">Fermer</button></div><p>Cette partie a été jouée avant l’enregistrement de l’historique complet dans D1.</p>`;
      document.getElementById("closeChessArchive")?.addEventListener("click",closeChessArchiveReplay); return;
    }
    chessArchiveReplay={game,ply:0};
    panel.innerHTML=`<div class="archive-replay-head"><div><h3>${escapeHtml(game.whiteUsername)} — ${escapeHtml(game.blackUsername)}</h3><p>${escapeHtml(game.result)} · ${escapeHtml(chessArchiveReasonLabel(game.reason))} · ${escapeHtml(chessArchiveTimeLabel(game))}</p></div><button class="btn small outline" id="closeChessArchive">Fermer</button></div>
      <div class="archive-board" aria-label="Échiquier de relecture"></div>
      <div class="archive-replay-controls"><button class="btn small outline" data-step="start">⏮ Début</button><button class="btn small outline" data-step="prev">◀ Précédent</button><strong data-archive-ply></strong><button class="btn small outline" data-step="next">Suivant ▶</button><button class="btn small outline" data-step="end">Fin ⏭</button></div>`;
    document.getElementById("closeChessArchive")?.addEventListener("click",closeChessArchiveReplay);
    panel.querySelectorAll("[data-step]").forEach(btn=>btn.addEventListener("click",()=>{
      const max=Math.max(0,chessArchiveSnapshots(chessArchiveReplay.game.replay).length-1);
      if(btn.dataset.step==="start") chessArchiveReplay.ply=0;
      if(btn.dataset.step==="prev") chessArchiveReplay.ply--;
      if(btn.dataset.step==="next") chessArchiveReplay.ply++;
      if(btn.dataset.step==="end") chessArchiveReplay.ply=max;
      renderChessArchiveBoard();
    }));
    renderChessArchiveBoard();
    requestAnimationFrame(()=>panel.scrollIntoView({behavior:"smooth",block:"start"}));
  }catch(err){ panel.innerHTML=`<p class="form-status">${escapeHtml(err.message)}</p>`; }
}
async function loadChessGamesPanel(){
  const list=document.getElementById("chessGameArchiveList");
  if(!list || !window.LudoOnline?.chessGames) return;
  list.innerHTML="<p>Chargement des parties…</p>";
  try{
    const games=await LudoOnline.chessGames.list();
    if(!games.length){ list.innerHTML="<p>Aucune partie en ligne terminée pour le moment.</p>"; return; }
    list.innerHTML=games.map(g=>`<article class="archive-game-row"><div><strong>${escapeHtml(g.whiteUsername)} <span class="archive-result">${escapeHtml(g.result)}</span> ${escapeHtml(g.blackUsername)}</strong><small>${escapeHtml(chessArchiveDate(g.createdAt))} · ${escapeHtml(chessArchiveTimeLabel(g))} · ${escapeHtml(ELO_CATEGORY_LABELS[g.category]||g.category||"")} · ${g.rated?"Classée":"Amicale"} · ${escapeHtml(chessArchiveReasonLabel(g.reason))}</small></div><button class="btn small ${g.replayAvailable?"":"outline"}" data-replay-id="${g.id}" ${g.replayAvailable?"":"disabled"}>${g.replayAvailable?"Rejouer":"Historique ancien"}</button></article>`).join("");
    list.querySelectorAll("[data-replay-id]:not([disabled])").forEach(btn=>btn.addEventListener("click",()=>openChessArchiveReplay(btn.dataset.replayId)));
  }catch(err){ list.innerHTML=`<p class="form-status">${escapeHtml(err.message)}</p>`; }
}

function renderAccountContent(user, newRecoveryKey = null) {
  const root = document.getElementById("accountContent");
  if (!root) return;

  if (user) {
    root.innerHTML = `
      <section class="panel account-card">
        <div class="account-avatar">♟</div>
        <h2>${escapeHtml(user.username)}</h2>
        <p>Votre session est active sur cet appareil.</p>
        <div class="account-actions">
          <a class="btn" href="#/jouer/abalone">Jouer à Abalone</a>
          <button id="logoutAccount" class="btn outline" type="button">Se déconnecter</button>
        </div>
        <div class="note"><strong>En ligne :</strong> sauvegardes Abalone, salons multijoueurs privés et récupération du compte.</div>
      </section>

      <section class="panel account-card chess-ratings-card">
        <h2>Classement Elo — Échecs</h2>
        <div id="myChessRatings" class="elo-grid"><p>Chargement des classements…</p></div>
        <div class="elo-leaderboard-head">
          <h3>Classement des joueurs</h3>
          <label><span>Cadence</span><select id="eloCategory">
            <option value="bullet">Bullet</option>
            <option value="blitz">Blitz</option>
            <option value="rapid" selected>Rapide</option>
            <option value="classical">Classique</option>
          </select></label>
        </div>
        <div id="eloLeaderboard" class="elo-leaderboard"><p>Chargement…</p></div>
        <div class="note">Chaque catégorie possède son Elo propre. Une nouvelle catégorie commence à <strong>1200</strong>. Seules les parties marquées « classée Elo » modifient le classement.</div>
      </section>

      <section class="panel account-card chess-archive-card">
        <h2>Mes parties d’Échecs</h2>
        <p>Retrouvez vos parties multijoueurs terminées et rejouez-les coup par coup.</p>
        <div id="chessGameArchiveList" class="chess-game-archive"><p>Chargement…</p></div>
        <div id="chessArchiveReplay" class="chess-archive-replay" hidden></div>
        <div class="note">Les parties jouées avant la V6.6 peuvent apparaître sans relecture complète, car leurs coups n’étaient pas encore archivés dans D1.</div>
      </section>

      <form id="changePasswordForm" class="panel account-card">
        <h2>Changer le mot de passe</h2>
        <label><span>Mot de passe actuel</span><input name="currentPassword" type="password" required minlength="10" autocomplete="current-password"></label>
        <label><span>Nouveau mot de passe</span><input name="newPassword" type="password" required minlength="10" autocomplete="new-password"></label>
        <label><span>Confirmer le nouveau mot de passe</span><input name="confirmPassword" type="password" required minlength="10" autocomplete="new-password"></label>
        <button class="btn" type="submit">Modifier le mot de passe</button>
        <p id="changePasswordStatus" class="form-status"></p>
      </form>

      ${newRecoveryKey ? recoveryKeyPanel(newRecoveryKey, "Votre nouvelle clé de récupération") : `
      <section class="panel account-card">
        <h2>Clé de récupération</h2>
        <p>Si vous oubliez votre mot de passe, cette clé vous permettra d'en choisir un nouveau.</p>
        <button id="generateRecoveryKey" class="btn outline" type="button">Générer une nouvelle clé</button>
        <p id="recoveryKeyStatus" class="form-status"></p>
        <div class="note"><strong>Attention :</strong> générer une nouvelle clé invalide immédiatement la précédente.</div>
      </section>`}
    `;

    document.getElementById("logoutAccount")?.addEventListener("click", async () => {
      await LudoOnline.logout();
      renderAccountContent(null);
    });

    document.getElementById("changePasswordForm")?.addEventListener("submit", async e => {
      e.preventDefault();
      const fd=new FormData(e.currentTarget),st=document.getElementById("changePasswordStatus");
      const next=String(fd.get("newPassword")||""),confirm=String(fd.get("confirmPassword")||"");
      if(next!==confirm){ st.textContent="Les deux nouveaux mots de passe ne sont pas identiques."; return; }
      st.textContent="Modification…";
      try {
        const data=await LudoOnline.changePassword(fd.get("currentPassword"),next);
        st.textContent=data.message||"Mot de passe modifié.";
        e.currentTarget.reset();
      } catch(err){ st.textContent=err.message; }
    });

    document.getElementById("generateRecoveryKey")?.addEventListener("click", async e => {
      const st=document.getElementById("recoveryKeyStatus");
      st.textContent="Génération…";
      e.currentTarget.disabled=true;
      try {
        const data=await LudoOnline.generateRecoveryKey();
        renderAccountContent(user,data.recoveryKey);
      } catch(err) {
        st.textContent=err.message;
        e.currentTarget.disabled=false;
      }
    });

    attachRecoveryCopy();
    loadChessRatingsPanel();
    loadChessGamesPanel();
    return;
  }

  root.innerHTML = `
    <form id="loginForm" class="panel account-card">
      <h2>Se connecter</h2>
      <label><span>Pseudo</span><input name="username" required minlength="3" maxlength="24" autocomplete="username"></label>
      <label><span>Mot de passe</span><input name="password" type="password" required minlength="10" autocomplete="current-password"></label>
      <button class="btn" type="submit">Connexion</button>
      <a href="#/recuperation">Mot de passe oublié ?</a>
      <p id="loginStatus" class="form-status"></p>
    </form>
    <form id="registerForm" class="panel account-card">
      <h2>Créer un compte</h2>
      <label><span>Pseudo</span><input name="username" required minlength="3" maxlength="24" autocomplete="username"></label>
      <label><span>Mot de passe</span><input name="password" type="password" required minlength="10" autocomplete="new-password"></label>
      <small>10 caractères minimum. Après la création, une clé de récupération personnelle vous sera affichée une seule fois : conservez-la en lieu sûr.</small>
      <button class="btn" type="submit">Créer mon compte</button>
      <p id="registerStatus" class="form-status"></p>
    </form>`;

  document.getElementById("loginForm")?.addEventListener("submit", async e => {
    e.preventDefault(); const fd=new FormData(e.currentTarget),st=document.getElementById("loginStatus"); st.textContent="Connexion…";
    try { const u=await LudoOnline.login(fd.get("username"),fd.get("password")); renderAccountContent(u); } catch(err){ st.textContent=err.message; }
  });

  document.getElementById("registerForm")?.addEventListener("submit", async e => {
    e.preventDefault(); const fd=new FormData(e.currentTarget),st=document.getElementById("registerStatus"); st.textContent="Création…";
    try {
      const data=await LudoOnline.register(fd.get("username"),fd.get("password"));
      renderAccountContent(data.user,data.recoveryKey);
    } catch(err){ st.textContent=err.message; }
  });
}

function renderRecovery() {
  app.innerHTML = `
    <div class="page account-page">
      <div class="breadcrumb"><a href="#/accueil">Accueil</a><span>›</span><a href="#/compte">Compte</a><span>›</span><span>Récupération</span></div>
      <div class="section-head">
        <div>
          <div class="eyebrow">Récupération du compte</div>
          <h1>Mot de passe oublié</h1>
          <p class="section-lead">Saisissez le pseudo, la clé de récupération enregistrée auparavant et un nouveau mot de passe.</p>
        </div>
      </div>
      <div id="recoveryContent" class="account-grid">
        <form id="recoveryForm" class="panel account-card">
          <h2>Réinitialiser le mot de passe</h2>
          <label><span>Pseudo</span><input name="username" required minlength="3" maxlength="24" autocomplete="username"></label>
          <label><span>Clé de récupération</span><input name="recoveryKey" required autocomplete="off" placeholder="XXXXX-XXXXX-XXXXX-XXXXX"></label>
          <label><span>Nouveau mot de passe</span><input name="newPassword" type="password" required minlength="10" autocomplete="new-password"></label>
          <label><span>Confirmer le nouveau mot de passe</span><input name="confirmPassword" type="password" required minlength="10" autocomplete="new-password"></label>
          <button class="btn" type="submit">Réinitialiser</button>
          <p id="recoveryStatus" class="form-status"></p>
        </form>
        <section class="panel account-card">
          <h2>Vous n'avez pas encore de clé ?</h2>
          <p>Si vous êtes encore connecté sur un autre appareil, ouvrez <strong>Compte → Clé de récupération</strong> et générez-en une.</p>
          <div class="note">Dans une prochaine étape, nous pourrons aussi ajouter une récupération par e-mail. La clé personnelle reste utile comme solution de secours indépendante de l'e-mail.</div>
          <a class="btn outline" href="#/compte">Retour au compte</a>
        </section>
      </div>
    </div>`;

  document.getElementById("recoveryForm")?.addEventListener("submit", async e => {
    e.preventDefault();
    const fd=new FormData(e.currentTarget),st=document.getElementById("recoveryStatus");
    const next=String(fd.get("newPassword")||""),confirm=String(fd.get("confirmPassword")||"");
    if(next!==confirm){ st.textContent="Les deux nouveaux mots de passe ne sont pas identiques."; return; }
    st.textContent="Réinitialisation…";
    try {
      const data=await LudoOnline.resetWithRecovery(fd.get("username"),fd.get("recoveryKey"),next);
      const root=document.getElementById("recoveryContent");
      root.innerHTML = `
        <section class="panel account-card">
          <h2>Mot de passe réinitialisé</h2>
          <p>Vous pouvez maintenant vous reconnecter avec votre nouveau mot de passe.</p>
          <a class="btn" href="#/compte">Se connecter</a>
        </section>
        ${recoveryKeyPanel(data.recoveryKey,"Nouvelle clé de récupération")}`;
      attachRecoveryCopy();
    } catch(err){ st.textContent=err.message; }
  });
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[ch]));
}

function renderPlay(id) {
  if (id === "echecs") return renderChessPlay();
  if (id === "dames") return renderDraughtsChooser();
  if (id === "dames-internationales") return renderDraughtsPlay("international");
  if (id === "dames-anglaises") return renderDraughtsPlay("english");
  if (id === "go") return renderGoPlay();
  if (id === "abalone") return renderAbalonePlay();
  if (id === "awale") return renderAwalePlay();

  app.innerHTML = `
    <div class="page">
      <div class="section-head"><div><div class="eyebrow">Jeux interactifs</div><h1>Choisissez un jeu</h1><p class="section-lead">Ces versions fonctionnent entièrement dans votre navigateur et peuvent être testées localement.</p></div></div>
      <div class="play-cards">
        <article class="play-card"><div class="visual">${illustration("chess", false)}</div><div><span class="tag">Jouable</span><h2>Échecs</h2><p>Deux joueurs sur le même écran ou partie contre une IA à trois niveaux. Toutes les règles essentielles sont prises en compte.</p><a class="btn" href="#/jouer/echecs">Jouer aux Échecs</a></div></article>
        <article class="play-card"><div class="visual">${illustration("checkers", false)}</div><div><span class="tag">Jouable</span><h2>Dames</h2><p>Deux moteurs distincts : dames françaises/internationales 10 × 10 et dames anglaises 8 × 8, chacune jouable à deux ou contre l’IA.</p><a class="btn" href="#/jouer/dames">Choisir une variante</a></div></article>
        <article class="play-card"><div class="visual">${illustration("go", false)}</div><div><span class="tag">Jouable</span><h2>Go</h2><p>Goban 9 × 9, 13 × 13 ou 19 × 19, captures, libertés, ko, passes, score et trois niveaux d’IA.</p><a class="btn" href="#/jouer/go">Jouer au Go</a></div></article>
        <article class="play-card"><div class="visual">${illustration("abalone", false)}</div><div><span class="tag">Nouveau</span><h2>Abalone</h2><p>Plateau hexagonal, déplacements en ligne ou latéraux, poussées Sumito, éjections et trois niveaux d’IA.</p><a class="btn" href="#/jouer/abalone">Jouer à Abalone</a></div></article>
        <article class="play-card"><div class="visual">${illustration("awale", false)}</div><div><span class="tag">Jouable</span><h2>Awélé</h2><p>Deux joueurs en local ou joueur contre IA, avec semailles, captures et règle de nourrissage.</p><a class="btn" href="#/jouer/awale">Jouer à l’Awélé</a></div></article>
      </div>
    </div>
  `;
}


function renderDraughtsChooser() {
  app.innerHTML = `
    <div class="page">
      <div class="breadcrumb"><a href="#/accueil">Accueil</a><span>›</span><a href="#/jouer">Jouer</a><span>›</span><span>Dames</span></div>
      <div class="section-head"><div><div class="eyebrow">Deux variantes jouables</div><h1>Choisissez votre jeu de Dames</h1><p class="section-lead">Les règles ne sont pas seulement adaptées à la taille du damier : le moteur change réellement les déplacements, les prises, les rafles et les dames.</p></div><a class="btn outline small" href="#/jeu/dames">Voir les règles</a></div>
      <div class="draught-choice-grid">
        <article class="variant-card panel">
          <div class="variant-board-preview">${draughtsSetupDiagram("international")}</div>
          <div><span class="tag">10 × 10</span><h2>Dames françaises / internationales</h2><p>20 pions par joueur, prise avant/arrière, rafle maximale obligatoire et dames volantes.</p><div class="variant-actions"><a class="btn" href="#/jouer/dames-internationales">Jouer en 10 × 10</a><a class="btn outline small" href="#/jeu/dames">Règles</a></div></div>
        </article>
        <article class="variant-card panel">
          <div class="variant-board-preview">${draughtsSetupDiagram("english")}</div>
          <div><span class="tag">8 × 8</span><h2>Dames anglaises</h2><p>12 pions par joueur, prise du pion vers l’avant, choix libre entre les rafles et dames à déplacement court.</p><div class="variant-actions"><a class="btn" href="#/jouer/dames-anglaises">Jouer en 8 × 8</a><a class="btn outline small" href="#/jeu/dames">Règles</a></div></div>
        </article>
      </div>
    </div>
  `;
}

function renderDraughtsPlay(variant) {
  const cfg = DRAUGHTS_VARIANTS[variant];
  const isInternational = variant === "international";
  app.innerHTML = `
    <div class="page draughts-play-page">
      <div class="breadcrumb"><a href="#/accueil">Accueil</a><span>›</span><a href="#/jouer">Jouer</a><span>›</span><a href="#/jouer/dames">Dames</a><span>›</span><span>${cfg.shortTitle}</span></div>
      <div class="section-head">
        <div><div class="eyebrow">Jeu interactif</div><h1>${cfg.title}</h1><p class="section-lead">${isInternational ? "Damier 10 × 10, 20 pions par camp et règle de la rafle maximale." : "Damier 8 × 8, 12 pions par camp et règles anglaises WCDF."}</p></div>
        <div class="variant-switch"><a class="btn outline small" href="#/jeu/dames">Voir les règles</a><a class="btn outline small" href="#/jouer/${isInternational ? "dames-anglaises" : "dames-internationales"}">Passer au ${isInternational ? "8 × 8" : "10 × 10"}</a></div>
      </div>

      <div class="draught-play-layout">
        <section class="game-shell draught-shell">
          <div class="chess-toolbar">
            <label><span>Mode</span><select id="draughtMode"><option value="ai">Joueur contre IA</option><option value="local">2 joueurs sur le même écran</option></select></label>
            <div id="draughtAiSettings" class="toolbar-group">
              <label><span>Niveau IA</span><select id="draughtAiLevel"><option value="easy">Facile</option><option value="medium" selected>Intermédiaire</option><option value="hard">Difficile</option></select></label>
              <label><span>Votre camp</span><select id="draughtSide">${cfg.sideNames.map((name, i) => `<option value="${i}" ${i === cfg.firstSide ? "selected" : ""}>${name}</option>`).join("")}</select></label>
            </div>
            <div class="toolbar-actions"><button id="newDraught" class="btn small">Nouvelle partie</button><button id="undoDraught" class="btn outline small">Annuler</button><button id="flipDraught" class="btn outline small">↻ Plateau</button></div>
          </div>

          <div class="draught-board-wrap">
            <div id="draughtBoard" class="draughts-board" aria-label="Damier interactif ${cfg.shortTitle}"></div>
            <div id="draughtPathPicker" class="draught-path-picker" hidden></div>
          </div>
          <div id="draughtStatus" class="status draught-status"></div>
        </section>

        <aside class="draught-side-column">
          <section class="panel"><div class="turn-box"><span>Trait</span><strong id="draughtTurn">${cfg.sideNames[cfg.firstSide]}</strong></div><div class="piece-count-grid"><div><span id="draughtLabel0">${cfg.sideNames[0]}</span><strong id="draughtCount0">${cfg.piecesPerSide}</strong></div><div><span id="draughtLabel1">${cfg.sideNames[1]}</span><strong id="draughtCount1">${cfg.piecesPerSide}</strong></div></div><h3>Historique</h3><div id="draughtHistory" class="draught-history"></div></section>
          <section class="panel"><h3>Règles actives</h3>${isInternational ? `<p>✓ Pions : prise avant et arrière</p><p>✓ Rafle maximale obligatoire</p><p>✓ Dames volantes</p><p>✓ Promotion seulement à la fin du coup</p>` : `<p>✓ Pions : prise vers l’avant</p><p>✓ Toute prise est obligatoire</p><p>✓ Choix libre entre plusieurs rafles</p><p>✓ Dame : une case en diagonale</p>`}<div class="note"><strong>Conseil :</strong> cliquez sur une pièce. Seuls les coups légalement autorisés sont proposés. Pour une rafle, cliquez sur sa case d’arrivée finale. Si plusieurs rafles différentes finissent sur la même case, le site vous demandera laquelle choisir.</div></section>
          <section class="panel"><h3>IA</h3><p><strong>Facile :</strong> coup légal aléatoire.</p><p><strong>Intermédiaire :</strong> recherche courte avec valeur des pièces, promotion et contrôle du centre.</p><p><strong>Difficile :</strong> recherche alpha-bêta plus profonde.</p></section>
        </aside>
      </div>
    </div>
  `;
  initDraughts(variant);
}


function renderGoPlay() {
  app.innerHTML = `
    <div class="page go-play-page">
      <div class="breadcrumb"><a href="#/accueil">Accueil</a><span>›</span><a href="#/jouer">Jouer</a><span>›</span><span>Go</span></div>
      <div class="section-head">
        <div><div class="eyebrow">Jeu interactif</div><h1>Go</h1><p class="section-lead">Choisissez la taille du goban, posez une pierre sur une intersection libre et essayez de construire davantage d’espace vivant que votre adversaire.</p></div>
        <a class="btn outline small" href="#/jeu/go">Voir les règles</a>
      </div>

      <div class="go-play-layout">
        <section class="game-shell go-shell">
          <div class="go-toolbar">
            <label><span>Goban</span><select id="goSize"><option value="19" selected>19 × 19</option><option value="13">13 × 13</option><option value="9">9 × 9</option></select></label>
            <label><span>Mode</span><select id="goMode"><option value="ai">Joueur contre IA</option><option value="local">2 joueurs sur le même écran</option></select></label>
            <div id="goAiSettings" class="toolbar-group">
              <label><span>Niveau IA</span><select id="goAiLevel"><option value="easy">Facile</option><option value="medium" selected>Intermédiaire</option><option value="hard">Difficile</option></select></label>
              <label><span>Votre couleur</span><select id="goSide"><option value="1" selected>Noir</option><option value="2">Blanc</option></select></label>
            </div>
            <label><span>Komi</span><select id="goKomi"><option value="7.5" selected>7,5</option><option value="6.5">6,5</option><option value="0">0</option></select></label>
            <label><span>Score</span><select id="goScoring"><option value="area" selected>Aire</option><option value="territory">Territoire</option></select></label>
            <div class="toolbar-actions"><button id="newGo" class="btn small">Nouvelle partie</button><button id="undoGo" class="btn outline small">Annuler</button></div>
          </div>

          <div class="go-board-frame">
            <div id="goBoard" class="go-board" aria-label="Goban interactif"></div>
          </div>
          <div class="go-actions"><button id="passGo" class="btn outline">Passer</button><button id="resignGo" class="btn danger">Abandonner</button></div>
          <div id="goStatus" class="status go-status"></div>
        </section>

        <aside class="go-side-column">
          <section class="panel">
            <div class="turn-box"><span>Trait</span><strong id="goTurn">Noir</strong></div>
            <div class="go-score-grid">
              <div><span>Noir — prises</span><strong id="goCaptBlack">0</strong></div>
              <div><span>Blanc — prises</span><strong id="goCaptWhite">0</strong></div>
              <div><span>Noir — score estimé</span><strong id="goScoreBlack">0</strong></div>
              <div><span>Blanc — score estimé</span><strong id="goScoreWhite">7.5</strong></div>
            </div>
            <h3>Historique</h3><div id="goHistory" class="go-history"></div>
          </section>
          <section class="panel"><h3>Règles gérées</h3><p>✓ Groupes et libertés</p><p>✓ Captures automatiques</p><p>✓ Suicide interdit</p><p>✓ Ko simple</p><p>✓ Deux passes = fin</p><p>✓ Komi réglable</p><div class="note"><strong>Score :</strong> pour éviter une adjudication complexe des groupes morts, capturez les pierres contestées avant les deux passes.</div></section>
          <section class="panel"><h3>Les trois IA</h3><p><strong>Facile :</strong> joue un coup légal au hasard.</p><p><strong>Intermédiaire :</strong> privilégie captures, libertés, connexions et bons points d’ouverture.</p><p><strong>Difficile :</strong> compare en plus les meilleures réponses immédiates de l’adversaire.</p><div class="note">Cette IA est pédagogique. Un futur moteur spécialisé comme <strong>KataGo</strong> serait l’équivalent, pour le Go, de ce que Stockfish représente aux Échecs.</div></section>
        </aside>
      </div>
    </div>
  `;
  initGo();
}

function renderChessPlay() {
  app.innerHTML = `
    <div class="page chess-play-page">
      <div class="breadcrumb"><a href="#/accueil">Accueil</a><span>›</span><a href="#/jouer">Jouer</a><span>›</span><span>Échecs</span></div>
      <div class="section-head">
        <div><div class="eyebrow">Jeu interactif</div><h1>Échecs</h1><p class="section-lead">Jouez à deux sur le même écran, affrontez l’ordinateur ou créez un salon pour jouer à distance. Cliquez sur une pièce pour afficher ses coups légaux.</p></div>
        <a class="btn outline small" href="#/jeu/echecs">Voir les règles</a>
      </div>

      <div class="chess-play-layout">
        <section class="game-shell chess-shell">
          <div class="chess-toolbar">
            <label><span>Mode</span><select id="chessMode"><option value="ai">Joueur contre IA</option><option value="local">2 joueurs sur le même écran</option><option value="online">Multijoueur en ligne</option></select></label>
            <div id="chessAiSettings" class="toolbar-group">
              <label><span>Niveau IA</span><select id="chessAiLevel"><option value="easy">Facile</option><option value="medium" selected>Intermédiaire</option><option value="hard">Difficile</option></select></label>
              <label><span>Votre couleur</span><select id="chessSide"><option value="w">Blancs</option><option value="b">Noirs</option></select></label>
            </div>
            <div id="chessOnlineSettings" class="toolbar-group chess-online-settings" hidden>
              <label><span>Couleur si vous créez</span><select id="chessCreatorColor"><option value="random" selected>Aléatoire</option><option value="white">Blancs</option><option value="black">Noirs</option></select></label>
              <label><span>Cadence</span><select id="chessTimePreset">
                <option value="60,0">1+0 — Bullet</option>
                <option value="180,2">3+2 — Blitz</option>
                <option value="300,0">5+0 — Blitz</option>
                <option value="600,5" selected>10+5 — Rapide</option>
                <option value="900,10">15+10 — Rapide</option>
                <option value="1800,0">30+0 — Classique</option>
                <option value="custom">Personnalisée…</option>
              </select></label>
              <span id="chessCustomTime" class="custom-time-fields" hidden>
                <label><span>Minutes</span><input id="chessInitialMinutes" type="number" min="1" max="180" value="10"></label>
                <label><span>+ secondes/coup</span><input id="chessIncrementSeconds" type="number" min="0" max="60" value="5"></label>
              </span>
              <label class="inline-check"><input id="chessRated" type="checkbox" checked><span>Partie classée Elo</span></label>
              <button id="createChessRoom" class="btn small">Créer un salon</button>
              <label><span>Code du salon</span><input id="chessRoomCode" maxlength="6" placeholder="ABC234" autocomplete="off"></label>
              <button id="joinChessRoom" class="btn outline small">Rejoindre</button>
              <span id="chessRoomStatus" class="online-room-status">Connectez-vous pour jouer en ligne.</span>
            </div>
            <div class="toolbar-actions"><button id="newChess" class="btn small">Nouvelle partie</button><button id="undoChess" class="btn outline small">Annuler</button><button id="flipChess" class="btn outline small" title="Retourner l’échiquier">↻ Plateau</button></div>
          </div>

          <div id="chessClockPanel" class="chess-clock-panel" hidden>
            <div class="chess-clock-stack">
              <div class="chess-clock-card black-clock" data-side="b">
                <div><span id="chessBlackPlayer">Noirs</span><small id="chessBlackRating">Elo —</small></div>
                <strong id="chessBlackClock">10:00</strong>
              </div>
              <div class="chess-clock-card white-clock" data-side="w">
                <div><span id="chessWhitePlayer">Blancs</span><small id="chessWhiteRating">Elo —</small></div>
                <strong id="chessWhiteClock">10:00</strong>
              </div>
            </div>
            <div id="chessTimeMeta" class="chess-time-meta">10+5 · Rapide · classée</div>
          </div>

          <div class="chess-board-wrap">
            <div id="chessBoard" class="chess-board" aria-label="Échiquier interactif"></div>
            <div id="promotionPicker" class="promotion-picker" hidden><strong>Promotion :</strong><button data-promotion="Q"></button><button data-promotion="R"></button><button data-promotion="B"></button><button data-promotion="N"></button></div>
          </div>
          <div id="chessStatus" class="status chess-status"></div>
          <div id="chessOnlineActions" class="chess-online-actions" hidden>
            <button id="resignChessOnline" class="btn danger small">Abandonner</button>
            <button id="offerDrawChess" class="btn outline small">Proposer la nulle</button>
            <button id="offerRematchChess" class="btn small" hidden>Proposer une revanche</button>
          </div>
          <div id="chessOnlinePrompt" class="online-decision" hidden>
            <strong id="chessOnlinePromptTitle"></strong>
            <span id="chessOnlinePromptText"></span>
            <div class="online-decision-actions">
              <button id="acceptChessProposal" class="btn small">Accepter</button>
              <button id="declineChessProposal" class="btn outline small">Refuser</button>
            </div>
          </div>
        </section>

        <aside class="chess-side-column">
          <section class="panel"><div class="turn-box"><span>Trait</span><strong id="chessTurn">Blancs</strong></div><div id="chessRatingResult" class="rating-result" hidden></div><h3>Historique</h3><div id="chessHistory" class="chess-history"></div></section>
          <section class="panel"><h3>Multijoueur en ligne</h3><p>Le créateur choisit sa couleur, la <strong>cadence</strong> et si la partie compte pour le <strong>classement Elo</strong>. Une cadence comme <strong>10+5</strong> signifie 10 minutes au départ et 5 secondes ajoutées après chaque coup joué.</p><p>Pendant la partie, chacun peut <strong>abandonner</strong> ou <strong>proposer la nulle</strong>. Une revanche acceptée inverse automatiquement les couleurs tout en conservant la même cadence.</p><p>La pendule et la légalité des coups sont contrôlées côté Cloudflare : fermer l’onglet n’arrête donc pas le temps.</p><div class="note"><strong>Classements :</strong> Bullet, Blitz, Rapide et Classique disposent chacun de leur propre Elo, avec 1200 comme valeur de départ.</div></section>
          <section class="panel"><h3>Les trois niveaux d’IA</h3><p><strong>Facile :</strong> joue un coup légal au hasard.</p><p><strong>Intermédiaire :</strong> compare les positions à courte profondeur et valorise matériel, centre et sécurité du roi.</p><p><strong>Difficile :</strong> utilise la même évaluation avec une recherche plus profonde et un élagage alpha-bêta.</p><div class="note">Cette IA est destinée à la démonstration. Elle n’a pas la force d’un moteur spécialisé comme Stockfish.</div></section>
        </aside>
      </div>
    </div>
  `;

  initChess();
}

function renderAwalePlay() {
  app.innerHTML = `
    <div class="page">
      <div class="breadcrumb"><a href="#/accueil">Accueil</a><span>›</span><a href="#/jouer">Jouer</a><span>›</span><span>Awélé</span></div>
      <div class="section-head"><div><div class="eyebrow">Démo jouable</div><h1>Awélé interactif</h1><p class="section-lead">Mode local à deux joueurs ou partie contre une IA simple. Les captures et la règle de nourrissage sont gérées.</p></div></div>
      <div class="play-wrap">
        <section class="game-shell">
          <div class="awale-toolbar"><div><label for="awaleMode"><strong>Mode :</strong></label><select id="awaleMode"><option value="ai">Joueur contre IA</option><option value="local">2 joueurs sur le même écran</option></select></div><button id="newAwale" class="btn small">Nouvelle partie</button></div>
          <div id="awaleBoard" class="awale-board" aria-label="Plateau d'Awélé"></div>
          <div class="player-labels"><span>Joueur 1 — cases 1 à 6</span><span>Joueur 2 / IA — cases 7 à 12</span></div>
          <div class="scoreboard"><div class="score-box">Joueur 1<strong id="score0">0</strong></div><div class="score-box">Joueur 2 / IA<strong id="score1">0</strong></div></div>
          <div id="awaleStatus" class="status"></div>
        </section>
        <aside class="panel"><h3>Comment jouer</h3><p>Cliquez sur une de vos cases. Toutes ses graines sont semées une à une dans le sens antihoraire.</p><p>Une capture a lieu si la dernière graine arrive dans le camp adverse et forme une case de 2 ou 3 graines.</p><p>La capture remonte ensuite sur les cases adverses précédentes qui contiennent elles aussi 2 ou 3 graines.</p><div class="note"><strong>IA :</strong> elle évalue les coups légaux, privilégie les captures et évite autant que possible de vous offrir une capture immédiate.</div></aside>
      </div>
    </div>
  `;
  initAwale();
}

function renderAbout() {
  app.innerHTML = `
    <div class="page">
      <section class="panel">
        <div class="eyebrow">À propos du prototype</div>
        <h1>Une base locale avant la mise en ligne</h1>
        <p>Cette version fonctionne sans serveur et sans bibliothèque externe. Elle peut être ouverte directement dans un navigateur ou servie avec un petit serveur HTTP local.</p>
        <h2>Pour la future version en ligne</h2>
        <p>Le catalogue, les règles et les jeux solo/IA peuvent rester côté navigateur. Pour jouer à distance entre utilisateurs, il faudra ajouter un serveur afin de synchroniser les parties, gérer les salons, les comptes et l'historique des coups.</p>
        <p>Une architecture possible serait : interface HTML/CSS/JavaScript + API Python (FastAPI) + WebSocket pour le temps réel + base SQLite/PostgreSQL pour les comptes et les parties.</p>
      </section>
    </div>
  `;
}

function renderNotFound() {
  app.innerHTML = `<div class="page"><div class="empty"><h1>Page introuvable</h1><p>La page demandée n'existe pas.</p><a class="btn" href="#/accueil">Retour à l'accueil</a></div></div>`;
}

function gameCard(game) {
  return `
    <article class="game-card">
      <div class="visual">${illustration(game.art, false)}</div>
      <div class="game-card-body">
        <div class="meta-row"><span class="tag">${game.category}</span>${game.demo ? `<span class="tag">Jouable</span>` : ""}</div>
        <h3>${game.name}</h3>
        <p>${game.intro}</p>
        <div class="card-actions">
          <a class="btn small" href="#/jeu/${game.id}">Voir les règles</a>
          ${game.demo ? `<a class="btn outline small" href="#/jouer/${game.id}">Jouer</a>` : ""}
        </div>
      </div>
    </article>
  `;
}

function normalize(text) {
  return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function illustration(type, large = false) {
  const W = large ? 760 : 520;
  const H = large ? 420 : 300;
  const common = `viewBox="0 0 ${W} ${H}" role="img" aria-label="Illustration du jeu"`;

  if (type === "chess" || type === "checkers") {
    const size = Math.min(W, H) * .72;
    const x0 = (W - size) / 2, y0 = (H - size) / 2;
    let cells = "";
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      const fill = (r + c) % 2 ? "#5b4737" : "#e7d4ae";
      cells += `<rect x="${x0 + c * size / 8}" y="${y0 + r * size / 8}" width="${size / 8}" height="${size / 8}" fill="${fill}"/>`;
    }
    let pieces = "";
    if (type === "chess") {
      pieces = `<text x="${W/2}" y="${H/2+28}" font-size="105" text-anchor="middle" fill="#f9f3e6">♞</text><text x="${W/2+80}" y="${H/2-28}" font-size="85" text-anchor="middle" fill="#1f1f1d">♛</text>`;
    } else {
      for (let i=0;i<5;i++) pieces += `<circle cx="${x0+size*.18+i*size*.14}" cy="${y0+size*.28}" r="${size*.055}" fill="#c73f38" stroke="#822e29" stroke-width="4"/><circle cx="${x0+size*.25+i*size*.14}" cy="${y0+size*.70}" r="${size*.055}" fill="#efe6d6" stroke="#a39a8a" stroke-width="4"/>`;
    }
    return `<svg ${common}><rect width="100%" height="100%" fill="#c7b699"/>${cells}${pieces}</svg>`;
  }

  if (type === "go") {
    let lines = "";
    const x0=90, x1=W-90, y0=45, y1=H-45;
    for (let i=0;i<9;i++) {
      const x=x0+(x1-x0)*i/8, y=y0+(y1-y0)*i/8;
      lines += `<line x1="${x}" y1="${y0}" x2="${x}" y2="${y1}" stroke="#4d351d" stroke-width="2"/><line x1="${x0}" y1="${y}" x2="${x1}" y2="${y}" stroke="#4d351d" stroke-width="2"/>`;
    }
    return `<svg ${common}><rect width="100%" height="100%" fill="#d7ad61"/>${lines}<circle cx="${W*.43}" cy="${H*.47}" r="20" fill="#161616"/><circle cx="${W*.58}" cy="${H*.62}" r="20" fill="#f4f0e7" stroke="#777" stroke-width="2"/><circle cx="${W*.52}" cy="${H*.33}" r="20" fill="#161616"/></svg>`;
  }

  if (type === "awale") {
    let pits="";
    for(let r=0;r<2;r++) for(let c=0;c<6;c++) {
      const cx=70+c*(W-140)/5, cy=H*(r?0.68:0.32);
      pits += `<ellipse cx="${cx}" cy="${cy}" rx="30" ry="24" fill="#603817" stroke="#3f240f" stroke-width="5"/><circle cx="${cx-8}" cy="${cy-4}" r="5" fill="#efcf91"/><circle cx="${cx+6}" cy="${cy+6}" r="5" fill="#efcf91"/><circle cx="${cx+12}" cy="${cy-8}" r="5" fill="#efcf91"/><circle cx="${cx-13}" cy="${cy+9}" r="5" fill="#efcf91"/>`;
    }
    return `<svg ${common}><rect width="100%" height="100%" fill="#b6793c"/><rect x="28" y="35" width="${W-56}" height="${H-70}" rx="55" fill="#9a622e" stroke="#6e431e" stroke-width="10"/>${pits}</svg>`;
  }

  if (type === "abalone") {
    let dots="";
    const rows=[5,6,7,8,9,8,7,6,5];
    rows.forEach((n,r)=>{ const y=38+r*(H-76)/8; const step=34; const start=W/2-(n-1)*step/2; for(let c=0;c<n;c++){ const isDark=r<3 || (r===3&&c<3); const isLight=r>5 || (r===5&&c>n-4); dots+=`<circle cx="${start+c*step}" cy="${y}" r="13" fill="${isDark?'#1f2427':isLight?'#f2eee4':'#6e8a7a'}" stroke="#314a3f" stroke-width="2"/>`; }});
    return `<svg ${common}><rect width="100%" height="100%" fill="#d9d4c8"/>${dots}</svg>`;
  }

  if (type === "catan") {
    const hex=(cx,cy,s,fill)=>{const pts=[];for(let i=0;i<6;i++){const a=Math.PI/3*i;pts.push(`${cx+s*Math.cos(a)},${cy+s*Math.sin(a)}`)}return `<polygon points="${pts.join(' ')}" fill="${fill}" stroke="#f4ecd6" stroke-width="5"/>`;};
    const colors=["#7f9b52","#c69f4a","#8a6b4e","#7aad78","#c9bb79","#7895b5","#a57858"];
    let h=""; let idx=0; const s=56; const dx=s*1.52, dy=s*1.32;
    [[-1,0,1],[-1.5,-.5,.5,1.5],[-1.5,-.5,.5,1.5],[-1,0,1]].forEach((row,r)=>{ row.forEach(pos=>{h+=hex(W/2+pos*dx,H*.23+r*dy,s,colors[idx++%colors.length]);});});
    return `<svg ${common}><rect width="100%" height="100%" fill="#b9d1de"/>${h}</svg>`;
  }

  if (type === "carcassonne") {
    let tiles=""; const S=78; const ox=W/2-S*2.5, oy=H/2-S*1.5;
    for(let r=0;r<3;r++)for(let c=0;c<5;c++){const x=ox+c*S,y=oy+r*S;tiles+=`<rect x="${x}" y="${y}" width="${S-3}" height="${S-3}" rx="5" fill="${(r+c)%3===0?'#a8bf70':(r+c)%3===1?'#d9c78f':'#96b97a'}" stroke="#f8f2e2" stroke-width="3"/><path d="M${x+S/2} ${y} C${x+S/2-10} ${y+25}, ${x+S/2+15} ${y+50}, ${x+S/2} ${y+S}" stroke="#d3c6ae" stroke-width="12" fill="none"/>`;}
    return `<svg ${common}><rect width="100%" height="100%" fill="#d7caa9"/>${tiles}</svg>`;
  }

  if (type === "cards") {
    return `<svg ${common}><rect width="100%" height="100%" fill="#35644b"/><g transform="translate(${W/2-115} ${H/2-105}) rotate(-8 75 105)"><rect width="150" height="210" rx="14" fill="#fffdf8"/><text x="20" y="42" font-size="32" fill="#b92f33">A♥</text></g><g transform="translate(${W/2-10} ${H/2-95}) rotate(10 75 105)"><rect width="150" height="210" rx="14" fill="#fffdf8"/><text x="20" y="42" font-size="32" fill="#1f1f1f">K♣</text></g></svg>`;
  }

  if (type === "dice") {
    const die=(x,y,s,pips)=>`<g><rect x="${x}" y="${y}" width="${s}" height="${s}" rx="18" fill="#fffdf8" stroke="#d3c9b8" stroke-width="4"/>${pips.map(([px,py])=>`<circle cx="${x+px*s}" cy="${y+py*s}" r="${s*.07}" fill="#252525"/>`).join("")}</g>`;
    return `<svg ${common}><rect width="100%" height="100%" fill="#8fb39a"/>${die(W*.27,H*.30,120,[[.25,.25],[.75,.25],[.5,.5],[.25,.75],[.75,.75]])}${die(W*.52,H*.42,120,[[.25,.25],[.75,.75],[.25,.75],[.75,.25]])}</svg>`;
  }

  if (type === "domino") {
    let ds=""; for(let i=0;i<5;i++){const x=80+i*(W-160)/4,y=H/2-62+(i%2?20:-10);ds+=`<g transform="rotate(${i%2?10:-8} ${x} ${y})"><rect x="${x-30}" y="${y-55}" width="60" height="110" rx="8" fill="#f5efe0" stroke="#3e3a34" stroke-width="3"/><line x1="${x-30}" y1="${y}" x2="${x+30}" y2="${y}" stroke="#3e3a34" stroke-width="3"/><circle cx="${x}" cy="${y-28}" r="6" fill="#3e3a34"/><circle cx="${x-12}" cy="${y+22}" r="6" fill="#3e3a34"/><circle cx="${x+12}" cy="${y+22}" r="6" fill="#3e3a34"/></g>`;}
    return `<svg ${common}><rect width="100%" height="100%" fill="#c8b99d"/>${ds}</svg>`;
  }

  return `<svg ${common}><rect width="100%" height="100%" fill="#ddd4c5"/><circle cx="50%" cy="50%" r="70" fill="#326149"/></svg>`;
}

// -------------------------------
// AWÉLÉ : moteur de jeu local
// -------------------------------
let awale = null;

function initAwale() {
  awale = { pits: Array(12).fill(4), scores: [0, 0], player: 0, over: false, mode: "ai" };
  document.getElementById("awaleMode").addEventListener("change", e => { awale.mode = e.target.value; newAwale(); });
  document.getElementById("newAwale").addEventListener("click", newAwale);
  renderAwale();
}

function newAwale() {
  awale.pits = Array(12).fill(4);
  awale.scores = [0, 0];
  awale.player = 0;
  awale.over = false;
  renderAwale("Nouvelle partie : au joueur 1 de commencer.");
}

function renderAwale(message = "") {
  const board = document.getElementById("awaleBoard");
  const top = [11,10,9,8,7,6];
  const bottom = [0,1,2,3,4,5];
  board.innerHTML = [...top, ...bottom].map(i => pitHtml(i)).join("");
  document.getElementById("score0").textContent = awale.scores[0];
  document.getElementById("score1").textContent = awale.scores[1];
  document.getElementById("awaleStatus").textContent = message || statusText();
  board.querySelectorAll(".pit.playable").forEach(btn => btn.addEventListener("click", () => handleAwaleMove(Number(btn.dataset.pit))));
}

function pitHtml(i) {
  const owner = i < 6 ? 0 : 1;
  const legal = !awale.over && owner === awale.player && isLegalAwaleMove(awale, i) && !(awale.mode === "ai" && awale.player === 1);
  const seeds = Array.from({ length: Math.min(awale.pits[i], 18) }, () => `<span class="seed"></span>`).join("");
  return `<button class="pit ${legal ? "playable" : ""}" data-pit="${i}" ${legal ? "" : "disabled"} aria-label="Case ${i+1}, ${awale.pits[i]} graines"><span class="seed-cloud">${seeds}</span><span>${awale.pits[i]}</span></button>`;
}

function statusText() {
  if (awale.over) return endMessage(awale);
  return awale.player === 0 ? "Au joueur 1 de jouer." : (awale.mode === "ai" ? "L'IA réfléchit…" : "Au joueur 2 de jouer.");
}

function handleAwaleMove(index) {
  if (!isLegalAwaleMove(awale, index) || awale.over) return;
  awale = applyAwaleMove(awale, index);
  finishOrContinue();
  renderAwale();

  if (!awale.over && awale.mode === "ai" && awale.player === 1) {
    setTimeout(() => {
      const move = chooseAiMove(awale);
      if (move !== null) awale = applyAwaleMove(awale, move);
      finishOrContinue();
      renderAwale();
    }, 420);
  }
}

function finishOrContinue() {
  const legal = legalMoves(awale);
  if (awale.scores[0] >= 25 || awale.scores[1] >= 25 || legal.length === 0 || awale.pits.reduce((a,b)=>a+b,0) <= 6) {
    const remaining0 = awale.pits.slice(0,6).reduce((a,b)=>a+b,0);
    const remaining1 = awale.pits.slice(6).reduce((a,b)=>a+b,0);
    awale.scores[0] += remaining0;
    awale.scores[1] += remaining1;
    awale.pits.fill(0);
    awale.over = true;
  }
}

function legalMoves(state) {
  const start = state.player === 0 ? 0 : 6;
  const moves = [];
  for (let i = start; i < start + 6; i++) if (isLegalAwaleMove(state, i)) moves.push(i);
  return moves;
}

function isLegalAwaleMove(state, index) {
  const owner = index < 6 ? 0 : 1;
  if (owner !== state.player || state.pits[index] === 0) return false;
  const opponentEmpty = sideSeeds(state, 1 - state.player) === 0;
  if (!opponentEmpty) return true;
  const test = sowOnly(state, index);
  return sideSeeds(test, 1 - state.player) > 0;
}

function sowOnly(state, index) {
  const next = { pits: [...state.pits], scores: [...state.scores], player: state.player, over: state.over, mode: state.mode };
  let seeds = next.pits[index];
  next.pits[index] = 0;
  let pos = index;
  while (seeds > 0) {
    pos = (pos + 1) % 12;
    if (pos === index) continue;
    next.pits[pos]++;
    seeds--;
  }
  next.last = pos;
  return next;
}

function applyAwaleMove(state, index) {
  const next = sowOnly(state, index);
  const current = state.player;
  let captured = [];
  let pos = next.last;
  const opponentStart = current === 0 ? 6 : 0;
  const opponentEnd = opponentStart + 5;

  while (pos >= opponentStart && pos <= opponentEnd && (next.pits[pos] === 2 || next.pits[pos] === 3)) {
    captured.push(pos);
    pos = (pos + 11) % 12;
  }

  const totalCaptured = captured.reduce((sum, p) => sum + next.pits[p], 0);
  const opponentTotalBefore = sideSeeds(next, 1 - current);

  // Règle anti-famine : si la capture viderait entièrement le camp adverse,
  // elle est annulée mais la semaille reste valable.
  if (totalCaptured > 0 && totalCaptured < opponentTotalBefore) {
    captured.forEach(p => { next.scores[current] += next.pits[p]; next.pits[p] = 0; });
  }

  next.player = 1 - current;
  delete next.last;
  return next;
}

function sideSeeds(state, player) {
  const start = player === 0 ? 0 : 6;
  return state.pits.slice(start, start + 6).reduce((a,b)=>a+b,0);
}

function chooseAiMove(state) {
  const moves = legalMoves(state);
  if (!moves.length) return null;
  let bestMove = moves[0], bestScore = -Infinity;
  for (const move of moves) {
    const before = state.scores[1];
    const simulated = applyAwaleMove(state, move);
    const gain = simulated.scores[1] - before;
    const opponentMoves = legalMoves(simulated);
    let opponentBestGain = 0;
    for (const opp of opponentMoves) {
      const reply = applyAwaleMove(simulated, opp);
      opponentBestGain = Math.max(opponentBestGain, reply.scores[0] - simulated.scores[0]);
    }
    const ownSeeds = sideSeeds(simulated, 1);
    const score = gain * 10 - opponentBestGain * 6 + ownSeeds * .08 + Math.random() * .25;
    if (score > bestScore) { bestScore = score; bestMove = move; }
  }
  return bestMove;
}

function endMessage(state) {
  if (state.scores[0] > state.scores[1]) return `Partie terminée : joueur 1 gagne ${state.scores[0]} à ${state.scores[1]}.`;
  if (state.scores[1] > state.scores[0]) return `Partie terminée : joueur 2 / IA gagne ${state.scores[1]} à ${state.scores[0]}.`;
  return `Partie terminée : égalité ${state.scores[0]} à ${state.scores[1]}.`;
}
