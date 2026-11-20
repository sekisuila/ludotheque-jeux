// Une carte est un entier de 0 à 51, rangé par famille puis par valeur.
export const rank = card => card % 13;
const suit = card => Math.floor(card/13);
const value = card => Math.min(rank(card)+1,10);
export const label = card => ["A","2","3","4","5","6","7","8","9","10","V","D","R"][rank(card)]+["♣","♦","♥","♠"][suit(card)];
const total = cards => cards.reduce((sum,c)=>sum+value(c),0);

function isMeld(cards) {
  if (cards.length < 3) return false;
  if (cards.every(c=>rank(c)===rank(cards[0]))) return true;
  const sorted = [...cards].sort((a,b)=>a-b);
  return sorted.every((c,i)=>suit(c)===suit(sorted[0]) && c===sorted[0]+i);
}

// Essayer aussi les compléments en chaîne (par exemple 5 puis 4 sur 6-7-8).
function attach(cards, targets, cache) {
  if (!targets.length) return {loose:cards, added:[], points:total(cards)};
  // Plusieurs ordres de pose peuvent mener exactement aux mêmes combinaisons.
  const key=cards.join(",")+"|"+targets.map(g=>[...g].sort((a,b)=>a-b).join(",")).join("/");
  if (cache.has(key)) return cache.get(key);
  let best = {loose:cards, added:[], points:total(cards)};
  for (const card of cards) {
    for (const [index,group] of targets.entries()) {
      const extended = [...group,card];
      if (!isMeld(extended)) continue;
      const next = targets.slice();
      next[index] = extended;
      const rest = attach(cards.filter(c=>c!==card),next,cache);
      if (rest.points < best.points) best = {...rest,added:[card,...rest.added]};
      if (!best.points) return best;
    }
  }
  cache.set(key,best);
  return best;
}

export function analyse(hand, targets=[]) {
  const sorted = [...hand].sort((a,b)=>a-b);
  const groups = [];
  const cache = new Map();
  // Énumérer toutes les suites, y compris leurs sous-suites.
  for (let i=0;i<sorted.length;i++) {
    for (let j=i+1;j<sorted.length && suit(sorted[i])===suit(sorted[j]) && sorted[j]===sorted[i]+j-i;j++)
      if (j-i>=2) groups.push(sorted.slice(i,j+1));
  }
  // Un carré peut aussi être partagé entre un brelan et une suite.
  for (let r=0;r<13;r++) {
    const same=sorted.filter(c=>rank(c)===r);
    if (same.length>=3) groups.push(same);
    if (same.length===4) for (const c of same) groups.push(same.filter(k=>k!==c));
  }
  let best={groups:[],loose:sorted,added:[],points:total(sorted)};
  function visit(rest,used,start) {
    const score=attach(rest,targets,cache);
    if (score.points<best.points) best={groups:used,...score};
    for(let i=start;i<groups.length && best.points;i++) {
      const group=groups[i];
      if(group.every(c=>rest.includes(c))) visit(rest.filter(c=>!group.includes(c)),[...used,group],i+1);
    }
  }
  visit(sorted,[],0);
  return best;
}

function deal(dealer,scores,round,revision) {
  const deck=Array.from({length:52},(_,i)=>i);
  for(let i=51;i>0;i--) {
    const j=Math.floor(Math.random()*(i+1));
    [deck[i],deck[j]]=[deck[j],deck[i]];
  }
  const hands=[deck.splice(0,10),deck.splice(0,10)];
  return {hands,pile:[deck.pop()],stock:deck,dealer,scores,round,revision,turn:1-dealer,
    phase:"offer",passes:0,locked:null,summary:null,result:null,notice:"Première carte retournée."};
}
export const newGin = () => deal(Math.floor(Math.random()*2),[0,0],1,0);

// Construire explicitement les données autorisées à sortir du serveur.
export function ginView(g,side) {
  const {phase,turn,dealer,round,revision,scores,summary,result,notice,passes}=g;
  return {phase,turn,dealer,round,revision,scores,summary,result,notice,passes,
    hand:g.hands[side]||[],otherCount:g.hands[1-side]?.length||0,stockCount:g.stock.length,
    top:g.pile.at(-1)??null,locked:turn===side?g.locked:null};
}

export function playGin(state,side,action) {
  if(state.result || ![0,1].includes(side)) throw Error("Partie terminée ou place inconnue.");
  const g=structuredClone(state);
  g.revision++;
  if(action.kind==="resign") {
    g.result={over:true,winner:1-side,text:"Victoire par abandon."};
    return g;
  }
  if(action.kind==="next" && g.phase==="end") return deal(1-g.dealer,g.scores,g.round+1,g.revision);
  if(g.turn!==side) throw Error("Attendez votre tour.");
  const hand=g.hands[side],other=1-side;
  if(action.kind==="pass" && g.phase==="offer") {
    g.passes++;
    g.turn=other;
    if(g.passes===2) g.phase="draw";
    g.notice="Joueur "+(side+1)+" passe.";
    return g;
  }
  if((g.phase==="offer" || g.phase==="draw") && ["stock","pile"].includes(action.kind)) {
    const pile=action.kind==="pile";
    if((g.phase==="offer" && !pile) || (pile && g.passes===2) || (pile && !g.pile.length)) throw Error("Cette pioche est indisponible.");
    const card=pile?g.pile.pop():g.stock.pop();
    hand.push(card);
    g.locked=pile?card:null;
    g.passes=0;
    g.phase="discard";
    g.notice=pile?"Carte prise dans la défausse : "+label(card)+".":"Carte prise dans la pioche.";
    return g;
  }
  const {card,kind}=action;
  if(g.phase!=="discard" || !["discard","knock"].includes(kind) || !hand.includes(card) || card===g.locked)
    throw Error("Choisissez une carte que vous pouvez défausser.");
  hand.splice(hand.indexOf(card),1);
  g.pile.push(card);
  g.locked=null;
  g.notice="Joueur "+(side+1)+" défausse "+label(card)+".";
  if(kind==="knock") {
    const attack=analyse(hand);
    if(attack.points>10) throw Error("Il reste plus de dix points hors combinaison.");
    const gin=attack.points===0;
    const defense=analyse(g.hands[other],gin?[]:attack.groups);
    const diff=defense.points-attack.points;
    const winner=gin || diff>0?side:other;
    const points=Math.abs(diff)+(gin || diff<=0?25:0);
    g.scores[winner]+=points;
    const layouts=[];
    layouts[side]=attack; layouts[other]=defense;
    g.summary={winner,points,layouts,text:gin?"Gin !":diff<=0?"Knock contré.":"Knock réussi."};
    g.phase="end";
    if(g.scores[winner]>=100) g.result={over:true,winner,text:"Objectif de 100 points atteint."};
  } else if(g.stock.length===2) {
    g.phase="end";g.summary={points:0,text:"Deux cartes restent dans la pioche. Manche nulle.",layouts:g.hands.map(h=>analyse(h))};
  } else {g.turn=other;g.phase="draw";}
  return g;
}

// L’IA décide avec sa main et la seule carte visible de la défausse.
export function ginAI(view) {
  const {hand,top,phase,locked,passes}=view;
  const options=(cards,blocked)=>cards.filter(c=>c!==blocked).map(card=>({card,points:analyse(cards.filter(c=>c!==card)).points}))
    .sort((a,b)=>a.points-b.points || value(b.card)-value(a.card));
  if(phase==="discard") {
    const best=options(hand,locked)[0];
    return {kind:best.points<=10?"knock":"discard",card:best.card};
  }
  if(top!==null && passes!==2 && options([...hand,top],top)[0].points < analyse(hand).points) return {kind:"pile"};
  return {kind:phase==="offer"?"pass":"stock"};
}
