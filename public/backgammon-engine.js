// Les Noirs (0) vont de 24 vers 1, les Blancs (1) de 1 vers 24.
// Une flèche positive contient des pions noirs, une négative des blancs.
export const BAR = -1, OFF = 24;
const sign = side => side === 0 ? 1 : -1;
const die = () => 1 + Math.floor(Math.random() * 6);

export function newGame(roll = die) {
  const points = Array(24).fill(0);
  for (const [i, count] of [[23, 2], [12, 5], [7, 3], [5, 5]]) {
    points[i] = count;
    points[23 - i] = -count;
  }
  let black, white;
  do { black = roll(); white = roll(); } while (black === white);
  return { points, bar: [0, 0], off: [0, 0], turn: black > white ? 0 : 1,
    dice: [black, white], notice: `Ouverture · Noirs ${black}, Blancs ${white}.`, result: null, revision: 0 };
}

function candidates(game) {
  const {points, bar, turn, dice} = game;
  const color = sign(turn);
  const distance = i => turn === 0 ? i + 1 : 24 - i;
  const starts = bar[turn] ? [BAR] : points.flatMap((n, i) => n * color > 0 ? [i] : []);
  // Le pion le plus éloigné détermine quand une sortie excédentaire est permise.
  const farthest = bar[turn] ? 25 : Math.max(...starts.map(distance));
  const moves = [];
  for (const from of starts) {
    for (const value of new Set(dice)) {
      const target = (from === BAR ? (turn === 0 ? 24 : -1) : from) - color * value;
      if (target >= 0 && target < 24) {
        if (points[target] * color >= -1) moves.push({from, to: target, value});
      } else if (farthest <= 6 && (distance(from) === value || distance(from) === farthest)) {
        moves.push({from, to: OFF, value});
      }
    }
  }
  return moves;
}

function advance(game, {from, to, value}) {
  const {turn} = game, color = sign(turn);
  const points = game.points.slice(), bar = game.bar.slice(), off = game.off.slice(), dice = game.dice.slice();
  if (from === BAR) bar[turn]--; else points[from] -= color;
  if (to === OFF) off[turn]++;
  else {
    if (points[to] === -color) { bar[1 - turn]++; points[to] = 0; }
    points[to] += color;
  }
  dice.splice(dice.indexOf(value), 1);
  return {...game, points, bar, off, dice};
}

// On explore les suites de coups pour imposer le maximum de dés jouables.
function depth(game) {
  let best = 0;
  for (const move of candidates(game)) {
    best = Math.max(best, 1 + depth(advance(game, move)));
    if (best === game.dice.length) break;
  }
  return best;
}

export function legalMoves(game) {
  if (game.result) return [];
  const moves = candidates(game);
  const lengths = moves.map(move => 1 + depth(advance(game, move)));
  const longest = Math.max(...lengths);
  const high = Math.max(...moves.map(move => move.value));
  return moves.filter((move, i) => lengths[i] === longest && (longest !== 1 || move.value === high));
}

export function play(game, side, action, roll = die) {
  if (game.result || side !== game.turn) throw new Error("Ce n’est pas votre tour.");
  const who = side === 0 ? "Noirs" : "Blancs";
  let next;
  if (action.kind === "roll" && !game.dice.length) {
    const a = roll(), b = roll();
    next = {...game, dice: a === b ? [a,a,a,a] : [a,b], notice: `${who} · lancer ${a} et ${b}.`};
  } else {
    const move = legalMoves(game).find(m => action.kind === "move" && m.from === action.from && m.to === action.to && m.value === action.value);
    if (!move) throw new Error("Ce déplacement est impossible.");
    next = advance(game, move);
    const hit = next.bar[1-side] > game.bar[1-side];
    next.notice = `${who} · ${move.from === BAR ? "barre" : move.from+1} → ${move.to === OFF ? "sortie" : move.to+1} (dé ${move.value})${hit ? " · pion adverse frappé" : ""}.`;
  }
  if (next.off[side] === 15) {
    const home = side === 0 ? next.points.slice(0,6) : next.points.slice(18);
    const trapped = next.bar[1-side] || home.some(n => n * sign(side) < 0);
    const points = next.off[1-side] ? 1 : trapped ? 3 : 2;
    next.result = {over:true, winner:side, points, text:`${who} gagnent · ${["","victoire simple","gammon","backgammon"][points]} (${points} pt${points > 1 ? "s" : ""}).`};
  } else if (!candidates(next).length) {
    if (next.dice.length) next.notice += " Aucun autre déplacement possible.";
    next.turn = 1-side;
    next.dice = [];
  }
  return {...next, revision:game.revision+1};
}
