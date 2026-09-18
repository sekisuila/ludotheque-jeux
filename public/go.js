// ============================================================
// GO — moteur local pour gobans 9×9, 13×13 et 19×19
// ============================================================
// Valeurs du plateau : 0 = vide, 1 = Noir, 2 = Blanc.
// Le moteur gère les libertés, captures, suicide, ko simple,
// passes, abandon, score par aire/territoire et une IA légère.

const GO_EMPTY = 0;
const GO_BLACK = 1;
const GO_WHITE = 2;
const GO_DIRS = [[-1,0],[1,0],[0,-1],[0,1]];

function goOther(player) {
  return player === GO_BLACK ? GO_WHITE : GO_BLACK;
}

function goInside(size, r, c) {
  return r >= 0 && r < size && c >= 0 && c < size;
}

function goIndex(size, r, c) {
  return r * size + c;
}

function goRC(size, index) {
  return [Math.floor(index / size), index % size];
}

function goBoardHash(board) {
  return board.join("");
}

function goCloneBoard(board) {
  return board.slice();
}

function goNeighbors(size, r, c) {
  const result = [];
  for (const [dr, dc] of GO_DIRS) {
    const rr = r + dr, cc = c + dc;
    if (goInside(size, rr, cc)) result.push([rr, cc]);
  }
  return result;
}

// Retourne toutes les pierres connectées à (r,c) et leurs libertés.
function goGroupInfo(board, size, r, c) {
  const color = board[goIndex(size, r, c)];
  if (!color) return { stones: [], liberties: new Set() };

  const stack = [[r, c]];
  const seen = new Set([`${r},${c}`]);
  const stones = [];
  const liberties = new Set();

  while (stack.length) {
    const [rr, cc] = stack.pop();
    stones.push([rr, cc]);
    for (const [nr, nc] of goNeighbors(size, rr, cc)) {
      const value = board[goIndex(size, nr, nc)];
      if (value === GO_EMPTY) {
        liberties.add(`${nr},${nc}`);
      } else if (value === color) {
        const key = `${nr},${nc}`;
        if (!seen.has(key)) {
          seen.add(key);
          stack.push([nr, nc]);
        }
      }
    }
  }
  return { stones, liberties };
}

// Simule un coup sans modifier la partie d'origine.
function goSimulateMove(board, size, player, r, c, koForbiddenHash = null) {
  if (!goInside(size, r, c)) return { legal: false, reason: "Hors du goban." };
  const idx = goIndex(size, r, c);
  if (board[idx] !== GO_EMPTY) return { legal: false, reason: "Cette intersection est déjà occupée." };

  const next = goCloneBoard(board);
  next[idx] = player;
  const opponent = goOther(player);
  let captured = 0;

  // Toute chaîne adverse voisine sans liberté est retirée.
  const checked = new Set();
  for (const [nr, nc] of goNeighbors(size, r, c)) {
    const nidx = goIndex(size, nr, nc);
    if (next[nidx] !== opponent) continue;
    const key = `${nr},${nc}`;
    if (checked.has(key)) continue;
    const group = goGroupInfo(next, size, nr, nc);
    group.stones.forEach(([gr, gc]) => checked.add(`${gr},${gc}`));
    if (group.liberties.size === 0) {
      captured += group.stones.length;
      group.stones.forEach(([gr, gc]) => { next[goIndex(size, gr, gc)] = GO_EMPTY; });
    }
  }

  // Après les captures, notre propre groupe doit conserver au moins une liberté.
  const own = goGroupInfo(next, size, r, c);
  if (own.liberties.size === 0) return { legal: false, reason: "Suicide interdit : cette pierre n'aurait aucune liberté." };

  const hash = goBoardHash(next);
  if (koForbiddenHash !== null && hash === koForbiddenHash) {
    return { legal: false, reason: "Ko : il faut jouer ailleurs avant de reprendre." };
  }

  return {
    legal: true,
    board: next,
    captured,
    liberties: own.liberties.size,
    groupSize: own.stones.length,
    hash
  };
}

function goColumnLabel(index) {
  // Convention courante : la lettre I est omise.
  const letters = "ABCDEFGHJKLMNOPQRST";
  return letters[index] || String(index + 1);
}

function goMoveLabel(size, r, c) {
  return `${goColumnLabel(c)}${size - r}`;
}

function goStarPoints(size) {
  if (size === 19) {
    const p = [3, 9, 15];
    return p.flatMap(r => p.map(c => [r, c]));
  }
  if (size === 13) {
    const p = [3, 6, 9];
    return p.flatMap(r => p.map(c => [r, c]));
  }
  if (size === 9) {
    const p = [2, 4, 6];
    return p.flatMap(r => p.map(c => [r, c]));
  }
  return [];
}

function goIsStarPoint(size, r, c) {
  return goStarPoints(size).some(([rr, cc]) => rr === r && cc === c);
}

class GoGame {
  constructor(size = 19, options = {}) {
    this.size = Number(size) || 19;
    this.komi = Number(options.komi ?? 7.5);
    this.scoring = options.scoring || "area";
    this.reset();
  }

  reset() {
    this.board = Array(this.size * this.size).fill(GO_EMPTY);
    this.turn = GO_BLACK;
    this.captures = { [GO_BLACK]: 0, [GO_WHITE]: 0 };
    this.passes = 0;
    this.over = false;
    this.result = null;
    this.lastMove = null;
    this.moves = [];
    this.history = [];
    this.boardHashes = [goBoardHash(this.board)];
  }

  setOptions({ komi = this.komi, scoring = this.scoring } = {}) {
    this.komi = Number(komi);
    this.scoring = scoring;
  }

  koForbiddenHash() {
    // Le ko simple interdit de recréer la position qui existait juste avant
    // le dernier coup adverse. Une passe duplique le hash et libère donc le ko.
    return this.boardHashes.length >= 2 ? this.boardHashes[this.boardHashes.length - 2] : null;
  }

  analyzeMove(r, c) {
    if (this.over) return { legal: false, reason: "La partie est terminée." };
    return goSimulateMove(this.board, this.size, this.turn, r, c, this.koForbiddenHash());
  }

  isLegal(r, c) {
    return this.analyzeMove(r, c).legal;
  }

  legalMoves() {
    if (this.over) return [];
    const moves = [];
    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        if (this.board[goIndex(this.size, r, c)] !== GO_EMPTY) continue;
        const info = this.analyzeMove(r, c);
        if (info.legal) moves.push({ r, c, ...info });
      }
    }
    return moves;
  }

  saveSnapshot() {
    this.history.push({
      board: goCloneBoard(this.board),
      turn: this.turn,
      captures: { ...this.captures },
      passes: this.passes,
      over: this.over,
      result: this.result ? { ...this.result } : null,
      lastMove: this.lastMove ? { ...this.lastMove } : null,
      moves: this.moves.map(m => ({ ...m })),
      boardHashes: this.boardHashes.slice()
    });
  }

  play(r, c) {
    const info = this.analyzeMove(r, c);
    if (!info.legal) return info;

    this.saveSnapshot();
    const player = this.turn;
    this.board = info.board;
    this.captures[player] += info.captured;
    this.passes = 0;
    this.lastMove = { type: "move", player, r, c };
    this.moves.push({ type: "move", player, r, c, captured: info.captured, label: goMoveLabel(this.size, r, c) });
    this.boardHashes.push(info.hash);
    this.turn = goOther(player);
    return { ...info, player };
  }

  pass() {
    if (this.over) return false;
    this.saveSnapshot();
    const player = this.turn;
    this.passes += 1;
    this.lastMove = { type: "pass", player };
    this.moves.push({ type: "pass", player, label: "Passe" });
    // Une passe ne change pas le plateau, mais compte bien comme un coup.
    this.boardHashes.push(goBoardHash(this.board));
    this.turn = goOther(player);
    if (this.passes >= 2) {
      this.over = true;
      this.result = this.score();
    }
    return true;
  }

  resign(player = this.turn) {
    if (this.over) return false;
    this.saveSnapshot();
    this.over = true;
    this.lastMove = { type: "resign", player };
    this.moves.push({ type: "resign", player, label: "Abandon" });
    this.result = { type: "resign", winner: goOther(player), loser: player };
    return true;
  }

  undo() {
    const snapshot = this.history.pop();
    if (!snapshot) return false;
    this.board = snapshot.board;
    this.turn = snapshot.turn;
    this.captures = snapshot.captures;
    this.passes = snapshot.passes;
    this.over = snapshot.over;
    this.result = snapshot.result;
    this.lastMove = snapshot.lastMove;
    this.moves = snapshot.moves;
    this.boardHashes = snapshot.boardHashes;
    return true;
  }

  stoneCounts() {
    let black = 0, white = 0;
    for (const v of this.board) {
      if (v === GO_BLACK) black++;
      else if (v === GO_WHITE) white++;
    }
    return { [GO_BLACK]: black, [GO_WHITE]: white };
  }

  territory() {
    const visited = new Set();
    const territory = { [GO_BLACK]: 0, [GO_WHITE]: 0, neutral: 0 };

    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        const start = goIndex(this.size, r, c);
        if (this.board[start] !== GO_EMPTY || visited.has(start)) continue;

        const stack = [[r, c]];
        const region = [];
        const borders = new Set();
        visited.add(start);

        while (stack.length) {
          const [rr, cc] = stack.pop();
          region.push([rr, cc]);
          for (const [nr, nc] of goNeighbors(this.size, rr, cc)) {
            const idx = goIndex(this.size, nr, nc);
            const value = this.board[idx];
            if (value === GO_EMPTY) {
              if (!visited.has(idx)) {
                visited.add(idx);
                stack.push([nr, nc]);
              }
            } else {
              borders.add(value);
            }
          }
        }

        if (borders.size === 1) territory[[...borders][0]] += region.length;
        else territory.neutral += region.length;
      }
    }
    return territory;
  }

  score() {
    const territory = this.territory();
    const stones = this.stoneCounts();
    let black, white;

    if (this.scoring === "territory") {
      black = territory[GO_BLACK] + this.captures[GO_BLACK];
      white = territory[GO_WHITE] + this.captures[GO_WHITE] + this.komi;
    } else {
      black = territory[GO_BLACK] + stones[GO_BLACK];
      white = territory[GO_WHITE] + stones[GO_WHITE] + this.komi;
    }

    const winner = black > white ? GO_BLACK : white > black ? GO_WHITE : 0;
    return {
      type: "score",
      scoring: this.scoring,
      komi: this.komi,
      territory,
      stones,
      black,
      white,
      winner,
      margin: Math.abs(black - white)
    };
  }
}

// ------------------------------------------------------------
// IA légère : elle n'a pas vocation à remplacer KataGo.
// ------------------------------------------------------------
function goMoveHeuristic(board, size, player, r, c, koHash = null) {
  const sim = goSimulateMove(board, size, player, r, c, koHash);
  if (!sim.legal) return -Infinity;

  let score = sim.captured * 13;
  score += Math.min(sim.liberties, 8) * 0.75;
  score += Math.min(sim.groupSize, 8) * 0.15;

  // Préférence modérée pour les 3e/4e lignes et les points hoshi.
  const edge = Math.min(r, c, size - 1 - r, size - 1 - c);
  if (edge === 0) score -= 1.3;
  else if (edge === 1) score += 0.2;
  else if (edge === 2) score += 1.6;
  else if (edge === 3) score += 1.9;
  else score += 0.5;
  if (goIsStarPoint(size, r, c)) score += 1.2;

  let friendly = 0, enemy = 0, empty = 0;
  for (const [nr, nc] of goNeighbors(size, r, c)) {
    const v = board[goIndex(size, nr, nc)];
    if (v === player) friendly++;
    else if (v === goOther(player)) enemy++;
    else empty++;
  }
  score += friendly * 0.55 + enemy * 0.85 + empty * 0.12;

  // Evite les auto-atari et le remplissage évident d'un œil propre.
  if (sim.liberties === 1 && sim.captured === 0) score -= 8;
  const neighbors = goNeighbors(size, r, c);
  const looksLikeOwnEye = neighbors.length > 1 && neighbors.every(([nr, nc]) => board[goIndex(size, nr, nc)] === player);
  if (looksLikeOwnEye && sim.captured === 0) score -= 10;

  return score;
}

function goChooseAiMove(game, level = "medium") {
  const legal = game.legalMoves();
  if (!legal.length) return { type: "pass" };

  if (level === "easy") {
    const pick = legal[Math.floor(Math.random() * legal.length)];
    return { type: "move", r: pick.r, c: pick.c };
  }

  const player = game.turn;
  const koHash = game.koForbiddenHash();
  const ranked = legal.map(move => ({
    r: move.r,
    c: move.c,
    score: goMoveHeuristic(game.board, game.size, player, move.r, move.c, koHash) + Math.random() * 0.18
  })).sort((a, b) => b.score - a.score);

  if (level === "medium") {
    const best = ranked[0];
    if (game.lastMove?.type === "pass" && best.score < 1.4) return { type: "pass" };
    return { type: "move", r: best.r, c: best.c };
  }

  // Niveau difficile : on examine les meilleures réponses adverses
  // sur un petit ensemble de candidats. C'est volontairement léger
  // pour rester fluide même sur un goban 19×19 dans un navigateur.
  const top = ranked.slice(0, game.size === 19 ? 14 : 20);
  let bestMove = top[0];
  let bestNet = -Infinity;

  for (const candidate of top) {
    const first = goSimulateMove(game.board, game.size, player, candidate.r, candidate.c, koHash);
    if (!first.legal) continue;
    const opponent = goOther(player);
    let replyBest = -Infinity;

    // On ne recherche les réponses qu'autour des pierres et sur les bons points,
    // mais on garde une recherche complète sur les petits gobans.
    let replyCount = 0;
    for (let r = 0; r < game.size; r++) {
      for (let c = 0; c < game.size; c++) {
        if (first.board[goIndex(game.size, r, c)] !== GO_EMPTY) continue;
        const h = goMoveHeuristic(first.board, game.size, opponent, r, c, goBoardHash(game.board));
        if (h === -Infinity) continue;
        replyBest = Math.max(replyBest, h);
        replyCount++;
      }
    }
    if (!replyCount) replyBest = 0;

    const net = candidate.score - replyBest * 0.62;
    if (net > bestNet) {
      bestNet = net;
      bestMove = candidate;
    }
  }

  if (game.lastMove?.type === "pass" && bestMove.score < 1.7) return { type: "pass" };
  return { type: "move", r: bestMove.r, c: bestMove.c };
}

// ------------------------------------------------------------
// Interface utilisateur
// ------------------------------------------------------------
const GO_RATING_LABELS={bullet:"Bullet",blitz:"Blitz",rapid:"Rapide",classical:"Classique"};
function goEmptyOnlineState(){
  return {ws:null,code:null,connected:false,side:null,players:{black:null,white:null},result:null,clock:null,settings:null,ratings:null,ratingUpdate:null,drawOffer:null,rematchOffer:null,pendingProposal:null,clockTimer:null,syncTimer:null,reconnectTimer:null};
}
function goOnlineHasTwoPlayers(){ return Boolean(goUi?.online?.players?.black&&goUi?.online?.players?.white); }
function goDisconnectOnline(){
  if(!goUi?.online) return;
  try{goUi.online.ws?.close();}catch{}
  if(goUi.online.clockTimer) clearInterval(goUi.online.clockTimer);
  if(goUi.online.syncTimer) clearInterval(goUi.online.syncTimer);
  if(goUi.online.reconnectTimer) clearTimeout(goUi.online.reconnectTimer);
  goUi.online=goEmptyOnlineState();
  goHideOnlinePrompt();
  goUpdateClockDisplay();
}
let goUi = null;

function initGo() {
  const sizeEl=document.getElementById("goSize"); if(!sizeEl) return;
  goUi={game:null,mode:document.getElementById("goMode").value,aiLevel:document.getElementById("goAiLevel").value,humanSide:Number(document.getElementById("goSide").value),thinking:false,online:goEmptyOnlineState()};
  document.getElementById("goMode").addEventListener("change",e=>{
    if(goUi.mode==="online") goDisconnectOnline();
    goUi.mode=e.target.value;
    document.getElementById("goAiSettings").hidden=goUi.mode!=="ai";
    document.getElementById("goOnlineSettings").hidden=goUi.mode!=="online";
    if(goUi.mode==="online") goRefreshOnlineLoginStatus();
    newGoGame();
  });
  document.getElementById("goAiLevel").addEventListener("change",e=>{goUi.aiLevel=e.target.value;});
  document.getElementById("goSide").addEventListener("change",e=>{goUi.humanSide=Number(e.target.value); if(goUi.mode!=="online") newGoGame();});
  document.getElementById("goSize").addEventListener("change",()=>{if(goUi.mode!=="online")newGoGame();});
  document.getElementById("goKomi").addEventListener("change",()=>{if(goUi.game&&goUi.mode!=="online"){goUi.game.setOptions({komi:Number(document.getElementById("goKomi").value)});renderGoBoard();}});
  document.getElementById("goScoring").addEventListener("change",()=>{if(goUi.game&&goUi.mode!=="online"){goUi.game.setOptions({scoring:document.getElementById("goScoring").value});renderGoBoard();}});
  document.getElementById("newGo").addEventListener("click",newGoGame);
  document.getElementById("undoGo").addEventListener("click",undoGoMove);
  document.getElementById("passGo").addEventListener("click",()=>playGoPass(false));
  document.getElementById("resignGo").addEventListener("click",()=>{
    if(!goUi||goUi.thinking) return;
    if(goUi.mode==="online"){goResignOnline();return;}
    if(goUi.game.over) return;
    if(goUi.mode==="ai"&&goUi.game.turn!==goUi.humanSide) return;
    goUi.game.resign();renderGoBoard();
  });
  document.getElementById("goTimePreset")?.addEventListener("change",e=>{document.getElementById("goCustomTime").hidden=e.target.value!=="custom";});
  document.getElementById("createGoRoom")?.addEventListener("click",goCreateOnlineRoom);
  document.getElementById("joinGoRoom")?.addEventListener("click",goJoinOnlineRoom);
  document.getElementById("offerDrawGo")?.addEventListener("click",()=>goSendOnlineAction("draw_offer"));
  document.getElementById("offerRematchGo")?.addEventListener("click",()=>goSendOnlineAction("rematch_offer"));
  document.getElementById("acceptGoProposal")?.addEventListener("click",()=>goRespondToOnlineProposal(true));
  document.getElementById("declineGoProposal")?.addEventListener("click",()=>goRespondToOnlineProposal(false));
  newGoGame();
}

function newGoGame() {
  if (!goUi) return;
  const size = Number(document.getElementById("goSize").value);
  const komi = Number(document.getElementById("goKomi").value);
  const scoring = document.getElementById("goScoring").value;
  goUi.mode = document.getElementById("goMode").value;
  goUi.aiLevel = document.getElementById("goAiLevel").value;
  goUi.humanSide = Number(document.getElementById("goSide").value);
  goUi.thinking = false;
  goUi.game = new GoGame(size, { komi, scoring });
  renderGoBoard();
  maybeGoAiTurn();
}

function renderGoBoard() {
  if (!goUi?.game) return;
  const game = goUi.game;
  const boardEl = document.getElementById("goBoard");
  if (!boardEl) return;

  boardEl.style.setProperty("--go-size", game.size);
  boardEl.setAttribute("aria-label", `Goban ${game.size} par ${game.size}`);

  const humanCanPlay = !game.over && !goUi.thinking && (goUi.mode === "local" || (goUi.mode === "ai" && game.turn === goUi.humanSide) || (goUi.mode === "online" && goUi.online.connected && goOnlineHasTwoPlayers() && Number(game.turn)===Number(goUi.online.side)));
  const html = [];
  for (let r = 0; r < game.size; r++) {
    for (let c = 0; c < game.size; c++) {
      const value = game.board[goIndex(game.size, r, c)];
      const legal = value === GO_EMPTY && humanCanPlay && game.isLegal(r, c);
      const last = game.lastMove?.type === "move" && game.lastMove.r === r && game.lastMove.c === c;
      const edgeClasses = [r === 0 ? "edge-top" : "", r === game.size - 1 ? "edge-bottom" : "", c === 0 ? "edge-left" : "", c === game.size - 1 ? "edge-right" : ""].filter(Boolean).join(" ");
      const star = goIsStarPoint(game.size, r, c);
      const stone = value ? `<span class="go-stone ${value === GO_BLACK ? "black" : "white"}">${last ? `<span class="go-last-dot"></span>` : ""}</span>` : "";
      const ghost = legal ? `<span class="go-ghost ${game.turn === GO_BLACK ? "black" : "white"}"></span>` : "";
      const coord = `${goMoveLabel(game.size, r, c)}`;
      html.push(`<button class="go-point ${edgeClasses} ${legal ? "playable" : ""}" data-r="${r}" data-c="${c}" ${legal ? "" : "disabled"} aria-label="${coord}${value === GO_BLACK ? ", pierre noire" : value === GO_WHITE ? ", pierre blanche" : ""}">${star && !value ? `<span class="go-star"></span>` : ""}${ghost}${stone}</button>`);
    }
  }
  boardEl.innerHTML = html.join("");
  boardEl.querySelectorAll(".go-point.playable").forEach(btn => btn.addEventListener("click", onGoPointClick));
  renderGoInfo();
}

function renderGoInfo() {
  const game = goUi.game;
  const statusEl = document.getElementById("goStatus");
  const turnEl = document.getElementById("goTurn");
  const historyEl = document.getElementById("goHistory");
  if (!statusEl || !turnEl || !historyEl) return;

  turnEl.textContent = game.turn === GO_BLACK ? "Noir" : "Blanc";
  document.getElementById("goCaptBlack").textContent = game.captures[GO_BLACK];
  document.getElementById("goCaptWhite").textContent = game.captures[GO_WHITE];

  const live = game.score();
  document.getElementById("goScoreBlack").textContent = live.black.toFixed(1).replace(".0", "");
  document.getElementById("goScoreWhite").textContent = live.white.toFixed(1).replace(".0", "");

  if (goUi.mode === "online" && goUi.online.connected && !goOnlineHasTwoPlayers()) {
    statusEl.textContent = "Salon créé. En attente du deuxième joueur…";
  } else if (goUi.thinking) {
    statusEl.textContent = "L’IA réfléchit…";
  } else if (game.over) {
    if (game.result?.text) {
      statusEl.textContent = game.result.text;
    } else if (game.result?.type === "resign") {
      statusEl.textContent = `${game.result.winner === GO_BLACK ? "Noir" : "Blanc"} gagne par abandon.`;
    } else {
      const result = game.result || game.score();
      if (!result.winner) statusEl.textContent = `Partie terminée : égalité ${result.black} – ${result.white}.`;
      else statusEl.textContent = `Partie terminée : ${result.winner === GO_BLACK ? "Noir" : "Blanc"} gagne de ${result.margin.toFixed(1).replace(".0", "")} point${result.margin > 1 ? "s" : ""} (${result.black.toFixed(1).replace(".0", "")} – ${result.white.toFixed(1).replace(".0", "")}).`;
    }
  } else if (game.lastMove?.type === "pass") {
    statusEl.textContent = `${game.lastMove.player === GO_BLACK ? "Noir" : "Blanc"} a passé. Une seconde passe consécutive termine la partie.`;
  } else {
    statusEl.textContent = `${game.turn === GO_BLACK ? "Noir" : "Blanc"} joue.${game.lastMove?.type === "move" ? ` Dernier coup : ${goMoveLabel(game.size, game.lastMove.r, game.lastMove.c)}.` : ""}`;
  }

  const rows = [];
  for (let i = 0; i < game.moves.length; i += 2) {
    const black = game.moves[i];
    const white = game.moves[i + 1];
    const format = m => !m ? "" : `${m.label}${m.captured ? ` ×${m.captured}` : ""}`;
    rows.push(`<div class="go-history-row"><span>${Math.floor(i / 2) + 1}.</span><span>${format(black)}</span><span>${format(white)}</span></div>`);
  }
  historyEl.innerHTML = rows.length ? rows.join("") : `<div class="history-empty">Les coups apparaîtront ici.</div>`;
  historyEl.scrollTop = historyEl.scrollHeight;

  const disabled = game.over || goUi.thinking || (goUi.mode === "ai" && game.turn !== goUi.humanSide) || (goUi.mode === "online" && (!goUi.online.connected || !goOnlineHasTwoPlayers() || Number(game.turn)!==Number(goUi.online.side)));
  document.getElementById("passGo").disabled = disabled;
  document.getElementById("resignGo").disabled = game.over || (goUi.mode === "online" && !goOnlineHasTwoPlayers());
  document.getElementById("undoGo").disabled = goUi.mode === "online" || goUi.thinking || !game.history.length;
  document.getElementById("newGo").disabled = goUi.mode === "online";
  goUpdateClockDisplay();goUpdateOnlineControls();goUpdateRatingResult();
}

function onGoPointClick(event) {
  if (!goUi || goUi.thinking || goUi.game.over) return;
  if (goUi.mode === "ai" && goUi.game.turn !== goUi.humanSide) return;
  const r = Number(event.currentTarget.dataset.r);
  const c = Number(event.currentTarget.dataset.c);
  if(goUi.mode==="online"){
    if(!goUi.online.ws||goUi.online.ws.readyState!==WebSocket.OPEN||Number(goUi.game.turn)!==Number(goUi.online.side)) return;
    goUi.online.ws.send(JSON.stringify({type:"move",move:{r,c}}));
    return;
  }
  const result = goUi.game.play(r, c);
  if (!result.legal) {
    document.getElementById("goStatus").textContent = result.reason;
    return;
  }
  renderGoBoard();
  maybeGoAiTurn();
}

function playGoPass(fromAi = false) {
  if (!goUi || goUi.thinking && !fromAi || goUi.game.over) return;
  if (!fromAi && goUi.mode === "ai" && goUi.game.turn !== goUi.humanSide) return;
  if(!fromAi && goUi.mode==="online"){
    if(!goUi.online.ws||goUi.online.ws.readyState!==WebSocket.OPEN||Number(goUi.game.turn)!==Number(goUi.online.side)) return;
    goUi.online.ws.send(JSON.stringify({type:"pass"})); return;
  }
  goUi.game.pass();
  renderGoBoard();
  if (!goUi.game.over) maybeGoAiTurn();
}

function undoGoMove() {
  if (!goUi || goUi.thinking || goUi.mode==="online") return;
  const game = goUi.game;
  if (!game.history.length) return;

  if (goUi.mode === "ai") {
    game.undo();
    if (game.turn !== goUi.humanSide && game.history.length) game.undo();
  } else {
    game.undo();
  }
  renderGoBoard();
}

function maybeGoAiTurn() {
  if (!goUi || goUi.mode !== "ai" || goUi.game.over || goUi.game.turn === goUi.humanSide) return;
  goUi.thinking = true;
  renderGoInfo();

  window.setTimeout(() => {
    const action = goChooseAiMove(goUi.game, goUi.aiLevel);
    if (action.type === "pass") goUi.game.pass();
    else goUi.game.play(action.r, action.c);
    goUi.thinking = false;
    renderGoBoard();
    // Deux passes terminent la partie ; aucun enchaînement supplémentaire n'est nécessaire.
  }, 120);
}

// ------------------------------------------------------------
// GO multijoueur en ligne
// ------------------------------------------------------------
function goTimeControlFromUi(){
  const preset=document.getElementById("goTimePreset")?.value||"10+5";
  if(preset!=="custom"){
    const [m,s]=preset.split("+").map(Number); return {initialSeconds:m*60,incrementSeconds:s||0};
  }
  const m=Math.min(180,Math.max(1,Number(document.getElementById("goInitialMinutes")?.value||10)));
  const inc=Math.min(60,Math.max(0,Number(document.getElementById("goIncrementSeconds")?.value||5)));
  return {initialSeconds:Math.round(m*60),incrementSeconds:Math.round(inc)};
}
function goSetRoomStatus(text,error=false){ const el=document.getElementById("goRoomStatus"); if(el){el.textContent=text;el.classList.toggle("error",Boolean(error));} }
async function goRefreshOnlineLoginStatus(){
  if(!window.LudoOnline){goSetRoomStatus("Service en ligne indisponible.",true);return null;}
  try{const user=await LudoOnline.me(true);if(!user){goSetRoomStatus("Connectez-vous dans Compte pour jouer en ligne.",true);return null;} if(!goUi.online.connected)goSetRoomStatus(`Connecté : ${user.username}. Créez ou rejoignez un salon.`);return user;}catch(e){goSetRoomStatus(e.message,true);return null;}
}
async function goCreateOnlineRoom(){
  const user=await goRefreshOnlineLoginStatus();if(!user)return;
  try{
    const tc=goTimeControlFromUi(),creatorColor=document.getElementById("goCreatorColor")?.value||"random";
    const data=await LudoOnline.rooms.create("go",{creatorColor,initialSeconds:tc.initialSeconds,incrementSeconds:tc.incrementSeconds,rated:document.getElementById("goRated")?.checked!==false,goSize:Number(document.getElementById("goSize")?.value||19),goKomi:Number(document.getElementById("goKomi")?.value||7.5),goScoring:document.getElementById("goScoring")?.value||"area"});
    goUi.online.code=data.code;goUi.online.side=Number(data.side);document.getElementById("goRoomCode").value=data.code;goConnectOnline(data.code);
  }catch(e){goSetRoomStatus(e.message,true);}
}
async function goJoinOnlineRoom(){
  const user=await goRefreshOnlineLoginStatus();if(!user)return;
  const code=(document.getElementById("goRoomCode")?.value||"").trim().toUpperCase();
  if(!code){goSetRoomStatus("Saisissez le code du salon.",true);return;}
  try{
    const info=await LudoOnline.rooms.info(code);if(info.room?.game!=="go")throw new Error("Ce salon n’est pas une partie de Go.");
    const data=await LudoOnline.rooms.join(code);goUi.online.code=data.code;goUi.online.side=Number(data.side);goConnectOnline(data.code);
  }catch(e){goSetRoomStatus(e.message,true);}
}
function goConnectOnline(code){
  if(!window.LudoOnline||!goUi)return;
  if(goUi.online.syncTimer) clearInterval(goUi.online.syncTimer);
  if(goUi.online.reconnectTimer) clearTimeout(goUi.online.reconnectTimer);
  try{goUi.online.ws?.close();}catch{}
  goUi.online.code=code;
  const ws=LudoOnline.rooms.connect(code,{
    open(){
      if(!goUi||goUi.mode!=="online"||goUi.online.code!==code||goUi.online.ws!==ws) return;
      goUi.online.connected=true;
      goSetRoomStatus(`Connecté au salon ${code}.`);
      goUpdateOnlineControls();
      goUpdateClockDisplay();
      try{ws.send(JSON.stringify({type:"sync"}));}catch{}
      if(goUi.online.syncTimer) clearInterval(goUi.online.syncTimer);
      goUi.online.syncTimer=setInterval(()=>{
        if(goUi?.mode==="online"&&goUi.online.code===code&&ws.readyState===WebSocket.OPEN){
          try{ws.send(JSON.stringify({type:"sync"}));}catch{}
        }
      },5000);
    },
    message(data){if(goUi?.online?.ws===ws) goHandleOnlineMessage(data);},
    close(){
      if(!goUi||goUi.mode!=="online"||goUi.online.code!==code||goUi.online.ws!==ws) return;
      goUi.online.connected=false;
      if(goUi.online.syncTimer){clearInterval(goUi.online.syncTimer);goUi.online.syncTimer=null;}
      goSetRoomStatus("Connexion momentanément interrompue. Reconnexion…",true);
      goUpdateOnlineControls();
      goUpdateClockDisplay();
      if(goUi.online.reconnectTimer) clearTimeout(goUi.online.reconnectTimer);
      goUi.online.reconnectTimer=setTimeout(()=>{
        if(goUi?.mode==="online"&&goUi.online.code===code&&!goUi.online.connected) goConnectOnline(code);
      },1500);
    },
    error(){
      if(goUi?.mode==="online"&&goUi.online.code===code&&goUi.online.ws===ws) goSetRoomStatus("Connexion instable. Nouvelle tentative…",true);
    }
  });
  goUi.online.ws=ws;
  if(goUi.online.clockTimer)clearInterval(goUi.online.clockTimer);
  goUi.online.clockTimer=setInterval(goUpdateClockDisplay,250);
}
function goApplyServerGame(serverGame){
  if(!serverGame)return;const g=new GoGame(Number(serverGame.size||19),{komi:Number(serverGame.komi??7.5),scoring:serverGame.scoring||"area"});
  Object.assign(g,serverGame);g.board=(serverGame.board||[]).slice();g.captures={...serverGame.captures};g.moves=[...(serverGame.moves||[])];g.history=[...(serverGame.history||[])];g.boardHashes=[...(serverGame.boardHashes||[])];g.over=Boolean(serverGame.result?.over);goUi.game=g;goUi.online.result=serverGame.result||null;
  document.getElementById("goSize").value=String(g.size);document.getElementById("goKomi").value=String(g.komi);document.getElementById("goScoring").value=g.scoring;renderGoBoard();goUpdateOnlineControls();goUpdateRatingResult();
}
function goSetOnlineClock(clock){goUi.online.clock=clock?{...clock,clientReceivedAt:Date.now()}:null;}
function goHandleOnlineMessage(data){
  if(!goUi||goUi.mode!=="online")return;
  if(data.type==="welcome"){
    goUi.online.connected=true;goUi.online.side=Number(data.side);goUi.online.players=data.players||{black:null,white:null};goUi.online.settings=data.settings||null;goUi.online.ratings=data.ratings||null;goUi.online.ratingUpdate=data.ratingUpdate||null;goUi.online.drawOffer=data.drawOffer||null;goUi.online.rematchOffer=data.rematchOffer||null;goSetOnlineClock(data.clock||null);goApplyServerGame(data.game);goSetRoomStatus(`Salon ${goUi.online.code||""} connecté.`);goMaybeShowIncomingProposal();return;
  }
  if(data.type==="state"){
    if(data.players)goUi.online.players=data.players;if(data.settings)goUi.online.settings=data.settings;if(data.ratings)goUi.online.ratings=data.ratings;if(data.ratingUpdate!==undefined)goUi.online.ratingUpdate=data.ratingUpdate;if(data.clock)goSetOnlineClock(data.clock);goApplyServerGame(data.game);return;
  }
  if(data.type==="players"){goUi.online.players=data.players||goUi.online.players;if(data.clock)goSetOnlineClock(data.clock);if(data.settings)goUi.online.settings=data.settings;if(data.ratings)goUi.online.ratings=data.ratings;renderGoBoard();return;}
  if(data.type==="clock"){goSetOnlineClock(data.clock||null);goUpdateClockDisplay();return;}
  if(data.type==="draw_offer"){goUi.online.drawOffer=data.offer||null;if(Number(data.offer?.side)!==Number(goUi.online.side))goShowOnlinePrompt("draw",`${data.offer?.username||"Votre adversaire"} propose la partie nulle.`);return;}
  if(data.type==="draw_declined"){goUi.online.drawOffer=null;goHideOnlinePrompt();goSetRoomStatus("La proposition de nulle a été refusée.");return;}
  if(data.type==="rematch_offer"){goUi.online.rematchOffer=data.offer||null;if(Number(data.offer?.side)!==Number(goUi.online.side))goShowOnlinePrompt("rematch",`${data.offer?.username||"Votre adversaire"} propose une revanche avec inversion des couleurs.`);return;}
  if(data.type==="rematch_declined"){goUi.online.rematchOffer=null;goHideOnlinePrompt();goSetRoomStatus("La revanche a été refusée.");return;}
  if(data.type==="rematch_started"){goUi.online.side=Number(data.side);goUi.online.players=data.players||goUi.online.players;goUi.online.settings=data.settings||goUi.online.settings;goUi.online.ratings=data.ratings||null;goUi.online.ratingUpdate=null;goUi.online.drawOffer=null;goUi.online.rematchOffer=null;goSetOnlineClock(data.clock||null);goApplyServerGame(data.game);goHideOnlinePrompt();goSetRoomStatus("Revanche commencée : couleurs inversées.");return;}
  if(data.type==="error"){goSetRoomStatus(data.message||"Erreur de partie.",true);}
}
function goMaybeShowIncomingProposal(){const d=goUi.online.drawOffer,r=goUi.online.rematchOffer;if(d&&Number(d.side)!==Number(goUi.online.side))goShowOnlinePrompt("draw",`${d.username||"Votre adversaire"} propose la partie nulle.`);else if(r&&Number(r.side)!==Number(goUi.online.side))goShowOnlinePrompt("rematch",`${r.username||"Votre adversaire"} propose une revanche.`);}
function goShowOnlinePrompt(type,text){const box=document.getElementById("goOnlinePrompt");if(!box)return;goUi.online.pendingProposal=type;document.getElementById("goOnlinePromptTitle").textContent=type==="draw"?"Proposition de nulle":"Proposition de revanche";document.getElementById("goOnlinePromptText").textContent=text;box.hidden=false;}
function goHideOnlinePrompt(){if(goUi?.online)goUi.online.pendingProposal=null;const box=document.getElementById("goOnlinePrompt");if(box)box.hidden=true;}
function goRespondToOnlineProposal(accept){const type=goUi?.online?.pendingProposal;if(!type||!goUi.online.ws||goUi.online.ws.readyState!==WebSocket.OPEN)return;goUi.online.ws.send(JSON.stringify({type:type==="draw"?"draw_response":"rematch_response",accept:Boolean(accept)}));goHideOnlinePrompt();}
function goSendOnlineAction(type){if(goUi?.online?.ws?.readyState===WebSocket.OPEN)goUi.online.ws.send(JSON.stringify({type}));}
function goResignOnline(){if(!goUi?.online?.result?.over&&confirm("Voulez-vous vraiment abandonner cette partie ?"))goSendOnlineAction("resign");}
function goUpdateOnlineControls(){const box=document.getElementById("goOnlineActions");if(!box||!goUi)return;const online=goUi.mode==="online"&&goUi.online.connected;box.hidden=!online;for(const id of ["goSize","goKomi","goScoring"]){const el=document.getElementById(id);if(el)el.disabled=online;}if(!online)return;const over=Boolean(goUi.online.result?.over),two=goOnlineHasTwoPlayers();const draw=document.getElementById("offerDrawGo"),rematch=document.getElementById("offerRematchGo");if(draw)draw.disabled=!two||over||Boolean(goUi.online.drawOffer);if(rematch){rematch.hidden=!over;rematch.disabled=!two||Boolean(goUi.online.rematchOffer);}}
function goOnlineClockValues(){const c=goUi?.online?.clock;if(!c)return null;let blackMs=Number(c.blackMs||0),whiteMs=Number(c.whiteMs||0);if(c.started&&c.runningSide&&!goUi.online.result?.over){const e=Math.max(0,Date.now()-Number(c.clientReceivedAt||Date.now()));if(Number(c.runningSide)===GO_BLACK)blackMs=Math.max(0,blackMs-e);else whiteMs=Math.max(0,whiteMs-e);}return{blackMs,whiteMs,runningSide:c.runningSide,started:c.started};}
function goFormatClock(ms){let t=Math.max(0,Math.ceil(Number(ms||0)/1000)),m=Math.floor(t/60),s=t%60;return `${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;}
function goUpdateClockDisplay(){
  const panel=document.getElementById("goClockPanel");
  if(!panel||!goUi)return;
  const online=goUi.mode==="online"?goUi.online:null;
  const hasClock=Boolean(online?.clock);
  // En cas de micro-coupure WebSocket, on garde les dernières pendules visibles.
  panel.hidden=!(online&&hasClock);
  document.querySelector(".go-shell")?.classList.toggle("go-online-clock-layout",Boolean(online&&hasClock));
  if(!online||!hasClock)return;
  const v=goOnlineClockValues()||{blackMs:0,whiteMs:0,runningSide:null,started:false};
  const p=online.players||{},r=online.ratings||{};
  const readout=document.getElementById("goClockReadout");
  if(readout)readout.innerHTML=`
    <div class="go-clock-card black ${v.started&&Number(v.runningSide)===GO_BLACK&&!online.result?.over?"active":""}">
      <div class="go-clock-player"><span class="go-clock-dot black" aria-hidden="true"></span><span>Noirs · ${p.black?.username||"En attente"}</span><small>Elo ${r.black?.rating??1200}</small></div>
      <strong>${goFormatClock(v.blackMs)}</strong>
    </div>
    <div class="go-clock-card white ${v.started&&Number(v.runningSide)===GO_WHITE&&!online.result?.over?"active":""}">
      <div class="go-clock-player"><span class="go-clock-dot white" aria-hidden="true"></span><span>Blancs · ${p.white?.username||"En attente"}</span><small>Elo ${r.white?.rating??1200}</small></div>
      <strong>${goFormatClock(v.whiteMs)}</strong>
    </div>`;
  const tc=online.settings?.timeControl,meta=document.getElementById("goTimeMeta");
  if(meta&&tc){meta.textContent=`${Number(tc.initialSeconds)/60}+${Number(tc.incrementSeconds||0)} · ${GO_RATING_LABELS[online.settings?.ratingCategory||"rapid"]} · ${online.settings?.rated?"classée Elo":"amicale"}`;}
}
function goUpdateRatingResult(){const box=document.getElementById("goRatingResult");if(!box)return;const u=goUi?.online?.ratingUpdate;if(goUi.mode!=="online"||!u?.rated){box.hidden=true;return;}const mine=Number(goUi.online.side)===GO_BLACK?u.black:u.white,other=Number(goUi.online.side)===GO_BLACK?u.white:u.black;box.hidden=false;box.innerHTML=`<strong>Elo ${GO_RATING_LABELS[u.category]||u.category}</strong><span>Vous : ${mine?.before} → ${mine?.after} (${Number(mine?.delta)>=0?"+":""}${mine?.delta})</span><span>${other?.username||"Adversaire"} : ${other?.before} → ${other?.after} (${Number(other?.delta)>=0?"+":""}${other?.delta})</span>`;}
