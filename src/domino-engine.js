// ============================================================
// Dominos double-six — moteur serveur autoritatif (2 joueurs)
// 28 dominos, 7 par joueur, pioche, manches jusqu'à 100 points.
// ============================================================

const clone=v=>JSON.parse(JSON.stringify(v));

function secureInt(max){
  const a=new Uint32Array(1); crypto.getRandomValues(a); return a[0]%max;
}
function makeSet(){
  const out=[];
  for(let a=0;a<=6;a++) for(let b=a;b<=6;b++) out.push({id:`${a}-${b}`,a,b});
  return out;
}
function shuffle(list){
  const a=list.map(t=>({...t}));
  for(let i=a.length-1;i>0;i--){const j=secureInt(i+1);[a[i],a[j]]=[a[j],a[i]];}
  return a;
}
export function dominoPips(tile){return Number(tile?.a||0)+Number(tile?.b||0);}
export function dominoHandPips(hand){return (hand||[]).reduce((s,t)=>s+dominoPips(t),0);}
function startWeight(tile){
  const a=Number(tile.a),b=Number(tile.b);
  if(a===b) return 1000+a;
  return (a+b)*10+Math.max(a,b);
}
function chooseStarter(hands){
  let best=null;
  for(let side=0;side<2;side++) for(const tile of hands[side]){
    const candidate={side,tile,weight:startWeight(tile)};
    if(!best||candidate.weight>best.weight) best=candidate;
  }
  return best;
}
function orientFor(tile,end,side){
  const a=Number(tile.a),b=Number(tile.b),e=Number(end);
  if(side==="left"){
    if(b===e)return{id:tile.id,left:a,right:b};
    if(a===e)return{id:tile.id,left:b,right:a};
  }else{
    if(a===e)return{id:tile.id,left:a,right:b};
    if(b===e)return{id:tile.id,left:b,right:a};
  }
  return null;
}
export function dominoLegalSides(game,tile){
  const chain=game?.state?.chain||[];
  if(!chain.length)return["right"];
  const left=chain[0].left,right=chain[chain.length-1].right,sides=[];
  if(Number(tile.a)===Number(left)||Number(tile.b)===Number(left))sides.push("left");
  if(Number(tile.a)===Number(right)||Number(tile.b)===Number(right))sides.push("right");
  return sides;
}
export function dominoPlayableTiles(game,side){
  const hand=game?.state?.hands?.[Number(side)]||[];
  return hand.filter(t=>dominoLegalSides(game,t).length);
}

function dealRound(scores=[0,0],round=1,lastRound=null,target=100){
  const set=shuffle(makeSet());
  const hands=[set.splice(0,7),set.splice(0,7)];
  const starter=chooseStarter(hands);
  const tile=starter.tile;
  hands[starter.side]=hands[starter.side].filter(t=>t.id!==tile.id);
  const first={id:tile.id,left:tile.a,right:tile.b};
  return {
    state:{
      target,round,scores:[Number(scores[0]||0),Number(scores[1]||0)],
      hands,boneyard:set,chain:[first],turn:1-starter.side,starter:starter.side,
      passCount:0,lastRound
    },
    result:null,
    history:[{type:"round_start",round,starter:starter.side,tile:{...tile}}]
  };
}

export function initialDominoGameState(){
  return dealRound([0,0],1,null,100);
}

function finishRound(game,winner,reason){
  const s=game.state,pips=[dominoHandPips(s.hands[0]),dominoHandPips(s.hands[1])];
  let points=0;
  if(winner===0||winner===1){
    if(reason==="empty") points=pips[1-winner];
    else points=Math.max(0,pips[1-winner]-pips[winner]);
    s.scores[winner]+=points;
  }
  const summary={round:s.round,winner,reason,points,pips,scores:[...s.scores]};
  game.history.push({type:"round_end",...clone(summary)});
  s.lastRound=summary;
  s.roundPending=true;
  if((winner===0||winner===1)&&s.scores[winner]>=s.target){
    game.result={over:true,type:"score",winner,scores:[...s.scores],target:s.target,lastRound:summary};
  }
  return game;
}

export function advanceServerDominoRound(game){
  const current=clone(game);
  if(current?.result?.over)return{ok:false,error:"La partie est terminée."};
  if(!current?.state?.roundPending)return{ok:false,error:"La manche en cours n’est pas terminée."};
  const s=current.state;
  const next=dealRound(s.scores,Number(s.round||1)+1,s.lastRound,s.target);
  next.history=[...(current.history||[]),...next.history];
  return{ok:true,state:next};
}

export function playServerDominoPlay(game,side,tileId,placement){
  let next=clone(game); side=Number(side);
  if(next.result?.over)return{ok:false,error:"La partie est terminée."};
  if(next.state?.roundPending)return{ok:false,error:"La manche est terminée. Passez à la manche suivante."};
  if(side!==0&&side!==1)return{ok:false,error:"Joueur invalide."};
  if(Number(next.state.turn)!==side)return{ok:false,error:"Ce n’est pas votre tour."};
  const hand=next.state.hands[side]||[];
  const tile=hand.find(t=>t.id===String(tileId));
  if(!tile)return{ok:false,error:"Ce domino n’est pas dans votre main."};
  const sides=dominoLegalSides(next,tile);
  const where=placement==="left"?"left":"right";
  if(!sides.includes(where))return{ok:false,error:"Ce domino ne peut pas être posé de ce côté."};
  const chain=next.state.chain;
  const end=where==="left"?chain[0].left:chain[chain.length-1].right;
  const oriented=orientFor(tile,end,where);
  next.state.hands[side]=hand.filter(t=>t.id!==tile.id);
  if(where==="left")chain.unshift(oriented);else chain.push(oriented);
  next.state.passCount=0;
  next.history.push({type:"play",side,round:next.state.round,tile:{...tile},placement:where});
  if(next.state.hands[side].length===0){
    next=finishRound(next,side,"empty");
    return{ok:true,state:next,roundEnded:true};
  }
  next.state.turn=1-side;
  return{ok:true,state:next};
}

export function playServerDominoDraw(game,side){
  let next=clone(game); side=Number(side);
  if(next.result?.over)return{ok:false,error:"La partie est terminée."};
  if(next.state?.roundPending)return{ok:false,error:"La manche est terminée. Passez à la manche suivante."};
  if(Number(next.state.turn)!==side)return{ok:false,error:"Ce n’est pas votre tour."};
  if(dominoPlayableTiles(next,side).length)return{ok:false,error:"Vous avez déjà un domino jouable."};

  let drawn=0;
  while(next.state.boneyard.length && !dominoPlayableTiles(next,side).length){
    const tile=next.state.boneyard.pop();
    next.state.hands[side].push(tile); drawn++;
  }
  if(drawn){
    next.state.passCount=0;
    next.history.push({type:"draw",side,round:next.state.round,count:drawn});
    if(dominoPlayableTiles(next,side).length)return{ok:true,state:next,drawn};
  }

  // Pioche vide et toujours aucun coup : passe.
  next.state.passCount=Number(next.state.passCount||0)+1;
  next.history.push({type:"pass",side,round:next.state.round});
  if(next.state.passCount>=2){
    const pips=[dominoHandPips(next.state.hands[0]),dominoHandPips(next.state.hands[1])];
    const winner=pips[0]<pips[1]?0:pips[1]<pips[0]?1:null;
    next=finishRound(next,winner,"blocked");
    return{ok:true,state:next,passed:true,roundEnded:true};
  }
  next.state.turn=1-side;
  return{ok:true,state:next,passed:true};
}

export function publicDominoGameState(game,side){
  const view=clone(game);
  side=Number(side);
  const fullHands=game?.state?.hands||[[],[]];
  view.state.handCounts=[fullHands[0]?.length||0,fullHands[1]?.length||0];
  view.state.boneyardCount=game?.state?.boneyard?.length||0;
  view.state.hands=[
    side===0?clone(fullHands[0]):[],
    side===1?clone(fullHands[1]):[]
  ];
  view.state.boneyard=[];
  return view;
}
