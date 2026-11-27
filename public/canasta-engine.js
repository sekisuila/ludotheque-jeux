// Les deux exemplaires d'une carte ont une identité distincte, y compris en main.
export const seats = ["Sud", "Ouest", "Nord", "Est"];
export const ranks = ["As", "2", "3", "4", "5", "6", "7", "8", "9", "10", "Valet", "Dame", "Roi", "Joker"];
export const rank = c => c >= 104 ? 13 : c % 13;
export const wild = c => [1,13].includes(rank(c));
export const red = c => [15,28].includes(c % 52) && c < 104;
export const label = c => c >= 104 ? "Joker" : ranks[rank(c)] + ["♣","♦","♥","♠"][Math.floor(c % 52 / 13)];
export const value = c => c >= 104 ? 50 : rank(c) <= 1 ? 20 : rank(c) >= 7 ? 10 : 5;
export const points = cards => cards.reduce((n,c) => n + value(c), 0);
export const threshold = score => score < 0 ? 15 : score < 1500 ? 50 : score < 3000 ? 90 : 120;
export const side = g => g.teams[g.turn % 2];
export const hand = g => g.hands[g.turn];
const opened = t => Object.keys(t.melds).length > 0;
const hasCanasta = melds => Object.values(melds).some(cards => cards.length >= 7);
export const top = g => g.pile.at(-1);
export const frozen = g => !opened(side(g)) || g.pile.some(c => wild(c) || red(c));
const sortKey = c => wild(c) ? 20 + rank(c) : rank(c) || 14;
function sort(cards) { cards.sort((a,b) => sortKey(a)-sortKey(b) || a%52-b%52 || a-b); }
function record(g,s) { g.log.push(s); }
function startTurn(g) {
  g.phase = "draw";
  g.priorRanks = Object.keys(side(g).melds).map(Number);
  g.startSizes = Object.fromEntries(Object.entries(side(g).melds).map(([r,cards])=>[r,cards.length]));
  g.previouslyPlayed = g.played[g.turn];
  g.meldedThisTurn = false;
  g.permission = null;
  g.source = null;
}
export function deal(previous) {
  const stock = Array.from({length:108}, (_,i) => i);
  for (let i=107;i>0;i--) {
    const j = Math.floor(Math.random()*(i+1));
    [stock[i],stock[j]] = [stock[j],stock[i]];
  }
  const dealer = previous ? (previous.dealer+1)%4 : Math.floor(Math.random()*4);
  const g = {stock, dealer, turn:(dealer+1)%4, hands:[[],[],[],[]], teams:[0,1].map(()=>({melds:{},reds:[]})),
    scores:previous ? [...previous.scores] : [0,0], number:(previous?.number || 0)+1,
    pile:[], played:[false,false,false,false], log:[]};
  for(let n=0;n<44;n++) g.hands[(g.turn+n)%4].push(stock.pop());
  do { g.pile.push(stock.pop()); } while(wild(top(g)) || red(top(g)));
  for(let n=0;n<4;n++) {
    const p=(g.turn+n)%4;
    const reds=g.hands[p].filter(red);
    g.hands[p]=g.hands[p].filter(c=>!red(c));
    for(const c of reds) { expose(g,p,c); drawOne(g,p); }
    sort(g.hands[p]);
  }
  startTurn(g);
  return g;
}
function expose(g,p,c) {
  g.teams[p%2].reds.push(c);
  record(g,seats[p]+" expose le "+label(c)+".");
}
// Un remplacement peut lui-même être un trois rouge.
function drawOne(g,p) {
  while(g.stock.length) {
    const c=g.stock.pop();
    if(!red(c)) { g.hands[p].push(c); sort(g.hands[p]); return; }
    expose(g,p,c);
  }
  finish(g,false);
}
export function pickBase(g) {
  const c=top(g);
  if(c===undefined || wild(c) || rank(c)===2 || (hand(g).length===1 && g.pile.length===1)) return null;
  const r=rank(c), pair=hand(g).filter(x=>rank(x)===r);
  let support;
  if(!frozen(g) && side(g).melds[r]) support=[];
  else if(pair.length>=2) support=pair.slice(0,2);
  else if(!frozen(g) && pair.length && hand(g).some(wild)) support=[pair[0],hand(g).find(wild)];
  else return null;
  return {[r]:[...support,c]};
}
export const compulsory = g => !g.stock.length && !frozen(g) && !!side(g).melds[rank(top(g))] && pickBase(g)!==null;
export function draw(g) {
  if(g.phase!=="draw" || compulsory(g)) throw Error("La prise de la défausse est obligatoire.");
  if(!g.stock.length) { finish(g,false); return; }
  record(g,seats[g.turn]+" pioche.");
  g.phase="play"; g.source="stock"; drawOne(g,g.turn);
}
export function checkGroup(r,cards) {
  if(cards.length<3 || cards.filter(c=>!wild(c)).length<2) throw Error("Il faut au moins trois cartes, dont deux naturelles.");
  if(cards.filter(wild).length>3) throw Error("Une combinaison accepte au maximum trois cartes libres.");
  if(cards.some(c=>red(c) || (!wild(c) && rank(c)!==r)) || [1,13].includes(r))
    throw Error("Choisissez des cartes de même rang.");
  if(r===2 && cards.some(wild)) throw Error("Les 3 noirs se posent sans carte libre.");
}
// Valider sur des copies. Une ouverture refusée laisse main, défausse et table intactes.
export function preview(g,plan,pick=false) {
  if(g.phase!==(pick?"draw":"play")) throw Error("Ce coup ne correspond pas à la phase du tour.");
  const cards=Object.values(plan).flat(), melds={...side(g).melds}, c=top(g);
  if(!cards.length || new Set(cards).size!==cards.length || cards.some(x=>!hand(g).includes(x) && !(pick && x===c)))
    throw Error("Sélection de cartes invalide.");
  if(pick) {
    const group=plan[rank(c)] || [];
    if(!pickBase(g) || !group.includes(c) || (frozen(g) && group.filter(x=>x!==c && rank(x)===rank(c)).length<2))
      throw Error("La carte visible doit être posée avec les cartes requises de votre main.");
  }
  for(const [key,add] of Object.entries(plan)) {
    melds[key]=[...(melds[key]||[]),...add]; checkGroup(Number(key),melds[key]);
  }
  const left=hand(g).filter(x=>!cards.includes(x));
  if(pick) left.push(...g.pile.slice(0,-1).filter(x=>!red(x)));
  const canExit=left.length<=1 && hasCanasta(melds) && g.permission!==false;
  if(left.length<=1 && !canExit) throw Error("Gardez deux cartes pour défausser sans sortir.");
  if(plan[2] && !canExit) throw Error("Les 3 noirs se posent uniquement pour sortir.");
  if(!opened(side(g)) && points(cards)<threshold(g.scores[g.turn%2]) && !(canExit && !pick))
    throw Error("Ouverture : "+points(cards)+" points sur "+threshold(g.scores[g.turn%2])+" requis.");
  return {melds,left,canExit};
}
export function put(g,plan,pick=false) {
  const {melds,left}=preview(g,plan,pick);
  if(pick) {
    for(const c of g.pile.slice(0,-1).filter(red)) expose(g,g.turn,c);
    record(g,seats[g.turn]+" ramasse la défausse ("+g.pile.length+" cartes).");
    g.pile=[]; g.source="pile"; g.phase="play";
  }
  side(g).melds=melds; sort(left); g.hands[g.turn]=left; g.played[g.turn]=true;
  if(!pick) g.meldedThisTurn=true;
  record(g,seats[g.turn]+" pose "+Object.entries(plan).map(([r,c])=>c.length+" × "+ranks[r]).join(", ")+".");
  if(!left.length) finish(g,true);
}
export function discard(g,c) {
  if(g.phase!=="play" || !hand(g).includes(c)) throw Error("Choisissez une carte de votre main.");
  const out=hand(g).length===1;
  if(out && (!hasCanasta(side(g).melds) || g.permission===false)) throw Error("La sortie est impossible.");
  if(!out && g.permission===true) throw Error("Nord a accepté votre sortie.");
  hand(g).splice(hand(g).indexOf(c),1); g.pile.push(c);
  record(g,seats[g.turn]+" défausse "+label(c)+(wild(c)?" et gèle la pile.":"."));
  if(out) finish(g,true);
  else { g.turn=(g.turn+1)%4; startTurn(g); }
}
function finish(g,out) {
  const melds=side(g).melds;
  const concealed=out && !g.previouslyPlayed && Object.keys(melds).some(r=>!g.priorRanks.includes(+r) && melds[r].length>=7)
    && g.priorRanks.every(r=>melds[r].length===g.startSizes[r]);
  g.reason=out ? seats[g.turn]+" sort"+(concealed?" avec une main cachée.":".") : "La pioche est épuisée.";
  g.result=g.teams.map((t,i)=>{
    const groups=Object.values(t.melds);
    const bonuses=groups.filter(cs=>cs.length>=7).reduce((v,cs)=>v+(cs.some(wild)?300:500),0);
    const reds=(t.reds.length===4?800:t.reds.length*100)*(opened(t)?1:-1);
    const exit=out && i===g.turn%2 ? (concealed?200:100) : 0;
    const laid=points(groups.flat()), held=points([...g.hands[i],...g.hands[i+2]]);
    const total=laid-held+reds+bonuses+exit;
    g.scores[i]+=total;
    return {laid,held,reds,bonuses,exit,total};
  });
  g.phase="end"; g.over=Math.max(...g.scores)>=5000 && g.scores[0]!==g.scores[1];
}

// L'IA ne consulte que sa main, les poses visibles et le sommet de la défausse.
function bestPlan(g,pick) {
  const base=pick ? pickBase(g) : {};
  if(!base) return null;
  let best=null, bestScore=-Infinity;
  function consider(plan) {
    try {
      const {melds,canExit}=preview(g,plan,pick);
      const bonus=Object.values(melds).reduce((n,cs)=>n+(cs.length>=7?(cs.some(wild)?300:500):0),0);
      const score=points(Object.values(plan).flat())+bonus+(canExit?300:0);
      if(score>bestScore) { best=structuredClone(plan); bestScore=score; }
    } catch { /* Une proposition incomplète reste disponible pour la suite de la recherche. */ }
  }
  const available=hand(g).filter(c=>!Object.values(base).flat().includes(c));
  const naturals=Array.from({length:13},(_,r)=>r).filter(r=>r!==1 && r!==2);
  naturals.sort((a,b)=>available.filter(c=>rank(c)===b).length-available.filter(c=>rank(c)===a).length);
  for(const order of [naturals,[...naturals].reverse()]) {
    const plan=structuredClone(base), free=available.filter(wild).sort((a,b)=>value(b)-value(a));
    if(pick) consider(plan);
    for(const r of order) {
      const originals=[...(side(g).melds[r]||[]),...(plan[r]||[])];
      const matches=available.filter(c=>rank(c)===r);
      if(originals.length+matches.length<2) continue;
      const add=[...matches];
      if(originals.length+add.length===2 && free.length) add.push(free.shift());
      if(originals.length+add.length<3) continue;
      for(const c of add) {
        (plan[r]??=[]).push(c);
        consider(plan);
      }
    }
    for(const r of order) {
      const group=[...(side(g).melds[r]||[]),...(plan[r]||[])];
      if(group.length<3 || (group.length>=7 && !group.some(wild))) continue;
      for(let count=group.filter(wild).length; count<3 && free.length;count++) {
        (plan[r]??=[]).push(free.shift()); consider(plan);
      }
    }
    const black=available.filter(c=>rank(c)===2);
    if(black.length>=3) { plan[2]=black; consider(plan); }
  }
  return best;
}
export function aiStep(g) {
  if(g.phase==="draw") {
    const proposal=bestPlan(g,true);
    if(proposal) put(g,proposal,true);
    else draw(g);
    return;
  }
  if(g.phase!=="play") return;
  const proposal=bestPlan(g,false);
  if(proposal) put(g,proposal);
  if(g.phase==="end") return;
  const their=g.teams[1-g.turn%2].melds;
  const priority=c=>wild(c)?-100:rank(c)===2?100:(their[rank(c)]?-50:0)+value(c)-15*hand(g).filter(x=>rank(x)===rank(c)).length;
  discard(g,[...hand(g)].sort((a,b)=>priority(b)-priority(a))[0]);
}
