// ============================================================
// ABALONE — moteur local 2 joueurs / IA
// ============================================================
// Plateau hexagonal de rayon 4 en coordonnées axiales (q,r).
// Valeurs : 0 = vide, 1 = Noir, 2 = Blanc.
// Règles gérées : déplacements de 1 à 3 billes, mouvements
// en ligne / latéraux, Sumito 2v1, 3v1, 3v2, éjection et victoire.

const AB_EMPTY = 0;
const AB_BLACK = 1;
const AB_WHITE = 2;
const AB_RADIUS = 4;
const AB_DIRS = [
  [1, 0], [0, 1], [-1, 1],
  [-1, 0], [0, -1], [1, -1]
];
const AB_AXES = [[1,0],[0,1],[1,-1]];

function abOther(player) {
  return player === AB_BLACK ? AB_WHITE : AB_BLACK;
}

function abKey(q, r) {
  return `${q},${r}`;
}

function abParse(key) {
  return key.split(',').map(Number);
}

function abInside(q, r) {
  return Math.abs(q) <= AB_RADIUS && Math.abs(r) <= AB_RADIUS && Math.abs(q + r) <= AB_RADIUS;
}

function abAddKey(key, dir) {
  const [q, r] = abParse(key);
  return abKey(q + dir[0], r + dir[1]);
}

function abNeg(dir) {
  return [-dir[0], -dir[1]];
}

function abSameDir(a, b) {
  return a[0] === b[0] && a[1] === b[1];
}

function abDirectionName(dir) {
  const names = ["→", "↘", "↙", "←", "↖", "↗"];
  const i = AB_DIRS.findIndex(d => abSameDir(d, dir));
  return names[i] || "•";
}

function abDistance(q, r) {
  return Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r));
}

function abCells() {
  const cells = [];
  for (let r = -AB_RADIUS; r <= AB_RADIUS; r++) {
    for (let q = -AB_RADIUS; q <= AB_RADIUS; q++) {
      if (abInside(q, r)) cells.push([q, r]);
    }
  }
  return cells;
}

const AB_CELLS = abCells();

function abEmptyBoard() {
  const board = Object.create(null);
  for (const [q,r] of AB_CELLS) board[abKey(q,r)] = AB_EMPTY;
  return board;
}

function abCloneBoard(board) {
  return { ...board };
}

function abStandardBoard() {
  const board = abEmptyBoard();

  // Position standard : 5 + 6 + 3 billes par camp.
  // Noir occupe le haut du plateau, Blanc le bas.
  for (const [q,r] of AB_CELLS) {
    if (r === -4 || r === -3) board[abKey(q,r)] = AB_BLACK;
    if (r === 4 || r === 3) board[abKey(q,r)] = AB_WHITE;
  }
  // Troisième rangée : trois billes centrées.
  for (const q of [0,1,2]) board[abKey(q,-2)] = AB_BLACK;
  for (const q of [-2,-1,0]) board[abKey(q,2)] = AB_WHITE;
  return board;
}

function abProjection(key, dir) {
  const [q,r] = abParse(key);
  // Produit scalaire suffisant pour ordonner le long d'une direction.
  return q * dir[0] + r * dir[1];
}

function abNormalizeGroup(group) {
  return [...group].sort().join('|');
}

function abGroupAxis(group) {
  if (group.length < 2) return null;
  // On ne dépend pas de l'ordre dans lequel l'utilisateur a sélectionné les billes.
  for (const axis of AB_AXES) {
    const sorted = [...group].sort((a,b) => abProjection(a, axis) - abProjection(b, axis));
    let ok = true;
    for (let i=1; i<sorted.length; i++) {
      if (abAddKey(sorted[i-1], axis) !== sorted[i]) { ok = false; break; }
    }
    if (ok) return axis;
  }
  return null;
}

function abIsContiguousAligned(group) {
  if (!Array.isArray(group) || group.length < 1 || group.length > 3) return false;
  const unique = [...new Set(group)];
  if (unique.length !== group.length) return false;
  if (group.length === 1) return true;

  for (const axis of AB_AXES) {
    const sorted = [...group].sort((a,b) => abProjection(a, axis) - abProjection(b, axis));
    let ok = true;
    for (let i=1; i<sorted.length; i++) {
      if (abAddKey(sorted[i-1], axis) !== sorted[i]) { ok = false; break; }
    }
    if (ok) return true;
  }
  return false;
}

function abGroupsForPlayer(board, player) {
  const groups = [];
  const seen = new Set();
  const ownKeys = AB_CELLS.map(([q,r]) => abKey(q,r)).filter(k => board[k] === player);

  for (const key of ownKeys) {
    const sig = key;
    if (!seen.has(sig)) { seen.add(sig); groups.push([key]); }
  }

  for (const axis of AB_AXES) {
    for (const start of ownKeys) {
      for (const len of [2,3]) {
        const group = [start];
        let cur = start;
        let ok = true;
        for (let i=1; i<len; i++) {
          cur = abAddKey(cur, axis);
          const [q,r] = abParse(cur);
          if (!abInside(q,r) || board[cur] !== player) { ok = false; break; }
          group.push(cur);
        }
        if (!ok) continue;
        const sig = abNormalizeGroup(group);
        if (!seen.has(sig)) { seen.add(sig); groups.push(group); }
      }
    }
  }
  return groups;
}

function abAnalyzeMove(board, player, group, dir) {
  if (!abIsContiguousAligned(group)) return null;
  if (!AB_DIRS.some(d => abSameDir(d, dir))) return null;
  if (group.some(k => board[k] !== player)) return null;

  const opponent = abOther(player);
  if (group.length === 1) {
    const dest = abAddKey(group[0], dir);
    const [dq,dr] = abParse(dest);
    if (!abInside(dq,dr) || board[dest] !== AB_EMPTY) return null;
    return { group:[...group], dir:[...dir], type:"single", push:[], eject:0, destinations:[dest] };
  }

  const axis = abGroupAxis(group);
  const inline = abSameDir(dir, axis) || abSameDir(dir, abNeg(axis));

  if (!inline) {
    const destinations = group.map(k => abAddKey(k, dir));
    for (const dest of destinations) {
      const [q,r] = abParse(dest);
      if (!abInside(q,r) || board[dest] !== AB_EMPTY) return null;
    }
    return { group:[...group], dir:[...dir], type:"broadside", push:[], eject:0, destinations };
  }

  // La bille de tête est celle dont la case suivante n'appartient plus au groupe.
  const groupSet = new Set(group);
  const front = group.find(k => !groupSet.has(abAddKey(k, dir)));
  if (!front) return null;
  const ahead = abAddKey(front, dir);
  const [aq,ar] = abParse(ahead);
  if (!abInside(aq,ar)) return null; // ses propres billes ne peuvent sortir du plateau.

  if (board[ahead] === AB_EMPTY) {
    return { group:[...group], dir:[...dir], type:"inline", push:[], eject:0, destinations:group.map(k => abAddKey(k,dir)) };
  }
  if (board[ahead] === player) return null;

  // Chaîne adverse contiguë devant le groupe.
  const push = [];
  let cursor = ahead;
  while (true) {
    const [q,r] = abParse(cursor);
    if (!abInside(q,r) || board[cursor] !== opponent) break;
    push.push(cursor);
    cursor = abAddKey(cursor, dir);
  }

  if (!push.length || push.length >= group.length || push.length > 2) return null;
  const [cq,cr] = abParse(cursor);
  if (abInside(cq,cr) && board[cursor] !== AB_EMPTY) return null;

  return {
    group:[...group], dir:[...dir], type:"sumito", push,
    eject: abInside(cq,cr) ? 0 : 1,
    destinations: group.map(k => abAddKey(k,dir))
  };
}

function abGenerateMoves(board, player) {
  const moves = [];
  const seen = new Set();
  for (const group of abGroupsForPlayer(board, player)) {
    for (const dir of AB_DIRS) {
      const move = abAnalyzeMove(board, player, group, dir);
      if (!move) continue;
      const sig = `${abNormalizeGroup(group)}>${dir.join(',')}`;
      if (!seen.has(sig)) { seen.add(sig); moves.push(move); }
    }
  }
  return moves;
}

function abApplyMoveToBoard(board, player, move) {
  const next = abCloneBoard(board);
  const opponent = abOther(player);

  // Retirer d'abord tout ce qui se déplace évite les écrasements.
  for (const key of move.group) next[key] = AB_EMPTY;
  for (const key of move.push || []) next[key] = AB_EMPTY;

  // Déplacer la chaîne adverse, de la plus éloignée à la plus proche.
  for (const key of move.push || []) {
    const dest = abAddKey(key, move.dir);
    const [q,r] = abParse(dest);
    if (abInside(q,r)) next[dest] = opponent;
  }

  for (const key of move.group) {
    const dest = abAddKey(key, move.dir);
    next[dest] = player;
  }
  return next;
}

function abMoveLabel(move) {
  const kind = move.type === "sumito" ? `Sumito ${move.group.length}–${move.push.length}` : (move.type === "broadside" ? "Latéral" : "Ligne");
  return `${kind} ${abDirectionName(move.dir)}${move.eject ? " • éjection" : ""}`;
}

class AbaloneGame {
  constructor() { this.reset(); }

  reset() {
    this.board = abStandardBoard();
    this.turn = AB_BLACK;
    this.ejected = { [AB_BLACK]: 0, [AB_WHITE]: 0 }; // nombre de billes adverses éjectées par ce joueur
    this.over = false;
    this.winner = null;
    this.moves = [];
    this.history = [];
  }

  legalMoves() {
    if (this.over) return [];
    return abGenerateMoves(this.board, this.turn);
  }

  movesForGroup(group) {
    if (this.over || !abIsContiguousAligned(group) || group.some(k => this.board[k] !== this.turn)) return [];
    return AB_DIRS.map(dir => abAnalyzeMove(this.board, this.turn, group, dir)).filter(Boolean);
  }

  saveSnapshot() {
    this.history.push({
      board: abCloneBoard(this.board), turn: this.turn,
      ejected: { ...this.ejected }, over: this.over, winner: this.winner,
      moves: this.moves.map(m => ({...m, group:[...m.group], dir:[...m.dir], push:[...(m.push||[])], destinations:[...(m.destinations||[])]}))
    });
  }

  play(move) {
    if (this.over) return false;
    const legal = abAnalyzeMove(this.board, this.turn, move.group, move.dir);
    if (!legal) return false;

    this.saveSnapshot();
    const player = this.turn;
    this.board = abApplyMoveToBoard(this.board, player, legal);
    if (legal.eject) this.ejected[player] += legal.eject;
    const moveRecord = { ...legal, player, label: abMoveLabel(legal) };
    this.moves.push(moveRecord);

    if (this.ejected[player] >= 6) {
      this.over = true;
      this.winner = player;
    } else {
      this.turn = abOther(player);
    }

    // Mémorise l'évaluation de la position APRES le coup.
    // Les deux notes sont conservées dans l'historique afin de suivre
    // l'évolution stratégique de la partie coup après coup.
    const evaluation = abPositionEvaluation(this);
    moveRecord.evalBlack = evaluation.blackNote;
    moveRecord.evalWhite = evaluation.whiteNote;
    moveRecord.evalRawBlack = evaluation.rawBlack;
    return true;
  }

  undo() {
    if (!this.history.length) return false;
    const snap = this.history.pop();
    this.board = abCloneBoard(snap.board);
    this.turn = snap.turn;
    this.ejected = { ...snap.ejected };
    this.over = snap.over;
    this.winner = snap.winner;
    this.moves = snap.moves.map(m => ({...m, group:[...m.group], dir:[...m.dir], push:[...(m.push||[])], destinations:[...(m.destinations||[])]}));
    return true;
  }
}

// ------------------------------------------------------------
// Évaluation stratégique de l'IA Abalone
// ------------------------------------------------------------
// Le niveau Expert utilise un barème non linéaire : plus on se
// rapproche de la 6e bille éjectée, plus chaque nouvelle éjection
// devient importante. C'est volontairement plus réaliste qu'un
// simple score fixe par bille.
const AB_EJECTION_SCORE = [0, 800, 1800, 3200, 5000, 8000, 100000];

function abCountConnectedComponents(board, player) {
  const own = AB_CELLS.map(([q,r]) => abKey(q,r)).filter(k => board[k] === player);
  const remaining = new Set(own);
  let components = 0;
  while (remaining.size) {
    components++;
    const first = remaining.values().next().value;
    remaining.delete(first);
    const stack = [first];
    while (stack.length) {
      const key = stack.pop();
      const [q,r] = abParse(key);
      for (const dir of AB_DIRS) {
        const nq = q + dir[0], nr = r + dir[1];
        if (!abInside(nq,nr)) continue;
        const nk = abKey(nq,nr);
        if (board[nk] === player && remaining.has(nk)) {
          remaining.delete(nk);
          stack.push(nk);
        }
      }
    }
  }
  return components;
}

function abPositionalFeatures(board, player) {
  let centre = 0;
  let cohesion = 0;
  let edgeRisk = 0;
  let isolated = 0;
  let localMobility = 0;

  for (const [q,r] of AB_CELLS) {
    const key = abKey(q,r);
    if (board[key] !== player) continue;
    const dist = abDistance(q,r);

    // Contrôle du centre : un bonus doux mais permanent.
    centre += 24 - dist * 5;

    let friends = 0;
    let emptyNeighbours = 0;
    for (const dir of AB_DIRS) {
      const nq = q + dir[0], nr = r + dir[1];
      if (!abInside(nq,nr)) continue;
      const v = board[abKey(nq,nr)];
      if (v === player) friends++;
      else if (v === AB_EMPTY) emptyNeighbours++;
    }

    // Chaque voisin ami renforce la compacité du groupe.
    cohesion += friends * 2.0;
    if (friends === 0) isolated++;
    localMobility += emptyNeighbours;

    // Une bille sur l'anneau extérieur est beaucoup plus vulnérable.
    if (dist === 4) edgeRisk += 1;
    else if (dist === 3) edgeRisk += 0.22;
  }

  const components = abCountConnectedComponents(board, player);
  return { centre, cohesion, edgeRisk, isolated, localMobility, components };
}

function abTacticalFeatures(board, player) {
  const moves = abGenerateMoves(board, player);
  let sumitos = 0;
  let ejectThreats = 0;
  let pushedMarbles = 0;
  for (const move of moves) {
    if (move.type !== "sumito") continue;
    sumitos++;
    pushedMarbles += move.push.length;
    if (move.eject) ejectThreats++;
  }
  return { moves: moves.length, sumitos, ejectThreats, pushedMarbles };
}

function abEvaluateExpert(game, perspective) {
  const enemy = abOther(perspective);
  if (game.over) return game.winner === perspective ? 1000000 : -1000000;

  // 1) Situation au score : progression non linéaire vers la victoire.
  let score = AB_EJECTION_SCORE[game.ejected[perspective]]
            - AB_EJECTION_SCORE[game.ejected[enemy]];

  // 2) Qualité géométrique de la formation.
  const me = abPositionalFeatures(game.board, perspective);
  const them = abPositionalFeatures(game.board, enemy);
  score += (me.centre - them.centre) * 1.00;
  score += (me.cohesion - them.cohesion) * 1.15;
  score += (me.localMobility - them.localMobility) * 0.38;
  score -= (me.edgeRisk - them.edgeRisk) * 15;
  score -= (me.isolated - them.isolated) * 18;
  score -= (me.components - them.components) * 10;

  // 3) Pression tactique : Sumitos et menaces d'éjection disponibles.
  const myTac = abTacticalFeatures(game.board, perspective);
  const enTac = abTacticalFeatures(game.board, enemy);
  score += (myTac.moves - enTac.moves) * 0.45;
  score += (myTac.sumitos - enTac.sumitos) * 8;
  score += (myTac.pushedMarbles - enTac.pushedMarbles) * 4;
  score += (myTac.ejectThreats - enTac.ejectThreats) * 95;

  return score;
}

// Convertit le score brut de l'évaluation Expert en une note pédagogique
// de 0 à 100. 50/50 = position équilibrée. Il s'agit d'un indice
// heuristique, pas d'une probabilité mathématique de victoire.
const AB_EVAL_SCALE = 3500;

function abPositionEvaluation(game) {
  if (game.over) {
    return game.winner === AB_BLACK
      ? { rawBlack: 1000000, rawWhite: -1000000, blackNote: 100, whiteNote: 0 }
      : { rawBlack: -1000000, rawWhite: 1000000, blackNote: 0, whiteNote: 100 };
  }
  const rawBlack = abEvaluateExpert(game, AB_BLACK);
  const rawWhite = -rawBlack;
  const blackNote = 50 + 49 * Math.tanh(rawBlack / AB_EVAL_SCALE);
  const roundedBlack = Math.round(Math.max(0, Math.min(100, blackNote)) * 10) / 10;
  const roundedWhite = Math.round((100 - roundedBlack) * 10) / 10;
  return { rawBlack, rawWhite, blackNote: roundedBlack, whiteNote: roundedWhite };
}

function abEvaluate(game, perspective) {
  const enemy = abOther(perspective);
  if (game.over) return game.winner === perspective ? 100000 : -100000;
  let score = (game.ejected[perspective] - game.ejected[enemy]) * 1400;

  for (const [q,r] of AB_CELLS) {
    const value = game.board[abKey(q,r)];
    if (!value) continue;
    const sign = value === perspective ? 1 : -1;
    const dist = abDistance(q,r);
    score += sign * (26 - dist * 5); // centre
    let friends = 0;
    for (const dir of AB_DIRS) {
      const k = abKey(q+dir[0], r+dir[1]);
      if (abInside(q+dir[0], r+dir[1]) && game.board[k] === value) friends++;
    }
    score += sign * friends * 2.3; // cohésion
    if (dist === 4) score -= sign * 4; // prudence près du bord
  }
  return score;
}

function abSimGame(game, move) {
  const g = Object.create(AbaloneGame.prototype);
  g.board = abCloneBoard(game.board);
  g.turn = game.turn;
  g.ejected = { ...game.ejected };
  g.over = game.over;
  g.winner = game.winner;
  g.moves = [];
  g.history = [];
  g.play(move);
  return g;
}

function abQuickMoveScore(game, move, perspective) {
  // Heuristique très rapide utilisée uniquement pour trier les branches.
  // L'alpha-bêta devient beaucoup plus efficace si les coups prometteurs
  // sont analysés en premier.
  let score = 0;
  if (move.eject) score += 5000;
  if (move.type === "sumito") score += 240 + move.push.length * 90;
  if (move.type === "broadside") score += 8;

  const next = abApplyMoveToBoard(game.board, game.turn, move);
  for (const key of move.destinations || []) {
    const [q,r] = abParse(key);
    const d = abDistance(q,r);
    score += (4-d) * 6;
  }
  // Le tri doit privilégier les bons coups du camp qui a le trait.
  // Le Minimax se charge ensuite de maximiser ou minimiser selon la perspective.
  return score;
}

function abExpertSearch(game, depth, alpha, beta, perspective, deadline, table) {
  if (performance.now() >= deadline) return { score: abEvaluateExpert(game, perspective), timedOut: true };
  if (depth <= 0 || game.over) return { score: abEvaluateExpert(game, perspective), timedOut: false };

  const boardSig = AB_CELLS.map(([q,r]) => game.board[abKey(q,r)]).join('');
  const cacheKey = `${boardSig}|${game.turn}|${game.ejected[AB_BLACK]}-${game.ejected[AB_WHITE]}|${depth}|${perspective}`;
  const cached = table.get(cacheKey);
  if (cached !== undefined) return { score: cached, timedOut: false };

  let moves = game.legalMoves();
  if (!moves.length) return { score: abEvaluateExpert(game, perspective), timedOut: false };

  // Recherche sélective : on conserve davantage de branches près de la racine,
  // puis on resserre le faisceau aux profondeurs suivantes.
  moves.sort((a,b) => abQuickMoveScore(game,b,perspective) - abQuickMoveScore(game,a,perspective));
  const branchLimit = depth >= 3 ? 22 : 16;
  if (moves.length > branchLimit) moves = moves.slice(0, branchLimit);

  const maximizing = game.turn === perspective;
  let best = maximizing ? -Infinity : Infinity;

  for (const move of moves) {
    const next = abSimGame(game, move);
    const result = abExpertSearch(next, depth-1, alpha, beta, perspective, deadline, table);
    if (result.timedOut) return { score: best === Infinity || best === -Infinity ? result.score : best, timedOut: true };

    if (maximizing) {
      if (result.score > best) best = result.score;
      if (best > alpha) alpha = best;
    } else {
      if (result.score < best) best = result.score;
      if (best < beta) beta = best;
    }
    if (beta <= alpha) break;
  }

  table.set(cacheKey, best);
  return { score: best, timedOut: false };
}

function abChooseExpertMove(game) {
  const perspective = game.turn;
  const legal = game.legalMoves();
  if (!legal.length) return null;

  // Une victoire immédiate doit toujours être jouée sans autre calcul.
  const winning = legal.find(m => m.eject && game.ejected[perspective] >= 5);
  if (winning) return winning;

  // Budget borné pour éviter de figer longtemps le navigateur.
  const start = performance.now();
  const deadline = start + 1800;
  const table = new Map();
  let bestMove = legal[0];

  // Iterative deepening : profondeur 2 garantie, puis 3 si le temps le permet.
  // En finale très dégagée (peu de coups), on tente une profondeur 4.
  const maxDepth = legal.length <= 18 ? 4 : 3;
  for (let depth = 2; depth <= maxDepth; depth++) {
    let localBest = null;
    let localScore = -Infinity;
    let completed = true;
    const ordered = [...legal].sort((a,b) => abQuickMoveScore(game,b,perspective) - abQuickMoveScore(game,a,perspective));

    for (const move of ordered) {
      if (performance.now() >= deadline) { completed = false; break; }
      const next = abSimGame(game, move);
      const result = abExpertSearch(next, depth-1, -Infinity, Infinity, perspective, deadline, table);
      if (result.timedOut) { completed = false; break; }
      let score = result.score;
      if (move.eject) score += 120; // petit départage tactique, sans écraser l'évaluation.
      if (score > localScore) { localScore = score; localBest = move; }
    }

    // On ne remplace le résultat de la profondeur précédente que si toute
    // la profondeur courante a été calculée.
    if (completed && localBest) bestMove = localBest;
    else break;
  }

  return bestMove;
}

function abChooseAiMove(game, level = "medium") {
  const moves = game.legalMoves();
  if (!moves.length) return null;
  if (level === "easy") return moves[Math.floor(Math.random()*moves.length)];
  if (level === "expert") return abChooseExpertMove(game);
  const perspective = game.turn;

  const scoreMove = move => {
    const next = abSimGame(game, move);
    let score = abEvaluate(next, perspective);
    if (move.eject) score += 500;
    if (move.type === "sumito") score += 30 + move.push.length * 12;
    return score;
  };

  if (level === "medium") {
    let best = -Infinity, choices = [];
    for (const move of moves) {
      const score = scoreMove(move) + Math.random()*2;
      if (score > best + 0.001) { best = score; choices = [move]; }
      else if (Math.abs(score-best)<0.001) choices.push(move);
    }
    return choices[Math.floor(Math.random()*choices.length)];
  }

  // Niveau difficile : un coup de l'IA + meilleure réponse adverse.
  let bestMove = moves[0], bestScore = -Infinity;
  const ordered = [...moves].sort((a,b) => scoreMove(b)-scoreMove(a));
  for (const move of ordered) {
    const next = abSimGame(game, move);
    if (next.over) return move;
    const replies = next.legalMoves();
    let worst = Infinity;
    if (!replies.length) worst = abEvaluate(next, perspective);
    else {
      // L'adversaire choisit la réponse la plus défavorable pour nous.
      const replyOrdered = [...replies].sort((a,b) => {
        const ga = abSimGame(next,a), gb = abSimGame(next,b);
        return abEvaluate(ga,perspective)-abEvaluate(gb,perspective);
      });
      const limit = Math.min(replyOrdered.length, 70);
      for (let i=0; i<limit; i++) {
        const after = abSimGame(next, replyOrdered[i]);
        const s = abEvaluate(after, perspective);
        if (s < worst) worst = s;
      }
    }
    const finalScore = worst + (move.eject ? 350 : 0);
    if (finalScore > bestScore) { bestScore = finalScore; bestMove = move; }
  }
  return bestMove;
}

// -------------------------------
// Interface navigateur
// -------------------------------
let abaloneUi = null;

// ------------------------------------------------------------
// Sauvegardes locales Abalone
// ------------------------------------------------------------
// Les parties sont stockées dans le localStorage du navigateur.
// Elles restent donc disponibles après fermeture du site sur ce navigateur.
const AB_SAVE_STORAGE_KEY = "ludotheque_abalone_saves_v1";
const AB_MAX_SAVES = 100;

function abCloneMoveRecord(m) {
  return {
    ...m,
    group: [...(m.group || [])],
    dir: [...(m.dir || [])],
    push: [...(m.push || [])],
    destinations: [...(m.destinations || [])]
  };
}

function abSerializeGame(game) {
  return {
    board: { ...game.board },
    turn: game.turn,
    ejected: { ...game.ejected },
    over: game.over,
    winner: game.winner,
    moves: game.moves.map(abCloneMoveRecord)
  };
}

function abDeserializeGame(data) {
  const g = new AbaloneGame();
  if (!data || !data.board) return g;
  g.board = { ...data.board };
  g.turn = Number(data.turn) || AB_BLACK;
  g.ejected = { [AB_BLACK]: Number(data.ejected?.[AB_BLACK] || 0), [AB_WHITE]: Number(data.ejected?.[AB_WHITE] || 0) };
  g.over = Boolean(data.over);
  g.winner = data.winner == null ? null : Number(data.winner);
  g.moves = Array.isArray(data.moves) ? data.moves.map(abCloneMoveRecord) : [];
  // Une partie chargée peut être poursuivie. L'annulation repart de ce point.
  g.history = [];
  return g;
}

function abReadSavedGames() {
  try {
    const parsed = JSON.parse(localStorage.getItem(AB_SAVE_STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.warn("Impossible de lire les sauvegardes Abalone", e);
    return [];
  }
}

function abWriteSavedGames(saves) {
  localStorage.setItem(AB_SAVE_STORAGE_KEY, JSON.stringify(saves.slice(0, AB_MAX_SAVES)));
}

function abSaveLabel(save) {
  const date = new Date(save.savedAt);
  const dateText = Number.isNaN(date.getTime()) ? "Date inconnue" : date.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
  const name = save.name ? `${save.name} — ` : "";
  const b = save.game?.ejected?.[AB_BLACK] ?? 0;
  const w = save.game?.ejected?.[AB_WHITE] ?? 0;
  const level = save.ui?.mode === "ai" ? `IA ${save.ui.aiLevel || "medium"}` : "2 joueurs";
  return `${name}${dateText} • N ${b} / B ${w} • ${level}`;
}

function refreshAbaloneSaveList(selectedId = "") {
  const select = document.getElementById("abaloneSaveList");
  if (!select) return;
  const saves = abReadSavedGames();
  select.innerHTML = `<option value="">Parties sauvegardées (${saves.length})…</option>` +
    saves.map(sv => `<option value="${sv.id}">${abEscapeHtml(abSaveLabel(sv))}</option>`).join("");
  if (selectedId && saves.some(s => s.id === selectedId)) select.value = selectedId;
}

function abEscapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[ch]));
}

function saveCurrentAbaloneGame() {
  if (!abaloneUi) return;
  const input = document.getElementById("abaloneSaveName");
  const name = (input?.value || "").trim();
  const save = {
    version: 1,
    id: `${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
    savedAt: new Date().toISOString(),
    name,
    game: abSerializeGame(abaloneUi.game),
    ui: { mode: abaloneUi.mode, aiLevel: abaloneUi.aiLevel, humanSide: abaloneUi.humanSide }
  };
  const saves = abReadSavedGames();
  saves.unshift(save);
  try {
    abWriteSavedGames(saves);
    if (input) input.value = "";
    refreshAbaloneSaveList(save.id);
    const status = document.getElementById("abaloneSaveStatus");
    if (status) status.textContent = "Partie sauvegardée dans ce navigateur.";
  } catch (e) {
    const status = document.getElementById("abaloneSaveStatus");
    if (status) status.textContent = "La sauvegarde a échoué : stockage local indisponible.";
  }
}

function loadSelectedAbaloneGame() {
  if (!abaloneUi || abaloneUi.thinking) return;
  const id = document.getElementById("abaloneSaveList")?.value;
  if (!id) return;
  const save = abReadSavedGames().find(s => s.id === id);
  if (!save) return;
  abaloneUi.game = abDeserializeGame(save.game);
  abaloneUi.mode = save.ui?.mode === "local" ? "local" : "ai";
  abaloneUi.aiLevel = save.ui?.aiLevel || "medium";
  abaloneUi.humanSide = Number(save.ui?.humanSide) || AB_BLACK;
  abaloneUi.selected = [];
  abaloneUi.candidateMoves = [];
  abaloneUi.thinking = false;

  const mode = document.getElementById("abaloneMode");
  const level = document.getElementById("abaloneAiLevel");
  const side = document.getElementById("abaloneSide");
  if (mode) mode.value = abaloneUi.mode;
  if (level) level.value = abaloneUi.aiLevel;
  if (side) side.value = String(abaloneUi.humanSide);
  const aiSettings = document.getElementById("abaloneAiSettings");
  if (aiSettings) aiSettings.hidden = abaloneUi.mode !== "ai";

  renderAbalone();
  const status = document.getElementById("abaloneSaveStatus");
  if (status) status.textContent = `Partie chargée : ${abSaveLabel(save)}`;
  maybeAbaloneAiTurn();
}

function deleteSelectedAbaloneGame() {
  const select = document.getElementById("abaloneSaveList");
  const id = select?.value;
  if (!id) return;
  const saves = abReadSavedGames().filter(s => s.id !== id);
  try {
    abWriteSavedGames(saves);
    refreshAbaloneSaveList();
    const status = document.getElementById("abaloneSaveStatus");
    if (status) status.textContent = "Sauvegarde supprimée.";
  } catch (e) {
    const status = document.getElementById("abaloneSaveStatus");
    if (status) status.textContent = "Impossible de supprimer cette sauvegarde.";
  }
}


async function abRefreshOnlineAccountState() {
  const status = document.getElementById("abaloneOnlineSaveStatus");
  const roomStatus = document.getElementById("abaloneRoomStatus");
  try {
    const user = await LudoOnline.me(true);
    if (!user) {
      if (status) status.innerHTML = `Connexion requise — <a href="#/compte">ouvrir un compte</a>.`;
      if (roomStatus) roomStatus.innerHTML = `Connexion requise — <a href="#/compte">Compte</a>`;
      abFillOnlineSaveList([]);
      return;
    }
    if (status) status.textContent = `Connecté : ${user.username}`;
    if (roomStatus && !abaloneUi?.online?.connected) roomStatus.textContent = `Connecté : ${user.username}`;
    await abRefreshOnlineSaveList();
  } catch (e) {
    if (status) status.textContent = "Service en ligne indisponible.";
    if (roomStatus) roomStatus.textContent = "Service en ligne indisponible.";
  }
}

function abFillOnlineSaveList(saves) {
  const select = document.getElementById("abaloneOnlineSaveList");
  if (!select) return;
  select.innerHTML = `<option value="">Sauvegardes D1…</option>` + saves.map(s => {
    const d = new Date(s.updated_at || s.created_at);
    const date = Number.isNaN(d.getTime()) ? "" : d.toLocaleString("fr-FR", {dateStyle:"short",timeStyle:"short"});
    return `<option value="${s.id}">${String(s.name).replace(/[&<>]/g,"")} — ${date}</option>`;
  }).join("");
}

async function abRefreshOnlineSaveList() {
  if (!LudoOnline.state.user) return abFillOnlineSaveList([]);
  try { abFillOnlineSaveList(await LudoOnline.saves.list("abalone")); } catch { abFillOnlineSaveList([]); }
}

async function abSaveOnlineGame() {
  const status = document.getElementById("abaloneOnlineSaveStatus");
  try {
    const user = await LudoOnline.me(true);
    if (!user) throw new Error("Connectez-vous d’abord dans la page Compte.");
    const name = document.getElementById("abaloneSaveName")?.value?.trim() || `Abalone ${new Date().toLocaleDateString("fr-FR")}`;
    await LudoOnline.saves.create("abalone", name, abSerializeGame(abaloneUi.game));
    if (status) status.textContent = "Partie enregistrée dans Cloudflare D1.";
    await abRefreshOnlineSaveList();
  } catch (e) { if (status) status.textContent = e.message; }
}

async function abLoadOnlineGame() {
  const status = document.getElementById("abaloneOnlineSaveStatus");
  const id = document.getElementById("abaloneOnlineSaveList")?.value;
  if (!id) return;
  try {
    const save = await LudoOnline.saves.get(id);
    abDisconnectOnlineRoom();
    abaloneUi.mode = "local";
    const mode = document.getElementById("abaloneMode"); if (mode) mode.value = "local";
    document.getElementById("abaloneAiSettings").hidden = true;
    document.getElementById("abaloneOnlineSettings").hidden = true;
    abaloneUi.game = abDeserializeGame(save.state);
    abaloneUi.selected = []; abaloneUi.candidateMoves = []; renderAbalone();
    if (status) status.textContent = `« ${save.name} » chargée depuis D1.`;
  } catch (e) { if (status) status.textContent = e.message; }
}

async function abDeleteOnlineGame() {
  const status = document.getElementById("abaloneOnlineSaveStatus");
  const id = document.getElementById("abaloneOnlineSaveList")?.value;
  if (!id) return;
  try { await LudoOnline.saves.remove(id); if (status) status.textContent = "Sauvegarde en ligne supprimée."; await abRefreshOnlineSaveList(); }
  catch (e) { if (status) status.textContent = e.message; }
}

function abDisconnectOnlineRoom() {
  if (!abaloneUi?.online) return;
  try { abaloneUi.online.ws?.close(1000, "Déconnexion"); } catch {}
  abaloneUi.online = { ws:null, code:"", connected:false, side:null, players:null };
}

function abSetRoomStatus(text) {
  const el = document.getElementById("abaloneRoomStatus"); if (el) el.textContent = text;
}

async function abCreateOnlineRoom() {
  try {
    const user = await LudoOnline.me(true); if (!user) throw new Error("Connectez-vous d’abord.");
    const room = await LudoOnline.rooms.create();
    const input = document.getElementById("abaloneRoomCode"); if (input) input.value = room.code;
    abConnectOnlineRoom(room.code);
  } catch (e) { abSetRoomStatus(e.message); }
}

async function abJoinOnlineRoom() {
  const code = document.getElementById("abaloneRoomCode")?.value?.trim()?.toUpperCase();
  if (!code) return abSetRoomStatus("Saisissez le code du salon.");
  try {
    const user = await LudoOnline.me(true); if (!user) throw new Error("Connectez-vous d’abord.");
    await LudoOnline.rooms.join(code);
    abConnectOnlineRoom(code);
  } catch (e) { abSetRoomStatus(e.message); }
}

function abConnectOnlineRoom(code) {
  abDisconnectOnlineRoom();
  abaloneUi.online.code = code.toUpperCase();
  abSetRoomStatus(`Connexion au salon ${abaloneUi.online.code}…`);
  const ws = LudoOnline.rooms.connect(abaloneUi.online.code, {
    open: () => abSetRoomStatus(`Salon ${abaloneUi.online.code} connecté.`),
    message: data => {
      if (data.type === "welcome") {
        abaloneUi.online.connected = true;
        abaloneUi.online.side = Number(data.side);
        abaloneUi.online.players = data.players || null;
        abApplyOnlineState(data.game);
        const color = abaloneUi.online.side === AB_BLACK ? "Noir" : "Blanc";
        abSetRoomStatus(`Salon ${abaloneUi.online.code} — vous jouez ${color}. Partagez le code avec l’autre joueur.`);
      } else if (data.type === "state") {
        if (data.players) abaloneUi.online.players = data.players;
        abApplyOnlineState(data.game);
      } else if (data.type === "players") {
        abaloneUi.online.players = data.players;
        const black = data.players?.black?.username || "?";
        const white = data.players?.white?.username || "en attente";
        abSetRoomStatus(`Salon ${abaloneUi.online.code} — Noir : ${black} · Blanc : ${white}`);
      } else if (data.type === "error") abSetRoomStatus(data.message || "Coup refusé par le serveur.");
    },
    close: () => { if (abaloneUi?.online) { abaloneUi.online.connected = false; renderAbalone(); } },
    error: () => abSetRoomStatus("Erreur de connexion WebSocket.")
  });
  abaloneUi.online.ws = ws;
}

function abApplyOnlineState(state) {
  if (!state) return;
  const g = abDeserializeGame(state);
  const ev = abPositionEvaluation(g);
  if (g.moves.length) {
    const last = g.moves[g.moves.length - 1];
    if (!Number.isFinite(last.evalBlack)) { last.evalBlack = ev.blackNote; last.evalWhite = ev.whiteNote; last.evalRawBlack = ev.rawBlack; }
  }
  abaloneUi.game = g;
  abaloneUi.selected = []; abaloneUi.candidateMoves = [];
  renderAbalone();
}

function initAbalone() {
  abaloneUi = {
    game: new AbaloneGame(),
    mode: "ai",
    aiLevel: "medium",
    humanSide: AB_BLACK,
    selected: [],
    candidateMoves: [],
    thinking: false,
    online: { ws: null, code: "", connected: false, side: null, players: null }
  };

  document.getElementById("abaloneMode")?.addEventListener("change", e => {
    abaloneUi.mode = e.target.value;
    document.getElementById("abaloneAiSettings").hidden = abaloneUi.mode !== "ai";
    document.getElementById("abaloneOnlineSettings").hidden = abaloneUi.mode !== "online";
    if (abaloneUi.mode === "online") {
      abDisconnectOnlineRoom();
      abaloneUi.game = new AbaloneGame();
      abaloneUi.selected = [];
      abaloneUi.candidateMoves = [];
      renderAbalone();
      abRefreshOnlineAccountState();
    } else newAbaloneGame();
  });
  document.getElementById("abaloneAiLevel")?.addEventListener("change", e => { abaloneUi.aiLevel = e.target.value; });
  document.getElementById("abaloneSide")?.addEventListener("change", e => { abaloneUi.humanSide = Number(e.target.value); newAbaloneGame(); });
  document.getElementById("newAbalone")?.addEventListener("click", newAbaloneGame);
  document.getElementById("undoAbalone")?.addEventListener("click", undoAbaloneMove);
  document.getElementById("saveAbalone")?.addEventListener("click", saveCurrentAbaloneGame);
  document.getElementById("loadAbalone")?.addEventListener("click", loadSelectedAbaloneGame);
  document.getElementById("deleteAbaloneSave")?.addEventListener("click", deleteSelectedAbaloneGame);
  document.getElementById("createAbaloneRoom")?.addEventListener("click", abCreateOnlineRoom);
  document.getElementById("joinAbaloneRoom")?.addEventListener("click", abJoinOnlineRoom);
  document.getElementById("saveAbaloneOnline")?.addEventListener("click", abSaveOnlineGame);
  document.getElementById("loadAbaloneOnline")?.addEventListener("click", abLoadOnlineGame);
  document.getElementById("deleteAbaloneOnline")?.addEventListener("click", abDeleteOnlineGame);
  document.querySelectorAll("[data-ab-dir]").forEach(btn => btn.addEventListener("click", () => playSelectedAbaloneDirection(Number(btn.dataset.abDir))));
  refreshAbaloneSaveList();
  abRefreshOnlineAccountState();
  renderAbalone();
}

function newAbaloneGame() {
  if (abaloneUi?.mode === "online") abDisconnectOnlineRoom();
  abaloneUi.game = new AbaloneGame();
  abaloneUi.selected = [];
  abaloneUi.candidateMoves = [];
  abaloneUi.thinking = false;
  renderAbalone();
  maybeAbaloneAiTurn();
}

function abCanHumanInteract() {
  if (!abaloneUi || abaloneUi.game.over || abaloneUi.thinking) return false;
  if (abaloneUi.mode === "online") return Boolean(abaloneUi.online.connected && abaloneUi.online.side === abaloneUi.game.turn);
  return abaloneUi.mode !== "ai" || abaloneUi.game.turn === abaloneUi.humanSide;
}

function abGroupWithClicked(key) {
  const selected = abaloneUi.selected;
  if (selected.includes(key)) return selected.filter(k => k !== key);
  if (selected.length >= 3) return [key];
  const candidate = [...selected, key];
  return abIsContiguousAligned(candidate) ? candidate : [key];
}

function abMoveCanBeTriggeredByTarget(move, board, player, key) {
  const value = board[key];

  // Une case vide peut déclencher un déplacement normal ou latéral.
  if (value === AB_EMPTY) return (move.destinations || []).includes(key);

  // Pour un Sumito, la cible naturelle est la première bille adverse poussée.
  // L'ancienne interface refusait ce clic parce que la case n'était pas vide.
  return value === abOther(player)
    && move.type === "sumito"
    && (move.push || []).includes(key);
}

function onAbaloneCellClick(event) {
  if (!abCanHumanInteract()) return;
  const key = event.currentTarget.dataset.key;
  const game = abaloneUi.game;
  const value = game.board[key];

  // Un clic sur une destination surlignée — y compris une bille adverse
  // cerclée en rouge lors d'un Sumito — peut exécuter directement le coup.
  if (value !== game.turn && abaloneUi.candidateMoves.length) {
    const matches = abaloneUi.candidateMoves.filter(m =>
      abMoveCanBeTriggeredByTarget(m, game.board, game.turn, key)
    );
    if (matches.length === 1) { playAbaloneMove(matches[0]); return; }
  }

  if (value !== game.turn) {
    abaloneUi.selected = [];
    abaloneUi.candidateMoves = [];
    renderAbalone();
    return;
  }

  abaloneUi.selected = abGroupWithClicked(key);
  abaloneUi.candidateMoves = game.movesForGroup(abaloneUi.selected);
  renderAbalone();
}

function playSelectedAbaloneDirection(dirIndex) {
  if (!abCanHumanInteract()) return;
  const dir = AB_DIRS[dirIndex];
  const move = abaloneUi.candidateMoves.find(m => abSameDir(m.dir, dir));
  if (move) playAbaloneMove(move);
}

function playAbaloneMove(move) {
  if (abaloneUi.mode === "online") {
    if (!abaloneUi.online.connected || !abaloneUi.online.ws || abaloneUi.online.ws.readyState !== WebSocket.OPEN) return;
    const dirIndex = AB_DIRS.findIndex(d => abSameDir(d, move.dir));
    abaloneUi.online.ws.send(JSON.stringify({ type: "move", group: [...move.group], dir: dirIndex }));
    abaloneUi.selected = [];
    abaloneUi.candidateMoves = [];
    renderAbalone();
    return;
  }
  if (!abaloneUi.game.play(move)) return;
  abaloneUi.selected = [];
  abaloneUi.candidateMoves = [];
  renderAbalone();
  maybeAbaloneAiTurn();
}

function undoAbaloneMove() {
  if (!abaloneUi || abaloneUi.mode === "online" || abaloneUi.thinking || !abaloneUi.game.history.length) return;
  const game = abaloneUi.game;
  game.undo();
  if (abaloneUi.mode === "ai" && game.turn !== abaloneUi.humanSide && game.history.length) game.undo();
  abaloneUi.selected = [];
  abaloneUi.candidateMoves = [];
  renderAbalone();
}

function maybeAbaloneAiTurn() {
  if (!abaloneUi || abaloneUi.mode !== "ai" || abaloneUi.game.over || abaloneUi.game.turn === abaloneUi.humanSide) return;
  abaloneUi.thinking = true;
  renderAbaloneInfo();
  window.setTimeout(() => {
    const move = abChooseAiMove(abaloneUi.game, abaloneUi.aiLevel);
    if (move) abaloneUi.game.play(move);
    abaloneUi.thinking = false;
    renderAbalone();
  }, 120);
}

function renderAbalone() {
  renderAbaloneBoard();
  renderAbaloneInfo();
}

function renderAbaloneBoard() {
  const boardEl = document.getElementById("abaloneBoard");
  if (!boardEl || !abaloneUi) return;
  const game = abaloneUi.game;
  const selectedSet = new Set(abaloneUi.selected);
  const targetSet = new Set(abaloneUi.candidateMoves.flatMap(m => m.destinations));
  const pushSet = new Set(abaloneUi.candidateMoves.flatMap(m => m.push || []));

  boardEl.innerHTML = `<div class="abalone-board-surface" aria-hidden="true"></div>` + AB_CELLS.map(([q,r]) => {
    const key = abKey(q,r);
    const value = game.board[key];
    const left = 50 + (q + r/2) * 10.45;
    const top = 50 + r * 10.45;
    const classes = ["abalone-cell", selectedSet.has(key)?"selected":"", targetSet.has(key)?"target":"", pushSet.has(key)?"push-target":""].filter(Boolean).join(" ");
    const marble = value ? `<span class="abalone-marble ${value===AB_BLACK?"black":"white"}"></span>` : "";
    const disabled = !abCanHumanInteract() ? "disabled" : "";
    return `<button class="${classes}" data-key="${key}" style="left:${left}%;top:${top}%" ${disabled} aria-label="${value===AB_BLACK?"Bille noire":value===AB_WHITE?"Bille blanche":"Case vide"} ${key}">${marble}</button>`;
  }).join("");

  boardEl.querySelectorAll(".abalone-cell").forEach(btn => btn.addEventListener("click", onAbaloneCellClick));

  document.querySelectorAll("[data-ab-dir]").forEach((btn, i) => {
    const dir = AB_DIRS[i];
    const move = abaloneUi.candidateMoves.find(m => abSameDir(m.dir, dir));
    btn.disabled = !move || !abCanHumanInteract();
    btn.classList.toggle("active", Boolean(move));
    btn.title = move ? abMoveLabel(move) : "Direction non disponible";
  });
}

function renderAbaloneInfo() {
  if (!abaloneUi) return;
  const game = abaloneUi.game;
  const turn = document.getElementById("abaloneTurn");
  const status = document.getElementById("abaloneStatus");
  const hist = document.getElementById("abaloneHistory");
  if (!turn || !status || !hist) return;

  turn.textContent = game.over ? "Partie terminée" : (game.turn === AB_BLACK ? "Noir" : "Blanc");
  document.getElementById("abaloneEjectBlack").textContent = `${game.ejected[AB_BLACK]} / 6`;
  document.getElementById("abaloneEjectWhite").textContent = `${game.ejected[AB_WHITE]} / 6`;

  if (game.over) status.textContent = `${game.winner === AB_BLACK ? "Noir" : "Blanc"} gagne après avoir éjecté 6 billes adverses.`;
  else if (abaloneUi.mode === "online" && !abaloneUi.online.connected) status.textContent = "Mode en ligne : créez un salon ou rejoignez-en un avec son code.";
  else if (abaloneUi.mode === "online" && abaloneUi.online.side !== game.turn) status.textContent = `En attente du coup de ${game.turn === AB_BLACK ? "Noir" : "Blanc"}…`;
  else if (abaloneUi.thinking) status.textContent = "L’IA réfléchit…";
  else if (abaloneUi.selected.length) status.textContent = `${abaloneUi.selected.length} bille${abaloneUi.selected.length>1?"s":""} sélectionnée${abaloneUi.selected.length>1?"s":""}. Choisissez une direction disponible, cliquez sur une destination verte ou sur la bille adverse cerclée en rouge pour effectuer un Sumito.`;
  else status.textContent = `${game.turn === AB_BLACK ? "Noir" : "Blanc"} joue. Cliquez sur 1, 2 ou 3 billes adjacentes et alignées.`;

  // Évaluation de la position courante selon la fonction Expert.
  const evaluation = abPositionEvaluation(game);
  const blackEval = document.getElementById("abaloneEvalBlack");
  const whiteEval = document.getElementById("abaloneEvalWhite");
  const blackBar = document.getElementById("abaloneEvalBlackBar");
  const whiteBar = document.getElementById("abaloneEvalWhiteBar");
  const raw = document.getElementById("abaloneEvalRaw");
  if (blackEval) blackEval.textContent = `${evaluation.blackNote.toFixed(1)} / 100`;
  if (whiteEval) whiteEval.textContent = `${evaluation.whiteNote.toFixed(1)} / 100`;
  if (blackBar) blackBar.style.width = `${evaluation.blackNote}%`;
  if (whiteBar) whiteBar.style.width = `${evaluation.whiteNote}%`;
  if (raw) raw.textContent = game.over
    ? "Position terminale"
    : `Score stratégique brut : ${evaluation.rawBlack >= 0 ? "+" : ""}${Math.round(evaluation.rawBlack)} pour Noir`;

  hist.innerHTML = game.moves.length ? game.moves.map((m,i) => {
    const eb = Number.isFinite(m.evalBlack) ? m.evalBlack : null;
    const ew = Number.isFinite(m.evalWhite) ? m.evalWhite : null;
    const evalText = eb == null ? "" : `<small>N ${eb.toFixed(1)} · B ${ew.toFixed(1)}</small>`;
    return `<div class="abalone-history-row"><span>${i+1}.</span><span class="ab-dot ${m.player===AB_BLACK?"black":"white"}"></span><span><b>${m.label}</b>${evalText}</span></div>`;
  }).join("") : `<div class="history-empty">Les coups et leurs évaluations apparaîtront ici.</div>`;
  hist.scrollTop = hist.scrollHeight;
  document.getElementById("undoAbalone").disabled = abaloneUi.mode === "online" || abaloneUi.thinking || !game.history.length;
}

// Export minimal pour les tests Node sans affecter le navigateur.
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    AB_EMPTY, AB_BLACK, AB_WHITE, AB_DIRS, AB_CELLS,
    abKey, abInside, abStandardBoard, abGroupsForPlayer, abAnalyzeMove,
    abGenerateMoves, abApplyMoveToBoard, abMoveCanBeTriggeredByTarget,
    AbaloneGame, abChooseAiMove, abEvaluateExpert, abPositionEvaluation, abChooseExpertMove, AB_EJECTION_SCORE,
    abSerializeGame, abDeserializeGame
  };
}
