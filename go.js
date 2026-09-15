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
let goUi = null;

function initGo() {
  const sizeEl = document.getElementById("goSize");
  if (!sizeEl) return;

  goUi = {
    game: null,
    mode: document.getElementById("goMode").value,
    aiLevel: document.getElementById("goAiLevel").value,
    humanSide: Number(document.getElementById("goSide").value),
    thinking: false
  };

  document.getElementById("goMode").addEventListener("change", e => {
    goUi.mode = e.target.value;
    document.getElementById("goAiSettings").hidden = goUi.mode !== "ai";
    newGoGame();
  });
  document.getElementById("goAiLevel").addEventListener("change", e => { goUi.aiLevel = e.target.value; });
  document.getElementById("goSide").addEventListener("change", e => { goUi.humanSide = Number(e.target.value); newGoGame(); });
  document.getElementById("goSize").addEventListener("change", newGoGame);
  document.getElementById("goKomi").addEventListener("change", () => {
    if (goUi.game) { goUi.game.setOptions({ komi: Number(document.getElementById("goKomi").value) }); renderGoBoard(); }
  });
  document.getElementById("goScoring").addEventListener("change", () => {
    if (goUi.game) { goUi.game.setOptions({ scoring: document.getElementById("goScoring").value }); renderGoBoard(); }
  });
  document.getElementById("newGo").addEventListener("click", newGoGame);
  document.getElementById("undoGo").addEventListener("click", undoGoMove);
  document.getElementById("passGo").addEventListener("click", () => playGoPass(false));
  document.getElementById("resignGo").addEventListener("click", () => {
    if (!goUi || goUi.thinking || goUi.game.over) return;
    if (goUi.mode === "ai" && goUi.game.turn !== goUi.humanSide) return;
    goUi.game.resign();
    renderGoBoard();
  });

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

  const humanCanPlay = !game.over && !goUi.thinking && (goUi.mode === "local" || game.turn === goUi.humanSide);
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

  if (goUi.thinking) {
    statusEl.textContent = "L’IA réfléchit…";
  } else if (game.over) {
    if (game.result?.type === "resign") {
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

  const disabled = game.over || goUi.thinking || (goUi.mode === "ai" && game.turn !== goUi.humanSide);
  document.getElementById("passGo").disabled = disabled;
  document.getElementById("resignGo").disabled = disabled;
  document.getElementById("undoGo").disabled = goUi.thinking || !game.history.length;
}

function onGoPointClick(event) {
  if (!goUi || goUi.thinking || goUi.game.over) return;
  if (goUi.mode === "ai" && goUi.game.turn !== goUi.humanSide) return;
  const r = Number(event.currentTarget.dataset.r);
  const c = Number(event.currentTarget.dataset.c);
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
  goUi.game.pass();
  renderGoBoard();
  if (!goUi.game.over) maybeGoAiTurn();
}

function undoGoMove() {
  if (!goUi || goUi.thinking) return;
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
