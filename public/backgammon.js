import {BAR, OFF, newGame, legalMoves, play} from "./backgammon-engine.js?v=2";

const colors = ["Noirs", "Blancs"];
const faces = ["","⚀","⚁","⚂","⚃","⚄","⚅"];
const order = [...Array.from({length:12}, (_,i) => i+12), ...Array.from({length:12}, (_,i) => 11-i)];

// Chaque casier reste à l’extérieur du plateau et contient un disque par pion sorti.
function tray(side) {
  return `<div class="bg-tray" id="bg-tray-${side}"><b>${colors[side]}</b><small>Sortis</small><strong></strong><div class="bg-stack"></div></div>`;
}

window.renderBackgammonRules = (app, game) => {
  app.innerHTML = `<div class="page"><div class="breadcrumb"><a href="#/catalogue">Catalogue</a> › Jeux de dés</div>
    <section class="game-hero"><div class="game-hero-visual">${illustration(game.art)}</div><div>
    <h1>Backgammon</h1><p>${game.goal}</p><a class="btn" href="#/jouer/backgammon">Jouer au Backgammon</a></div></section>
    <article class="panel"><h2>Règles de la manche</h2><ol class="rule-list">${game.rules.map(r => '<li>'+r+'</li>').join("")}</ol><p>${game.tips}</p></article></div>`;
};

window.renderBackgammon = app => {
  app.innerHTML = `<div class="page bg-page"><div class="breadcrumb"><a href="#/jouer">Jouer</a> › Jeux de dés</div>
    <div class="section-head"><h1>Backgammon</h1><a href="#/jeu/backgammon" class="btn outline small">Règles du jeu</a></div>
    <div class="bg-layout"><div class="bg-board-area">${tray(0)}<section class="bg-table" aria-label="Plateau de backgammon">
    <div id="bg-points"></div><div class="bg-rail"><span id="bg-dice"></span><button id="bg-roll" class="btn small">Lancer les dés</button></div></section>${tray(1)}</div>
    <aside class="panel bg-controls"><label>Mode de jeu <select id="bg-mode"><option value="ai">Contre l’ordinateur</option><option value="local">À deux sur cet écran</option><option value="online">Multijoueur en ligne</option></select></label>
    <div id="bg-room" hidden><button class="btn small" id="bg-create">Créer un salon</button>
    <label>Code du salon <input id="bg-code" maxlength="6" autocomplete="off"></label><button class="btn outline small" id="bg-join">Rejoindre</button>
    <p id="bg-connection" role="status"></p></div>
    <strong id="bg-turn" aria-live="polite"></strong><p id="bg-notice"></p><p id="bg-hint"></p>
    <button class="btn outline small" id="bg-bar"></button><button class="btn outline small" id="bg-off"></button>
    <div id="bg-choices"></div><p id="bg-trail" aria-live="polite"></p><button class="btn small" id="bg-new">Nouvelle partie</button>
    <button class="btn outline small" id="bg-resign" hidden>Abandonner</button><div id="bg-rematch"></div>
    </aside></div></div>`;
  const root = app.querySelector(".bg-page");
  const el = name => root.querySelector("#bg-"+name);
  let game = newGame(), mode = "ai", selected = null, moves = [], side = null, players = {};
  let socket = null, timer, retry, room = "", generation = 0, offer = null, busy = false;

  let shownMove = null;
  function showMove(move) {
    const point = i => root.querySelector('[data-point="'+i+'"]');
    const start = move.from === BAR ? el("bar") : point(move.from);
    const end = move.to === OFF ? el("tray-"+move.side) : point(move.to);
    start.classList.add("bg-depart");
    end.classList.add("bg-arrive");
    if (shownMove === move.revision) return;
    shownMove = move.revision;
    if (!root.animate || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const a = (start.querySelector("i:last-child") || start).getBoundingClientRect();
    const b = (end.querySelector("i:last-child") || end).getBoundingClientRect();
    const ghost = document.createElement("i");
    ghost.className = "bg-man bg-flying "+(move.side === 0 ? "dark" : "light");
    ghost.setAttribute("aria-hidden","true");
    ghost.style.left = a.left + a.width/2 + "px";
    ghost.style.top = a.top + a.height/2 + "px";
    root.append(ghost);
    const dx = b.left+b.width/2-a.left-a.width/2, dy = b.top+b.height/2-a.top-a.height/2;
    const flight = ghost.animate([{transform:"translate(-50%,-50%)"}, {transform:`translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px))`}], {duration:800,easing:"ease-in-out"});
    flight.onfinish = () => ghost.remove();
  }
  function disconnect() {
    generation++;
    clearTimeout(timer);
    clearTimeout(retry);
    const old = socket;
    socket = null;
    old?.close();
    room = ""; side = null; players = {}; offer = null; busy = false;
  }
  window.addEventListener("hashchange", disconnect, {once:true});
  function send(message) {
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
  }
  function act(action) {
    if (mode === "online") send({type:"backgammon", revision:game.revision, ...action});
    else { game = play(game, game.turn, action); selected = null; render(); }
  }
  function computer() {
    if (!root.isConnected || mode !== "ai" || game.turn !== 1 || game.result) return;
    if (!moves.length) return act({kind:"roll"});
    // L’ordinateur privilégie une sortie, une frappe ou la protection d’un pion.
    const weight = m => (m.to === OFF ? 5 : game.points[m.to] === 1 ? 4 : game.points[m.to] === -1 ? 3 : 0)
      - (game.points[m.from] === -2 ? 2 : 0) + Math.random();
    const choice = moves.map(move => ({move, score:weight(move)})).sort((a,b) => b.score-a.score)[0];
    act({kind:"move", ...choice.move});
  }
  function render() {
    clearTimeout(timer);
    const online = mode === "online", connected = socket?.readyState === WebSocket.OPEN;
    const ready = !online || (connected && side !== null && players.black && players.white);
    const mine = ready && !game.result && (mode === "local" || game.turn === (online ? side : 0));
    moves = legalMoves(game);
    if (game.bar[game.turn] && moves.length) selected = BAR;
    const possible = mine ? moves.filter(m => m.from === selected) : [];
    el("points").innerHTML = order.map((i, pos) => {
      const n = game.points[i], total = Math.abs(n), dest = possible.some(m => m.to === i);
      const active = dest || (mine && moves.some(m => m.from === i));
      const stack = Array.from({length:Math.min(total,5)}, (_,k) =>
        `<i class="bg-man ${n > 0 ? "dark" : "light"}">${total > 5 && k === 4 ? total : ""}</i>`).join("");
      return `<button type="button" data-point="${i}" class="bg-point ${pos >= 12 ? "lower" : ""} ${dest ? "target" : ""} ${selected === i ? "chosen" : ""}"
        aria-label="Flèche ${i+1}, ${total ? total+' '+(n>0?'noirs':'blancs') : 'vide'}${dest ? ', destination' : ''}" ${active ? '' : 'disabled'}>
        <b>${i+1}</b><span>${stack}</span></button>`;
    }).join("");
    el("turn").textContent = online && !ready ? (room ? "En attente de l’adversaire ou de la connexion." : "Créez ou rejoignez un salon.") :
      game.result?.text || "Au tour des "+colors[game.turn];
    el("notice").textContent = ready ? game.notice : "";
    el("hint").textContent = !ready || game.result ? "" : !mine ? "L’adversaire joue…" : !game.dice.length ? "Lancez les deux dés." :
      selected === BAR ? "Rentrez un pion de la barre sur une flèche indiquée." :
      selected === null ? "Choisissez un pion à déplacer." : "Cliquez sur une flèche indiquée ou sur Sortir.";
    const remaining = game.dice.slice();
    el("dice").innerHTML = ready ? (game.rolled || game.dice).map(value => {
      const index = remaining.indexOf(value);
      if (index >= 0) remaining.splice(index, 1);
      return `<span class="${index < 0 ? "used" : ""}">${faces[value]}</span>`;
    }).join("") : "";
    el("dice").setAttribute("aria-label", "Lancer "+(game.rolled || game.dice).join(", ")+". Dés restants "+game.dice.join(", "));
    el("roll").disabled = !mine || !!game.dice.length;
    el("bar").textContent = `Barre · ${game.bar[0]} noirs / ${game.bar[1]} blancs`;
    el("bar").disabled = !mine || !moves.some(m => m.from === BAR);
    el("off").textContent = "Sortir un pion";
    el("off").disabled = !possible.some(m => m.to === OFF);
    el("choices").replaceChildren();
    for (const player of [0,1]) {
      const box = el("tray-"+player), count = game.off[player];
      box.querySelector("strong").textContent = count+"/15";
      box.querySelector(".bg-stack").innerHTML = `<i aria-hidden="true" class="bg-man ${player === 0 ? "dark" : "light"}"></i>`.repeat(count);
    }
    root.querySelectorAll(".bg-depart,.bg-arrive").forEach(node => node.classList.remove("bg-depart","bg-arrive"));
    if (ready && game.lastMove) showMove(game.lastMove);
    else shownMove = null;
    const other = mode === "ai" ? 1 : mode === "online" ? 1-side : game.lastMove?.side;
    const trail = game.paths?.[other] || [];
    const label = i => i === BAR ? "barre" : i === OFF ? "sortie" : i+1;
    el("trail").textContent = ready && trail.length ? `Derniers coups des ${colors[other]} · `+
      trail.map(m => `${label(m.from)} → ${label(m.to)}${m.hit ? " (frappe)" : ""}`).join(" / ") : "";
    el("new").hidden = online;
    el("room").hidden = !online;
    el("create").disabled = el("join").disabled = busy || !!room;
    el("resign").hidden = !online || !ready || !!game.result;
    el("rematch").innerHTML = !online || !game.result || !connected ? "" : !offer ? '<button class="btn small" data-reply="offer">Proposer une revanche</button>' :
      offer.side === side ? "Revanche proposée…" : '<button class="btn small" data-reply="yes">Accepter la revanche</button> <button class="btn outline small" data-reply="no">Refuser</button>';
    if (mode === "ai" && !game.result && game.turn === 1) timer = setTimeout(computer, 1550);
  }
  function choose(to) {
    const choices = moves.filter(m => m.from === selected && m.to === to);
    if (!choices.length) { selected = to; render(); return; }
    if (choices.length === 1) return act({kind:"move", ...choices[0]});
    // Deux dés différents peuvent parfois sortir le même pion.
    el("choices").replaceChildren(...choices.map(move => {
      const button = document.createElement("button");
      button.className = "btn small"; button.textContent = "Utiliser le "+move.value;
      button.onclick = () => act({kind:"move", ...move});
      return button;
    }));
  }
  function connect(code) {
    room = code;
    el("connection").textContent = "Connexion au salon "+code+"…";
    socket = LudoOnline.rooms.connect(code, {
      message(data, ws) {
        if (ws !== socket) return;
        if (data.game) { game = data.game; selected = null; }
        if (data.side != null) side = data.side;
        if (data.players) players = data.players;
        if ("rematchOffer" in data) offer = data.rematchOffer;
        if (data.type === "rematch_offer") offer = data.offer;
        if (["rematch_declined","rematch_started"].includes(data.type)) offer = null;
        if (data.type === "error") { el("connection").textContent = data.message; return; }
        if (side !== null) el("connection").textContent = `Salon ${code} · Vous jouez les ${colors[side]}.`;
        render();
      },
      close(e, ws) {
        if (ws !== socket) return;
        el("connection").textContent = "Connexion interrompue. Reconnexion au salon "+code+"…";
        render(); retry = setTimeout(() => connect(code), 2500);
      }
    });
  }
  async function openRoom(create) {
    const attempt = generation, code = el("code").value.trim().toUpperCase();
    busy = true; render();
    try {
      if (!create && (await LudoOnline.rooms.info(code)).room.game !== "backgammon") throw new Error("Ce salon appartient à un autre jeu.");
      if (attempt !== generation) return;
      const response = create ? await LudoOnline.rooms.create("backgammon",{rated:false}) : await LudoOnline.rooms.join(code);
      if (attempt === generation) connect(response.code);
    } catch (err) { if (attempt === generation) el("connection").textContent = err.message; }
    finally { if (attempt === generation) {busy = false; render();} }
  }
  el("points").onclick = e => { const b = e.target.closest("button"); if (b && !b.disabled) choose(Number(b.dataset.point)); };
  el("off").onclick = () => choose(OFF);
  el("bar").onclick = () => {selected = BAR; render();};
  el("roll").onclick = () => act({kind:"roll"});
  el("new").onclick = () => {game = newGame(); selected = null; render();};
  el("mode").onchange = () => {
    disconnect(); mode = el("mode").value; selected = null; game = newGame();
    el("connection").textContent = ""; render();
  };
  el("create").onclick = () => openRoom(true);
  el("join").onclick = () => openRoom(false);
  el("resign").onclick = () => {if (confirm("Abandonner cette manche ?")) send({type:"resign",revision:game.revision});};
  el("rematch").onclick = e => {
    const reply = e.target.dataset.reply;
    if (reply) send(reply === "offer" ? {type:"rematch_offer"} : {type:"rematch_response", accept:reply === "yes"});
  };
  const pending = LudoOnline.invites.consumePendingRoom("backgammon");
  if (pending) {mode = el("mode").value = "online"; el("code").value = pending.code; openRoom(false);}
  render();
};
