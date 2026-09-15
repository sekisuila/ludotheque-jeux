// ============================================================
// DAMES — moteur générique pour deux variantes
//   • Dames françaises / internationales : 10 × 10
//   • Dames anglaises (English draughts / checkers) : 8 × 8
// ============================================================
// Le moteur reste en JavaScript pur afin que le site fonctionne
// entièrement en local, sans bibliothèque ni serveur externe.

const DRAUGHTS_VARIANTS = {
  international: {
    id: "international",
    title: "Dames françaises / internationales",
    shortTitle: "Dames 10 × 10",
    size: 10,
    rows: 4,
    piecesPerSide: 20,
    firstSide: 0,
    sideNames: ["Blancs", "Noirs"],
    sideShort: ["Blanc", "Noir"],
    // Les Blancs sont logiquement en bas et avancent vers la ligne 0.
    setupTopSide: 1,
    setupBottomSide: 0,
    forward: [-1, 1],
    kingFlying: true,
    manCaptureBackwards: true,
    maximumCapture: true,
    promotionStopsCapture: false,
    drawPlyLimit: 50, // 25 coups par joueur sans pion ni capture, avec dames seulement.
    pieceClass: ["draught-white", "draught-black"]
  },
  english: {
    id: "english",
    title: "Dames anglaises",
    shortTitle: "Dames 8 × 8",
    size: 8,
    rows: 3,
    piecesPerSide: 12,
    firstSide: 0,
    sideNames: ["Rouges", "Blancs"],
    sideShort: ["Rouge", "Blanc"],
    // Dans la règle WCDF, les Rouges occupent les cases 1 à 12 et jouent les premiers.
    setupTopSide: 0,
    setupBottomSide: 1,
    forward: [1, -1],
    kingFlying: false,
    manCaptureBackwards: false,
    maximumCapture: false,
    promotionStopsCapture: true,
    drawPlyLimit: 80, // 40 coups par joueur sans avance de pion ni capture.
    pieceClass: ["draught-red", "draught-white"]
  }
};

const DRAUGHTS_DIRS = [[-1,-1],[-1,1],[1,-1],[1,1]];

function draughtInside(size, r, c) {
  return r >= 0 && r < size && c >= 0 && c < size;
}

function draughtPlayable(r, c) {
  return (r + c) % 2 === 1;
}

function draughtPiece(side, king = false) {
  return { side, king };
}

function draughtCloneBoard(board) {
  return board.map(row => row.map(piece => piece ? { ...piece } : null));
}

function draughtCreateBoard(config) {
  const board = Array.from({ length: config.size }, () => Array(config.size).fill(null));

  for (let r = 0; r < config.rows; r++) {
    for (let c = 0; c < config.size; c++) {
      if (draughtPlayable(r, c)) board[r][c] = draughtPiece(config.setupTopSide);
    }
  }
  for (let r = config.size - config.rows; r < config.size; r++) {
    for (let c = 0; c < config.size; c++) {
      if (draughtPlayable(r, c)) board[r][c] = draughtPiece(config.setupBottomSide);
    }
  }
  return board;
}

function draughtPromotionRow(config, side) {
  return config.forward[side] < 0 ? 0 : config.size - 1;
}

function draughtSquareNumber(config, r, c) {
  if (!draughtPlayable(r, c)) return null;
  let number = 0;
  for (let rr = 0; rr < config.size; rr++) {
    for (let cc = 0; cc < config.size; cc++) {
      if (!draughtPlayable(rr, cc)) continue;
      number++;
      if (rr === r && cc === c) return number;
    }
  }
  return null;
}

function draughtPositionKey(state, config) {
  const cells = [];
  for (let r = 0; r < config.size; r++) {
    for (let c = 0; c < config.size; c++) {
      if (!draughtPlayable(r, c)) continue;
      const p = state.board[r][c];
      cells.push(!p ? "." : `${p.side}${p.king ? "K" : "M"}`);
    }
  }
  return `${state.turn}|${cells.join("")}`;
}

function draughtMoveNotation(config, move) {
  const separator = move.captures.length ? "x" : "-";
  return move.path.map(([r,c]) => draughtSquareNumber(config, r, c)).join(separator);
}

class DraughtsGame {
  constructor(variant = "international") {
    this.setVariant(variant);
  }

  setVariant(variant) {
    this.variant = variant;
    this.config = DRAUGHTS_VARIANTS[variant] || DRAUGHTS_VARIANTS.international;
    this.reset();
  }

  reset() {
    this.state = {
      board: draughtCreateBoard(this.config),
      turn: this.config.firstSide,
      quietPly: 0
    };
    this.history = [];
    this.positionHistory = [draughtPositionKey(this.state, this.config)];
  }

  cloneState(state = this.state) {
    return {
      board: draughtCloneBoard(state.board),
      turn: state.turn,
      quietPly: state.quietPly
    };
  }

  pieceAt(r, c, state = this.state) {
    return state.board[r]?.[c] || null;
  }

  captureDirections(piece) {
    if (piece.king || this.config.manCaptureBackwards) return DRAUGHTS_DIRS;
    const d = this.config.forward[piece.side];
    return [[d, -1], [d, 1]];
  }

  simpleMovesForPiece(state, r, c) {
    const piece = state.board[r][c];
    if (!piece) return [];
    const moves = [];

    if (!piece.king) {
      const d = this.config.forward[piece.side];
      for (const dc of [-1, 1]) {
        const tr = r + d, tc = c + dc;
        if (draughtInside(this.config.size, tr, tc) && !state.board[tr][tc]) {
          moves.push({
            from: [r,c], to: [tr,tc], path: [[r,c],[tr,tc]], captures: [], piece: { ...piece }
          });
        }
      }
      return moves;
    }

    if (!this.config.kingFlying) {
      for (const [dr, dc] of DRAUGHTS_DIRS) {
        const tr = r + dr, tc = c + dc;
        if (draughtInside(this.config.size, tr, tc) && !state.board[tr][tc]) {
          moves.push({
            from: [r,c], to: [tr,tc], path: [[r,c],[tr,tc]], captures: [], piece: { ...piece }
          });
        }
      }
      return moves;
    }

    for (const [dr, dc] of DRAUGHTS_DIRS) {
      let tr = r + dr, tc = c + dc;
      while (draughtInside(this.config.size, tr, tc) && !state.board[tr][tc]) {
        moves.push({
          from: [r,c], to: [tr,tc], path: [[r,c],[tr,tc]], captures: [], piece: { ...piece }
        });
        tr += dr;
        tc += dc;
      }
    }
    return moves;
  }

  captureSequencesForPiece(state, startR, startC) {
    const piece = state.board[startR][startC];
    if (!piece) return [];
    const results = [];
    const captured = new Set();
    const path = [[startR, startC]];

    const search = (board, r, c, capturedSet, currentPath, captureList) => {
      const choices = [];
      const dirs = this.captureDirections(piece);

      if (piece.king && this.config.kingFlying) {
        for (const [dr, dc] of dirs) {
          let rr = r + dr, cc = c + dc;
          let opponent = null;

          while (draughtInside(this.config.size, rr, cc)) {
            const cell = board[rr][cc];
            if (!opponent) {
              if (!cell) {
                rr += dr; cc += dc;
                continue;
              }
              if (cell.side === piece.side || capturedSet.has(`${rr},${cc}`)) break;
              opponent = [rr, cc];
              rr += dr; cc += dc;
              continue;
            }

            if (cell) break;
            choices.push({ landing: [rr,cc], taken: opponent });
            rr += dr; cc += dc;
          }
        }
      } else {
        for (const [dr, dc] of dirs) {
          const mr = r + dr, mc = c + dc;
          const lr = r + dr * 2, lc = c + dc * 2;
          if (!draughtInside(this.config.size, lr, lc)) continue;
          const middle = board[mr]?.[mc];
          if (!middle || middle.side === piece.side || capturedSet.has(`${mr},${mc}`) || board[lr][lc]) continue;
          choices.push({ landing: [lr,lc], taken: [mr,mc] });
        }
      }

      // Aux dames anglaises, un pion qui atteint la rangée de promotion
      // pendant une prise termine immédiatement son tour.
      const reachedPromotionAsMan = !piece.king && this.config.promotionStopsCapture &&
        currentPath.length > 1 && r === draughtPromotionRow(this.config, piece.side);

      if (!choices.length || reachedPromotionAsMan) {
        if (captureList.length) {
          results.push({
            from: [...currentPath[0]],
            to: [...currentPath[currentPath.length - 1]],
            path: currentPath.map(p => [...p]),
            captures: captureList.map(p => [...p]),
            piece: { ...piece }
          });
        }
        return;
      }

      for (const choice of choices) {
        const [lr, lc] = choice.landing;
        const [cr, cc] = choice.taken;
        const nextBoard = draughtCloneBoard(board);
        nextBoard[r][c] = null;
        nextBoard[lr][lc] = { ...piece };
        // Important : la pièce capturée reste physiquement présente pendant
        // la rafle. Elle ne pourra donc pas être franchie une seconde fois.
        const nextCaptured = new Set(capturedSet);
        nextCaptured.add(`${cr},${cc}`);
        search(nextBoard, lr, lc, nextCaptured,
          [...currentPath, [lr,lc]], [...captureList, [cr,cc]]);
      }
    };

    search(draughtCloneBoard(state.board), startR, startC, captured, path, []);
    return results;
  }

  legalMoves(state = this.state) {
    const side = state.turn;
    const captures = [];

    for (let r = 0; r < this.config.size; r++) {
      for (let c = 0; c < this.config.size; c++) {
        const piece = state.board[r][c];
        if (!piece || piece.side !== side) continue;
        captures.push(...this.captureSequencesForPiece(state, r, c));
      }
    }

    if (captures.length) {
      if (!this.config.maximumCapture) return captures;
      const max = Math.max(...captures.map(move => move.captures.length));
      return captures.filter(move => move.captures.length === max);
    }

    const moves = [];
    for (let r = 0; r < this.config.size; r++) {
      for (let c = 0; c < this.config.size; c++) {
        const piece = state.board[r][c];
        if (piece && piece.side === side) moves.push(...this.simpleMovesForPiece(state, r, c));
      }
    }
    return moves;
  }

  legalMovesFrom(r, c, state = this.state) {
    return this.legalMoves(state).filter(move => move.from[0] === r && move.from[1] === c);
  }

  applyMoveToState(state, move) {
    const next = this.cloneState(state);
    const [fr,fc] = move.from;
    const [tr,tc] = move.to;
    const piece = next.board[fr][fc];
    if (!piece) return next;

    next.board[fr][fc] = null;
    for (const [cr,cc] of move.captures) next.board[cr][cc] = null;

    const moved = { ...piece };
    if (!moved.king && tr === draughtPromotionRow(this.config, moved.side)) moved.king = true;
    next.board[tr][tc] = moved;
    next.turn = 1 - state.turn;

    // Le compteur de nulle repart à zéro dès qu'un pion bouge ou qu'une prise a lieu.
    next.quietPly = (!piece.king || move.captures.length) ? 0 : state.quietPly + 1;
    return next;
  }

  play(move) {
    const legal = this.legalMoves();
    const found = legal.find(candidate =>
      candidate.from[0] === move.from[0] && candidate.from[1] === move.from[1] &&
      candidate.to[0] === move.to[0] && candidate.to[1] === move.to[1] &&
      candidate.path.length === move.path.length &&
      candidate.path.every((p, i) => p[0] === move.path[i][0] && p[1] === move.path[i][1])
    );
    if (!found) return false;

    const before = this.cloneState(this.state);
    const notation = draughtMoveNotation(this.config, found);
    this.state = this.applyMoveToState(this.state, found);
    this.history.push({ state: before, move: found, notation });
    this.positionHistory.push(draughtPositionKey(this.state, this.config));
    return true;
  }

  undo() {
    if (!this.history.length) return false;
    const item = this.history.pop();
    this.state = item.state;
    this.positionHistory.pop();
    return true;
  }

  pieceCounts(state = this.state) {
    const counts = [
      { men: 0, kings: 0, total: 0 },
      { men: 0, kings: 0, total: 0 }
    ];
    for (const row of state.board) {
      for (const p of row) {
        if (!p) continue;
        counts[p.side].total++;
        if (p.king) counts[p.side].kings++;
        else counts[p.side].men++;
      }
    }
    return counts;
  }

  status() {
    const moves = this.legalMoves();
    const counts = this.pieceCounts();
    const current = this.state.turn;
    const opponent = 1 - current;

    if (!counts[current].total || !moves.length) {
      return {
        over: true,
        type: "win",
        winner: opponent,
        text: `${this.config.sideNames[opponent]} gagnent : ${this.config.sideNames[current].toLowerCase()} n’ont plus de coup légal.`
      };
    }

    const key = draughtPositionKey(this.state, this.config);
    const repetitions = this.positionHistory.filter(k => k === key).length;
    if (repetitions >= 3) {
      return { over: true, type: "draw", winner: null, text: "Partie nulle : même position répétée trois fois." };
    }

    if (this.state.quietPly >= this.config.drawPlyLimit) {
      const label = this.variant === "international" ? "25 coups de chaque joueur sans pion ni prise" : "40 coups de chaque joueur sans avance de pion ni prise";
      return { over: true, type: "draw", winner: null, text: `Partie nulle : ${label}.` };
    }

    const forcedCapture = moves.length && moves[0].captures.length > 0;
    let detail = `${this.config.sideNames[current]} au trait.`;
    if (forcedCapture) {
      detail += this.config.maximumCapture
        ? ` Prise obligatoire : une rafle maximale de ${moves[0].captures.length} pièce${moves[0].captures.length > 1 ? "s" : ""}.`
        : " Prise obligatoire.";
    }
    return { over: false, type: forcedCapture ? "capture" : "play", winner: null, text: detail };
  }
}

// ------------------------------------------------------------
// IA légère : facile = hasard, intermédiaire = 2 plis,
// difficile = recherche alpha-bêta plus profonde.
// ------------------------------------------------------------
function draughtEvaluate(game, state, aiSide) {
  const cfg = game.config;
  let score = 0;
  for (let r = 0; r < cfg.size; r++) {
    for (let c = 0; c < cfg.size; c++) {
      const p = state.board[r][c];
      if (!p) continue;
      let value = p.king ? (cfg.kingFlying ? 310 : 190) : 100;
      if (!p.king) {
        const promo = draughtPromotionRow(cfg, p.side);
        const distance = Math.abs(promo - r);
        value += (cfg.size - 1 - distance) * 4;
      }
      const center = (cfg.size - 1) / 2;
      value += Math.max(0, center - (Math.abs(r - center) + Math.abs(c - center)) / 2) * 2;
      score += p.side === aiSide ? value : -value;
    }
  }
  return score;
}

function draughtMinimax(game, state, depth, alpha, beta, aiSide) {
  const legal = game.legalMoves(state);
  if (!legal.length) return state.turn === aiSide ? -100000 - depth : 100000 + depth;
  if (depth <= 0) return draughtEvaluate(game, state, aiSide);

  // Les prises sont examinées en premier ; pour les positions très ouvertes,
  // on limite légèrement le nombre de branches profondes pour garder l'UI fluide.
  const ordered = [...legal].sort((a,b) => b.captures.length - a.captures.length);
  const moves = depth >= 2 && ordered.length > 18 ? ordered.slice(0, 18) : ordered;
  const maximizing = state.turn === aiSide;

  if (maximizing) {
    let best = -Infinity;
    for (const move of moves) {
      const next = game.applyMoveToState(state, move);
      best = Math.max(best, draughtMinimax(game, next, depth - 1, alpha, beta, aiSide));
      alpha = Math.max(alpha, best);
      if (beta <= alpha) break;
    }
    return best;
  }

  let best = Infinity;
  for (const move of moves) {
    const next = game.applyMoveToState(state, move);
    best = Math.min(best, draughtMinimax(game, next, depth - 1, alpha, beta, aiSide));
    beta = Math.min(beta, best);
    if (beta <= alpha) break;
  }
  return best;
}

function draughtChooseAiMove(game, level, aiSide) {
  const legal = game.legalMoves();
  if (!legal.length) return null;
  if (level === "easy") return legal[Math.floor(Math.random() * legal.length)];

  const depth = level === "hard" ? 3 : 2;
  let best = -Infinity;
  let choices = [];

  for (const move of legal) {
    const next = game.applyMoveToState(game.state, move);
    let score = draughtMinimax(game, next, depth - 1, -Infinity, Infinity, aiSide);
    if (level === "medium") score += (Math.random() - .5) * 14;
    else score += (Math.random() - .5) * 1.5;

    if (score > best + .001) {
      best = score;
      choices = [move];
    } else if (Math.abs(score - best) <= .001) {
      choices.push(move);
    }
  }
  return choices[Math.floor(Math.random() * choices.length)];
}

// ------------------------------------------------------------
// Interface utilisateur.
// ------------------------------------------------------------
let draughtUi = null;

function initDraughts(variant = "international") {
  const game = new DraughtsGame(variant);
  const cfg = game.config;
  draughtUi = {
    game,
    selected: null,
    candidateMoves: [],
    mode: "ai",
    aiLevel: "medium",
    humanSide: cfg.firstSide,
    orientation: cfg.firstSide,
    thinking: false,
    variant
  };

  document.getElementById("draughtMode")?.addEventListener("change", e => {
    draughtUi.mode = e.target.value;
    document.getElementById("draughtAiSettings").hidden = draughtUi.mode !== "ai";
    newDraughtGame();
  });
  document.getElementById("draughtAiLevel")?.addEventListener("change", e => draughtUi.aiLevel = e.target.value);
  document.getElementById("draughtSide")?.addEventListener("change", e => {
    draughtUi.humanSide = Number(e.target.value);
    draughtUi.orientation = draughtUi.humanSide;
    newDraughtGame();
  });
  document.getElementById("newDraught")?.addEventListener("click", newDraughtGame);
  document.getElementById("undoDraught")?.addEventListener("click", undoDraughtMove);
  document.getElementById("flipDraught")?.addEventListener("click", () => {
    draughtUi.orientation = 1 - draughtUi.orientation;
    renderDraughtBoard();
  });

  newDraughtGame();
}

function newDraughtGame() {
  draughtUi.game.reset();
  draughtUi.selected = null;
  draughtUi.candidateMoves = [];
  draughtUi.thinking = false;
  hideDraughtPathPicker();
  draughtUi.orientation = draughtUi.mode === "local" ? draughtUi.game.config.firstSide : draughtUi.humanSide;
  renderDraughtBoard();
  maybeDraughtAiTurn();
}

function draughtBoardOrder() {
  const size = draughtUi.game.config.size;
  const normal = Array.from({ length: size }, (_, i) => i);
  const reverse = [...normal].reverse();
  // L'orientation place le camp choisi visuellement en bas.
  const bottomSide = draughtUi.game.config.setupBottomSide;
  const shouldReverse = draughtUi.orientation !== bottomSide;
  return { rows: shouldReverse ? reverse : normal, cols: shouldReverse ? reverse : normal };
}

function renderDraughtBoard() {
  const boardEl = document.getElementById("draughtBoard");
  if (!boardEl || !draughtUi) return;
  const game = draughtUi.game;
  const cfg = game.config;
  const { rows, cols } = draughtBoardOrder();
  boardEl.style.setProperty("--board-size", cfg.size);

  const targets = new Map();
  for (const move of draughtUi.candidateMoves) {
    const key = `${move.to[0]},${move.to[1]}`;
    if (!targets.has(key)) targets.set(key, []);
    targets.get(key).push(move);
  }
  const last = game.history.at(-1)?.move;

  let html = "";
  rows.forEach((r, vr) => {
    cols.forEach((c, vc) => {
      const piece = game.state.board[r][c];
      const playable = draughtPlayable(r,c);
      const selected = draughtUi.selected && draughtUi.selected[0] === r && draughtUi.selected[1] === c;
      const moves = targets.get(`${r},${c}`) || [];
      const wasLast = last && (last.path.some(p => p[0] === r && p[1] === c));
      const classes = [
        "draught-square", playable ? "dark" : "light", selected ? "selected" : "",
        moves.length ? "legal" : "", moves.some(m => m.captures.length) ? "capture" : "", wasLast ? "last" : ""
      ].filter(Boolean).join(" ");
      const number = playable ? draughtSquareNumber(cfg, r, c) : null;
      const showNumber = playable && ((cfg.size === 10 && (vr === 0 || vr === cfg.size - 1)) || (cfg.size === 8 && (vr === 0 || vr === cfg.size - 1)));
      const pieceHtml = piece ? `<span class="draught-piece ${cfg.pieceClass[piece.side]} ${piece.king ? "king" : ""}"><span class="disc-core">${piece.king ? "♛" : ""}</span></span>` : "";
      html += `<button class="${classes}" data-r="${r}" data-c="${c}" ${playable ? "" : "disabled"} aria-label="${playable ? `Case ${number}` : "Case non jouable"}${piece ? `, ${cfg.sideShort[piece.side]}${piece.king ? ", dame" : ", pion"}` : ""}">${showNumber ? `<span class="draught-coord">${number}</span>` : ""}${pieceHtml}<span class="draught-move-dot"></span></button>`;
    });
  });

  boardEl.innerHTML = html;
  boardEl.querySelectorAll(".draught-square.dark").forEach(btn => btn.addEventListener("click", onDraughtSquareClick));
  renderDraughtInfo();
}

function renderDraughtInfo() {
  if (!draughtUi) return;
  const game = draughtUi.game;
  const cfg = game.config;
  const status = game.status();
  const counts = game.pieceCounts();
  const statusEl = document.getElementById("draughtStatus");
  const turnEl = document.getElementById("draughtTurn");
  const historyEl = document.getElementById("draughtHistory");
  if (!statusEl || !turnEl || !historyEl) return;

  statusEl.textContent = draughtUi.thinking ? "L’IA réfléchit…" : status.text;
  statusEl.classList.toggle("alert", status.type === "capture" || status.type === "win");
  turnEl.textContent = cfg.sideNames[game.state.turn];

  document.getElementById("draughtCount0").textContent = `${counts[0].total} (${counts[0].kings} dame${counts[0].kings > 1 ? "s" : ""})`;
  document.getElementById("draughtCount1").textContent = `${counts[1].total} (${counts[1].kings} dame${counts[1].kings > 1 ? "s" : ""})`;
  document.getElementById("draughtLabel0").textContent = cfg.sideNames[0];
  document.getElementById("draughtLabel1").textContent = cfg.sideNames[1];

  const items = game.history.map((item, i) => `<div class="draught-history-row"><span>${i + 1}.</span><span>${item.notation}</span></div>`);
  historyEl.innerHTML = items.length ? items.join("") : `<div class="history-empty">Les coups apparaîtront ici.</div>`;
  historyEl.scrollTop = historyEl.scrollHeight;

  const undo = document.getElementById("undoDraught");
  if (undo) undo.disabled = draughtUi.thinking || !game.history.length;
}

function onDraughtSquareClick(event) {
  if (!draughtUi || draughtUi.thinking || draughtUi.game.status().over) return;
  const r = Number(event.currentTarget.dataset.r);
  const c = Number(event.currentTarget.dataset.c);
  const game = draughtUi.game;
  const piece = game.state.board[r][c];
  const turn = game.state.turn;

  if (draughtUi.mode === "ai" && turn !== draughtUi.humanSide) return;

  if (draughtUi.selected) {
    const matches = draughtUi.candidateMoves.filter(move => move.to[0] === r && move.to[1] === c);
    if (matches.length === 1) {
      playDraughtMove(matches[0]);
      return;
    }
    if (matches.length > 1) {
      showDraughtPathPicker(matches);
      return;
    }
  }

  if (piece && piece.side === turn) {
    const moves = game.legalMovesFrom(r,c);
    if (moves.length) {
      draughtUi.selected = [r,c];
      draughtUi.candidateMoves = moves;
    } else {
      draughtUi.selected = null;
      draughtUi.candidateMoves = [];
    }
  } else {
    draughtUi.selected = null;
    draughtUi.candidateMoves = [];
  }
  renderDraughtBoard();
}


function showDraughtPathPicker(moves) {
  const picker = document.getElementById("draughtPathPicker");
  if (!picker) return;
  const cfg = draughtUi.game.config;
  picker.innerHTML = `<strong>Plusieurs rafles arrivent sur cette case</strong><p>Choisissez le trajet :</p><div class="draught-path-options">${moves.map((move, i) => `<button class="btn small" data-path-index="${i}">${draughtMoveNotation(cfg, move)}</button>`).join("")}</div><button class="btn outline small" data-cancel-path>Annuler</button>`;
  picker.hidden = false;
  picker.querySelectorAll("[data-path-index]").forEach(button => {
    button.addEventListener("click", () => {
      const move = moves[Number(button.dataset.pathIndex)];
      hideDraughtPathPicker();
      if (move) playDraughtMove(move);
    });
  });
  picker.querySelector("[data-cancel-path]")?.addEventListener("click", hideDraughtPathPicker);
}

function hideDraughtPathPicker() {
  const picker = document.getElementById("draughtPathPicker");
  if (picker) picker.hidden = true;
}

function playDraughtMove(move) {
  hideDraughtPathPicker();
  if (!draughtUi.game.play(move)) return;
  draughtUi.selected = null;
  draughtUi.candidateMoves = [];
  renderDraughtBoard();
  maybeDraughtAiTurn();
}

function undoDraughtMove() {
  if (!draughtUi || draughtUi.thinking) return;
  hideDraughtPathPicker();
  const game = draughtUi.game;
  if (draughtUi.mode === "ai") {
    if (!game.history.length) return;
    game.undo();
    if (game.state.turn !== draughtUi.humanSide && game.history.length) game.undo();
  } else {
    game.undo();
  }
  draughtUi.selected = null;
  draughtUi.candidateMoves = [];
  renderDraughtBoard();
}

function maybeDraughtAiTurn() {
  if (!draughtUi || draughtUi.mode !== "ai" || draughtUi.game.status().over || draughtUi.game.state.turn === draughtUi.humanSide) return;
  draughtUi.thinking = true;
  renderDraughtInfo();
  window.setTimeout(() => {
    const aiSide = draughtUi.game.state.turn;
    const move = draughtChooseAiMove(draughtUi.game, draughtUi.aiLevel, aiSide);
    if (move) draughtUi.game.play(move);
    draughtUi.thinking = false;
    renderDraughtBoard();
  }, 140);
}
