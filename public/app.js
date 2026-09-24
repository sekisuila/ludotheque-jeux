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
  const [path, queryString=""] = raw.split("?");
  const [route, id] = path.split("/");
  const routeParams = new URLSearchParams(queryString);

  if (route === "accueil") renderHome();
  else if (route === "catalogue") renderCatalogue();
  else if (route === "jeu" && id) renderGame(id);
  else if (route === "jouer") renderPlay(id);
  else if (route === "apropos") renderAbout();
  else if (route === "compte") renderAccount();
  else if (route === "recuperation") renderRecovery();
  else if (route === "reinitialiser") renderEmailPasswordReset(routeParams.get("token") || "");
  else if (route === "verification") renderEmailVerification(routeParams.get("token") || "");
  else renderNotFound();

  requestAnimationFrame(() => {
    app.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "instant" });
  });
}


const HOME_GAME_CATEGORIES = [
  {
    title: "Stratégie",
    description: "Jeux de réflexion, d’anticipation et de confrontation.",
    ids: ["echecs", "dames", "go", "awale", "abalone"]
  },
  {
    title: "Plateau & tuiles",
    description: "Construire, développer un territoire et optimiser ses placements.",
    ids: ["catan", "carcassonne"]
  },
  {
    title: "Cartes",
    description: "Plis, combinaisons, défausse et tactique avec des cartes.",
    ids: ["cartes"]
  },
  {
    title: "Dés",
    description: "Probabilités, prises de risque et choix de relance.",
    ids: ["yams", "421", "des"]
  },
  {
    title: "Dominos",
    description: "Placement, blocage et gestion des valeurs disponibles.",
    ids: ["dominos"]
  }
];

function homeCategorySection(category) {
  const games = category.ids.map(id => GAMES.find(game => game.id === id)).filter(Boolean);
  if (!games.length) return "";
  return `
    <section class="home-category-block">
      <div class="home-category-head">
        <div>
          <h3>${category.title}</h3>
          <p>${category.description}</p>
        </div>
        <a href="#/catalogue" class="home-category-link">Voir le catalogue</a>
      </div>
      <div class="grid cards home-category-grid">${games.map(gameCard).join("")}</div>
    </section>
  `;
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

      <section class="section home-game-categories">
        <div class="section-head">
          <div>
            <div class="eyebrow">Explorer la ludothèque</div>
            <h2>Les jeux classés par grandes catégories</h2>
            <p class="section-lead">Choisissez directement la famille qui vous intéresse. Le catalogue complet reste disponible pour rechercher ou filtrer plus précisément.</p>
          </div>
          <a class="btn outline small" href="#/catalogue">Voir tout le catalogue</a>
        </div>
        <div class="home-category-list">${HOME_GAME_CATEGORIES.map(homeCategorySection).join("")}</div>
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
          <article class="feature"><div class="ico">🧠</div><h3>Jeux contre IA</h3><p>Le site inclut maintenant l’Awélé, les Échecs, deux variantes de Dames, le Go, Abalone et le Yams, avec jeu local, IA et modes en ligne selon les jeux.</p></article>
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
  if (id === "yams") return renderYamsGamePage(game);
  if (id === "421") return render421GamePage(game);

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
            <label><span>Mode</span><select id="abaloneMode"><option value="ai">Joueur contre IA</option><option value="local">2 joueurs sur le même écran</option><option value="online" selected>Multijoueur en ligne</option></select></label>
            <div id="abaloneAiSettings" class="toolbar-group" hidden>
              <label><span>Niveau IA</span><select id="abaloneAiLevel"><option value="easy">Facile</option><option value="medium" selected>Intermédiaire</option><option value="hard">Difficile</option><option value="expert">Expert</option></select></label>
              <label><span>Votre couleur</span><select id="abaloneSide"><option value="1" selected>Noir</option><option value="2">Blanc</option></select></label>
            </div>
            <div id="abaloneOnlineSettings" class="toolbar-group abalone-online-settings">
              <label><span>Couleur si vous créez</span><select id="abaloneCreatorColor"><option value="random" selected>Aléatoire</option><option value="black">Noirs</option><option value="white">Blancs</option></select></label>
              <label><span>Cadence</span><select id="abaloneTimePreset">
                <option value="60,0">1+0 — Bullet</option><option value="180,2">3+2 — Blitz</option><option value="300,0">5+0 — Blitz</option><option value="600,5" selected>10+5 — Rapide</option><option value="900,10">15+10 — Rapide</option><option value="1800,0">30+0 — Classique</option><option value="custom">Personnalisée…</option>
              </select></label>
              <span id="abaloneCustomTime" class="custom-time-fields" hidden><label><span>Minutes</span><input id="abaloneInitialMinutes" type="number" min="1" max="180" value="10"></label><label><span>+ secondes/coup</span><input id="abaloneIncrementSeconds" type="number" min="0" max="60" value="5"></label></span>
              <label class="inline-check"><input id="abaloneRated" type="checkbox" checked><span>Partie classée Elo</span></label>
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

          <div class="abalone-stage">
            <div class="abalone-board-wrap">
              <div id="abaloneBoard" class="abalone-board" aria-label="Plateau Abalone interactif"></div>
            </div>
            <div id="abaloneClockPanel" class="abalone-clock-panel" hidden>
              <div id="abaloneClockReadout" class="abalone-clock-readout"></div>
              <div id="abaloneTimeMeta" class="chess-time-meta"></div>
              <div id="abaloneOnlineActions" class="chess-online-actions" hidden>
                <button id="resignAbaloneOnline" class="btn danger small">Abandonner</button>
                <button id="offerDrawAbalone" class="btn outline small">Proposer la nulle</button>
                <button id="offerRematchAbalone" class="btn small" hidden>Proposer une revanche</button>
              </div>
              <div id="abaloneOnlinePrompt" class="online-decision" hidden><strong id="abaloneOnlinePromptTitle"></strong><span id="abaloneOnlinePromptText"></span><div class="online-decision-actions"><button id="acceptAbaloneProposal" class="btn small">Accepter</button><button id="declineAbaloneProposal" class="btn outline small">Refuser</button></div></div>
              <div id="abaloneRatingResult" class="rating-result" hidden></div>
            </div>
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
          <section class="panel"><h3>Multijoueur en ligne</h3><p>Créez un salon privé ou rejoignez un code. Le créateur choisit sa couleur, la cadence et si la partie est classée Elo.</p><p>La pendule et tous les déplacements, Sumitos et éjections sont validés côté serveur.</p><div class="note"><strong>Elo :</strong> Bullet, Blitz, Rapide et Classique disposent chacun de leur propre classement, à partir de 1200.</div></section><section class="panel"><h3>Règles gérées</h3><p>✓ 1 à 3 billes par mouvement</p><p>✓ Déplacement en ligne</p><p>✓ Déplacement latéral</p><p>✓ Sumito 2–1, 3–1 et 3–2</p><p>✓ Blocage des forces égales</p><p>✓ Éjection et victoire à 6</p><div class="note"><strong>Astuce :</strong> les cases vertes montrent les destinations possibles. Les billes adverses bordées de rouge sont celles qu’un Sumito sélectionné peut pousser.</div></section>
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


const CHECKERS_VARIANT_LABELS={international:"Internationales 10×10",english:"Anglaises 8×8"};

async function loadCheckersRatingsPanel(){
  const mine=document.getElementById("myCheckersRatings"),board=document.getElementById("checkersEloLeaderboard");
  const variant=document.getElementById("checkersEloVariant"),category=document.getElementById("checkersEloCategory");
  if(!mine||!board||!variant||!category||!window.LudoOnline?.checkersRatings) return;
  const loadMine=async()=>{
    mine.innerHTML="<p>Chargement…</p>";
    try{
      const ratings=await LudoOnline.checkersRatings.mine(variant.value);
      mine.innerHTML=["bullet","blitz","rapid","classical"].map(cat=>{
        const r=ratings[cat]||{rating:1200,games:0};
        return `<div class="elo-chip"><span>${ELO_CATEGORY_LABELS[cat]}</span><strong>${Number(r.rating||1200)}</strong><small>${Number(r.games||0)} partie${Number(r.games||0)>1?"s":""}</small></div>`;
      }).join("");
    }catch(err){ mine.innerHTML=`<p class="form-status">${escapeHtml(err.message)}</p>`; }
  };
  const loadBoard=async()=>{
    board.innerHTML="<p>Chargement…</p>";
    try{
      const data=await LudoOnline.checkersRatings.leaderboard(variant.value,category.value,30);
      const players=Array.isArray(data.players)?data.players:[];
      if(!players.length){ board.innerHTML="<p>Aucune partie classée dans cette catégorie pour le moment.</p>"; return; }
      board.innerHTML=`<div class="elo-table"><div class="elo-row elo-head"><span>#</span><span>Joueur</span><span>Elo</span><span>Parties</span></div>${players.map((p,i)=>`<div class="elo-row"><span>${i+1}</span><strong>${escapeHtml(p.username)}</strong><span>${Number(p.rating)}</span><span>${Number(p.games)}</span></div>`).join("")}</div>`;
    }catch(err){ board.innerHTML=`<p class="form-status">${escapeHtml(err.message)}</p>`; }
  };
  variant.addEventListener("change",async()=>{await loadMine();await loadBoard();});
  category.addEventListener("change",loadBoard);
  await loadMine(); await loadBoard();
}

let checkersArchiveReplay={game:null,ply:0};
function checkersArchiveReasonLabel(reason){
  return ({win:"Victoire",timeout:"Temps",resign:"Abandon","draw-agreement":"Nulle convenue",repetition:"Répétition","quiet-draw":"Règle de nulle"})[reason]||reason||"Partie terminée";
}
function checkersArchiveSnapshots(replay){
  if(!replay?.state) return [];
  const hist=Array.isArray(replay.history)?replay.history:[];
  const snaps=hist.map(x=>x?.state).filter(Boolean); snaps.push(replay.state); return snaps;
}
function checkersSideLabels(variant){ return variant==="english"?["Rouges","Blancs"]:["Blancs","Noirs"]; }
function checkersPieceClass(variant,side){ return variant==="english"?(side===0?"draught-red":"draught-white"):(side===0?"draught-white":"draught-black"); }
function renderCheckersArchiveBoard(){
  const panel=document.getElementById("checkersArchiveReplay");
  if(!panel||!checkersArchiveReplay.game?.replay) return;
  const replay=checkersArchiveReplay.game.replay,snaps=checkersArchiveSnapshots(replay),max=Math.max(0,snaps.length-1);
  checkersArchiveReplay.ply=Math.max(0,Math.min(max,checkersArchiveReplay.ply));
  const state=snaps[checkersArchiveReplay.ply],variant=checkersArchiveReplay.game.variant||replay.variant||"international";
  const size=variant==="english"?8:10,board=state?.board||[],moves=Array.isArray(replay.history)?replay.history:[];
  const last=checkersArchiveReplay.ply>0?moves[checkersArchiveReplay.ply-1]?.notation:"Position initiale";
  const boardEl=panel.querySelector(".archive-draught-board");
  boardEl.style.setProperty("--archive-draught-size",size);
  boardEl.innerHTML=Array.from({length:size*size},(_,i)=>{
    const r=Math.floor(i/size),c=i%size,piece=board?.[r]?.[c],dark=(r+c)%2===1;
    return `<div class="archive-draught-square ${dark?"dark":"light"}">${piece?`<span class="archive-draught-piece ${checkersPieceClass(variant,piece.side)} ${piece.king?"king":""}">${piece.king?"♛":""}</span>`:""}</div>`;
  }).join("");
  panel.querySelector("[data-checkers-archive-ply]").textContent=`${checkersArchiveReplay.ply}/${max} — ${escapeHtml(last||"")}`;
  panel.querySelector('[data-checkers-step="start"]').disabled=checkersArchiveReplay.ply===0;
  panel.querySelector('[data-checkers-step="prev"]').disabled=checkersArchiveReplay.ply===0;
  panel.querySelector('[data-checkers-step="next"]').disabled=checkersArchiveReplay.ply===max;
  panel.querySelector('[data-checkers-step="end"]').disabled=checkersArchiveReplay.ply===max;
}
function closeCheckersArchiveReplay(){ checkersArchiveReplay={game:null,ply:0}; const p=document.getElementById("checkersArchiveReplay"); if(p)p.hidden=true; }
async function openCheckersArchiveReplay(id){
  const panel=document.getElementById("checkersArchiveReplay"); if(!panel)return;
  panel.hidden=false; panel.innerHTML="<p>Chargement de la partie…</p>";
  try{
    const game=await LudoOnline.checkersGames.get(id);
    if(!game.replay){ panel.innerHTML=`<div class="archive-replay-head"><h3>Relecture indisponible</h3><button class="btn small outline" id="closeCheckersArchive">Fermer</button></div>`; document.getElementById("closeCheckersArchive")?.addEventListener("click",closeCheckersArchiveReplay); return; }
    checkersArchiveReplay={game,ply:0};
    const labels=checkersSideLabels(game.variant);
    panel.innerHTML=`<div class="archive-replay-head"><div><h3>${escapeHtml(game.side0Username)} — ${escapeHtml(game.side1Username)}</h3><p>${escapeHtml(CHECKERS_VARIANT_LABELS[game.variant]||game.variant)} · ${escapeHtml(game.result)} · ${escapeHtml(checkersArchiveReasonLabel(game.reason))} · ${escapeHtml(chessArchiveTimeLabel(game))}</p><small>${labels[0]} : ${escapeHtml(game.side0Username)} · ${labels[1]} : ${escapeHtml(game.side1Username)}</small></div><button class="btn small outline" id="closeCheckersArchive">Fermer</button></div><div class="archive-draught-board" aria-label="Damier de relecture"></div><div class="archive-replay-controls"><button class="btn small outline" data-checkers-step="start">⏮ Début</button><button class="btn small outline" data-checkers-step="prev">◀ Précédent</button><strong data-checkers-archive-ply></strong><button class="btn small outline" data-checkers-step="next">Suivant ▶</button><button class="btn small outline" data-checkers-step="end">Fin ⏭</button></div>`;
    document.getElementById("closeCheckersArchive")?.addEventListener("click",closeCheckersArchiveReplay);
    panel.querySelectorAll("[data-checkers-step]").forEach(btn=>btn.addEventListener("click",()=>{
      const max=Math.max(0,checkersArchiveSnapshots(checkersArchiveReplay.game.replay).length-1);
      if(btn.dataset.checkersStep==="start")checkersArchiveReplay.ply=0;
      if(btn.dataset.checkersStep==="prev")checkersArchiveReplay.ply--;
      if(btn.dataset.checkersStep==="next")checkersArchiveReplay.ply++;
      if(btn.dataset.checkersStep==="end")checkersArchiveReplay.ply=max;
      renderCheckersArchiveBoard();
    }));
    renderCheckersArchiveBoard();
    requestAnimationFrame(()=>panel.scrollIntoView({behavior:"smooth",block:"start"}));
  }catch(err){ panel.innerHTML=`<p class="form-status">${escapeHtml(err.message)}</p>`; }
}
async function loadCheckersGamesPanel(){
  const list=document.getElementById("checkersGameArchiveList"); if(!list||!window.LudoOnline?.checkersGames)return;
  list.innerHTML="<p>Chargement des parties…</p>";
  try{
    const games=await LudoOnline.checkersGames.list();
    if(!games.length){ list.innerHTML="<p>Aucune partie de Dames en ligne terminée pour le moment.</p>"; return; }
    list.innerHTML=games.map(g=>{
      const labels=checkersSideLabels(g.variant);
      return `<article class="archive-game-row"><div><strong>${escapeHtml(g.side0Username)} <span class="archive-result">${escapeHtml(g.result)}</span> ${escapeHtml(g.side1Username)}</strong><small>${escapeHtml(chessArchiveDate(g.createdAt))} · ${escapeHtml(CHECKERS_VARIANT_LABELS[g.variant]||g.variant)} · ${escapeHtml(chessArchiveTimeLabel(g))} · ${escapeHtml(ELO_CATEGORY_LABELS[g.category]||g.category||"")} · ${g.rated?"Classée":"Amicale"} · ${escapeHtml(checkersArchiveReasonLabel(g.reason))}</small><small>${labels[0]} : ${escapeHtml(g.side0Username)} · ${labels[1]} : ${escapeHtml(g.side1Username)}</small></div><button class="btn small ${g.replayAvailable?"":"outline"}" data-checkers-replay-id="${g.id}" ${g.replayAvailable?"":"disabled"}>${g.replayAvailable?"Rejouer":"Historique ancien"}</button></article>`;
    }).join("");
    list.querySelectorAll("[data-checkers-replay-id]:not([disabled])").forEach(btn=>btn.addEventListener("click",()=>openCheckersArchiveReplay(btn.dataset.checkersReplayId)));
  }catch(err){ list.innerHTML=`<p class="form-status">${escapeHtml(err.message)}</p>`; }
}

const GO_SIZE_LABELS={9:"9×9",13:"13×13",19:"19×19"};
async function loadGoRatingsPanel(){
  const mine=document.getElementById("myGoRatings"),board=document.getElementById("goEloLeaderboard"),size=document.getElementById("goEloSize"),category=document.getElementById("goEloCategory");
  if(!mine||!board||!size||!category||!window.LudoOnline?.goRatings)return;
  const refresh=async()=>{
    try{
      const ratings=await LudoOnline.goRatings.mine(Number(size.value));
      mine.innerHTML=["bullet","blitz","rapid","classical"].map(k=>`<div><span>${escapeHtml(ELO_CATEGORY_LABELS[k]||k)}</span><strong>${ratings[k]?.rating??1200}</strong><small>${ratings[k]?.games??0} partie${Number(ratings[k]?.games||0)>1?"s":""}</small></div>`).join("");
      const data=await LudoOnline.goRatings.leaderboard(Number(size.value),category.value,30);
      board.innerHTML=data.players?.length?data.players.map((r,i)=>`<div class="elo-row"><span>${i+1}.</span><strong>${escapeHtml(r.username)}</strong><b>${r.rating}</b><small>${r.games} p.</small></div>`).join(""):"<p>Aucun classement pour cette catégorie.</p>";
    }catch(e){mine.innerHTML=board.innerHTML=`<p>${escapeHtml(e.message)}</p>`;}
  };
  size.addEventListener("change",refresh);category.addEventListener("change",refresh);refresh();
}
let goArchiveReplay={game:null,ply:0};
function goArchiveSnapshots(replay){
  if(!replay)return[];const out=(replay.history||[]).map(h=>h.state?.board).filter(Boolean).map(b=>b.slice());out.push((replay.board||[]).slice());return out;
}
function renderGoArchiveReplay(){
  const panel=document.getElementById("goArchiveReplay");if(!panel||!goArchiveReplay.game?.replay)return;
  const replay=goArchiveReplay.game.replay,snaps=goArchiveSnapshots(replay),max=Math.max(0,snaps.length-1);goArchiveReplay.ply=Math.max(0,Math.min(max,goArchiveReplay.ply));
  const board=snaps[goArchiveReplay.ply]||[],size=Number(goArchiveReplay.game.size||replay.size||19),last=goArchiveReplay.ply>0?(replay.moves||[])[goArchiveReplay.ply-1]:null;
  const el=panel.querySelector(".archive-go-board");el.style.setProperty("--archive-go-size",size);
  let html="";for(let r=0;r<size;r++)for(let c=0;c<size;c++){const v=board[r*size+c];html+=`<div class="archive-go-point">${v?`<span class="archive-go-stone ${v===1?"black":"white"}"></span>`:""}</div>`;}el.innerHTML=html;
  panel.querySelector("[data-go-archive-ply]").textContent=`${goArchiveReplay.ply}/${max} — ${escapeHtml(last?.label||"Position initiale")}`;
  panel.querySelector('[data-go-step="start"]').disabled=goArchiveReplay.ply===0;panel.querySelector('[data-go-step="prev"]').disabled=goArchiveReplay.ply===0;panel.querySelector('[data-go-step="next"]').disabled=goArchiveReplay.ply===max;panel.querySelector('[data-go-step="end"]').disabled=goArchiveReplay.ply===max;
}
function closeGoArchiveReplay(){goArchiveReplay={game:null,ply:0};const p=document.getElementById("goArchiveReplay");if(p)p.hidden=true;}
async function openGoArchiveReplay(id){
  const panel=document.getElementById("goArchiveReplay");if(!panel)return;
  try{const game=await LudoOnline.goGames.get(id);goArchiveReplay={game,ply:0};panel.innerHTML=`<div class="archive-replay-head"><div><h3>${escapeHtml(game.blackUsername)} — ${escapeHtml(game.whiteUsername)}</h3><p>Go ${GO_SIZE_LABELS[game.size]||game.size} · ${escapeHtml(game.result)} · komi ${game.komi} · ${escapeHtml(chessArchiveTimeLabel(game))}</p><small>Noir : ${escapeHtml(game.blackUsername)} · Blanc : ${escapeHtml(game.whiteUsername)}</small></div><button class="btn small outline" id="closeGoArchive">Fermer</button></div><div class="archive-go-board"></div><div class="archive-replay-controls"><button class="btn small outline" data-go-step="start">⏮ Début</button><button class="btn small outline" data-go-step="prev">◀ Précédent</button><strong data-go-archive-ply></strong><button class="btn small outline" data-go-step="next">Suivant ▶</button><button class="btn small outline" data-go-step="end">Fin ⏭</button></div>`;panel.hidden=false;panel.querySelector("#closeGoArchive").addEventListener("click",closeGoArchiveReplay);panel.querySelectorAll("[data-go-step]").forEach(btn=>btn.addEventListener("click",()=>{const max=Math.max(0,goArchiveSnapshots(goArchiveReplay.game.replay).length-1);if(btn.dataset.goStep==="start")goArchiveReplay.ply=0;if(btn.dataset.goStep==="prev")goArchiveReplay.ply--;if(btn.dataset.goStep==="next")goArchiveReplay.ply++;if(btn.dataset.goStep==="end")goArchiveReplay.ply=max;renderGoArchiveReplay();}));renderGoArchiveReplay();panel.scrollIntoView({block:"start",behavior:"smooth"});}catch(e){panel.hidden=false;panel.innerHTML=`<p>${escapeHtml(e.message)}</p>`;}
}
async function loadGoGamesPanel(){
  const list=document.getElementById("goGameArchiveList");if(!list||!window.LudoOnline?.goGames)return;
  try{const games=await LudoOnline.goGames.list();if(!games.length){list.innerHTML="<p>Aucune partie de Go en ligne terminée pour le moment.</p>";return;}list.innerHTML=games.map(g=>`<article class="archive-game-row"><div><strong>${escapeHtml(g.blackUsername)} <span class="archive-result">${escapeHtml(g.result)}</span> ${escapeHtml(g.whiteUsername)}</strong><small>${escapeHtml(chessArchiveDate(g.createdAt))} · Go ${GO_SIZE_LABELS[g.size]||g.size} · ${escapeHtml(chessArchiveTimeLabel(g))} · ${escapeHtml(ELO_CATEGORY_LABELS[g.category]||g.category||"")} · ${g.rated?"Classée":"Amicale"} · komi ${g.komi}</small></div><button class="btn small ${g.replayAvailable?"":"outline"}" data-go-replay-id="${g.id}" ${g.replayAvailable?"":"disabled"}>${g.replayAvailable?"Rejouer":"Historique ancien"}</button></article>`).join("");list.querySelectorAll("[data-go-replay-id]:not([disabled])").forEach(btn=>btn.addEventListener("click",()=>openGoArchiveReplay(btn.dataset.goReplayId)));}catch(e){list.innerHTML=`<p>${escapeHtml(e.message)}</p>`;}
}


let awaleArchiveReplay={game:null,ply:0};
function awaleArchiveSnapshots(replay){if(!replay?.state)return[];const h=Array.isArray(replay.history)?replay.history:[];const snaps=h.map(x=>x?.state).filter(Boolean);snaps.push(replay.state);return snaps;}
function renderAwaleArchiveReplay(){
  const panel=document.getElementById("awaleArchiveReplay");if(!panel||!awaleArchiveReplay.game?.replay)return;
  const snaps=awaleArchiveSnapshots(awaleArchiveReplay.game.replay),max=Math.max(0,snaps.length-1);awaleArchiveReplay.ply=Math.max(0,Math.min(max,awaleArchiveReplay.ply));const st=snaps[awaleArchiveReplay.ply];
  const board=panel.querySelector(".archive-awale-board");if(board){const top=[11,10,9,8,7,6],bottom=[0,1,2,3,4,5];board.innerHTML=[...top,...bottom].map(i=>`<div class="archive-awale-pit"><span>${Number(st.pits?.[i]||0)}</span></div>`).join("");}
  panel.querySelector("[data-awale-archive-ply]").textContent=`${awaleArchiveReplay.ply}/${max} · Score ${st.scores?.[0]??0}–${st.scores?.[1]??0}`;
  panel.querySelector('[data-awale-step="start"]').disabled=awaleArchiveReplay.ply===0;panel.querySelector('[data-awale-step="prev"]').disabled=awaleArchiveReplay.ply===0;panel.querySelector('[data-awale-step="next"]').disabled=awaleArchiveReplay.ply===max;panel.querySelector('[data-awale-step="end"]').disabled=awaleArchiveReplay.ply===max;
}
function closeAwaleArchiveReplay(){awaleArchiveReplay={game:null,ply:0};const p=document.getElementById("awaleArchiveReplay");if(p)p.hidden=true;}
async function openAwaleArchiveReplay(id){
  const panel=document.getElementById("awaleArchiveReplay");if(!panel)return;panel.hidden=false;panel.innerHTML="<p>Chargement…</p>";
  try{const game=await LudoOnline.awaleGames.get(id);if(!game.replay){panel.innerHTML='<p>Historique indisponible.</p>';return;}awaleArchiveReplay={game,ply:0};panel.innerHTML=`<div class="archive-replay-head"><div><h3>${escapeHtml(game.side0Username)} — ${escapeHtml(game.side1Username)}</h3><p>${escapeHtml(game.result)} · ${escapeHtml(chessArchiveTimeLabel(game))}</p><small>Sud : ${escapeHtml(game.side0Username)} · Nord : ${escapeHtml(game.side1Username)}</small></div><button class="btn small outline" id="closeAwaleArchive">Fermer</button></div><div class="archive-awale-board"></div><div class="archive-replay-controls"><button class="btn small outline" data-awale-step="start">⏮ Début</button><button class="btn small outline" data-awale-step="prev">◀ Précédent</button><strong data-awale-archive-ply></strong><button class="btn small outline" data-awale-step="next">Suivant ▶</button><button class="btn small outline" data-awale-step="end">Fin ⏭</button></div>`;document.getElementById("closeAwaleArchive")?.addEventListener("click",closeAwaleArchiveReplay);panel.querySelectorAll("[data-awale-step]").forEach(btn=>btn.addEventListener("click",()=>{const max=Math.max(0,awaleArchiveSnapshots(awaleArchiveReplay.game.replay).length-1);if(btn.dataset.awaleStep==="start")awaleArchiveReplay.ply=0;if(btn.dataset.awaleStep==="prev")awaleArchiveReplay.ply--;if(btn.dataset.awaleStep==="next")awaleArchiveReplay.ply++;if(btn.dataset.awaleStep==="end")awaleArchiveReplay.ply=max;renderAwaleArchiveReplay();}));renderAwaleArchiveReplay();panel.scrollIntoView({block:"start",behavior:"smooth"});}catch(e){panel.innerHTML=`<p>${escapeHtml(e.message)}</p>`;}
}
async function loadAwaleRatingsPanel(){
  const mine=document.getElementById("myAwaleRatings"),board=document.getElementById("awaleEloLeaderboard"),category=document.getElementById("awaleEloCategory");if(!mine||!board||!category||!LudoOnline?.awaleRatings)return;
  try{const ratings=await LudoOnline.awaleRatings.mine();mine.innerHTML=["bullet","blitz","rapid","classical"].map(c=>{const r=ratings[c]||{rating:1200,games:0};return `<div class="elo-chip"><span>${ELO_CATEGORY_LABELS[c]}</span><strong>${r.rating}</strong><small>${r.games} partie${r.games>1?"s":""}</small></div>`;}).join("");}catch(e){mine.innerHTML=`<p>${escapeHtml(e.message)}</p>`;}
  const load=async()=>{try{const data=await LudoOnline.awaleRatings.leaderboard(category.value,30),players=data.players||[];board.innerHTML=players.length?`<div class="elo-table"><div class="elo-row elo-head"><span>#</span><span>Joueur</span><span>Elo</span><span>Parties</span></div>${players.map((p,i)=>`<div class="elo-row"><span>${i+1}</span><strong>${escapeHtml(p.username)}</strong><span>${p.rating}</span><span>${p.games}</span></div>`).join("")}</div>`:"<p>Aucune partie classée pour le moment.</p>";}catch(e){board.innerHTML=`<p>${escapeHtml(e.message)}</p>`;}};category.addEventListener("change",load);await load();
}
async function loadAwaleGamesPanel(){
  const list=document.getElementById("awaleGameArchiveList");if(!list||!LudoOnline?.awaleGames)return;
  try{const games=await LudoOnline.awaleGames.list();if(!games.length){list.innerHTML="<p>Aucune partie d’Awélé en ligne terminée pour le moment.</p>";return;}list.innerHTML=games.map(g=>`<article class="archive-game-row"><div><strong>${escapeHtml(g.side0Username)} <span class="archive-result">${escapeHtml(g.result)}</span> ${escapeHtml(g.side1Username)}</strong><small>${escapeHtml(chessArchiveDate(g.createdAt))} · ${escapeHtml(chessArchiveTimeLabel(g))} · ${escapeHtml(ELO_CATEGORY_LABELS[g.category]||g.category||"")} · ${g.rated?"Classée":"Amicale"}</small></div><button class="btn small ${g.replayAvailable?"":"outline"}" data-awale-replay-id="${g.id}" ${g.replayAvailable?"":"disabled"}>${g.replayAvailable?"Rejouer":"Historique ancien"}</button></article>`).join("");list.querySelectorAll("[data-awale-replay-id]:not([disabled])").forEach(btn=>btn.addEventListener("click",()=>openAwaleArchiveReplay(btn.dataset.awaleReplayId)));}catch(e){list.innerHTML=`<p>${escapeHtml(e.message)}</p>`;}
}



// ============================================================
// Abalone — classement Elo et archive/relecture dans la page Compte
// ============================================================
const ACCOUNT_AB_RADIUS = 4;
const ACCOUNT_AB_BLACK = 1;
const ACCOUNT_AB_WHITE = 2;
const ACCOUNT_AB_EMPTY = 0;

function accountAbInside(q,r){
  return Math.abs(q)<=ACCOUNT_AB_RADIUS && Math.abs(r)<=ACCOUNT_AB_RADIUS && Math.abs(q+r)<=ACCOUNT_AB_RADIUS;
}
function accountAbKey(q,r){ return `${q},${r}`; }
function accountAbParse(key){ return String(key).split(',').map(Number); }
function accountAbAddKey(key,dir){ const [q,r]=accountAbParse(key); return accountAbKey(q+Number(dir?.[0]||0),r+Number(dir?.[1]||0)); }
function accountAbCells(){
  const cells=[];
  for(let r=-ACCOUNT_AB_RADIUS;r<=ACCOUNT_AB_RADIUS;r++){
    for(let q=-ACCOUNT_AB_RADIUS;q<=ACCOUNT_AB_RADIUS;q++) if(accountAbInside(q,r)) cells.push([q,r]);
  }
  return cells;
}
const ACCOUNT_AB_CELLS = accountAbCells();

function accountAbInitialBoard(){
  const board={};
  for(const [q,r] of ACCOUNT_AB_CELLS) board[accountAbKey(q,r)]=ACCOUNT_AB_EMPTY;
  for(const [q,r] of ACCOUNT_AB_CELLS){
    if(r===-4||r===-3) board[accountAbKey(q,r)]=ACCOUNT_AB_BLACK;
    if(r===4||r===3) board[accountAbKey(q,r)]=ACCOUNT_AB_WHITE;
  }
  for(const q of [0,1,2]) board[accountAbKey(q,-2)]=ACCOUNT_AB_BLACK;
  for(const q of [-2,-1,0]) board[accountAbKey(q,2)]=ACCOUNT_AB_WHITE;
  return board;
}

function accountAbApplyMove(board,move){
  const next={...board};
  const player=Number(move?.player||0);
  const opponent=player===ACCOUNT_AB_BLACK?ACCOUNT_AB_WHITE:ACCOUNT_AB_BLACK;
  const dir=Array.isArray(move?.dir)?move.dir:[0,0];
  const group=Array.isArray(move?.group)?move.group:[];
  const push=Array.isArray(move?.push)?move.push:[];

  // Déplace d'abord les billes adverses, de la plus éloignée vers la plus proche.
  for(const key of [...push].reverse()){
    const dest=accountAbAddKey(key,dir);
    const [dq,dr]=accountAbParse(dest);
    next[key]=ACCOUNT_AB_EMPTY;
    if(accountAbInside(dq,dr)) next[dest]=opponent;
  }

  // Puis déplace le groupe du joueur.
  for(const key of group) next[key]=ACCOUNT_AB_EMPTY;
  for(const key of group){
    const dest=accountAbAddKey(key,dir);
    const [dq,dr]=accountAbParse(dest);
    if(accountAbInside(dq,dr)) next[dest]=player;
  }
  return next;
}

function abaloneArchiveSnapshots(replay){
  if(!replay) return [];
  let board=accountAbInitialBoard();
  let ejectBlack=0,ejectWhite=0;
  const snapshots=[{board:{...board},move:null,ejectBlack,ejectWhite}];
  const moves=Array.isArray(replay.moves)?replay.moves:[];
  for(const move of moves){
    board=accountAbApplyMove(board,move);
    if(Number(move?.eject||0)>0){
      if(Number(move.player)===ACCOUNT_AB_BLACK) ejectBlack+=Number(move.eject||0);
      else if(Number(move.player)===ACCOUNT_AB_WHITE) ejectWhite+=Number(move.eject||0);
    }
    snapshots.push({board:{...board},move,ejectBlack,ejectWhite});
  }
  // Le serveur conserve aussi le plateau final : on le préfère pour la dernière vue.
  if(replay.board && snapshots.length){
    snapshots[snapshots.length-1]={...snapshots[snapshots.length-1],board:{...replay.board},ejectBlack:Number(replay.ejected?.[ACCOUNT_AB_BLACK]??ejectBlack),ejectWhite:Number(replay.ejected?.[ACCOUNT_AB_WHITE]??ejectWhite)};
  }
  return snapshots;
}

let abaloneArchiveReplay={game:null,ply:0};

function renderAbaloneArchiveReplay(){
  const panel=document.getElementById('abaloneArchiveReplay');
  if(!panel||!abaloneArchiveReplay.game?.replay) return;
  const snaps=abaloneArchiveSnapshots(abaloneArchiveReplay.game.replay);
  const max=Math.max(0,snaps.length-1);
  abaloneArchiveReplay.ply=Math.max(0,Math.min(max,abaloneArchiveReplay.ply));
  const snap=snaps[abaloneArchiveReplay.ply];
  const board=panel.querySelector('.archive-abalone-board');
  if(board){
    board.innerHTML=`<div class="abalone-board-surface" aria-hidden="true"></div>`+ACCOUNT_AB_CELLS.map(([q,r])=>{
      const key=accountAbKey(q,r),value=Number(snap.board?.[key]||0);
      const left=50+(q+r/2)*10.45,top=50+r*10.45;
      const marble=value===ACCOUNT_AB_BLACK?'<span class="abalone-marble black"></span>':value===ACCOUNT_AB_WHITE?'<span class="abalone-marble white"></span>':'';
      return `<div class="abalone-cell archive" style="left:${left}%;top:${top}%">${marble}</div>`;
    }).join('');
  }
  const label=panel.querySelector('[data-abalone-archive-ply]');
  if(label){
    const move=snap.move?.label?` · ${escapeHtml(snap.move.label)}`:'';
    label.innerHTML=`Coup ${abaloneArchiveReplay.ply}/${max}${move}<br><small>Éjections : Noir ${snap.ejectBlack} · Blanc ${snap.ejectWhite}</small>`;
  }
  panel.querySelector('[data-abalone-step="start"]')?.toggleAttribute('disabled',abaloneArchiveReplay.ply===0);
  panel.querySelector('[data-abalone-step="prev"]')?.toggleAttribute('disabled',abaloneArchiveReplay.ply===0);
  panel.querySelector('[data-abalone-step="next"]')?.toggleAttribute('disabled',abaloneArchiveReplay.ply===max);
  panel.querySelector('[data-abalone-step="end"]')?.toggleAttribute('disabled',abaloneArchiveReplay.ply===max);
}

function closeAbaloneArchiveReplay(){
  abaloneArchiveReplay={game:null,ply:0};
  const panel=document.getElementById('abaloneArchiveReplay');
  if(panel) panel.hidden=true;
}

async function openAbaloneArchiveReplay(id){
  const panel=document.getElementById('abaloneArchiveReplay');
  if(!panel) return;
  panel.hidden=false; panel.innerHTML='<p>Chargement…</p>';
  try{
    const game=await LudoOnline.abaloneGames.get(id);
    if(!game.replay){ panel.innerHTML='<p>Historique indisponible pour cette ancienne partie.</p>'; return; }
    abaloneArchiveReplay={game,ply:0};
    panel.innerHTML=`
      <div class="archive-replay-head">
        <div><h3>${escapeHtml(game.blackUsername)} — ${escapeHtml(game.whiteUsername)}</h3>
          <p>${escapeHtml(game.result)} · ${escapeHtml(chessArchiveTimeLabel(game))} · ${escapeHtml(ELO_CATEGORY_LABELS[game.category]||game.category||'')}</p>
          <small>Noir : ${escapeHtml(game.blackUsername)} · Blanc : ${escapeHtml(game.whiteUsername)}</small>
        </div>
        <button class="btn small outline" id="closeAbaloneArchive">Fermer</button>
      </div>
      <div class="archive-abalone-board"></div>
      <div class="archive-replay-controls">
        <button class="btn small outline" data-abalone-step="start">⏮ Début</button>
        <button class="btn small outline" data-abalone-step="prev">◀ Précédent</button>
        <strong data-abalone-archive-ply></strong>
        <button class="btn small outline" data-abalone-step="next">Suivant ▶</button>
        <button class="btn small outline" data-abalone-step="end">Fin ⏭</button>
      </div>`;
    panel.querySelector('#closeAbaloneArchive')?.addEventListener('click',closeAbaloneArchiveReplay);
    panel.querySelectorAll('[data-abalone-step]').forEach(btn=>btn.addEventListener('click',()=>{
      const max=Math.max(0,abaloneArchiveSnapshots(abaloneArchiveReplay.game.replay).length-1);
      if(btn.dataset.abaloneStep==='start') abaloneArchiveReplay.ply=0;
      if(btn.dataset.abaloneStep==='prev') abaloneArchiveReplay.ply--;
      if(btn.dataset.abaloneStep==='next') abaloneArchiveReplay.ply++;
      if(btn.dataset.abaloneStep==='end') abaloneArchiveReplay.ply=max;
      renderAbaloneArchiveReplay();
    }));
    renderAbaloneArchiveReplay();
    panel.scrollIntoView({block:'start',behavior:'smooth'});
  }catch(e){ panel.innerHTML=`<p>${escapeHtml(e.message)}</p>`; }
}

async function loadAbaloneRatingsPanel(){
  const mine=document.getElementById('myAbaloneRatings');
  const board=document.getElementById('abaloneEloLeaderboard');
  const category=document.getElementById('abaloneEloCategory');
  if(!mine||!board||!category||!window.LudoOnline?.abaloneRatings) return;
  try{
    const ratings=await LudoOnline.abaloneRatings.mine();
    mine.innerHTML=['bullet','blitz','rapid','classical'].map(c=>{
      const r=ratings[c]||{rating:1200,games:0};
      return `<div class="elo-chip"><span>${ELO_CATEGORY_LABELS[c]}</span><strong>${r.rating}</strong><small>${r.games} partie${r.games>1?'s':''}</small></div>`;
    }).join('');
  }catch(e){ mine.innerHTML=`<p>${escapeHtml(e.message)}</p>`; }

  const load=async()=>{
    try{
      const data=await LudoOnline.abaloneRatings.leaderboard(category.value,30),players=data.players||[];
      board.innerHTML=players.length?`<div class="elo-table"><div class="elo-row elo-head"><span>#</span><span>Joueur</span><span>Elo</span><span>Parties</span></div>${players.map((p,i)=>`<div class="elo-row"><span>${i+1}</span><strong>${escapeHtml(p.username)}</strong><span>${p.rating}</span><span>${p.games}</span></div>`).join('')}</div>`:'<p>Aucune partie classée pour le moment.</p>';
    }catch(e){ board.innerHTML=`<p>${escapeHtml(e.message)}</p>`; }
  };
  category.addEventListener('change',load);
  await load();
}

async function loadAbaloneGamesPanel(){
  const list=document.getElementById('abaloneGameArchiveList');
  if(!list||!window.LudoOnline?.abaloneGames) return;
  try{
    const games=await LudoOnline.abaloneGames.list();
    if(!games.length){ list.innerHTML='<p>Aucune partie d’Abalone en ligne terminée pour le moment.</p>'; return; }
    list.innerHTML=games.map(g=>`<article class="archive-game-row"><div><strong>${escapeHtml(g.blackUsername)} <span class="archive-result">${escapeHtml(g.result)}</span> ${escapeHtml(g.whiteUsername)}</strong><small>${escapeHtml(chessArchiveDate(g.createdAt))} · ${escapeHtml(chessArchiveTimeLabel(g))} · ${escapeHtml(ELO_CATEGORY_LABELS[g.category]||g.category||'')} · ${g.rated?'Classée':'Amicale'}</small></div><button class="btn small ${g.replayAvailable?'':'outline'}" data-abalone-replay-id="${g.id}" ${g.replayAvailable?'':'disabled'}>${g.replayAvailable?'Rejouer':'Historique ancien'}</button></article>`).join('');
    list.querySelectorAll('[data-abalone-replay-id]:not([disabled])').forEach(btn=>btn.addEventListener('click',()=>openAbaloneArchiveReplay(btn.dataset.abaloneReplayId)));
  }catch(e){ list.innerHTML=`<p>${escapeHtml(e.message)}</p>`; }
}


let yamsArchiveReplay={game:null,index:0};
const YAMS_ACCOUNT_LABELS={ones:"As",twos:"Deux",threes:"Trois",fours:"Quatre",fives:"Cinq",sixes:"Six",threeKind:"Brelan",fourKind:"Carré",fullHouse:"Full",smallStraight:"Petite suite",largeStraight:"Grande suite",yams:"Yams",chance:"Chance"};
async function loadYamsRatingsPanel(){
  const mine=document.getElementById("myYamsRating"),board=document.getElementById("yamsEloLeaderboard"); if(!mine||!board||!window.LudoOnline)return;
  try{
    const [rating,data]=await Promise.all([LudoOnline.yamsRatings.mine(),LudoOnline.yamsRatings.leaderboard(30)]);
    mine.innerHTML=`<div><span>Yams</span><strong>${Number(rating.rating||1200)}</strong><small>${Number(rating.games||0)} partie${Number(rating.games||0)>1?"s":""}</small></div>`;
    board.innerHTML=data.players?.length?data.players.map((r,i)=>`<div class="elo-row"><span>${i+1}.</span><strong>${escapeHtml(r.username)}</strong><b>${Number(r.rating)}</b><small>${Number(r.games)} p.</small></div>`).join(""):'<p>Aucun classement Yams pour le moment.</p>';
  }catch(e){mine.innerHTML=`<p>${escapeHtml(e.message)}</p>`;board.innerHTML="";}
}
function yamsReplayState(game,index){
  const events=game?.replay?.history||[]; const scores=[{},{}]; let dice=[0,0,0,0,0],side=0,roll=0;
  for(let i=0;i<=index&&i<events.length;i++){
    const ev=events[i]; if(ev.type==="roll"){dice=ev.dice||dice;side=Number(ev.side||0);roll=Number(ev.roll||0);} if(ev.type==="score"){scores[Number(ev.side||0)][ev.category]=ev.score;dice=ev.dice||dice;side=Number(ev.side||0);roll=3;}
  }
  return {events,scores,dice,side,roll};
}
function renderYamsArchiveReplay(){
  const panel=document.getElementById("yamsArchiveReplay"),game=yamsArchiveReplay.game;if(!panel||!game)return;
  const st=yamsReplayState(game,yamsArchiveReplay.index),ev=st.events[yamsArchiveReplay.index];
  const dice=st.dice.map(v=>`<span class="archive-yams-die">${["—","⚀","⚁","⚂","⚃","⚄","⚅"][Number(v)||0]}</span>`).join("");
  const scores=Object.entries(YAMS_ACCOUNT_LABELS).map(([k,l])=>`<tr><th>${l}</th><td>${st.scores[0][k]??"—"}</td><td>${st.scores[1][k]??"—"}</td></tr>`).join("");
  panel.querySelector(".yams-replay-body").innerHTML=`<div class="archive-yams-dice">${dice}</div><p>${ev?ev.type==="score"?`${game[Number(ev.side)===0?"player0Username":"player1Username"]} inscrit ${ev.score} en ${YAMS_ACCOUNT_LABELS[ev.category]||ev.category}.`:`Lancer ${ev.roll} de ${game[Number(ev.side)===0?"player0Username":"player1Username"]}.`:"Début de la partie"}</p><div class="yams-score-scroll"><table class="yams-score-sheet"><thead><tr><th>Catégorie</th><th>${escapeHtml(game.player0Username)}</th><th>${escapeHtml(game.player1Username)}</th></tr></thead><tbody>${scores}</tbody></table></div>`;
  const label=panel.querySelector(".yams-replay-counter");if(label)label.textContent=st.events.length?`${yamsArchiveReplay.index+1} / ${st.events.length}`:"0 / 0";
}
async function openYamsArchiveReplay(id){
  const panel=document.getElementById("yamsArchiveReplay"); if(!panel)return;
  try{const game=await LudoOnline.yamsGames.get(id);yamsArchiveReplay={game,index:0};panel.hidden=false;panel.innerHTML=`<div class="archive-replay-head"><div><h3>${escapeHtml(game.player0Username)} — ${escapeHtml(game.player1Username)}</h3><p>${game.player0Score} à ${game.player1Score} · ${game.rated?"Classée":"Amicale"}</p></div><button class="btn small outline" id="closeYamsArchive">Fermer</button></div><div class="yams-replay-body"></div><div class="archive-replay-controls"><button class="btn small outline" data-yams-step="start">⏮ Début</button><button class="btn small outline" data-yams-step="prev">◀ Précédent</button><strong class="yams-replay-counter"></strong><button class="btn small outline" data-yams-step="next">Suivant ▶</button><button class="btn small outline" data-yams-step="end">Fin ⏭</button></div>`;
    panel.querySelector("#closeYamsArchive")?.addEventListener("click",()=>panel.hidden=true);
    panel.querySelectorAll("[data-yams-step]").forEach(b=>b.addEventListener("click",()=>{const len=game.replay?.history?.length||0;if(!len)return;const a=b.dataset.yamsStep;if(a==="start")yamsArchiveReplay.index=0;else if(a==="prev")yamsArchiveReplay.index=Math.max(0,yamsArchiveReplay.index-1);else if(a==="next")yamsArchiveReplay.index=Math.min(len-1,yamsArchiveReplay.index+1);else yamsArchiveReplay.index=len-1;renderYamsArchiveReplay();}));renderYamsArchiveReplay();panel.scrollIntoView({behavior:"smooth",block:"start"});
  }catch(e){panel.hidden=false;panel.innerHTML=`<p>${escapeHtml(e.message)}</p>`;}
}
async function loadYamsGamesPanel(){
  const list=document.getElementById("yamsGameArchiveList");if(!list||!window.LudoOnline)return;
  try{const games=await LudoOnline.yamsGames.list();if(!games.length){list.innerHTML="<p>Aucune partie de Yams en ligne terminée pour le moment.</p>";return;}list.innerHTML=games.map(g=>`<article class="archive-game-row"><div><strong>${escapeHtml(g.player0Username)} <span class="archive-result">${escapeHtml(g.result)}</span> ${escapeHtml(g.player1Username)}</strong><small>${escapeHtml(chessArchiveDate(g.createdAt))} · ${g.player0Score}–${g.player1Score} · ${g.rated?"Classée":"Amicale"}</small></div><button class="btn small ${g.replayAvailable?"":"outline"}" data-yams-replay-id="${g.id}" ${g.replayAvailable?"":"disabled"}>${g.replayAvailable?"Rejouer":"Historique ancien"}</button></article>`).join("");list.querySelectorAll("[data-yams-replay-id]:not([disabled])").forEach(b=>b.addEventListener("click",()=>openYamsArchiveReplay(b.dataset.yamsReplayId)));}catch(e){list.innerHTML=`<p>${escapeHtml(e.message)}</p>`;}
}


let game421ArchiveReplay={game:null,index:0};
async function load421RatingsPanel(){
  const mine=document.getElementById("my421Rating"),board=document.getElementById("game421EloLeaderboard");if(!mine||!board||!window.LudoOnline)return;
  try{const [rating,data]=await Promise.all([LudoOnline.game421Ratings.mine(),LudoOnline.game421Ratings.leaderboard(30)]);mine.innerHTML=`<div><span>421</span><strong>${Number(rating.rating||1200)}</strong><small>${Number(rating.games||0)} partie${Number(rating.games||0)>1?"s":""}</small></div>`;board.innerHTML=data.players?.length?data.players.map((r,i)=>`<div class="elo-row"><span>${i+1}.</span><strong>${escapeHtml(r.username)}</strong><b>${Number(r.rating)}</b><small>${Number(r.games)} p.</small></div>`).join(""):'<p>Aucun classement 421 pour le moment.</p>';}catch(e){mine.innerHTML=`<p>${escapeHtml(e.message)}</p>`;board.innerHTML="";}
}
function render421ArchiveReplay(){
  const panel=document.getElementById("game421ArchiveReplay"),game=game421ArchiveReplay.game;if(!panel||!game)return;const events=game.replay?.history||[],ev=events[game421ArchiveReplay.index];
  const dice=(ev?.dice||ev?.results?.[ev?.winner]?.dice||[0,0,0]).map(v=>`<span class="archive-yams-die">${["—","⚀","⚁","⚂","⚃","⚄","⚅"][Number(v)||0]}</span>`).join("");
  const txt=!ev?"Début de la partie":ev.type==="roll"?`Lancer ${ev.roll} du joueur ${Number(ev.side)+1}.`:ev.type==="stop"?`Le joueur ${Number(ev.side)+1} valide ${escapeHtml(ev.combo?.name||"")}.`:ev.tie?`Manche ${ev.round} : égalité.`:`Manche ${ev.round} : ${ev.transfer} jeton${ev.transfer>1?"s":""} transféré${ev.transfer>1?"s":""}.`;
  panel.querySelector(".game421-replay-body").innerHTML=`<div class="archive-yams-dice">${dice}</div><p>${txt}</p>${ev?.tokens?`<p><strong>Jetons :</strong> ${ev.tokens[0]} – ${ev.tokens[1]} · Pot : ${ev.pot}</p>`:""}`;const c=panel.querySelector(".game421-replay-counter");if(c)c.textContent=events.length?`${game421ArchiveReplay.index+1} / ${events.length}`:"0 / 0";
}
async function open421ArchiveReplay(id){
  const panel=document.getElementById("game421ArchiveReplay");if(!panel)return;try{const game=await LudoOnline.game421Games.get(id);game421ArchiveReplay={game,index:0};panel.hidden=false;panel.innerHTML=`<div class="archive-replay-head"><div><h3>${escapeHtml(game.player0Username)} — ${escapeHtml(game.player1Username)}</h3><p>${game.rated?"Classée":"Amicale"}</p></div><button class="btn small outline" id="close421Archive">Fermer</button></div><div class="game421-replay-body"></div><div class="archive-replay-controls"><button class="btn small outline" data-421-step="start">⏮ Début</button><button class="btn small outline" data-421-step="prev">◀ Précédent</button><strong class="game421-replay-counter"></strong><button class="btn small outline" data-421-step="next">Suivant ▶</button><button class="btn small outline" data-421-step="end">Fin ⏭</button></div>`;panel.querySelector("#close421Archive")?.addEventListener("click",()=>panel.hidden=true);panel.querySelectorAll("[data-421-step]").forEach(b=>b.addEventListener("click",()=>{const len=game.replay?.history?.length||0;if(!len)return;const a=b.getAttribute("data-421-step");if(a==="start")game421ArchiveReplay.index=0;else if(a==="prev")game421ArchiveReplay.index=Math.max(0,game421ArchiveReplay.index-1);else if(a==="next")game421ArchiveReplay.index=Math.min(len-1,game421ArchiveReplay.index+1);else game421ArchiveReplay.index=len-1;render421ArchiveReplay();}));render421ArchiveReplay();}catch(e){panel.hidden=false;panel.innerHTML=`<p>${escapeHtml(e.message)}</p>`;}
}
async function load421GamesPanel(){
  const list=document.getElementById("game421ArchiveList");if(!list||!window.LudoOnline)return;try{const games=await LudoOnline.game421Games.list();if(!games.length){list.innerHTML="<p>Aucune partie de 421 en ligne terminée pour le moment.</p>";return;}list.innerHTML=games.map(g=>`<article class="archive-game-row"><div><strong>${escapeHtml(g.player0Username)} <span class="archive-result">${escapeHtml(g.result)}</span> ${escapeHtml(g.player1Username)}</strong><small>${escapeHtml(chessArchiveDate(g.createdAt))} · Jetons finaux ${g.player0Tokens}–${g.player1Tokens} · ${g.rated?"Classée":"Amicale"}</small></div><button class="btn small ${g.replayAvailable?"":"outline"}" data-421-replay-id="${g.id}" ${g.replayAvailable?"":"disabled"}>${g.replayAvailable?"Rejouer":"Historique ancien"}</button></article>`).join("");list.querySelectorAll("[data-421-replay-id]:not([disabled])").forEach(b=>b.addEventListener("click",()=>open421ArchiveReplay(b.getAttribute("data-421-replay-id"))));}catch(e){list.innerHTML=`<p>${escapeHtml(e.message)}</p>`;}
}


const ACCOUNT_HISTORY_STORAGE_KEY = "strathasard.account.lastHistoryGame";
const LEGACY_ACCOUNT_HISTORY_STORAGE_KEY = "jeux" + "partage.account.lastHistoryGame";
const ACCOUNT_HISTORY_GAMES = [
  {
    id: "echecs",
    label: "Échecs",
    description: "Retrouvez vos parties multijoueurs terminées et rejouez-les coup par coup.",
    listId: "chessGameArchiveList",
    replayId: "chessArchiveReplay",
    replayClass: "chess-archive-replay",
    note: "Les parties d’Échecs jouées avant la V6.6 peuvent apparaître sans relecture complète."
  },
  {
    id: "dames",
    label: "Dames",
    description: "Les parties internationales 10×10 et anglaises 8×8 sont réunies dans cet historique.",
    listId: "checkersGameArchiveList",
    replayId: "checkersArchiveReplay",
    replayClass: "chess-archive-replay"
  },
  {
    id: "go",
    label: "Go",
    description: "Retrouvez vos parties terminées, quelle que soit la taille du goban.",
    listId: "goGameArchiveList",
    replayId: "goArchiveReplay",
    replayClass: "chess-archive-replay go-archive-replay"
  },
  {
    id: "awale",
    label: "Awélé",
    description: "Retrouvez vos parties terminées et rejouez les semailles coup par coup.",
    listId: "awaleGameArchiveList",
    replayId: "awaleArchiveReplay",
    replayClass: "chess-archive-replay awale-archive-replay"
  },
  {
    id: "abalone",
    label: "Abalone",
    description: "Retrouvez vos parties terminées et rejouez les déplacements coup par coup.",
    listId: "abaloneGameArchiveList",
    replayId: "abaloneArchiveReplay",
    replayClass: "chess-archive-replay abalone-archive-replay"
  },
  {
    id: "yams",
    label: "Yams",
    description: "Retrouvez vos parties terminées et revoyez les lancers et les choix de score.",
    listId: "yamsGameArchiveList",
    replayId: "yamsArchiveReplay",
    replayClass: "chess-archive-replay yams-archive-replay"
  },
  {
    id: "421",
    label: "421",
    description: "Retrouvez vos parties terminées et revoyez les lancers et transferts de jetons.",
    listId: "game421ArchiveList",
    replayId: "game421ArchiveReplay",
    replayClass: "chess-archive-replay"
  }
];

const ACCOUNT_HISTORY_LOADERS = {
  echecs: loadChessGamesPanel,
  dames: loadCheckersGamesPanel,
  go: loadGoGamesPanel,
  awale: loadAwaleGamesPanel,
  abalone: loadAbaloneGamesPanel,
  yams: loadYamsGamesPanel,
  "421": load421GamesPanel
};

function readLastAccountHistoryGame() {
  try {
    const saved = localStorage.getItem(ACCOUNT_HISTORY_STORAGE_KEY) || localStorage.getItem(LEGACY_ACCOUNT_HISTORY_STORAGE_KEY);
    if (ACCOUNT_HISTORY_GAMES.some(game => game.id === saved)) {
      localStorage.setItem(ACCOUNT_HISTORY_STORAGE_KEY, saved);
      localStorage.removeItem(LEGACY_ACCOUNT_HISTORY_STORAGE_KEY);
      return saved;
    }
    return ACCOUNT_HISTORY_GAMES[0].id;
  } catch {
    return ACCOUNT_HISTORY_GAMES[0].id;
  }
}

function rememberAccountHistoryGame(gameId) {
  try {
    localStorage.setItem(ACCOUNT_HISTORY_STORAGE_KEY, gameId);
  } catch {
    // Le filtre fonctionne quand même si le stockage local est indisponible.
  }
}

function loadAccountHistoryGame(gameId, remember = true) {
  const container = document.getElementById("accountHistoryContent");
  const select = document.getElementById("accountHistoryGame");
  const config = ACCOUNT_HISTORY_GAMES.find(game => game.id === gameId) || ACCOUNT_HISTORY_GAMES[0];
  if (!container) return;

  if (select) select.value = config.id;
  if (remember) rememberAccountHistoryGame(config.id);

  container.innerHTML = `
    <div class="account-history-selected">
      <h3>${config.label}</h3>
      <p>${config.description}</p>
    </div>
    <div id="${config.listId}" class="chess-game-archive"><p>Chargement des parties…</p></div>
    <div id="${config.replayId}" class="${config.replayClass}" hidden></div>
    ${config.note ? `<div class="note account-history-note">${config.note}</div>` : ""}
  `;

  const loader = ACCOUNT_HISTORY_LOADERS[config.id];
  if (typeof loader === "function") loader();
}

function initAccountGameHistory() {
  const select = document.getElementById("accountHistoryGame");
  if (!select) return;

  const saved = readLastAccountHistoryGame();
  select.value = saved;
  select.addEventListener("change", () => loadAccountHistoryGame(select.value, true));
  loadAccountHistoryGame(saved, false);
}

function renderAccountContent(user, newRecoveryKey = null, accountNotice = null) {
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
        <div class="note"><strong>En ligne :</strong> sauvegardes, salons multijoueurs privés et récupération du compte.</div>
      </section>

      ${accountNotice ? `<section class="panel account-card account-notice"><strong>${escapeHtml(accountNotice)}</strong></section>` : ""}

      <section class="panel account-card email-account-card">
        <h2>Adresse e-mail du compte</h2>
        <p>${user.email ? `Adresse actuelle : <strong>${escapeHtml(user.email)}</strong>` : "Aucune adresse e-mail n’est encore associée à cet ancien compte."}</p>
        <p class="email-verification-state ${user.emailVerified ? "verified" : "pending"}">${user.emailVerified ? "✓ Adresse vérifiée — la récupération du mot de passe par e-mail est active." : "Adresse non vérifiée — vérifiez-la pour pouvoir récupérer votre mot de passe par e-mail."}</p>
        <form id="accountEmailForm">
          <label><span>${user.email ? "Modifier l’adresse e-mail" : "Ajouter une adresse e-mail"}</span><input name="email" type="email" required autocomplete="email" value="${escapeHtml(user.email||"")}" placeholder="vous@exemple.fr"></label>
          <label><span>Mot de passe actuel</span><input name="password" type="password" required minlength="10" autocomplete="current-password"></label>
          <button class="btn small" type="submit">${user.email ? "Enregistrer et vérifier" : "Ajouter et vérifier"}</button>
          ${user.email && !user.emailVerified ? `<button id="resendEmailVerification" class="btn outline small" type="button">Renvoyer l’e-mail de vérification</button>` : ""}
          <p id="accountEmailStatus" class="form-status"></p>
        </form>
        <div class="privacy-note"><strong>Confidentialité :</strong> votre pseudo et votre adresse e-mail sont utilisés uniquement pour l’accès et la sécurité de votre compte Strathasard (connexion, vérification et récupération du mot de passe). Ils ne sont jamais utilisés pour la publicité, ni vendus ou loués. L’adresse e-mail est transmise uniquement au prestataire technique Resend pour l’envoi de ces messages.</div>
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

            <section class="panel account-card chess-archive-card account-history-card">
        <div class="account-history-toolbar">
          <div>
            <h2>Mes parties</h2>
            <p>Choisissez un jeu pour n’afficher que les parties correspondantes.</p>
          </div>
          <label class="account-history-filter">
            <span>Jeu</span>
            <select id="accountHistoryGame">
              ${ACCOUNT_HISTORY_GAMES.map(game => `<option value="${game.id}">${game.label}</option>`).join("")}
            </select>
          </label>
        </div>
        <div id="accountHistoryContent"><p>Chargement…</p></div>
        <div class="note"><strong>Pratique :</strong> le dernier jeu choisi est mémorisé automatiquement sur cet appareil.</div>
      </section>

      <section class="panel account-card chess-ratings-card">
        <h2>Classement Elo — Dames</h2>
        <div class="elo-leaderboard-head">
          <label><span>Variante</span><select id="checkersEloVariant"><option value="international" selected>Internationales 10×10</option><option value="english">Anglaises 8×8</option></select></label>
          <label><span>Cadence du classement</span><select id="checkersEloCategory"><option value="bullet">Bullet</option><option value="blitz">Blitz</option><option value="rapid" selected>Rapide</option><option value="classical">Classique</option></select></label>
        </div>
        <div id="myCheckersRatings" class="elo-grid"><p>Chargement des classements…</p></div>
        <h3>Classement des joueurs</h3>
        <div id="checkersEloLeaderboard" class="elo-leaderboard"><p>Chargement…</p></div>
        <div class="note">Chaque variante et chaque cadence possèdent leur propre Elo. Une nouvelle catégorie commence à <strong>1200</strong>.</div>
      </section>

      

      <section class="panel account-card chess-ratings-card">
        <h2>Classement Elo — Go</h2>
        <div class="elo-leaderboard-head"><label><span>Goban</span><select id="goEloSize"><option value="9">9×9</option><option value="13">13×13</option><option value="19" selected>19×19</option></select></label><label><span>Cadence</span><select id="goEloCategory"><option value="bullet">Bullet</option><option value="blitz">Blitz</option><option value="rapid" selected>Rapide</option><option value="classical">Classique</option></select></label></div>
        <div id="myGoRatings" class="elo-grid"><p>Chargement des classements…</p></div><h3>Classement des joueurs</h3><div id="goEloLeaderboard" class="elo-leaderboard"><p>Chargement…</p></div>
        <div class="note">Chaque taille de goban et chaque cadence possèdent leur propre Elo.</div>
      </section>
      
      <section class="panel account-card chess-ratings-card">
        <h2>Classement Elo — Awélé</h2>
        <div class="elo-leaderboard-head"><h3>Classement des joueurs</h3><label><span>Cadence</span><select id="awaleEloCategory"><option value="bullet">Bullet</option><option value="blitz">Blitz</option><option value="rapid" selected>Rapide</option><option value="classical">Classique</option></select></label></div>
        <div id="myAwaleRatings" class="elo-grid"><p>Chargement des classements…</p></div><div id="awaleEloLeaderboard" class="elo-leaderboard"><p>Chargement…</p></div>
        <div class="note">Chaque cadence possède son propre Elo, avec 1200 comme valeur de départ.</div>
      </section>
      

      <section class="panel account-card chess-ratings-card">
        <h2>Classement Elo — Abalone</h2>
        <div class="elo-leaderboard-head"><h3>Classement des joueurs</h3><label><span>Cadence</span><select id="abaloneEloCategory"><option value="bullet">Bullet</option><option value="blitz">Blitz</option><option value="rapid" selected>Rapide</option><option value="classical">Classique</option></select></label></div>
        <div id="myAbaloneRatings" class="elo-grid"><p>Chargement des classements…</p></div><div id="abaloneEloLeaderboard" class="elo-leaderboard"><p>Chargement…</p></div>
        <div class="note">Chaque cadence possède son propre Elo, avec 1200 comme valeur de départ.</div>
      </section>
      

      <section class="panel account-card chess-ratings-card">
        <h2>Classement Elo — Yams</h2>
        <div id="myYamsRating" class="elo-grid"><p>Chargement du classement…</p></div><h3>Classement des joueurs</h3><div id="yamsEloLeaderboard" class="elo-leaderboard"><p>Chargement…</p></div>
        <div class="note">Le Yams possède un Elo unique. Les parties amicales ne modifient pas le classement.</div>
      </section>
      
      <section class="panel account-card chess-ratings-card"><h2>Classement Elo — 421</h2><div id="my421Rating" class="elo-grid"><p>Chargement du classement…</p></div><h3>Classement des joueurs</h3><div id="game421EloLeaderboard" class="elo-leaderboard"><p>Chargement…</p></div><div class="note">Le 421 possède un Elo unique. Les parties amicales ne modifient pas le classement.</div></section>
      

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
        <h2>Clé de récupération de secours</h2>
        <p>La récupération par e-mail est maintenant la méthode principale. Vous pouvez conserver une clé personnelle comme solution de secours indépendante de l’e-mail.</p>
        <button id="generateRecoveryKey" class="btn outline" type="button">Générer une nouvelle clé</button>
        <p id="recoveryKeyStatus" class="form-status"></p>
        <div class="note"><strong>Attention :</strong> générer une nouvelle clé invalide immédiatement la précédente.</div>
      </section>`}

      <section class="panel account-card delete-account-card">
        <h2>Supprimer mon compte</h2>
        <p>La suppression efface votre e-mail, vos sessions, vos sauvegardes et vos classements. Les anciennes parties restent dans l’historique des adversaires sous un nom anonymisé afin de ne pas supprimer leur propre historique.</p>
        <button id="showDeleteAccount" class="btn danger" type="button">Supprimer mon compte</button>
        <form id="deleteAccountForm" hidden>
          <label><span>Votre mot de passe</span><input name="password" type="password" required minlength="10" autocomplete="current-password"></label>
          <label><span>Pour confirmer, écrivez SUPPRIMER</span><input name="confirmation" required autocomplete="off" placeholder="SUPPRIMER"></label>
          <div class="account-actions"><button class="btn danger" type="submit">Confirmer la suppression définitive</button><button id="cancelDeleteAccount" class="btn outline" type="button">Annuler</button></div>
          <p id="deleteAccountStatus" class="form-status"></p>
        </form>
      </section>
    `;

    document.getElementById("logoutAccount")?.addEventListener("click", async () => {
      await LudoOnline.logout();
      renderAccountContent(null);
    });

    document.getElementById("changePasswordForm")?.addEventListener("submit", async e => {
      e.preventDefault();
      const form=e.currentTarget;
      const fd=new FormData(form),st=document.getElementById("changePasswordStatus");
      const next=String(fd.get("newPassword")||""),confirm=String(fd.get("confirmPassword")||"");
      if(next!==confirm){ st.textContent="Les deux nouveaux mots de passe ne sont pas identiques."; return; }
      st.textContent="Modification…";
      try {
        const data=await LudoOnline.changePassword(fd.get("currentPassword"),next);
        st.textContent=data.message||"Mot de passe modifié.";
        form.reset();
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

    document.getElementById("accountEmailForm")?.addEventListener("submit", async e => {
      e.preventDefault();
      const fd=new FormData(e.currentTarget),st=document.getElementById("accountEmailStatus");
      st.textContent="Enregistrement…";
      try {
        const data=await LudoOnline.setEmail(fd.get("email"),fd.get("password"));
        const refreshed=await LudoOnline.me(true);
        renderAccountContent(refreshed,null,data.message);
      } catch(err){ st.textContent=err.message; }
    });

    document.getElementById("resendEmailVerification")?.addEventListener("click", async e => {
      const button=e.currentTarget;
      const st=document.getElementById("accountEmailStatus"); button.disabled=true; st.textContent="Envoi…";
      try{ const data=await LudoOnline.resendVerification(); st.textContent=data.message; }
      catch(err){ st.textContent=err.message; }
      finally{ button.disabled=false; }
    });

    document.getElementById("showDeleteAccount")?.addEventListener("click", e => {
      e.currentTarget.hidden=true; const form=document.getElementById("deleteAccountForm"); if(form) form.hidden=false;
    });
    document.getElementById("cancelDeleteAccount")?.addEventListener("click", () => {
      const form=document.getElementById("deleteAccountForm"),button=document.getElementById("showDeleteAccount"); if(form){form.hidden=true;form.reset();} if(button) button.hidden=false;
    });
    document.getElementById("deleteAccountForm")?.addEventListener("submit", async e => {
      e.preventDefault(); const fd=new FormData(e.currentTarget),st=document.getElementById("deleteAccountStatus");
      if(String(fd.get("confirmation")||"").trim().toUpperCase()!=="SUPPRIMER"){st.textContent="Écrivez exactement SUPPRIMER pour confirmer.";return;}
      st.textContent="Suppression…";
      try{
        const data=await LudoOnline.deleteAccount(fd.get("password"),fd.get("confirmation"));
        root.innerHTML=`<section class="panel account-card"><h2>Compte supprimé</h2><p>${escapeHtml(data.message)}</p><a class="btn" href="#/accueil">Retour à l’accueil</a></section>`;
      }catch(err){st.textContent=err.message;}
    });

    attachRecoveryCopy();
    loadChessRatingsPanel();
    loadCheckersRatingsPanel();
    loadGoRatingsPanel();
    loadAwaleRatingsPanel();
    loadAbaloneRatingsPanel();
    loadYamsRatingsPanel();
    load421RatingsPanel();
    initAccountGameHistory();
    return;
  }

  root.innerHTML = `
    <form id="loginForm" class="panel account-card">
      <h2>Se connecter</h2>
      <label><span>Pseudo ou adresse e-mail</span><input name="username" required autocomplete="username"></label>
      <label><span>Mot de passe</span><input name="password" type="password" required minlength="10" autocomplete="current-password"></label>
      <div id="loginTurnstileWrap" class="turnstile-challenge" hidden>
        <small>Après plusieurs essais infructueux, confirmez que vous êtes bien une personne.</small>
        <div id="loginTurnstile" class="turnstile-box"></div>
      </div>
      <button class="btn" type="submit">Connexion</button>
      <a href="#/recuperation">Mot de passe oublié ?</a>
      <p id="loginStatus" class="form-status"></p>
    </form>
    <form id="registerForm" class="panel account-card">
      <h2>Créer un compte</h2>
      <label><span>Pseudo</span><input name="username" required minlength="3" maxlength="24" autocomplete="username"></label>
      <label><span>Adresse e-mail</span><input name="email" type="email" required autocomplete="email" placeholder="vous@exemple.fr"></label>
      <label><span>Mot de passe</span><input name="password" type="password" required minlength="10" autocomplete="new-password"></label>
      <small>10 caractères minimum. Un e-mail de vérification vous sera envoyé après la création du compte.</small>
      <div class="privacy-note"><strong>Vos coordonnées restent privées.</strong> Le pseudo et l’adresse e-mail servent uniquement à accéder à Strathasard et à sécuriser/récupérer votre compte. Ils ne sont jamais utilisés pour la publicité, ni vendus ou loués. L’adresse est transmise uniquement à Resend pour l’envoi des e-mails techniques du compte.</div>
      <div id="registerTurnstile" class="turnstile-box"></div>
      <button class="btn" type="submit">Créer mon compte</button>
      <p id="registerStatus" class="form-status"></p>
    </form>`;

  const registerTurnstilePromise=LudoOnline.security.render("#registerTurnstile","register",{appearance:"always"}).catch(err=>{
    const st=document.getElementById("registerStatus"); if(st) st.textContent=err.message; return null;
  });
  let loginTurnstilePromise=null;
  const ensureLoginTurnstile=()=>{
    const wrap=document.getElementById("loginTurnstileWrap"); if(wrap) wrap.hidden=false;
    if(!loginTurnstilePromise) loginTurnstilePromise=LudoOnline.security.render("#loginTurnstile","login",{appearance:"always"}).catch(err=>{
      const st=document.getElementById("loginStatus"); if(st) st.textContent=err.message; return null;
    });
    return loginTurnstilePromise;
  };

  document.getElementById("loginForm")?.addEventListener("submit", async e => {
    e.preventDefault();
    const form=e.currentTarget,fd=new FormData(form),st=document.getElementById("loginStatus"); st.textContent="Connexion…";
    const widget=loginTurnstilePromise?await loginTurnstilePromise:null;
    const token=widget?.getToken?.()||"";
    if(loginTurnstilePromise && !token){ st.textContent="Effectuez d’abord la vérification anti-robot."; return; }
    try {
      const u=await LudoOnline.login(fd.get("username"),fd.get("password"),token);
      renderAccountContent(u);
    } catch(err){
      st.textContent=err.message;
      if(err.turnstileRequired) await ensureLoginTurnstile();
      widget?.reset?.();
    }
  });

  document.getElementById("registerForm")?.addEventListener("submit", async e => {
    e.preventDefault();
    const fd=new FormData(e.currentTarget),st=document.getElementById("registerStatus"); st.textContent="Création…";
    const widget=await registerTurnstilePromise;
    const token=widget?.getToken?.()||"";
    if(!widget || !token){ st.textContent="Effectuez d’abord la vérification anti-robot."; return; }
    try {
      const data=await LudoOnline.register(fd.get("username"),fd.get("email"),fd.get("password"),token);
      renderAccountContent(data.user,data.recoveryKey,data.emailWarning || "Compte créé. Vérifiez maintenant votre adresse e-mail.");
    } catch(err){ st.textContent=err.message; widget.reset?.(); }
  });
}

function renderRecovery() {
  app.innerHTML = `
    <div class="page account-page">
      <div class="breadcrumb"><a href="#/accueil">Accueil</a><span>›</span><a href="#/compte">Compte</a><span>›</span><span>Récupération</span></div>
      <div class="section-head"><div><div class="eyebrow">Récupération du compte</div><h1>Mot de passe oublié</h1><p class="section-lead">La méthode principale utilise maintenant l’adresse e-mail vérifiée du compte.</p></div></div>
      <div id="recoveryContent" class="account-grid">
        <form id="emailRecoveryForm" class="panel account-card">
          <h2>Recevoir un lien par e-mail</h2>
          <label><span>Adresse e-mail du compte</span><input name="email" type="email" required autocomplete="email" placeholder="vous@exemple.fr"></label>
          <div id="emailRecoveryTurnstile" class="turnstile-box"></div>
          <button class="btn" type="submit">Envoyer le lien de réinitialisation</button>
          <p id="emailRecoveryStatus" class="form-status"></p>
          <div class="note">Pour protéger les comptes, le site affiche la même confirmation qu’une adresse soit enregistrée ou non. Le lien, lorsqu’il est envoyé, reste valable 30 minutes.</div>
        </form>
        <form id="recoveryForm" class="panel account-card">
          <h2>Solution de secours : clé de récupération</h2>
          <p>Les anciens comptes qui n’ont pas encore enregistré d’adresse e-mail peuvent toujours utiliser leur clé personnelle.</p>
          <label><span>Pseudo</span><input name="username" required minlength="3" maxlength="24" autocomplete="username"></label>
          <label><span>Clé de récupération</span><input name="recoveryKey" required autocomplete="off" placeholder="XXXXX-XXXXX-XXXXX-XXXXX"></label>
          <label><span>Nouveau mot de passe</span><input name="newPassword" type="password" required minlength="10" autocomplete="new-password"></label>
          <label><span>Confirmer le nouveau mot de passe</span><input name="confirmPassword" type="password" required minlength="10" autocomplete="new-password"></label>
          <button class="btn outline" type="submit">Réinitialiser avec la clé</button>
          <p id="recoveryStatus" class="form-status"></p>
        </form>
      </div>
    </div>`;

  const emailRecoveryTurnstilePromise=LudoOnline.security.render("#emailRecoveryTurnstile","forgot_password",{appearance:"always"}).catch(err=>{
    const st=document.getElementById("emailRecoveryStatus"); if(st) st.textContent=err.message; return null;
  });

  document.getElementById("emailRecoveryForm")?.addEventListener("submit", async e => {
    e.preventDefault();
    const form=e.currentTarget;
    const fd=new FormData(form),st=document.getElementById("emailRecoveryStatus"); st.textContent="Envoi…";
    const widget=await emailRecoveryTurnstilePromise;
    const token=widget?.getToken?.()||"";
    if(!widget || !token){ st.textContent="Effectuez d’abord la vérification anti-robot."; return; }
    try{ const data=await LudoOnline.requestPasswordReset(fd.get("email"),token); st.textContent=data.message; form.reset(); }
    catch(err){st.textContent=err.message;}
    finally{widget.reset?.();}
  });

  document.getElementById("recoveryForm")?.addEventListener("submit", async e => {
    e.preventDefault();
    const fd=new FormData(e.currentTarget),st=document.getElementById("recoveryStatus");
    const next=String(fd.get("newPassword")||""),confirm=String(fd.get("confirmPassword")||"");
    if(next!==confirm){ st.textContent="Les deux nouveaux mots de passe ne sont pas identiques."; return; }
    st.textContent="Réinitialisation…";
    try {
      const data=await LudoOnline.resetWithRecovery(fd.get("username"),fd.get("recoveryKey"),next);
      const root=document.getElementById("recoveryContent");
      root.innerHTML = `<section class="panel account-card"><h2>Mot de passe réinitialisé</h2><p>Vous pouvez maintenant vous reconnecter avec votre nouveau mot de passe.</p><a class="btn" href="#/compte">Se connecter</a></section>${recoveryKeyPanel(data.recoveryKey,"Nouvelle clé de récupération")}`;
      attachRecoveryCopy();
    } catch(err){ st.textContent=err.message; }
  });
}

function renderEmailPasswordReset(token) {
  app.innerHTML=`<div class="page account-page"><div class="breadcrumb"><a href="#/accueil">Accueil</a><span>›</span><span>Nouveau mot de passe</span></div><div class="section-head"><div><div class="eyebrow">Lien reçu par e-mail</div><h1>Choisir un nouveau mot de passe</h1></div></div><div class="account-grid"><form id="emailResetForm" class="panel account-card"><label><span>Nouveau mot de passe</span><input name="newPassword" type="password" required minlength="10" autocomplete="new-password"></label><label><span>Confirmer</span><input name="confirmPassword" type="password" required minlength="10" autocomplete="new-password"></label><button class="btn" type="submit">Enregistrer le nouveau mot de passe</button><p id="emailResetStatus" class="form-status"></p></form></div></div>`;
  const form=document.getElementById("emailResetForm"),st=document.getElementById("emailResetStatus");
  if(!token){st.textContent="Le lien ne contient pas de jeton de réinitialisation valide.";form.querySelector("button").disabled=true;return;}
  form.addEventListener("submit",async e=>{e.preventDefault();const fd=new FormData(form),next=String(fd.get("newPassword")||""),confirm=String(fd.get("confirmPassword")||"");if(next!==confirm){st.textContent="Les deux mots de passe ne sont pas identiques.";return;}st.textContent="Réinitialisation…";try{const data=await LudoOnline.resetPasswordWithEmail(token,next);form.innerHTML=`<h2>Mot de passe modifié</h2><p>${escapeHtml(data.message)}</p><a class="btn" href="#/compte">Se connecter</a>`;}catch(err){st.textContent=err.message;}});
}

function renderEmailVerification(token) {
  app.innerHTML=`<div class="page account-page"><div class="breadcrumb"><a href="#/accueil">Accueil</a><span>›</span><span>Vérification e-mail</span></div><div class="section-head"><div><div class="eyebrow">Sécurité du compte</div><h1>Vérification de l’adresse e-mail</h1></div></div><div class="account-grid"><section id="verifyEmailPanel" class="panel account-card"><p>Vérification en cours…</p></section></div></div>`;
  const panel=document.getElementById("verifyEmailPanel");
  if(!token){panel.innerHTML='<h2>Lien invalide</h2><p>Ce lien de vérification ne contient pas de jeton valide.</p><a class="btn" href="#/compte">Ouvrir mon compte</a>';return;}
  LudoOnline.verifyEmail(token).then(async data=>{try{await LudoOnline.me(true);}catch{}panel.innerHTML=`<h2>Adresse vérifiée</h2><p>${escapeHtml(data.message)}</p><a class="btn" href="#/compte">Ouvrir mon compte</a>`;}).catch(err=>{panel.innerHTML=`<h2>Vérification impossible</h2><p>${escapeHtml(err.message)}</p><a class="btn" href="#/compte">Ouvrir mon compte</a>`;});
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
  if (id === "yams") return renderYamsPlay();
  if (id === "421") return render421Play();

  app.innerHTML = `
    <div class="page">
      <div class="section-head"><div><div class="eyebrow">Jeux interactifs</div><h1>Choisissez un jeu</h1><p class="section-lead">Ces versions fonctionnent entièrement dans votre navigateur et peuvent être testées localement.</p></div></div>
      <div class="play-cards">
        <article class="play-card"><div class="visual">${illustration("chess", false)}</div><div><span class="tag">Jouable</span><h2>Échecs</h2><p>Deux joueurs sur le même écran ou partie contre une IA à trois niveaux. Toutes les règles essentielles sont prises en compte.</p><a class="btn" href="#/jouer/echecs">Jouer aux Échecs</a></div></article>
        <article class="play-card"><div class="visual">${illustration("checkers", false)}</div><div><span class="tag">Jouable</span><h2>Dames</h2><p>Deux moteurs distincts : dames françaises/internationales 10 × 10 et dames anglaises 8 × 8, chacune jouable à deux ou contre l’IA.</p><a class="btn" href="#/jouer/dames">Choisir une variante</a></div></article>
        <article class="play-card"><div class="visual">${illustration("go", false)}</div><div><span class="tag">Jouable</span><h2>Go</h2><p>Goban 9 × 9, 13 × 13 ou 19 × 19, captures, libertés, ko, passes, score et trois niveaux d’IA.</p><a class="btn" href="#/jouer/go">Jouer au Go</a></div></article>
        <article class="play-card"><div class="visual">${illustration("abalone", false)}</div><div><span class="tag">Nouveau</span><h2>Abalone</h2><p>Plateau hexagonal, déplacements en ligne ou latéraux, poussées Sumito, éjections et trois niveaux d’IA.</p><a class="btn" href="#/jouer/abalone">Jouer à Abalone</a></div></article>
        <article class="play-card"><div class="visual">${illustration("awale", false)}</div><div><span class="tag">Jouable</span><h2>Awélé</h2><p>Deux joueurs en local ou joueur contre IA, avec semailles, captures et règle de nourrissage.</p><a class="btn" href="#/jouer/awale">Jouer à l’Awélé</a></div></article>
        <article class="play-card"><div class="visual">${illustration("dice", false)}</div><div><span class="tag">Nouveau</span><h2>Yams</h2><p>Cinq dés, jusqu’à trois lancers, feuille de score complète, IA et salons multijoueurs avec tirages validés par le serveur.</p><a class="btn" href="#/jouer/yams">Jouer au Yams</a></div></article>
        <article class="play-card"><div class="visual">${illustration("dice", false)}</div><div><span class="tag">Nouveau</span><h2>421</h2><p>Trois dés, 21 jetons, charge et décharge, IA et salons multijoueurs avec tirages validés par le serveur.</p><a class="btn" href="#/jouer/421">Jouer au 421</a></div></article>
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
        <div><div class="eyebrow">Jeu interactif</div><h1>${cfg.title}</h1><p class="section-lead">${isInternational ? "Damier 10 × 10, 20 pions par camp et règle de la rafle maximale." : "Damier 8 × 8, 12 pions par camp et règles anglaises WCDF."} Jouez aussi à distance grâce au mode multijoueur.</p></div>
        <div class="variant-switch"><a class="btn outline small" href="#/jeu/dames">Voir les règles</a><a class="btn outline small" href="#/jouer/${isInternational ? "dames-anglaises" : "dames-internationales"}">Passer au ${isInternational ? "8 × 8" : "10 × 10"}</a></div>
      </div>

      <div class="draught-play-layout">
        <section class="game-shell draught-shell">
          <div class="chess-toolbar">
            <label><span>Mode</span><select id="draughtMode"><option value="ai">Joueur contre IA</option><option value="local">2 joueurs sur le même écran</option><option value="online" selected>Multijoueur en ligne</option></select></label>
            <div id="draughtAiSettings" class="toolbar-group" hidden>
              <label><span>Niveau IA</span><select id="draughtAiLevel"><option value="easy">Facile</option><option value="medium" selected>Intermédiaire</option><option value="hard">Difficile</option></select></label>
              <label><span>Votre camp</span><select id="draughtSide">${cfg.sideNames.map((name, i) => `<option value="${i}" ${i === cfg.firstSide ? "selected" : ""}>${name}</option>`).join("")}</select></label>
            </div>
            <div id="draughtOnlineSettings" class="toolbar-group draught-online-settings">
              <label><span>Camp si vous créez</span><select id="draughtCreatorSide"><option value="random" selected>Aléatoire</option>${cfg.sideNames.map((name,i)=>`<option value="${i}">${name}</option>`).join("")}</select></label>
              <label><span>Cadence</span><select id="draughtTimePreset">
                <option value="60,0">1+0 — Bullet</option>
                <option value="180,2">3+2 — Blitz</option>
                <option value="300,0">5+0 — Blitz</option>
                <option value="600,5" selected>10+5 — Rapide</option>
                <option value="900,10">15+10 — Rapide</option>
                <option value="1800,0">30+0 — Classique</option>
                <option value="custom">Personnalisée…</option>
              </select></label>
              <span id="draughtCustomTime" class="custom-time-fields" hidden>
                <label><span>Minutes</span><input id="draughtInitialMinutes" type="number" min="1" max="180" value="10"></label>
                <label><span>+ secondes/coup</span><input id="draughtIncrementSeconds" type="number" min="0" max="60" value="5"></label>
              </span>
              <label class="inline-check"><input id="draughtRated" type="checkbox" checked><span>Partie classée Elo</span></label>
              <button id="createDraughtRoom" class="btn small">Créer un salon</button>
              <label><span>Code du salon</span><input id="draughtRoomCode" maxlength="6" placeholder="ABC234" autocomplete="off"></label>
              <button id="joinDraughtRoom" class="btn outline small">Rejoindre</button>
              <span id="draughtRoomStatus" class="online-room-status">Connectez-vous pour jouer en ligne.</span>
            </div>
            <div class="toolbar-actions"><button id="newDraught" class="btn small">Nouvelle partie</button><button id="undoDraught" class="btn outline small">Annuler</button><button id="flipDraught" class="btn outline small">↻ Plateau</button></div>
          </div>

          <div id="draughtClockPanel" class="draught-clock-panel" hidden>
            <div id="draughtClockReadout" class="draught-clock-readout" aria-label="Pendules des deux joueurs"></div>
            <div id="draughtTimeMeta" class="chess-time-meta"></div>
          </div>

          <div class="draught-board-wrap">
            <div id="draughtBoard" class="draughts-board" aria-label="Damier interactif ${cfg.shortTitle}"></div>
            <div id="draughtPathPicker" class="draught-path-picker" hidden></div>
          </div>
          <div id="draughtStatus" class="status draught-status"></div>
          <div id="draughtOnlineActions" class="chess-online-actions" hidden>
            <button id="resignDraughtOnline" class="btn danger small">Abandonner</button>
            <button id="offerDrawDraught" class="btn outline small">Proposer la nulle</button>
            <button id="offerRematchDraught" class="btn small" hidden>Proposer une revanche</button>
          </div>
          <div id="draughtOnlinePrompt" class="online-decision" hidden>
            <strong id="draughtOnlinePromptTitle"></strong>
            <span id="draughtOnlinePromptText"></span>
            <div class="online-decision-actions"><button id="acceptDraughtProposal" class="btn small">Accepter</button><button id="declineDraughtProposal" class="btn outline small">Refuser</button></div>
          </div>
        </section>

        <aside class="draught-side-column">
          <section class="panel"><div class="turn-box"><span>Trait</span><strong id="draughtTurn">${cfg.sideNames[cfg.firstSide]}</strong></div><div id="draughtRatingResult" class="rating-result" hidden></div><div class="piece-count-grid"><div><span id="draughtLabel0">${cfg.sideNames[0]}</span><strong id="draughtCount0">${cfg.piecesPerSide}</strong></div><div><span id="draughtLabel1">${cfg.sideNames[1]}</span><strong id="draughtCount1">${cfg.piecesPerSide}</strong></div></div><h3>Historique</h3><div id="draughtHistory" class="draught-history"></div></section>
          <section class="panel"><h3>Multijoueur en ligne</h3><p>Créez un salon privé ou rejoignez un code. Le créateur choisit son camp, la cadence et si la partie compte pour le classement Elo.</p><p>La pendule et la légalité des déplacements sont contrôlées côté Cloudflare. Les prises obligatoires et les rafles sont donc vérifiées par le serveur.</p><p>Abandon, proposition de nulle et revanche avec inversion des camps sont disponibles comme aux Échecs.</p><div class="note"><strong>Elo :</strong> les Dames ${isInternational?"internationales":"anglaises"} possèdent leurs propres classements Bullet, Blitz, Rapide et Classique.</div></section>
          <section class="panel"><h3>Règles actives</h3>${isInternational ? `<p>✓ Pions : prise avant et arrière</p><p>✓ Rafle maximale obligatoire</p><p>✓ Dames volantes</p><p>✓ Promotion seulement à la fin du coup</p>` : `<p>✓ Pions : prise vers l’avant</p><p>✓ Toute prise est obligatoire</p><p>✓ Choix libre entre plusieurs rafles</p><p>✓ Dame : une case en diagonale</p>`}<div class="note"><strong>Conseil :</strong> cliquez sur une pièce. Seuls les coups légalement autorisés sont proposés. Pour une rafle, cliquez sur sa case d’arrivée finale.</div></section>
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
            <label><span>Mode</span><select id="goMode"><option value="ai">Joueur contre IA</option><option value="local">2 joueurs sur le même écran</option><option value="online" selected>Multijoueur en ligne</option></select></label>
            <div id="goAiSettings" class="toolbar-group" hidden>
              <label><span>Niveau IA</span><select id="goAiLevel"><option value="easy">Facile</option><option value="medium" selected>Intermédiaire</option><option value="hard">Difficile</option></select></label>
              <label><span>Votre couleur</span><select id="goSide"><option value="1" selected>Noir</option><option value="2">Blanc</option></select></label>
            </div>
            <div id="goOnlineSettings" class="toolbar-group go-online-settings">
              <label><span>Couleur si vous créez</span><select id="goCreatorColor"><option value="random" selected>Aléatoire</option><option value="black">Noir</option><option value="white">Blanc</option></select></label>
              <label><span>Cadence</span><select id="goTimePreset"><option value="1+0">1+0</option><option value="3+2">3+2</option><option value="5+0">5+0</option><option value="10+5" selected>10+5</option><option value="15+10">15+10</option><option value="30+0">30+0</option><option value="custom">Personnalisée</option></select></label>
              <span id="goCustomTime" class="custom-time-fields" hidden><label><span>Minutes</span><input id="goInitialMinutes" type="number" min="1" max="180" value="10"></label><label><span>+ secondes/coup</span><input id="goIncrementSeconds" type="number" min="0" max="60" value="5"></label></span>
              <label class="inline-check"><input id="goRated" type="checkbox" checked><span>Partie classée Elo</span></label>
              <button id="createGoRoom" class="btn small" type="button">Créer un salon</button>
              <label><span>Code du salon</span><input id="goRoomCode" maxlength="6" placeholder="ABC234" autocomplete="off"></label>
              <button id="joinGoRoom" class="btn outline small" type="button">Rejoindre</button>
              <span id="goRoomStatus" class="online-room-status">Connectez-vous pour jouer en ligne.</span>
            </div>
            <label><span>Komi</span><select id="goKomi"><option value="7.5" selected>7,5</option><option value="6.5">6,5</option><option value="0">0</option></select></label>
            <label><span>Score</span><select id="goScoring"><option value="area" selected>Aire</option><option value="territory">Territoire</option></select></label>
            <div class="toolbar-actions"><button id="newGo" class="btn small">Nouvelle partie</button><button id="undoGo" class="btn outline small">Annuler</button></div>
          </div>

          <div id="goClockPanel" class="go-clock-panel" hidden><div id="goClockReadout" class="go-clock-readout"></div><div id="goTimeMeta" class="chess-time-meta"></div></div>
          <div class="go-board-frame"><div id="goBoard" class="go-board" aria-label="Goban interactif"></div></div>
          <div class="go-actions"><button id="passGo" class="btn outline">Passer</button><button id="resignGo" class="btn danger">Abandonner</button></div>
          <div id="goStatus" class="status go-status"></div>
          <div id="goOnlineActions" class="chess-online-actions" hidden><button id="offerDrawGo" class="btn outline small">Proposer nulle</button><button id="offerRematchGo" class="btn small" hidden>Proposer revanche</button></div>
          <div id="goOnlinePrompt" class="online-decision" hidden><strong id="goOnlinePromptTitle"></strong><span id="goOnlinePromptText"></span><div><button id="acceptGoProposal" class="btn small">Accepter</button><button id="declineGoProposal" class="btn outline small">Refuser</button></div></div>
        </section>

        <aside class="go-side-column">
          <section class="panel">
            <div class="turn-box"><span>Trait</span><strong id="goTurn">Noir</strong></div><div id="goRatingResult" class="rating-result" hidden></div>
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
            <label><span>Mode</span><select id="chessMode"><option value="ai">Joueur contre IA</option><option value="local">2 joueurs sur le même écran</option><option value="online" selected>Multijoueur en ligne</option></select></label>
            <div id="chessAiSettings" class="toolbar-group" hidden>
              <label><span>Niveau IA</span><select id="chessAiLevel"><option value="easy">Facile</option><option value="medium" selected>Intermédiaire</option><option value="hard">Difficile</option></select></label>
              <label><span>Votre couleur</span><select id="chessSide"><option value="w">Blancs</option><option value="b">Noirs</option></select></label>
            </div>
            <div id="chessOnlineSettings" class="toolbar-group chess-online-settings">
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
    <div class="page awale-page">
      <div class="breadcrumb"><a href="#/accueil">Accueil</a><span>›</span><a href="#/jouer">Jouer</a><span>›</span><span>Awélé</span></div>
      <div class="section-head"><div><div class="eyebrow">Jeu jouable</div><h1>Awélé interactif</h1><p class="section-lead">Multijoueur en ligne par défaut, jeu local ou partie contre l’IA. Semailles, captures et règle de nourrissage sont contrôlées.</p></div></div>
      <div class="awale-play-layout">
        <section class="game-shell awale-shell">
          <div class="awale-toolbar">
            <div><label for="awaleMode"><strong>Mode :</strong></label><select id="awaleMode"><option value="online" selected>Multijoueur en ligne</option><option value="ai">Joueur contre IA</option><option value="local">2 joueurs sur le même écran</option></select></div>
            <button id="newAwale" class="btn small" type="button">Nouvelle partie</button>
          </div>

          <div id="awaleOnlineSettings" class="awale-online-settings">
            <div class="awale-online-grid">
              <label><span>Votre camp à la création</span><select id="awaleCreatorSide"><option value="random" selected>Aléatoire</option><option value="0">Sud — cases 1 à 6</option><option value="1">Nord — cases 7 à 12</option></select></label>
              <label><span>Cadence</span><select id="awaleTimeControl"><option value="60,0">1+0</option><option value="180,2">3+2</option><option value="300,0">5+0</option><option value="600,5" selected>10+5</option><option value="900,10">15+10</option><option value="1800,0">30+0</option><option value="custom">Personnalisée</option></select></label>
              <label class="form-check"><input id="awaleRated" type="checkbox" checked><span>Partie classée Elo</span></label>
            </div>
            <div id="awaleCustomTime" class="awale-custom-time" hidden>
              <label><span>Minutes</span><input id="awaleMinutes" type="number" min="1" max="180" value="10"></label>
              <label><span>Incrément (s)</span><input id="awaleIncrement" type="number" min="0" max="60" value="5"></label>
            </div>
            <div class="awale-room-actions">
              <button id="createAwaleRoom" class="btn small" type="button">Créer un salon</button>
              <input id="awaleRoomCode" maxlength="6" placeholder="CODE" autocomplete="off">
              <button id="joinAwaleRoom" class="btn outline small" type="button">Rejoindre</button>
            </div>
            <div id="awaleOnlineStatus" class="form-status"></div>
          </div>

          <div class="awale-stage">
            <div class="awale-board-column">
              <div id="awaleTopPlayer" class="awale-player-caption"></div>
              <div id="awaleBoard" class="awale-board" aria-label="Plateau d'Awélé"></div>
              <div id="awaleBottomPlayer" class="awale-player-caption"></div>
              <div class="scoreboard"><div class="score-box"><span id="awaleScoreLabel0">Joueur 1</span><strong id="score0">0</strong></div><div class="score-box"><span id="awaleScoreLabel1">Joueur 2</span><strong id="score1">0</strong></div></div>
              <div id="awaleStatus" class="status"></div>
            </div>
            <div id="awaleClockPanel" class="awale-clock-panel" hidden>
              <div id="awaleClockReadout" class="awale-clock-readout"></div>
              <div id="awaleTimeMeta" class="chess-time-meta"></div>
              <div id="awaleOnlineActions" class="chess-online-actions" hidden>
                <button id="resignAwale" class="btn danger small" type="button">Abandonner</button>
                <button id="offerDrawAwale" class="btn outline small" type="button">Proposer nulle</button>
                <button id="offerRematchAwale" class="btn small" type="button" hidden>Proposer revanche</button>
              </div>
              <div id="awaleOnlinePrompt" class="online-decision" hidden><strong id="awaleOnlinePromptTitle"></strong><span id="awaleOnlinePromptText"></span><div><button id="acceptAwaleProposal" class="btn small" type="button">Accepter</button><button id="declineAwaleProposal" class="btn outline small" type="button">Refuser</button></div></div>
              <div id="awaleRatingResult" class="rating-result" hidden></div>
            </div>
          </div>
        </section>
        <aside class="panel"><h3>Comment jouer</h3><p>Cliquez sur une de vos cases. Toutes ses graines sont semées une à une dans le sens antihoraire.</p><p>Une capture a lieu si la dernière graine arrive dans le camp adverse et forme une case de 2 ou 3 graines. La capture remonte ensuite sur les cases adverses précédentes qui contiennent elles aussi 2 ou 3 graines.</p><div class="note"><strong>En ligne :</strong> le serveur vérifie chaque coup, la règle anti-famine et la pendule.</div></aside>
      </div>
    </div>`;
  initAwale();
}


function renderYamsGamePage(game) {
  app.innerHTML = `
    <div class="page yams-rules-page">
      <div class="breadcrumb"><a href="#/accueil">Accueil</a><span>›</span><a href="#/catalogue">Catalogue</a><span>›</span><span>Yams</span></div>
      <section class="game-hero">
        <div class="game-hero-visual">${illustration("dice", true)}</div>
        <div>
          <div class="eyebrow">Jeu de dés</div><h1>Yams</h1>
          <p>Cette version utilise une feuille de score de type Yahtzee/Yams classique : cinq dés, treize catégories et jusqu’à trois lancers par tour.</p>
          <div class="stats"><div class="stat"><strong>5 dés</strong><span>Matériel</span></div><div class="stat"><strong>13 tours</strong><span>Par joueur</span></div><div class="stat"><strong>1–2 joueurs</strong><span>Version actuelle</span></div></div>
          <div class="hero-actions"><a class="btn" href="#/jouer/yams">Jouer au Yams</a></div>
        </div>
      </section>
      <div class="content-grid">
        <article class="panel">
          <h2>Déroulement d’un tour</h2>
          <ol class="rule-list">
            <li>Lancez les cinq dés.</li>
            <li>Après le premier lancer, gardez autant de dés que vous le souhaitez et relancez les autres.</li>
            <li>Vous pouvez faire au maximum trois lancers pendant votre tour. Vous pouvez aussi vous arrêter plus tôt.</li>
            <li>Choisissez ensuite une catégorie encore libre sur votre feuille de score.</li>
            <li>Une catégorie peut être inscrite à zéro si votre lancer ne permet pas de marquer.</li>
          </ol>
          <h2 style="margin-top:24px">Feuille de score</h2>
          <div class="yams-rules-table-wrap"><table class="yams-rules-table"><thead><tr><th>Catégorie</th><th>Calcul</th></tr></thead><tbody>
            <tr><td>As à Six</td><td>Somme des dés de la valeur choisie.</td></tr>
            <tr><td>Bonus supérieur</td><td>+35 points si le total As à Six atteint au moins 63.</td></tr>
            <tr><td>Brelan</td><td>Au moins 3 dés identiques : somme des 5 dés.</td></tr>
            <tr><td>Carré</td><td>Au moins 4 dés identiques : total des 4 dés identiques. Exemple : 5-5-5-5-1 = 20 points.</td></tr>
            <tr><td>Full</td><td>3 dés identiques + 2 dés identiques : 25 points.</td></tr>
            <tr><td>Petite suite</td><td>4 valeurs consécutives : 30 points.</td></tr>
            <tr><td>Grande suite</td><td>5 valeurs consécutives : 40 points.</td></tr>
            <tr><td>Yams</td><td>5 dés identiques : 50 points.</td></tr>
            <tr><td>Chance</td><td>Somme des 5 dés, sans autre condition.</td></tr>
          </tbody></table></div>
          <div class="note" style="margin-top:20px"><strong>Variante choisie :</strong> cette table est volontairement explicite. D’autres variantes françaises du Yams existent ; nous pourrons les ajouter ensuite comme règles alternatives.</div>
        </article>
        <aside class="panel">
          <h3>Modes disponibles</h3>
          <p><strong>Multijoueur :</strong> les valeurs des dés sont générées côté serveur Cloudflare.</p>
          <p><strong>Contre IA :</strong> l’ordinateur choisit quels dés conserver puis sélectionne sa case de score.</p>
          <p><strong>Local :</strong> deux joueurs utilisent le même écran.</p>
          <div class="note"><strong>Classement :</strong> les parties en ligne peuvent être classées Elo ou amicales.</div>
        </aside>
      </div>
    </div>`;
}

function renderYamsPlay() {
  app.innerHTML = `
    <div class="page yams-page">
      <div class="breadcrumb"><a href="#/accueil">Accueil</a><span>›</span><a href="#/jouer">Jouer</a><span>›</span><span>Yams</span></div>
      <div class="section-head"><div><div class="eyebrow">Jeu de dés</div><h1>Yams interactif</h1><p class="section-lead">Conservez les dés utiles, relancez les autres et choisissez la meilleure case de votre feuille de score.</p></div><a class="btn outline small" href="#/jeu/yams">Voir les règles</a></div>
      <div class="yams-layout">
        <section class="game-shell yams-shell">
          <div class="yams-toolbar">
            <label><strong>Mode :</strong><select id="yamsMode"><option value="online" selected>Multijoueur en ligne</option><option value="ai">Joueur contre IA</option><option value="local">2 joueurs sur le même écran</option></select></label>
            <button id="newYams" class="btn small" type="button">Nouvelle partie</button>
          </div>
          <div id="yamsOnlineSettings" class="yams-online-settings">
            <div class="yams-online-grid">
              <label><span>Ordre à la création</span><select id="yamsCreatorSide"><option value="random" selected>Aléatoire</option><option value="0">Joueur 1 — commence</option><option value="1">Joueur 2</option></select></label>
              <label class="form-check"><input id="yamsRated" type="checkbox" checked><span>Partie classée Elo</span></label>
            </div>
            <div class="yams-room-actions"><button id="createYamsRoom" class="btn small" type="button">Créer un salon</button><input id="yamsRoomCode" maxlength="6" placeholder="CODE" autocomplete="off"><button id="joinYamsRoom" class="btn outline small" type="button">Rejoindre</button></div>
            <div id="yamsOnlineStatus" class="form-status"></div><div id="yamsRoomState" class="yams-room-state"></div>
          </div>
          <div id="yamsDice" class="yams-dice" aria-label="Les cinq dés"></div>
          <div class="yams-roll-row"><button id="rollYams" class="btn yams-roll-button" type="button">Lancer les dés</button></div>
          <div id="yamsStatus" class="status"></div>
          <div id="yamsOnlineActions" class="chess-online-actions" hidden><button id="resignYams" class="btn danger small" type="button">Abandonner</button><button id="offerRematchYams" class="btn small" type="button" hidden>Proposer une revanche</button></div>
          <div id="yamsOnlinePrompt" class="online-decision" hidden><strong>Proposition</strong><span></span><div><button id="acceptYamsProposal" class="btn small" type="button">Accepter</button><button id="declineYamsProposal" class="btn outline small" type="button">Refuser</button></div></div>
          <div id="yamsRatingResult" class="rating-result" hidden></div>
        </section>
        <aside class="panel yams-score-panel"><h2>Feuille de score</h2><p class="section-lead">Après au moins un lancer, les cases encore libres affichent le score que vous obtiendriez.</p><div class="yams-score-scroll"><table id="yamsScoreSheet" class="yams-score-sheet"></table></div></aside>
      </div>
    </div>`;
  initYams();
}


function render421GamePage(game){
  app.innerHTML=`<div class="page game421-rules-page"><div class="breadcrumb"><a href="#/accueil">Accueil</a><span>›</span><a href="#/catalogue">Catalogue</a><span>›</span><span>421</span></div><section class="game-hero"><div class="game-hero-visual">${illustration("dice",true)}</div><div><div class="eyebrow">Jeu de dés</div><h1>421</h1><p>Notre variante à deux joueurs utilise trois dés et 21 jetons. La partie se joue en deux phases : charge puis décharge.</p><div class="stats"><div class="stat"><strong>3 dés</strong><span>Matériel</span></div><div class="stat"><strong>21 jetons</strong><span>Pot de départ</span></div><div class="stat"><strong>2 joueurs</strong><span>Version actuelle</span></div></div><div class="hero-actions"><a class="btn" href="#/jouer/421">Jouer au 421</a></div></div></section><div class="content-grid"><article class="panel"><h2>Déroulement</h2><ol class="rule-list"><li>Chaque joueur lance les trois dés et peut effectuer jusqu’à trois lancers, en conservant les dés de son choix.</li><li>Pendant la <strong>charge</strong>, le perdant de la manche reçoit des jetons du pot. Leur nombre dépend de la meilleure combinaison.</li><li>Quand le pot est vide, commence la <strong>décharge</strong>.</li><li>Pendant la décharge, le gagnant de la manche donne à son adversaire autant de jetons que vaut sa combinaison.</li><li>Le premier joueur qui ne possède plus aucun jeton pendant la décharge gagne.</li></ol><h2 style="margin-top:24px">Hiérarchie utilisée</h2><div class="yams-rules-table-wrap"><table class="yams-rules-table"><thead><tr><th>Ordre</th><th>Combinaison</th><th>Valeur</th></tr></thead><tbody><tr><td>1</td><td>4-2-1</td><td>10 jetons</td></tr><tr><td>2</td><td>1-1-1</td><td>7</td></tr><tr><td>3–12</td><td>Deux As + X, puis brelan de X (de 6 à 2)</td><td>6 à 2</td></tr><tr><td>13–16</td><td>Suites 6-5-4, 5-4-3, 4-3-2, 3-2-1</td><td>2</td></tr><tr><td>Ensuite</td><td>Autres combinaisons, classées de la plus forte à la plus faible</td><td>1</td></tr><tr><td>Dernière</td><td>2-2-1 « nénette »</td><td>2 jetons, mais combinaison la plus faible</td></tr></tbody></table></div><div class="note" style="margin-top:20px"><strong>Variante choisie :</strong> le 421 possède de nombreuses variantes locales. Cette version fixe une hiérarchie explicite pour que le jeu en ligne soit sans ambiguïté.</div></article><aside class="panel"><h3>Modes disponibles</h3><p><strong>Multijoueur :</strong> les dés sont générés par le serveur Cloudflare.</p><p><strong>Contre IA :</strong> l’ordinateur choisit quels dés conserver.</p><p><strong>Local :</strong> deux joueurs utilisent le même écran.</p><div class="note">Les parties en ligne peuvent être classées Elo ou amicales.</div></aside></div></div>`;
}
function render421Play(){
  app.innerHTML=`<div class="page game421-page"><div class="breadcrumb"><a href="#/accueil">Accueil</a><span>›</span><a href="#/jouer">Jouer</a><span>›</span><span>421</span></div><div class="section-head"><div><div class="eyebrow">Jeu de dés</div><h1>421 interactif</h1><p class="section-lead">Conservez vos meilleurs dés, validez votre combinaison et débarrassez-vous de vos jetons.</p></div><a class="btn outline small" href="#/jeu/421">Voir les règles</a></div><div class="game421-layout"><section class="game-shell"><div class="yams-toolbar"><label><strong>Mode :</strong><select id="game421Mode"><option value="online" selected>Multijoueur en ligne</option><option value="ai">Joueur contre IA</option><option value="local">2 joueurs sur le même écran</option></select></label><button id="new421" class="btn small" type="button">Nouvelle partie</button></div><div id="game421OnlineSettings" class="yams-online-settings"><div class="yams-online-grid"><label><span>Ordre à la création</span><select id="game421CreatorSide"><option value="random" selected>Aléatoire</option><option value="0">Joueur 1 — commence</option><option value="1">Joueur 2</option></select></label><label class="form-check"><input id="game421Rated" type="checkbox" checked><span>Partie classée Elo</span></label></div><div class="yams-room-actions"><button id="create421Room" class="btn small" type="button">Créer un salon</button><input id="game421RoomCode" maxlength="6" placeholder="CODE" autocomplete="off"><button id="join421Room" class="btn outline small" type="button">Rejoindre</button></div><div id="game421OnlineStatus" class="form-status"></div><div id="game421RoomState" class="yams-room-state"></div></div><div id="game421Tokens" class="game421-tokens"></div><div id="game421Dice" class="yams-dice game421-dice"></div><div id="game421Combo" class="game421-combo"></div><div class="game421-actions"><button id="roll421" class="btn" type="button">Lancer les dés</button><button id="stop421" class="btn outline" type="button">Valider la combinaison</button></div><div id="game421Status" class="status"></div><div id="game421OnlineActions" class="chess-online-actions" hidden><button id="resign421" class="btn danger small" type="button">Abandonner</button><button id="draw421" class="btn outline small" type="button">Proposer nulle</button><button id="rematch421" class="btn small" type="button" hidden>Proposer une revanche</button></div><div id="game421Prompt" class="online-decision" hidden><strong>Proposition</strong><span></span><div><button id="accept421" class="btn small" type="button">Accepter</button><button id="decline421" class="btn outline small" type="button">Refuser</button></div></div><div id="game421RatingResult" class="rating-result" hidden></div></section><aside class="panel"><h2>Repères</h2><p><strong>Charge :</strong> évitez de récupérer les jetons du pot.</p><p><strong>Décharge :</strong> gagnez les manches pour donner vos jetons à l’adversaire.</p><p><strong>Nénette :</strong> 2-2-1 est la combinaison la plus faible.</p><div class="note"><strong>Astuce :</strong> un 4, un 2 ou un As conservé peut ouvrir la voie au 421, mais deux As donnent aussi accès à plusieurs combinaisons très fortes.</div></aside></div></div>`;init421();
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
// AWÉLÉ : local / IA / multijoueur
// -------------------------------
let awale = null;
let awaleUi = null;
const AWALE_ELO_LABELS={bullet:"Bullet",blitz:"Blitz",rapid:"Rapide",classical:"Classique"};

function awaleEmptyOnline(){
  return {ws:null,connected:false,code:null,side:null,players:{black:null,white:null},game:null,clock:null,settings:null,ratings:null,ratingUpdate:null,result:null,drawOffer:null,rematchOffer:null,pendingProposal:null,syncTimer:null,reconnectTimer:null,manualClose:false};
}

function initAwale() {
  awale={pits:Array(12).fill(4),scores:[0,0],player:0,over:false,mode:"online"};
  awaleUi={mode:"online",online:awaleEmptyOnline(),clockTimer:null};
  document.getElementById("awaleMode")?.addEventListener("change",e=>awaleSetMode(e.target.value));
  document.getElementById("newAwale")?.addEventListener("click",newAwale);
  document.getElementById("awaleTimeControl")?.addEventListener("change",e=>{ document.getElementById("awaleCustomTime").hidden=e.target.value!=="custom"; });
  document.getElementById("createAwaleRoom")?.addEventListener("click",awaleCreateRoom);
  document.getElementById("joinAwaleRoom")?.addEventListener("click",awaleJoinRoom);
  document.getElementById("resignAwale")?.addEventListener("click",()=>{ if(confirm("Abandonner cette partie ?")) awaleSend({type:"resign"}); });
  document.getElementById("offerDrawAwale")?.addEventListener("click",()=>awaleSend({type:"draw_offer"}));
  document.getElementById("offerRematchAwale")?.addEventListener("click",()=>awaleSend({type:"rematch_offer"}));
  document.getElementById("acceptAwaleProposal")?.addEventListener("click",()=>awaleRespondProposal(true));
  document.getElementById("declineAwaleProposal")?.addEventListener("click",()=>awaleRespondProposal(false));
  awaleUpdateModeUi();
  renderAwale();
  awaleUi.clockTimer=setInterval(()=>{ if(!document.getElementById("awaleBoard")){ clearInterval(awaleUi.clockTimer); return; } awaleUpdateClockDisplay(); },250);
  LudoOnline?.me?.().then(user=>{ if(!user) awaleOnlineStatus("Connectez-vous dans Compte pour créer ou rejoindre un salon."); }).catch(()=>{});
}

function awaleSetMode(mode){
  if(!["online","ai","local"].includes(mode)) mode="online";
  if(awaleUi.mode==="online"&&mode!=="online") awaleDisconnect(true);
  awaleUi.mode=mode; awale.mode=mode;
  if(mode!=="online") newAwale();
  awaleUpdateModeUi(); renderAwale();
}

function awaleUpdateModeUi(){
  const online=awaleUi?.mode==="online";
  const settings=document.getElementById("awaleOnlineSettings"); if(settings) settings.hidden=!online;
  const newBtn=document.getElementById("newAwale"); if(newBtn) newBtn.hidden=online;
  const clock=document.getElementById("awaleClockPanel"); if(clock&&!online) clock.hidden=true;
}

function newAwale() {
  awale={pits:Array(12).fill(4),scores:[0,0],player:0,over:false,mode:awaleUi?.mode||"ai"};
  renderAwale("Nouvelle partie : au joueur 1 de commencer.");
}

function awaleCurrentState(){ return awaleUi?.mode==="online"?(awaleUi.online.game?.state||awale):awale; }
function awaleOnlineHasTwo(){ return Boolean(awaleUi?.online?.players?.black&&awaleUi?.online?.players?.white); }
function awalePlayerName(side){
  if(awaleUi?.mode!=="online") return side===0?"Joueur 1":awaleUi?.mode==="ai"?"IA":"Joueur 2";
  const p=side===0?awaleUi.online.players?.black:awaleUi.online.players?.white;
  return p?.username||`Joueur ${side+1}`;
}

function renderAwale(message="") {
  const state=awaleCurrentState(); if(!state) return;
  const board=document.getElementById("awaleBoard"); if(!board) return;
  const rotated=awaleUi?.mode==="online"&&Number(awaleUi.online.side)===1;
  const top=rotated?[5,4,3,2,1,0]:[11,10,9,8,7,6];
  const bottom=rotated?[6,7,8,9,10,11]:[0,1,2,3,4,5];
  board.innerHTML=[...top,...bottom].map(i=>pitHtml(i,state)).join("");
  document.getElementById("score0").textContent=state.scores[0];
  document.getElementById("score1").textContent=state.scores[1];
  document.getElementById("awaleScoreLabel0").textContent=awalePlayerName(0);
  document.getElementById("awaleScoreLabel1").textContent=awalePlayerName(1);
  const topSide=rotated?0:1,bottomSide=rotated?1:0;
  document.getElementById("awaleTopPlayer").textContent=`${awalePlayerName(topSide)} — ${topSide===0?"Sud":"Nord"}`;
  document.getElementById("awaleBottomPlayer").textContent=`${awalePlayerName(bottomSide)} — ${bottomSide===0?"Sud":"Nord"}`;
  const status=document.getElementById("awaleStatus");
  if(status) status.textContent=message||awaleStatusText(state);
  board.querySelectorAll(".pit.playable").forEach(btn=>btn.addEventListener("click",()=>handleAwaleMove(Number(btn.dataset.pit))));
  awaleUpdateClockDisplay(); awaleUpdateOnlineControls(); awaleRenderRatingResult();
}

function pitHtml(i,state) {
  const owner=i<6?0:1;
  let legal=!state.over&&owner===state.player&&isLegalAwaleMove(state,i);
  if(awaleUi?.mode==="ai"&&state.player===1) legal=false;
  if(awaleUi?.mode==="online") legal=legal&&!awaleUi.online.game?.result?.over&&awaleUi.online.connected&&awaleOnlineHasTwo()&&Number(awaleUi.online.side)===Number(state.player);
  const seeds=Array.from({length:Math.min(state.pits[i],18)},()=>`<span class="seed"></span>`).join("");
  return `<button class="pit ${legal?"playable":""}" data-pit="${i}" ${legal?"":"disabled"} aria-label="Case ${i+1}, ${state.pits[i]} graines"><span class="seed-cloud">${seeds}</span><span>${state.pits[i]}</span></button>`;
}

function awaleStatusText(state) {
  if(awaleUi?.mode==="online"){
    if(!awaleUi.online.connected) return awaleUi.online.code?"Connexion au salon…":"Créez ou rejoignez un salon.";
    if(!awaleOnlineHasTwo()) return `Salon ${awaleUi.online.code} — en attente du deuxième joueur.`;
    if(awaleUi.online.game?.result?.over) return awaleUi.online.game.result.text||"Partie terminée.";
    return `${awalePlayerName(state.player)} doit jouer.`;
  }
  if(state.over) return endMessage(state);
  return state.player===0?"Au joueur 1 de jouer.":(awaleUi?.mode==="ai"?"L'IA réfléchit…":"Au joueur 2 de jouer.");
}

function handleAwaleMove(index) {
  const state=awaleCurrentState(); if(!isLegalAwaleMove(state,index)||state.over) return;
  if(awaleUi?.mode==="online") { awaleSend({type:"move",move:{index}}); return; }
  awale=applyAwaleMove(awale,index); finishOrContinue(); renderAwale();
  if(!awale.over&&awaleUi?.mode==="ai"&&awale.player===1){
    setTimeout(()=>{ const move=chooseAiMove(awale); if(move!==null) awale=applyAwaleMove(awale,move); finishOrContinue(); renderAwale(); },420);
  }
}

function awaleTimeControl(){
  const value=document.getElementById("awaleTimeControl")?.value||"600,5";
  if(value==="custom") return {initialSeconds:Math.max(60,Math.min(10800,Number(document.getElementById("awaleMinutes")?.value||10)*60)),incrementSeconds:Math.max(0,Math.min(60,Number(document.getElementById("awaleIncrement")?.value||0)))};
  const [initialSeconds,incrementSeconds]=value.split(",").map(Number); return {initialSeconds,incrementSeconds};
}
function awaleOnlineStatus(text){ const el=document.getElementById("awaleOnlineStatus"); if(el) el.textContent=text||""; }

async function awaleCreateRoom(){
  try{
    const user=await LudoOnline.me(true); if(!user){awaleOnlineStatus("Connectez-vous d'abord dans Compte.");return;}
    const tc=awaleTimeControl(),creatorSide=document.getElementById("awaleCreatorSide")?.value||"random",rated=document.getElementById("awaleRated")?.checked!==false;
    const data=await LudoOnline.rooms.create("awale",{creatorSide,initialSeconds:tc.initialSeconds,incrementSeconds:tc.incrementSeconds,rated});
    document.getElementById("awaleRoomCode").value=data.code; awaleOnlineStatus(`Salon ${data.code} créé. Partagez ce code.`);
    awaleConnect(data.code,data.side);
  }catch(err){awaleOnlineStatus(err.message);}
}
async function awaleJoinRoom(){
  const code=(document.getElementById("awaleRoomCode")?.value||"").trim().toUpperCase();
  try{ const user=await LudoOnline.me(true); if(!user){awaleOnlineStatus("Connectez-vous d'abord dans Compte.");return;} const data=await LudoOnline.rooms.join(code); if(data.game!=="awale") throw new Error("Ce code ne correspond pas à une partie d’Awélé."); awaleConnect(data.code,data.side); }
  catch(err){awaleOnlineStatus(err.message);}
}

function awaleDisconnect(manual=false){
  const o=awaleUi?.online; if(!o)return; o.manualClose=manual;
  if(o.syncTimer) clearInterval(o.syncTimer); if(o.reconnectTimer) clearTimeout(o.reconnectTimer); o.syncTimer=o.reconnectTimer=null;
  try{o.ws?.close();}catch{} o.ws=null;o.connected=false;
}
function awaleStartSync(){ const o=awaleUi.online;if(o.syncTimer)clearInterval(o.syncTimer);o.syncTimer=setInterval(()=>{if(o.ws?.readyState===WebSocket.OPEN)o.ws.send(JSON.stringify({type:"sync"}));},5000); }
function awaleScheduleReconnect(){ const o=awaleUi.online;if(o.manualClose||!o.code||o.reconnectTimer)return;o.reconnectTimer=setTimeout(()=>{o.reconnectTimer=null;if(awaleUi?.mode==="online"&&!o.connected)awaleConnect(o.code,o.side,true);},1200); }
function awaleConnect(code,side,reconnecting=false){
  awaleDisconnect(false); const o=awaleUi.online;o.manualClose=false;o.code=String(code).toUpperCase();o.side=Number(side);o.connected=false;
  awaleOnlineStatus(reconnecting?`Reconnexion au salon ${o.code}…`:`Connexion au salon ${o.code}…`);
  const ws=LudoOnline.rooms.connect(o.code,{
    open:()=>{ if(o.ws!==ws)return;o.connected=true;awaleOnlineStatus(`Salon ${o.code} connecté.`);awaleStartSync();renderAwale(); },
    message:data=>{ if(o.ws!==ws)return;awaleHandleOnlineMessage(data); },
    close:()=>{ if(o.ws!==ws)return;o.connected=false;if(o.syncTimer)clearInterval(o.syncTimer);o.syncTimer=null;renderAwale();awaleScheduleReconnect(); },
    error:()=>{ if(o.ws!==ws)return;awaleOnlineStatus("Problème de connexion au salon."); }
  }); o.ws=ws;
}
function awaleHandleOnlineMessage(data){
  const o=awaleUi.online;
  if(data.type==="welcome"||data.type==="state"){
    if(data.side!==undefined)o.side=Number(data.side); if(data.players)o.players=data.players;if(data.game){o.game=data.game;o.result=data.game.result;}if(data.clock)o.clock={...data.clock,clientReceivedAt:Date.now()};if(data.settings)o.settings=data.settings;if(data.ratings)o.ratings=data.ratings;if(data.ratingUpdate)o.ratingUpdate=data.ratingUpdate;if(data.drawOffer!==undefined)o.drawOffer=data.drawOffer;if(data.rematchOffer!==undefined)o.rematchOffer=data.rematchOffer;renderAwale();return;
  }
  if(data.type==="players"){o.players=data.players||o.players;if(data.clock)o.clock={...data.clock,clientReceivedAt:Date.now()};if(data.ratings)o.ratings=data.ratings;renderAwale();return;}
  if(data.type==="clock"){o.clock={...data.clock,clientReceivedAt:Date.now()};awaleUpdateClockDisplay();return;}
  if(data.type==="draw_offer"){o.drawOffer=data.offer;if(data.offer?.userId!==LudoOnline.state.user?.id)awaleShowProposal("draw",`${data.offer?.username||"Votre adversaire"} propose la nulle.`);awaleUpdateOnlineControls();return;}
  if(data.type==="draw_declined"){o.drawOffer=null;awaleHideProposal();awaleOnlineStatus("Proposition de nulle refusée.");awaleUpdateOnlineControls();return;}
  if(data.type==="rematch_offer"){o.rematchOffer=data.offer;if(data.offer?.userId!==LudoOnline.state.user?.id)awaleShowProposal("rematch",`${data.offer?.username||"Votre adversaire"} propose une revanche.`);awaleUpdateOnlineControls();return;}
  if(data.type==="rematch_declined"){o.rematchOffer=null;awaleHideProposal();awaleOnlineStatus("Revanche refusée.");awaleUpdateOnlineControls();return;}
  if(data.type==="rematch_started"){o.side=Number(data.side);o.players=data.players;o.game=data.game;o.result=data.game?.result;o.clock=data.clock?{...data.clock,clientReceivedAt:Date.now()}:null;o.settings=data.settings;o.ratings=data.ratings;o.ratingUpdate=null;o.drawOffer=o.rematchOffer=null;awaleHideProposal();renderAwale();return;}
  if(data.type==="error") awaleOnlineStatus(data.message||"Erreur de partie.");
}
function awaleSend(payload){const ws=awaleUi?.online?.ws;if(ws?.readyState===WebSocket.OPEN)ws.send(JSON.stringify(payload));}
function awaleShowProposal(type,text){const box=document.getElementById("awaleOnlinePrompt");if(!box)return;awaleUi.online.pendingProposal=type;document.getElementById("awaleOnlinePromptTitle").textContent=type==="draw"?"Proposition de nulle":"Proposition de revanche";document.getElementById("awaleOnlinePromptText").textContent=text;box.hidden=false;}
function awaleHideProposal(){if(awaleUi?.online)awaleUi.online.pendingProposal=null;const box=document.getElementById("awaleOnlinePrompt");if(box)box.hidden=true;}
function awaleRespondProposal(accept){const t=awaleUi.online.pendingProposal;if(!t)return;awaleSend({type:t==="draw"?"draw_response":"rematch_response",accept});awaleHideProposal();}
function awaleUpdateOnlineControls(){
  const box=document.getElementById("awaleOnlineActions");if(!box||!awaleUi)return;const online=awaleUi.mode==="online"&&awaleUi.online.connected;box.hidden=!online;if(!online)return;
  const over=Boolean(awaleUi.online.game?.result?.over),two=awaleOnlineHasTwo();
  const resign=document.getElementById("resignAwale"),draw=document.getElementById("offerDrawAwale"),rematch=document.getElementById("offerRematchAwale");
  if(resign)resign.disabled=!two||over;if(draw)draw.disabled=!two||over||Boolean(awaleUi.online.drawOffer);if(rematch){rematch.hidden=!over;rematch.disabled=!two||Boolean(awaleUi.online.rematchOffer);}
}
function awaleFormatClock(ms){let total=Math.max(0,Math.ceil(Number(ms||0)/1000)),m=Math.floor(total/60),s=total%60;return `${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;}
function awaleClockValues(){const c=awaleUi?.online?.clock;if(!c)return null;let side0Ms=Number(c.side0Ms||0),side1Ms=Number(c.side1Ms||0);if(c.started&&c.runningSide!==null&&!awaleUi.online.game?.result?.over){const e=Math.max(0,Date.now()-Number(c.clientReceivedAt||Date.now()));if(Number(c.runningSide)===0)side0Ms=Math.max(0,side0Ms-e);else side1Ms=Math.max(0,side1Ms-e);}return{side0Ms,side1Ms,runningSide:c.runningSide,started:c.started};}
function awaleUpdateClockDisplay(){
  const panel=document.getElementById("awaleClockPanel");if(!panel||!awaleUi)return;const o=awaleUi.mode==="online"?awaleUi.online:null;panel.hidden=!o?.connected;if(!o?.connected)return;
  const v=awaleClockValues()||{side0Ms:0,side1Ms:0},r=o.ratings||{},readout=document.getElementById("awaleClockReadout");
  const rows=[0,1].map(side=>({side,name:awalePlayerName(side),rating:(side===0?r.side0:r.side1)?.rating??1200,time:side===0?v.side0Ms:v.side1Ms,active:v.started&&Number(v.runningSide)===side}));
  const bottom=Number(o.side)===1?1:0; const ordered=bottom===0?[rows[1],rows[0]]:[rows[0],rows[1]];
  if(readout)readout.innerHTML=ordered.map(x=>`<div class="awale-clock-card side${x.side} ${x.active?"active":""}"><div><span>${x.side===0?"Sud":"Nord"}</span><strong>${escapeHtml(x.name)}</strong><small>Elo ${x.rating}</small></div><b>${awaleFormatClock(x.time)}</b></div>`).join("");
  const tc=o.settings?.timeControl,meta=document.getElementById("awaleTimeMeta");if(meta&&tc)meta.textContent=`${Number(tc.initialSeconds)/60}+${Number(tc.incrementSeconds||0)} · ${AWALE_ELO_LABELS[o.settings?.ratingCategory||"rapid"]} · ${o.settings?.rated?"classée Elo":"amicale"}`;
}
function awaleRenderRatingResult(){const box=document.getElementById("awaleRatingResult"),u=awaleUi?.online?.ratingUpdate;if(!box)return;if(!u){box.hidden=true;return;}const mine=Number(awaleUi.online.side)===0?u.side0:u.side1,other=Number(awaleUi.online.side)===0?u.side1:u.side0;box.hidden=false;box.innerHTML=`<strong>Elo ${AWALE_ELO_LABELS[u.category]||u.category}</strong><span>Vous : ${mine?.before??"—"} → ${mine?.after??"—"} (${Number(mine?.delta||0)>=0?"+":""}${mine?.delta??0})</span><span>${escapeHtml(other?.username||"Adversaire")} : ${other?.before??"—"} → ${other?.after??"—"}</span>`;}

function finishOrContinue() {
  const legal=legalMoves(awale);
  if(awale.scores[0]>=25||awale.scores[1]>=25||legal.length===0||awale.pits.reduce((a,b)=>a+b,0)<=6){
    awale.scores[0]+=awale.pits.slice(0,6).reduce((a,b)=>a+b,0);awale.scores[1]+=awale.pits.slice(6).reduce((a,b)=>a+b,0);awale.pits.fill(0);awale.over=true;
  }
}
function legalMoves(state){const start=state.player===0?0:6,moves=[];for(let i=start;i<start+6;i++)if(isLegalAwaleMove(state,i))moves.push(i);return moves;}
function isLegalAwaleMove(state,index){const owner=index<6?0:1;if(owner!==state.player||state.pits[index]===0)return false;const opponentEmpty=sideSeeds(state,1-state.player)===0;if(!opponentEmpty)return true;const test=sowOnly(state,index);return sideSeeds(test,1-state.player)>0;}
function sowOnly(state,index){const next={pits:[...state.pits],scores:[...state.scores],player:state.player,over:state.over,mode:state.mode};let seeds=next.pits[index];next.pits[index]=0;let pos=index;while(seeds>0){pos=(pos+1)%12;if(pos===index)continue;next.pits[pos]++;seeds--;}next.last=pos;return next;}
function applyAwaleMove(state,index){const next=sowOnly(state,index),current=state.player;let captured=[],pos=next.last;const opponentStart=current===0?6:0,opponentEnd=opponentStart+5;while(pos>=opponentStart&&pos<=opponentEnd&&(next.pits[pos]===2||next.pits[pos]===3)){captured.push(pos);pos=(pos+11)%12;}const totalCaptured=captured.reduce((sum,p)=>sum+next.pits[p],0),opponentTotalBefore=sideSeeds(next,1-current);if(totalCaptured>0&&totalCaptured<opponentTotalBefore)captured.forEach(p=>{next.scores[current]+=next.pits[p];next.pits[p]=0;});next.player=1-current;delete next.last;return next;}
function sideSeeds(state,player){const start=player===0?0:6;return state.pits.slice(start,start+6).reduce((a,b)=>a+b,0);}
function chooseAiMove(state){const moves=legalMoves(state);if(!moves.length)return null;let bestMove=moves[0],bestScore=-Infinity;for(const move of moves){const before=state.scores[1],simulated=applyAwaleMove(state,move),gain=simulated.scores[1]-before,opponentMoves=legalMoves(simulated);let opponentBestGain=0;for(const opp of opponentMoves){const reply=applyAwaleMove(simulated,opp);opponentBestGain=Math.max(opponentBestGain,reply.scores[0]-simulated.scores[0]);}const ownSeeds=sideSeeds(simulated,1),score=gain*10-opponentBestGain*6+ownSeeds*.08+Math.random()*.25;if(score>bestScore){bestScore=score;bestMove=move;}}return bestMove;}
function endMessage(state){if(state.scores[0]>state.scores[1])return `Partie terminée : joueur 1 gagne ${state.scores[0]} à ${state.scores[1]}.`;if(state.scores[1]>state.scores[0])return `Partie terminée : joueur 2 / IA gagne ${state.scores[1]} à ${state.scores[0]}.`;return `Partie terminée : égalité ${state.scores[0]} à ${state.scores[1]}.`;}

