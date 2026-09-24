// ============================================================
// ÉCHECS — moteur de règles + interface locale
// ============================================================
// Le moteur est volontairement écrit en JavaScript pur afin que
// le site puisse être testé localement sans dépendance externe.

const CHESS_PIECES = {
  K: "♔", Q: "♕", R: "♖", B: "♗", N: "♘", P: "♙",
  k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟"
};

const CHESS_VALUES = { P: 100, N: 320, B: 330, R: 500, Q: 900, K: 20000 };

function chessInitialBoard() {
  return [
    ["r", "n", "b", "q", "k", "b", "n", "r"],
    ["p", "p", "p", "p", "p", "p", "p", "p"],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    ["P", "P", "P", "P", "P", "P", "P", "P"],
    ["R", "N", "B", "Q", "K", "B", "N", "R"]
  ];
}

function chessColor(piece) {
  if (!piece) return null;
  return piece === piece.toUpperCase() ? "w" : "b";
}

function chessOpposite(color) {
  return color === "w" ? "b" : "w";
}

function chessInside(r, c) {
  return r >= 0 && r < 8 && c >= 0 && c < 8;
}

function chessSquareName(r, c) {
  return "abcdefgh"[c] + (8 - r);
}

function chessCloneState(state) {
  return {
    board: state.board.map(row => [...row]),
    turn: state.turn,
    castling: { ...state.castling },
    enPassant: state.enPassant ? [...state.enPassant] : null,
    halfmove: state.halfmove,
    fullmove: state.fullmove
  };
}

function chessPositionKey(state) {
  const board = state.board.map(row => row.map(p => p || ".").join("")).join("/");
  const rights = ["K", "Q", "k", "q"].filter(k => state.castling[k]).join("") || "-";
  const ep = state.enPassant ? chessSquareName(...state.enPassant) : "-";
  return `${board} ${state.turn} ${rights} ${ep}`;
}

class ChessGame {
  constructor() {
    this.reset();
  }

  reset() {
    this.state = {
      board: chessInitialBoard(),
      turn: "w",
      castling: { K: true, Q: true, k: true, q: true },
      enPassant: null,
      halfmove: 0,
      fullmove: 1
    };
    this.history = [];
    this.positionHistory = [chessPositionKey(this.state)];
  }

  pieceAt(r, c) {
    return this.state.board[r]?.[c] || null;
  }

  kingSquare(state, color) {
    const target = color === "w" ? "K" : "k";
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if (state.board[r][c] === target) return [r, c];
      }
    }
    return null;
  }

  isSquareAttacked(state, r, c, byColor) {
    const pawn = byColor === "w" ? "P" : "p";
    const pawnRow = byColor === "w" ? r + 1 : r - 1;
    for (const dc of [-1, 1]) {
      const cc = c + dc;
      if (chessInside(pawnRow, cc) && state.board[pawnRow][cc] === pawn) return true;
    }

    const knight = byColor === "w" ? "N" : "n";
    const knightSteps = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
    for (const [dr, dc] of knightSteps) {
      const rr = r + dr, cc = c + dc;
      if (chessInside(rr, cc) && state.board[rr][cc] === knight) return true;
    }

    const king = byColor === "w" ? "K" : "k";
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue;
        const rr = r + dr, cc = c + dc;
        if (chessInside(rr, cc) && state.board[rr][cc] === king) return true;
      }
    }

    const rook = byColor === "w" ? "R" : "r";
    const bishop = byColor === "w" ? "B" : "b";
    const queen = byColor === "w" ? "Q" : "q";

    for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]]) {
      let rr = r + dr, cc = c + dc;
      while (chessInside(rr, cc)) {
        const p = state.board[rr][cc];
        if (p) {
          if (p === rook || p === queen) return true;
          break;
        }
        rr += dr; cc += dc;
      }
    }

    for (const [dr, dc] of [[-1,-1],[-1,1],[1,-1],[1,1]]) {
      let rr = r + dr, cc = c + dc;
      while (chessInside(rr, cc)) {
        const p = state.board[rr][cc];
        if (p) {
          if (p === bishop || p === queen) return true;
          break;
        }
        rr += dr; cc += dc;
      }
    }

    return false;
  }

  inCheck(state, color) {
    const king = this.kingSquare(state, color);
    if (!king) return true;
    return this.isSquareAttacked(state, king[0], king[1], chessOpposite(color));
  }

  pseudoMoves(state, color) {
    const moves = [];
    const add = (fr, fc, tr, tc, extra = {}) => moves.push({ fr, fc, tr, tc, ...extra });

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = state.board[r][c];
        if (!piece || chessColor(piece) !== color) continue;
        const type = piece.toUpperCase();

        if (type === "P") {
          const dir = color === "w" ? -1 : 1;
          const startRow = color === "w" ? 6 : 1;
          const promoRow = color === "w" ? 0 : 7;
          const one = r + dir;

          if (chessInside(one, c) && !state.board[one][c]) {
            if (one === promoRow) {
              for (const promotion of ["Q", "R", "B", "N"]) add(r, c, one, c, { promotion });
            } else {
              add(r, c, one, c);
              const two = r + dir * 2;
              if (r === startRow && !state.board[two][c]) add(r, c, two, c, { doublePawn: true });
            }
          }

          for (const dc of [-1, 1]) {
            const tr = r + dir, tc = c + dc;
            if (!chessInside(tr, tc)) continue;
            const target = state.board[tr][tc];
            if (target && chessColor(target) !== color) {
              if (tr === promoRow) {
                for (const promotion of ["Q", "R", "B", "N"]) add(r, c, tr, tc, { capture: true, promotion });
              } else {
                add(r, c, tr, tc, { capture: true });
              }
            }
            if (state.enPassant && state.enPassant[0] === tr && state.enPassant[1] === tc) {
              add(r, c, tr, tc, { capture: true, enPassant: true });
            }
          }
        }

        if (type === "N") {
          for (const [dr, dc] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]) {
            const tr = r + dr, tc = c + dc;
            if (!chessInside(tr, tc)) continue;
            const target = state.board[tr][tc];
            if (!target || chessColor(target) !== color) add(r, c, tr, tc, { capture: Boolean(target) });
          }
        }

        if (["B", "R", "Q"].includes(type)) {
          const dirs = [];
          if (["B", "Q"].includes(type)) dirs.push([-1,-1],[-1,1],[1,-1],[1,1]);
          if (["R", "Q"].includes(type)) dirs.push([-1,0],[1,0],[0,-1],[0,1]);
          for (const [dr, dc] of dirs) {
            let tr = r + dr, tc = c + dc;
            while (chessInside(tr, tc)) {
              const target = state.board[tr][tc];
              if (!target) add(r, c, tr, tc);
              else {
                if (chessColor(target) !== color) add(r, c, tr, tc, { capture: true });
                break;
              }
              tr += dr; tc += dc;
            }
          }
        }

        if (type === "K") {
          for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
              if (!dr && !dc) continue;
              const tr = r + dr, tc = c + dc;
              if (!chessInside(tr, tc)) continue;
              const target = state.board[tr][tc];
              if (!target || chessColor(target) !== color) add(r, c, tr, tc, { capture: Boolean(target) });
            }
          }

          const homeRow = color === "w" ? 7 : 0;
          if (r === homeRow && c === 4 && !this.inCheck(state, color)) {
            const kingRight = color === "w" ? "K" : "k";
            const queenRight = color === "w" ? "Q" : "q";
            const rookPiece = color === "w" ? "R" : "r";
            const enemy = chessOpposite(color);

            if (state.castling[kingRight] && state.board[homeRow][7] === rookPiece &&
                !state.board[homeRow][5] && !state.board[homeRow][6] &&
                !this.isSquareAttacked(state, homeRow, 5, enemy) &&
                !this.isSquareAttacked(state, homeRow, 6, enemy)) {
              add(r, c, homeRow, 6, { castle: "king" });
            }

            if (state.castling[queenRight] && state.board[homeRow][0] === rookPiece &&
                !state.board[homeRow][1] && !state.board[homeRow][2] && !state.board[homeRow][3] &&
                !this.isSquareAttacked(state, homeRow, 3, enemy) &&
                !this.isSquareAttacked(state, homeRow, 2, enemy)) {
              add(r, c, homeRow, 2, { castle: "queen" });
            }
          }
        }
      }
    }

    return moves;
  }

  applyMoveToState(state, move) {
    const next = chessCloneState(state);
    const piece = next.board[move.fr][move.fc];
    const color = chessColor(piece);
    const target = next.board[move.tr][move.tc];
    const isPawn = piece.toUpperCase() === "P";

    next.board[move.fr][move.fc] = null;
    next.board[move.tr][move.tc] = piece;

    if (move.enPassant) {
      const capturedRow = move.tr + (color === "w" ? 1 : -1);
      next.board[capturedRow][move.tc] = null;
    }

    if (move.castle === "king") {
      const row = color === "w" ? 7 : 0;
      next.board[row][5] = next.board[row][7];
      next.board[row][7] = null;
    }

    if (move.castle === "queen") {
      const row = color === "w" ? 7 : 0;
      next.board[row][3] = next.board[row][0];
      next.board[row][0] = null;
    }

    if (move.promotion) {
      next.board[move.tr][move.tc] = color === "w" ? move.promotion : move.promotion.toLowerCase();
    }

    if (piece === "K") next.castling.K = next.castling.Q = false;
    if (piece === "k") next.castling.k = next.castling.q = false;
    if (piece === "R" && move.fr === 7 && move.fc === 0) next.castling.Q = false;
    if (piece === "R" && move.fr === 7 && move.fc === 7) next.castling.K = false;
    if (piece === "r" && move.fr === 0 && move.fc === 0) next.castling.q = false;
    if (piece === "r" && move.fr === 0 && move.fc === 7) next.castling.k = false;

    if (target === "R" && move.tr === 7 && move.tc === 0) next.castling.Q = false;
    if (target === "R" && move.tr === 7 && move.tc === 7) next.castling.K = false;
    if (target === "r" && move.tr === 0 && move.tc === 0) next.castling.q = false;
    if (target === "r" && move.tr === 0 && move.tc === 7) next.castling.k = false;

    next.enPassant = null;
    if (isPawn && Math.abs(move.tr - move.fr) === 2) {
      next.enPassant = [(move.fr + move.tr) / 2, move.fc];
    }

    next.halfmove = (isPawn || target || move.enPassant) ? 0 : next.halfmove + 1;
    if (color === "b") next.fullmove += 1;
    next.turn = chessOpposite(color);
    return next;
  }

  legalMoves(state = this.state, color = state.turn) {
    return this.pseudoMoves(state, color).filter(move => {
      const next = this.applyMoveToState(state, move);
      return !this.inCheck(next, color);
    });
  }

  legalMovesFrom(r, c) {
    return this.legalMoves().filter(m => m.fr === r && m.fc === c);
  }

  notation(move, beforeState, afterState) {
    const piece = beforeState.board[move.fr][move.fc];
    const type = piece.toUpperCase();
    if (move.castle === "king") return "O-O" + (this.inCheck(afterState, afterState.turn) ? "+" : "");
    if (move.castle === "queen") return "O-O-O" + (this.inCheck(afterState, afterState.turn) ? "+" : "");

    const capture = Boolean(beforeState.board[move.tr][move.tc]) || move.enPassant;
    const dest = chessSquareName(move.tr, move.tc);
    let text = "";

    if (type !== "P") {
      text += type;
      const alternatives = this.legalMoves(beforeState, chessColor(piece)).filter(other =>
        other.fr !== move.fr || other.fc !== move.fc ?
          beforeState.board[other.fr][other.fc]?.toUpperCase() === type && other.tr === move.tr && other.tc === move.tc : false
      );
      if (alternatives.length) {
        const sameFile = alternatives.some(m => m.fc === move.fc);
        const sameRank = alternatives.some(m => m.fr === move.fr);
        if (!sameFile) text += "abcdefgh"[move.fc];
        else if (!sameRank) text += (8 - move.fr);
        else text += chessSquareName(move.fr, move.fc);
      }
    } else if (capture) {
      text += "abcdefgh"[move.fc];
    }

    if (capture) text += "x";
    text += dest;
    if (move.promotion) text += `=${move.promotion}`;

    const enemy = afterState.turn;
    const replies = this.legalMoves(afterState, enemy);
    if (this.inCheck(afterState, enemy)) text += replies.length ? "+" : "#";
    return text;
  }

  play(move) {
    const legal = this.legalMoves();
    const found = legal.find(m => m.fr === move.fr && m.fc === move.fc && m.tr === move.tr && m.tc === move.tc &&
      (m.promotion || null) === (move.promotion || null));
    if (!found) return false;

    const before = chessCloneState(this.state);
    const after = this.applyMoveToState(this.state, found);
    const san = this.notation(found, before, after);
    this.history.push({ state: before, move: { ...found }, san });
    this.state = after;
    this.positionHistory.push(chessPositionKey(this.state));
    return true;
  }

  undo() {
    if (!this.history.length) return false;
    const previous = this.history.pop();
    this.state = previous.state;
    this.positionHistory.pop();
    return true;
  }

  insufficientMaterial() {
    const pieces = [];
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = this.state.board[r][c];
        if (p && p.toUpperCase() !== "K") pieces.push({ p, r, c });
      }
    }
    if (!pieces.length) return true;
    if (pieces.length === 1 && ["B", "N"].includes(pieces[0].p.toUpperCase())) return true;
    if (pieces.every(x => x.p.toUpperCase() === "B")) {
      const colors = pieces.map(x => (x.r + x.c) % 2);
      if (colors.every(c => c === colors[0])) return true;
    }
    return false;
  }

  status() {
    const legal = this.legalMoves();
    const check = this.inCheck(this.state, this.state.turn);
    const side = this.state.turn === "w" ? "Blancs" : "Noirs";

    if (!legal.length && check) {
      return { over: true, type: "checkmate", text: `Échec et mat ! ${this.state.turn === "w" ? "Les Noirs" : "Les Blancs"} gagnent.` };
    }
    if (!legal.length) return { over: true, type: "stalemate", text: "Pat : la partie est nulle." };
    if (this.state.halfmove >= 100) return { over: true, type: "fifty", text: "Partie nulle : règle des 50 coups." };
    if (this.insufficientMaterial()) return { over: true, type: "material", text: "Partie nulle : matériel insuffisant pour mater." };

    const key = chessPositionKey(this.state);
    const repetitions = this.positionHistory.filter(k => k === key).length;
    if (repetitions >= 3) return { over: true, type: "repetition", text: "Partie nulle : répétition de la position." };

    return { over: false, type: check ? "check" : "play", text: `${side} au trait${check ? " — Échec !" : ""}` };
  }
}

// ------------------------------------------------------------
// IA : trois niveaux volontairement simples et transparents.
// ------------------------------------------------------------
function chessEvaluate(game, state) {
  let score = 0;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = state.board[r][c];
      if (!p) continue;
      let value = CHESS_VALUES[p.toUpperCase()] || 0;
      if (p.toUpperCase() === "P") {
        const progress = chessColor(p) === "w" ? 6 - r : r - 1;
        value += Math.max(0, progress) * 8;
      }
      if (["N", "B"].includes(p.toUpperCase())) {
        const center = 3.5 - (Math.abs(r - 3.5) + Math.abs(c - 3.5)) / 2;
        value += center * 6;
      }
      score += chessColor(p) === "w" ? value : -value;
    }
  }

  const whiteKing = game.kingSquare(state, "w");
  const blackKing = game.kingSquare(state, "b");
  if (whiteKing && game.isSquareAttacked(state, whiteKing[0], whiteKing[1], "b")) score -= 35;
  if (blackKing && game.isSquareAttacked(state, blackKing[0], blackKing[1], "w")) score += 35;
  return score;
}

function chessMinimax(game, state, depth, alpha, beta) {
  const color = state.turn;
  const legal = game.legalMoves(state, color);
  const checked = game.inCheck(state, color);

  if (!legal.length) {
    if (checked) return color === "w" ? -999999 - depth : 999999 + depth;
    return 0;
  }
  if (depth === 0) return chessEvaluate(game, state);

  if (color === "w") {
    let best = -Infinity;
    for (const move of legal) {
      const next = game.applyMoveToState(state, move);
      best = Math.max(best, chessMinimax(game, next, depth - 1, alpha, beta));
      alpha = Math.max(alpha, best);
      if (beta <= alpha) break;
    }
    return best;
  }

  let best = Infinity;
  for (const move of legal) {
    const next = game.applyMoveToState(state, move);
    best = Math.min(best, chessMinimax(game, next, depth - 1, alpha, beta));
    beta = Math.min(beta, best);
    if (beta <= alpha) break;
  }
  return best;
}

function chessChooseAiMove(game, level) {
  const legal = game.legalMoves();
  if (!legal.length) return null;
  if (level === "easy") return legal[Math.floor(Math.random() * legal.length)];

  const depth = level === "hard" ? 3 : 2;
  const maximizing = game.state.turn === "w";
  let bestScore = maximizing ? -Infinity : Infinity;
  let bestMoves = [];

  for (const move of legal) {
    const next = game.applyMoveToState(game.state, move);
    let score = chessMinimax(game, next, depth - 1, -Infinity, Infinity);
    score += (Math.random() - .5) * (level === "medium" ? 16 : 2);

    const better = maximizing ? score > bestScore : score < bestScore;
    if (better) {
      bestScore = score;
      bestMoves = [move];
    } else if (Math.abs(score - bestScore) < .001) {
      bestMoves.push(move);
    }
  }

  return bestMoves[Math.floor(Math.random() * bestMoves.length)];
}

// ------------------------------------------------------------
// Interface utilisateur de l'échiquier.
// ------------------------------------------------------------
let chessUi = null;
let chessClockTimer = null;

const CHESS_RATING_LABELS={bullet:"Bullet",blitz:"Blitz",rapid:"Rapide",classical:"Classique"};

function chessTimeCategory(initialSeconds,incrementSeconds){
  const estimated=Number(initialSeconds||0)+Number(incrementSeconds||0)*40;
  if(estimated<180) return "bullet";
  if(estimated<600) return "blitz";
  if(estimated<1800) return "rapid";
  return "classical";
}

function chessReadTimeControl(){
  const preset=document.getElementById("chessTimePreset")?.value||"600,5";
  if(preset!=="custom"){
    const [initialSeconds,incrementSeconds]=preset.split(",").map(Number);
    return {initialSeconds,incrementSeconds};
  }
  const minutes=Math.min(180,Math.max(1,Number(document.getElementById("chessInitialMinutes")?.value||10)));
  const incrementSeconds=Math.min(60,Math.max(0,Number(document.getElementById("chessIncrementSeconds")?.value||0)));
  return {initialSeconds:Math.round(minutes*60),incrementSeconds:Math.round(incrementSeconds)};
}

function chessFormatClock(ms){
  ms=Math.max(0,Number(ms||0));
  const totalSeconds=ms/1000;
  const minutes=Math.floor(totalSeconds/60);
  const seconds=Math.floor(totalSeconds%60);
  if(ms<20000){
    const tenths=Math.floor((ms%1000)/100);
    return `${minutes}:${String(seconds).padStart(2,"0")}.${tenths}`;
  }
  return `${minutes}:${String(seconds).padStart(2,"0")}`;
}

function chessSetOnlineClock(clock){
  if(!chessUi?.online) return;
  chessUi.online.clock=clock?{...clock,clientReceivedAt:Date.now()}:null;
  chessUpdateClockDisplay();
}

function chessOnlineClockValues(){
  const clock=chessUi?.online?.clock;
  if(!clock) return null;
  let whiteMs=Number(clock.whiteMs||0),blackMs=Number(clock.blackMs||0);
  if(clock.started && clock.runningSide && !chessUi?.online?.result?.over){
    const elapsed=Math.max(0,Date.now()-Number(clock.clientReceivedAt||Date.now()));
    if(clock.runningSide==="w") whiteMs=Math.max(0,whiteMs-elapsed);
    if(clock.runningSide==="b") blackMs=Math.max(0,blackMs-elapsed);
  }
  return {whiteMs,blackMs,runningSide:clock.runningSide,started:clock.started};
}

function chessRenderRatingResult(update){
  const box=document.getElementById("chessRatingResult");
  if(!box) return;
  if(!update?.rated){
    box.hidden=true;
    box.innerHTML="";
    return;
  }
  const mine=chessUi?.online?.side==="w"?update.white:update.black;
  const other=chessUi?.online?.side==="w"?update.black:update.white;
  const delta=Number(mine?.delta||0);
  box.hidden=false;
  box.innerHTML=`<strong>Elo ${CHESS_RATING_LABELS[update.category]||update.category}</strong>
    <span>Vous : ${mine?.before ?? "—"} → ${mine?.after ?? "—"} (${delta>=0?"+":""}${delta})</span>
    <span>${other?.username||"Adversaire"} : ${other?.before ?? "—"} → ${other?.after ?? "—"} (${Number(other?.delta||0)>=0?"+":""}${other?.delta ?? 0})</span>`;
}

function chessEnsureClockPanel(){
  const panel=document.getElementById("chessClockPanel");
  if(!panel) return null;

  // V6.11 : on conserve un SEUL panneau parent pour garantir la robustesse,
  // mais on rend deux lignes/carte internes pour retrouver une vraie qualité visuelle.
  if(panel.dataset.clockVersion!=="614"){
    panel.innerHTML=`
      <div class="chess-dual-clock-readout" data-clock-role="readout" aria-label="Pendules Noir et Blanc"></div>
      <div class="chess-time-meta" data-clock-role="meta"></div>`;
    panel.dataset.clockVersion="614";
  }
  return panel;
}

function chessUpdateClockDisplay(){
  const panel=chessEnsureClockPanel();
  if(!panel || !chessUi) return;
  const online=chessUi.mode==="online"?chessUi.online:null;
  panel.hidden=!online?.connected;
  if(!online?.connected) return;

  const values=chessOnlineClockValues() || {whiteMs:0,blackMs:0,runningSide:null,started:false};
  const players=online.players||{};
  const category=online.settings?.ratingCategory||"rapid";
  const ratings=online.ratings||{};

  const blackName=players.black?.username||"Noirs";
  const whiteName=players.white?.username||"Blancs";
  const blackRating=ratings.black?.rating ?? 1200;
  const whiteRating=ratings.white?.rating ?? 1200;
  const blackActive=Boolean(values.started&&values.runningSide==="b"&&!online.result?.over);
  const whiteActive=Boolean(values.started&&values.runningSide==="w"&&!online.result?.over);

  const readout=panel.querySelector('[data-clock-role="readout"]');
  if(readout){
    // V6.14 : deux vrais blocs internes, toujours dans le même panneau parent.
    const escapeHtml=(value)=>String(value ?? "").replace(/[&<>"']/g,(ch)=>({
      "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
    }[ch]));
    const blackCard=`
      <div class="clock-side-row black ${blackActive?"active":""}">
        <div class="clock-side-head">
          <span class="clock-side-indicator" aria-hidden="true">
            <span class="clock-color-dot black-dot"></span>
            ${blackActive?'<span class="clock-turn-arrow">▶</span>':''}
          </span>
          <div class="clock-side-identity">
            <span class="clock-side-label">Noirs</span>
            <strong class="clock-side-name" title="${escapeHtml(blackName)}">${escapeHtml(blackName)}</strong>
          </div>
          <span class="clock-side-rating">Elo ${blackRating}</span>
        </div>
        <div class="clock-side-time">${chessFormatClock(values.blackMs)}</div>
      </div>`;

    const whiteCard=`
      <div class="clock-side-row white ${whiteActive?"active":""}">
        <div class="clock-side-head">
          <span class="clock-side-indicator" aria-hidden="true">
            <span class="clock-color-dot white-dot"></span>
            ${whiteActive?'<span class="clock-turn-arrow">▶</span>':''}
          </span>
          <div class="clock-side-identity">
            <span class="clock-side-label">Blancs</span>
            <strong class="clock-side-name" title="${escapeHtml(whiteName)}">${escapeHtml(whiteName)}</strong>
          </div>
          <span class="clock-side-rating">Elo ${whiteRating}</span>
        </div>
        <div class="clock-side-time">${chessFormatClock(values.whiteMs)}</div>
      </div>`;

    // V6.17 : les pendules suivent l'orientation réelle de l'échiquier.
    // La couleur qui se trouve en bas du plateau est aussi affichée en bas
    // dans le panneau des pendules. Cela reste vrai si le joueur retourne
    // manuellement l'échiquier pendant la partie.
    const bottomSide=chessUi.orientation === "b" ? "black" : "white";
    readout.innerHTML=bottomSide === "black"
      ? `${whiteCard}${blackCard}`
      : `${blackCard}${whiteCard}`;
  }

  const meta=panel.querySelector('[data-clock-role="meta"]');
  if(meta){
    const tc=online.settings?.timeControl;
    if(tc){
      const min=Number(tc.initialSeconds||0)/60;
      const inc=Number(tc.incrementSeconds||0);
      meta.textContent=`${Number.isInteger(min)?min:min.toFixed(1)}+${inc} · ${CHESS_RATING_LABELS[category]||category} · ${online.settings?.rated?"classée Elo":"amicale"}`;
    }else{
      meta.textContent="";
    }
  }
}

function chessStartClockTicker(){
  if(chessClockTimer) clearInterval(chessClockTimer);
  chessClockTimer=setInterval(()=>chessUpdateClockDisplay(),100);
}

function chessSetRoomStatus(text) {
  const el = document.getElementById("chessRoomStatus");
  if (el) el.textContent = text;
}

function chessEmptyOnlineState() {
  return {
    ws: null, code: "", connected: false, side: null, players: null,
    awaiting: false, result: null, drawOffer: null, rematchOffer: null,
    pendingProposal: null, clock: null, settings: null, ratings: null, ratingUpdate: null
  };
}

function chessDisconnectOnlineRoom() {
  if (!chessUi?.online) return;
  try { chessUi.online.ws?.close(1000, "Déconnexion"); } catch {}
  chessUi.online = chessEmptyOnlineState();
  const panel=document.getElementById("chessClockPanel"); if(panel) panel.hidden=true;
  const ratingBox=document.getElementById("chessRatingResult"); if(ratingBox){ratingBox.hidden=true;ratingBox.innerHTML="";}
  chessUpdateOnlineControls();
}

async function chessRefreshOnlineAccountState() {
  try {
    const user = await LudoOnline.me(true);
    if (!user) {
      const el = document.getElementById("chessRoomStatus");
      if (el) el.innerHTML = `Connexion requise — <a href="#/compte">Compte</a>`;
      return;
    }
    if (!chessUi?.online?.connected) chessSetRoomStatus(`Connecté : ${user.username}`);
  } catch {
    chessSetRoomStatus("Service en ligne indisponible.");
  }
}

function chessForceOnlineMode() {
  if (!chessUi) return;
  chessUi.mode = "online";
  chessUi.thinking = false;
  const mode = document.getElementById("chessMode");
  if (mode) mode.value = "online";
  const ai = document.getElementById("chessAiSettings");
  const online = document.getElementById("chessOnlineSettings");
  if (ai) ai.hidden = true;
  if (online) online.hidden = false;
}

async function chessCreateOnlineRoom() {
  chessForceOnlineMode();
  try {
    const user = await LudoOnline.me(true);
    if (!user) throw new Error("Connectez-vous d’abord.");
    const creatorColor = document.getElementById("chessCreatorColor")?.value || "random";
    const {initialSeconds,incrementSeconds}=chessReadTimeControl();
    const rated=document.getElementById("chessRated")?.checked!==false;
    const room = await LudoOnline.rooms.create("chess", { creatorColor, initialSeconds, incrementSeconds, rated });
    const input = document.getElementById("chessRoomCode");
    if (input) input.value = room.code;
    const chosen = room.side === "w" ? "Blancs" : "Noirs";
    const tc=room.timeControl||{initialSeconds:600,incrementSeconds:0};
    const cadence=`${tc.initialSeconds/60}+${tc.incrementSeconds}`;
    chessSetRoomStatus(`Salon ${room.code} créé — ${chosen}, cadence ${cadence}${room.rated?" classée":" amicale"}.`);
    chessConnectOnlineRoom(room.code);
  } catch (error) {
    chessSetRoomStatus(error.message);
  }
}

async function chessJoinOnlineRoom() {
  chessForceOnlineMode();
  const code = document.getElementById("chessRoomCode")?.value?.trim()?.toUpperCase();
  if (!code) return chessSetRoomStatus("Saisissez le code du salon.");
  try {
    const user = await LudoOnline.me(true);
    if (!user) throw new Error("Connectez-vous d’abord.");
    const room = await LudoOnline.rooms.join(code);
    if (room.game && room.game !== "chess") throw new Error("Ce code correspond à un autre jeu.");
    chessConnectOnlineRoom(code);
  } catch (error) {
    chessSetRoomStatus(error.message);
  }
}

function chessPlayersStatus(players) {
  const black = players?.black?.username || "en attente";
  const white = players?.white?.username || "en attente";
  return `Noirs : ${black} · Blancs : ${white}`;
}

function chessOnlineHasTwoPlayers() {
  return Boolean(chessUi?.online?.players?.black && chessUi?.online?.players?.white);
}

function chessProposalIsIncoming(offer) {
  if (!offer || !chessUi?.online?.side) return false;
  return offer.side !== chessUi.online.side;
}

function chessHideOnlinePrompt() {
  const box = document.getElementById("chessOnlinePrompt");
  if (box) box.hidden = true;
  if (chessUi?.online) chessUi.online.pendingProposal = null;
}

function chessShowOnlinePrompt(kind, offer) {
  const box = document.getElementById("chessOnlinePrompt");
  const title = document.getElementById("chessOnlinePromptTitle");
  const text = document.getElementById("chessOnlinePromptText");
  if (!box || !title || !text || !offer) return;
  chessUi.online.pendingProposal = kind;
  if (kind === "draw") {
    title.textContent = "Proposition de nulle";
    text.textContent = `${offer.username || "Votre adversaire"} propose la partie nulle.`;
  } else {
    title.textContent = "Proposition de revanche";
    text.textContent = `${offer.username || "Votre adversaire"} propose une revanche avec inversion des couleurs.`;
  }
  box.hidden = false;
}

function chessUpdateOnlineControls() {
  const actions = document.getElementById("chessOnlineActions");
  const resign = document.getElementById("resignChessOnline");
  const draw = document.getElementById("offerDrawChess");
  const rematch = document.getElementById("offerRematchChess");
  if (!actions || !chessUi) return;

  const online = chessUi.mode === "online" ? chessUi.online : null;
  const active = Boolean(online?.connected);
  const twoPlayers = active && chessOnlineHasTwoPlayers();
  const over = Boolean(online?.result?.over);
  actions.hidden = !active;

  if (resign) {
    resign.hidden = over;
    resign.disabled = !twoPlayers || Boolean(online?.awaiting);
  }
  if (draw) {
    draw.hidden = over;
    draw.disabled = !twoPlayers || Boolean(online?.drawOffer) || Boolean(online?.awaiting);
    draw.textContent = online?.drawOffer && !chessProposalIsIncoming(online.drawOffer)
      ? "Nulle proposée…"
      : "Proposer la nulle";
  }
  if (rematch) {
    rematch.hidden = !over;
    rematch.disabled = !twoPlayers || Boolean(online?.rematchOffer);
    rematch.textContent = online?.rematchOffer && !chessProposalIsIncoming(online.rematchOffer)
      ? "Revanche proposée…"
      : "Proposer une revanche";
  }

  if (!active) chessHideOnlinePrompt();
}

function chessSendOnlineAction(payload) {
  const ws = chessUi?.online?.ws;
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    chessSetRoomStatus("Connexion au salon indisponible.");
    return false;
  }
  ws.send(JSON.stringify(payload));
  return true;
}

function chessResignOnline() {
  if (!chessOnlineHasTwoPlayers() || chessUi?.online?.result?.over) return;
  if (!confirm("Voulez-vous vraiment abandonner cette partie ?")) return;
  chessSendOnlineAction({ type: "resign" });
}

function chessOfferDrawOnline() {
  if (!chessOnlineHasTwoPlayers() || chessUi?.online?.result?.over || chessUi?.online?.drawOffer) return;
  if (chessSendOnlineAction({ type: "draw_offer" })) {
    chessSetRoomStatus("Proposition de nulle envoyée à votre adversaire.");
  }
}

function chessOfferRematchOnline() {
  if (!chessOnlineHasTwoPlayers() || !chessUi?.online?.result?.over || chessUi?.online?.rematchOffer) return;
  if (chessSendOnlineAction({ type: "rematch_offer" })) {
    chessSetRoomStatus("Proposition de revanche envoyée.");
  }
}

function chessRespondToOnlineProposal(accept) {
  const kind = chessUi?.online?.pendingProposal;
  if (kind === "draw") chessSendOnlineAction({ type: "draw_response", accept });
  else if (kind === "rematch") chessSendOnlineAction({ type: "rematch_response", accept });
  chessHideOnlinePrompt();
}

function chessApplyOnlineState(serialized) {
  if (!serialized?.state || !chessUi) return;
  const game = new ChessGame();
  game.state = chessCloneState(serialized.state);
  game.history = Array.isArray(serialized.history)
    ? serialized.history.map(entry => ({
        state: chessCloneState(entry.state),
        move: { ...entry.move },
        san: entry.san
      }))
    : [];
  game.positionHistory = Array.isArray(serialized.positionHistory) && serialized.positionHistory.length
    ? [...serialized.positionHistory]
    : [chessPositionKey(game.state)];
  chessUi.game = game;
  chessUi.online.result = serialized.result || null;
  chessUi.online.awaiting = false;
  chessUi.selected = null;
  chessUi.candidateMoves = [];
  chessUi.pendingPromotion = null;
  hidePromotionPicker();
  renderChessBoard();
  chessUpdateOnlineControls();
}

function chessConnectOnlineRoom(code) {
  chessDisconnectOnlineRoom();
  chessUi.online.code = code.toUpperCase();
  chessSetRoomStatus(`Connexion au salon ${chessUi.online.code}…`);

  const ws = LudoOnline.rooms.connect(chessUi.online.code, {
    open: () => chessSetRoomStatus(`Salon ${chessUi.online.code} connecté.`),
    message: data => {
      if (data.gameType && data.gameType !== "chess") {
        chessSetRoomStatus("Ce salon n’est pas une partie d’échecs.");
        try { ws.close(); } catch {}
        return;
      }

      if (data.type === "welcome") {
        chessUi.online.connected = true;
        chessUi.online.side = data.side;
        chessUi.online.players = data.players || null;
        chessUi.online.drawOffer = data.drawOffer || null;
        chessUi.online.rematchOffer = data.rematchOffer || null;
        chessUi.online.settings = data.settings || null;
        chessUi.online.ratings = data.ratings || null;
        chessUi.online.ratingUpdate = data.ratingUpdate || null;
        chessSetOnlineClock(data.clock || null);
        chessUi.orientation = data.side === "b" ? "b" : "w";
        chessApplyOnlineState(data.game);
        chessRenderRatingResult(chessUi.online.ratingUpdate);
        chessUpdateClockDisplay();
        const color = data.side === "b" ? "Noirs" : "Blancs";
        chessSetRoomStatus(`Salon ${chessUi.online.code} — vous jouez les ${color}. ${chessPlayersStatus(data.players)}`);
        if (chessProposalIsIncoming(chessUi.online.drawOffer)) chessShowOnlinePrompt("draw", chessUi.online.drawOffer);
        else if (chessProposalIsIncoming(chessUi.online.rematchOffer)) chessShowOnlinePrompt("rematch", chessUi.online.rematchOffer);
        chessUpdateOnlineControls();
      } else if (data.type === "state") {
        if (data.players) chessUi.online.players = data.players;
        if (data.drawOffer !== undefined) chessUi.online.drawOffer = data.drawOffer;
        if (data.rematchOffer !== undefined) chessUi.online.rematchOffer = data.rematchOffer;
        if (data.settings) chessUi.online.settings = data.settings;
        if (data.ratings) chessUi.online.ratings = data.ratings;
        if (data.ratingUpdate !== undefined && data.ratingUpdate !== null) chessUi.online.ratingUpdate = data.ratingUpdate;
        if (data.clock) chessSetOnlineClock(data.clock);
        chessApplyOnlineState(data.game);
        if (data.ratingUpdate) chessRenderRatingResult(data.ratingUpdate);
        chessUpdateClockDisplay();
        if (data.game?.result?.over) {
          chessUi.online.drawOffer = null;
          chessHideOnlinePrompt();
        }
        chessUpdateOnlineControls();
      } else if (data.type === "players") {
        chessUi.online.players = data.players || null;
        if(data.settings) chessUi.online.settings=data.settings;
        if(data.ratings) chessUi.online.ratings=data.ratings;
        if(data.clock) chessSetOnlineClock(data.clock);
        chessSetRoomStatus(`Salon ${chessUi.online.code} — ${chessPlayersStatus(data.players)}`);
        renderChessInfo();
        chessUpdateClockDisplay();
        chessUpdateOnlineControls();
      } else if (data.type === "clock") {
        chessSetOnlineClock(data.clock || null);
      } else if (data.type === "draw_offer") {
        chessUi.online.drawOffer = data.offer || null;
        if (chessProposalIsIncoming(data.offer)) {
          chessShowOnlinePrompt("draw", data.offer);
          chessSetRoomStatus(`${data.offer?.username || "Votre adversaire"} propose la nulle.`);
        } else {
          chessSetRoomStatus("Proposition de nulle envoyée.");
        }
        chessUpdateOnlineControls();
      } else if (data.type === "draw_declined") {
        chessUi.online.drawOffer = null;
        chessHideOnlinePrompt();
        chessSetRoomStatus(data.implicit ? "Proposition de nulle refusée par le coup joué." : "Proposition de nulle refusée.");
        chessUpdateOnlineControls();
      } else if (data.type === "rematch_offer") {
        chessUi.online.rematchOffer = data.offer || null;
        if (chessProposalIsIncoming(data.offer)) {
          chessShowOnlinePrompt("rematch", data.offer);
          chessSetRoomStatus(`${data.offer?.username || "Votre adversaire"} propose une revanche.`);
        } else {
          chessSetRoomStatus("Proposition de revanche envoyée.");
        }
        chessUpdateOnlineControls();
      } else if (data.type === "rematch_declined") {
        chessUi.online.rematchOffer = null;
        chessHideOnlinePrompt();
        chessSetRoomStatus("Proposition de revanche refusée.");
        chessUpdateOnlineControls();
      } else if (data.type === "rematch_started") {
        chessUi.online.side = data.side;
        chessUi.online.players = data.players || null;
        chessUi.online.drawOffer = null;
        chessUi.online.rematchOffer = null;
        chessUi.online.settings = data.settings || chessUi.online.settings;
        chessUi.online.ratings = data.ratings || chessUi.online.ratings;
        chessUi.online.ratingUpdate = null;
        chessSetOnlineClock(data.clock || null);
        chessRenderRatingResult(null);
        chessHideOnlinePrompt();
        chessUi.orientation = data.side === "b" ? "b" : "w";
        chessApplyOnlineState(data.game);
        const color = data.side === "b" ? "Noirs" : "Blancs";
        chessSetRoomStatus(`Revanche commencée — vous jouez maintenant les ${color}. ${chessPlayersStatus(data.players)}`);
        chessUpdateOnlineControls();
      } else if (data.type === "error") {
        chessUi.online.awaiting = false;
        chessSetRoomStatus(data.message || "Action refusée par le serveur.");
        renderChessInfo();
        chessUpdateOnlineControls();
      }
    },
    close: () => {
      if (!chessUi?.online) return;
      chessUi.online.connected = false;
      chessUi.online.awaiting = false;
      chessHideOnlinePrompt();
      renderChessInfo();
      chessUpdateOnlineControls();
    },
    error: () => chessSetRoomStatus("Erreur de connexion WebSocket.")
  });
  chessUi.online.ws = ws;
}

function initChess() {
  // Si l’utilisateur revient sur la page, on ferme proprement une ancienne
  // connexion éventuelle avant de recréer l’interface.
  if (chessUi?.online?.ws) {
    try { chessUi.online.ws.close(1000, "Nouvelle interface"); } catch {}
  }

  const chessModeEl = document.getElementById("chessMode");
  if (chessModeEl) chessModeEl.value = "online";

  chessUi = {
    game: new ChessGame(),
    selected: null,
    candidateMoves: [],
    pendingPromotion: null,
    mode: "online",
    aiLevel: document.getElementById("chessAiLevel")?.value || "sf-1320",
    humanColor: "w",
    orientation: "w",
    thinking: false,
    online: chessEmptyOnlineState()
  };

  const chessAiSettings = document.getElementById("chessAiSettings");
  const chessOnlineSettings = document.getElementById("chessOnlineSettings");
  if (chessAiSettings) chessAiSettings.hidden = true;
  if (chessOnlineSettings) chessOnlineSettings.hidden = false;

  document.getElementById("chessMode").addEventListener("change", e => {
    const previousMode = chessUi.mode;
    if (previousMode === "online" && e.target.value !== "online") chessDisconnectOnlineRoom();
    chessUi.mode = e.target.value;
    document.getElementById("chessAiSettings").hidden = chessUi.mode !== "ai";
    document.getElementById("chessOnlineSettings").hidden = chessUi.mode !== "online";
    if (chessUi.mode === "online") {
      chessDisconnectOnlineRoom();
      chessUi.game = new ChessGame();
      chessUi.orientation = "w";
      chessUi.selected = null;
      chessUi.candidateMoves = [];
      renderChessBoard();
      chessRefreshOnlineAccountState();
    } else {
      newChessGame();
    }
  });

  document.getElementById("chessAiLevel").addEventListener("change", e => chessUi.aiLevel = e.target.value);
  document.getElementById("chessSide").addEventListener("change", e => {
    chessUi.humanColor = e.target.value;
    chessUi.orientation = e.target.value;
    newChessGame();
  });
  document.getElementById("newChess").addEventListener("click", newChessGame);
  document.getElementById("undoChess").addEventListener("click", undoChessMove);
  document.getElementById("flipChess").addEventListener("click", () => {
    chessUi.orientation = chessUi.orientation === "w" ? "b" : "w";
    renderChessBoard();
  });
  document.getElementById("chessTimePreset")?.addEventListener("change", e => {
    const custom=document.getElementById("chessCustomTime");
    if(custom) custom.hidden=e.target.value!=="custom";
  });
  document.getElementById("createChessRoom")?.addEventListener("click", chessCreateOnlineRoom);
  document.getElementById("joinChessRoom")?.addEventListener("click", chessJoinOnlineRoom);
  document.getElementById("resignChessOnline")?.addEventListener("click", chessResignOnline);
  document.getElementById("offerDrawChess")?.addEventListener("click", chessOfferDrawOnline);
  document.getElementById("offerRematchChess")?.addEventListener("click", chessOfferRematchOnline);
  document.getElementById("acceptChessProposal")?.addEventListener("click", () => chessRespondToOnlineProposal(true));
  document.getElementById("declineChessProposal")?.addEventListener("click", () => chessRespondToOnlineProposal(false));
  document.getElementById("promotionPicker").addEventListener("click", e => {
    const piece = e.target.closest("button")?.dataset.promotion;
    if (piece) finishPromotion(piece);
  });

  chessStartClockTicker();
  newChessGame();
}

function newChessGame() {
  window.StrathasardStockfish?.stop?.();
  if (chessUi.mode === "online") {
    chessDisconnectOnlineRoom();
    chessUi.game = new ChessGame();
    chessUi.selected = null;
    chessUi.candidateMoves = [];
    chessUi.pendingPromotion = null;
    chessUi.orientation = "w";
    hidePromotionPicker();
    renderChessBoard();
    chessRefreshOnlineAccountState();
    return;
  }

  chessUi.game.reset();
  chessUi.selected = null;
  chessUi.candidateMoves = [];
  chessUi.pendingPromotion = null;
  chessUi.thinking = false;
  if (chessUi.mode === "local") chessUi.orientation = "w";
  else chessUi.orientation = chessUi.humanColor;
  hidePromotionPicker();
  renderChessBoard();
  maybeChessAiTurn();
}

function chessBoardOrder() {
  const rows = chessUi.orientation === "w" ? [0,1,2,3,4,5,6,7] : [7,6,5,4,3,2,1,0];
  const cols = chessUi.orientation === "w" ? [0,1,2,3,4,5,6,7] : [7,6,5,4,3,2,1,0];
  return { rows, cols };
}

function renderChessBoard() {
  const board = document.getElementById("chessBoard");
  if (!board) return;
  const { rows, cols } = chessBoardOrder();
  const legalTargets = new Map();
  for (const move of chessUi.candidateMoves) legalTargets.set(`${move.tr},${move.tc}`, move);
  const last = chessUi.game.history.at(-1)?.move;

  let html = "";
  rows.forEach((r, vr) => {
    cols.forEach((c, vc) => {
      const piece = chessUi.game.state.board[r][c];
      const selected = chessUi.selected && chessUi.selected[0] === r && chessUi.selected[1] === c;
      const move = legalTargets.get(`${r},${c}`);
      const wasLast = last && ((last.fr === r && last.fc === c) || (last.tr === r && last.tc === c));
      const squareColor = (r + c) % 2 ? "dark" : "light";
      const rankLabel = vc === 0 ? `<span class="coord rank">${8-r}</span>` : "";
      const fileLabel = vr === 7 ? `<span class="coord file">${"abcdefgh"[c]}</span>` : "";
      const classes = ["chess-square", squareColor, selected ? "selected" : "", move ? "legal" : "", move?.capture ? "capture" : "", wasLast ? "last" : ""].filter(Boolean).join(" ");
      html += `<button class="${classes}" data-r="${r}" data-c="${c}" aria-label="${chessSquareName(r,c)}${piece ? ` ${CHESS_PIECES[piece]}` : ""}">${rankLabel}${fileLabel}${piece ? `<span class="chess-piece ${chessColor(piece) === "w" ? "white-piece" : "black-piece"}">${CHESS_PIECES[piece]}</span>` : ""}<span class="move-dot"></span></button>`;
    });
  });
  board.innerHTML = html;
  board.querySelectorAll(".chess-square").forEach(btn => btn.addEventListener("click", onChessSquareClick));
  renderChessInfo();
}

function renderChessInfo() {
  const localStatus = chessUi.game.status();
  const statusEl = document.getElementById("chessStatus");
  const turnEl = document.getElementById("chessTurn");
  const historyEl = document.getElementById("chessHistory");
  if (!statusEl || !turnEl || !historyEl) return;

  let text = chessUi.thinking ? "L’IA réfléchit…" : localStatus.text;
  let alert = localStatus.type === "check" || localStatus.type === "checkmate";

  if (chessUi.mode === "online") {
    const online = chessUi.online;
    if (online.result?.over) {
      text = online.result.text || "Partie terminée.";
      alert = ["checkmate", "timeout", "resign"].includes(online.result.type);
    } else if (!online.connected) {
      text = "Mode en ligne : créez un salon ou rejoignez-en un avec son code.";
      alert = false;
    } else if (!online.players?.white || !online.players?.black) {
      const missing = !online.players?.white ? "Blancs" : "Noirs";
      text = `Salon créé : en attente du joueur ${missing}.`;
      alert = false;
    } else if (online.awaiting) {
      text = "Coup envoyé au serveur…";
      alert = false;
    } else if (chessUi.game.state.turn === online.side) {
      text = `${online.side === "w" ? "Blancs" : "Noirs"} : à vous de jouer${localStatus.type === "check" ? " — Échec !" : ""}`;
    } else {
      text = `En attente du coup des ${chessUi.game.state.turn === "w" ? "Blancs" : "Noirs"}…`;
      alert = false;
    }
  }

  statusEl.textContent = text;
  statusEl.classList.toggle("alert", alert);
  turnEl.textContent = chessUi.game.state.turn === "w" ? "Blancs" : "Noirs";

  const moves = chessUi.game.history;
  const rows = [];
  for (let i = 0; i < moves.length; i += 2) {
    rows.push(`<div class="history-row"><span>${i/2 + 1}.</span><span>${moves[i]?.san || ""}</span><span>${moves[i+1]?.san || ""}</span></div>`);
  }
  historyEl.innerHTML = rows.length ? rows.join("") : `<div class="history-empty">Les coups apparaîtront ici.</div>`;
  historyEl.scrollTop = historyEl.scrollHeight;

  document.getElementById("undoChess").disabled = chessUi.mode === "online" || chessUi.thinking || !moves.length || (chessUi.mode === "ai" && moves.length < 2);
  if (chessUi.mode === "online") chessUpdateOnlineControls();
}

function onChessSquareClick(event) {
  if (chessUi.thinking || chessUi.pendingPromotion) return;
  if (chessUi.mode === "online") {
    if (!chessUi.online.connected || chessUi.online.awaiting || chessUi.online.result?.over) return;
    if (chessUi.game.state.turn !== chessUi.online.side) return;
  } else if (chessUi.game.status().over) {
    return;
  }

  const r = Number(event.currentTarget.dataset.r);
  const c = Number(event.currentTarget.dataset.c);
  const piece = chessUi.game.state.board[r][c];
  const turn = chessUi.game.state.turn;

  if (chessUi.mode === "ai" && turn !== chessUi.humanColor) return;

  if (chessUi.selected) {
    const matches = chessUi.candidateMoves.filter(m => m.tr === r && m.tc === c);
    if (matches.length) {
      if (matches.some(m => m.promotion)) {
        chessUi.pendingPromotion = matches;
        showPromotionPicker(turn);
        return;
      }
      playChessMove(matches[0]);
      return;
    }
  }

  if (piece && chessColor(piece) === turn) {
    chessUi.selected = [r, c];
    chessUi.candidateMoves = chessUi.game.legalMovesFrom(r, c);
  } else {
    chessUi.selected = null;
    chessUi.candidateMoves = [];
  }
  renderChessBoard();
}

function showPromotionPicker(color) {
  const picker = document.getElementById("promotionPicker");
  picker.hidden = false;
  picker.querySelectorAll("button").forEach(btn => {
    const p = btn.dataset.promotion;
    btn.textContent = CHESS_PIECES[color === "w" ? p : p.toLowerCase()];
  });
}

function hidePromotionPicker() {
  const picker = document.getElementById("promotionPicker");
  if (picker) picker.hidden = true;
}

function finishPromotion(piece) {
  if (!chessUi.pendingPromotion) return;
  const move = chessUi.pendingPromotion.find(m => m.promotion === piece);
  chessUi.pendingPromotion = null;
  hidePromotionPicker();
  if (move) playChessMove(move);
}

function playChessMove(move) {
  if (chessUi.mode === "online") {
    const ws = chessUi.online.ws;
    if (!chessUi.online.connected || !ws || ws.readyState !== WebSocket.OPEN || chessUi.online.awaiting) return;
    chessUi.online.awaiting = true;
    chessUi.selected = null;
    chessUi.candidateMoves = [];
    ws.send(JSON.stringify({
      type: "move",
      move: { fr: move.fr, fc: move.fc, tr: move.tr, tc: move.tc, promotion: move.promotion || null }
    }));
    renderChessBoard();
    return;
  }

  if (!chessUi.game.play(move)) return;
  chessUi.selected = null;
  chessUi.candidateMoves = [];
  renderChessBoard();
  maybeChessAiTurn();
}

function undoChessMove() {
  if (chessUi.mode === "online" || chessUi.thinking) return;
  if (chessUi.mode === "ai") {
    if (chessUi.game.history.length < 2) return;
    chessUi.game.undo();
    if (chessUi.game.state.turn !== chessUi.humanColor && chessUi.game.history.length) chessUi.game.undo();
  } else {
    chessUi.game.undo();
  }
  chessUi.selected = null;
  chessUi.candidateMoves = [];
  renderChessBoard();
}

function chessLevelUsesStockfish(level) {
  return String(level || "").startsWith("sf-");
}

function maybeChessAiTurn() {
  if (chessUi.mode !== "ai" || chessUi.game.status().over || chessUi.game.state.turn === chessUi.humanColor) return;
  chessUi.thinking = true;
  renderChessInfo();

  const gameAtStart = chessUi.game;
  const turnAtStart = chessUi.game.state.turn;
  const levelAtStart = chessUi.aiLevel;

  window.setTimeout(async () => {
    let move = null;

    try {
      if (chessLevelUsesStockfish(levelAtStart) && window.StrathasardStockfish) {
        move = await window.StrathasardStockfish.chooseMove(gameAtStart, levelAtStart);
      } else {
        move = chessChooseAiMove(gameAtStart, levelAtStart);
      }
    } catch (error) {
      console.warn("Stockfish indisponible, repli sur l’IA Strathasard :", error);
      move = chessChooseAiMove(gameAtStart, "hard");
    }

    // Si l'utilisateur a changé de mode, recommencé la partie ou si la position
    // a évolué pendant le calcul, on ignore la réponse tardive du moteur.
    if (chessUi.mode !== "ai" || chessUi.game !== gameAtStart || chessUi.game.state.turn !== turnAtStart) {
      chessUi.thinking = false;
      renderChessBoard();
      return;
    }

    if (move) chessUi.game.play(move);
    chessUi.thinking = false;
    renderChessBoard();
  }, 180);
}
