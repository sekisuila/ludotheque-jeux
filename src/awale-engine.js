// ============================================================
// AWÉLÉ — moteur serveur autoritatif.
// Side 0 : rangée du bas (cases 1 à 6), joue en premier.
// Side 1 : rangée du haut (cases 7 à 12).
// ============================================================

function sideSeeds(state, side){
  const start=Number(side)===0?0:6;
  return state.pits.slice(start,start+6).reduce((a,b)=>a+Number(b||0),0);
}

function sowOnly(state,index){
  const next={pits:[...state.pits],scores:[...state.scores],player:Number(state.player),over:Boolean(state.over)};
  let seeds=next.pits[index];
  next.pits[index]=0;
  let pos=index;
  const sowPath=[];
  while(seeds>0){
    pos=(pos+1)%12;
    if(pos===index) continue;
    next.pits[pos]++;
    sowPath.push(pos);
    seeds--;
  }
  next.last=pos;
  next.sowPath=sowPath;
  return next;
}

export function isLegalAwaleMove(state,index){
  index=Number(index);
  if(!Number.isInteger(index)||index<0||index>11) return false;
  const owner=index<6?0:1;
  if(owner!==Number(state.player)||Number(state.pits[index]||0)===0) return false;
  const opponent=1-Number(state.player);
  if(sideSeeds(state,opponent)>0) return true;
  const test=sowOnly(state,index);
  return sideSeeds(test,opponent)>0;
}

export function legalAwaleMoves(state){
  const start=Number(state.player)===0?0:6;
  const out=[];
  for(let i=start;i<start+6;i++) if(isLegalAwaleMove(state,i)) out.push(i);
  return out;
}

function finalizeIfNeeded(game){
  const st=game.state;
  const legal=legalAwaleMoves(st);
  const remaining=st.pits.reduce((a,b)=>a+Number(b||0),0);
  if(st.scores[0]>=25 || st.scores[1]>=25 || legal.length===0 || remaining<=6){
    st.scores[0]+=sideSeeds(st,0);
    st.scores[1]+=sideSeeds(st,1);
    st.pits.fill(0);
    st.over=true;
    const winner=st.scores[0]>st.scores[1]?0:st.scores[1]>st.scores[0]?1:null;
    game.result={
      over:true,type:"score",winner,
      text:winner===null
        ? `Partie terminée : égalité ${st.scores[0]} à ${st.scores[1]}.`
        : `Partie terminée : le joueur ${winner+1} gagne ${st.scores[winner]} à ${st.scores[1-winner]}.`
    };
  }else{
    game.result={over:false,type:"play",winner:null,text:`Au joueur ${st.player+1} de jouer.`};
  }
}

function snapshot(game){
  return {pits:[...game.state.pits],scores:[...game.state.scores],player:Number(game.state.player),over:Boolean(game.state.over)};
}

export function initialAwaleGameState(){
  const game={
    state:{pits:Array(12).fill(4),scores:[0,0],player:0,over:false},
    history:[],moves:[],result:{over:false,type:"play",winner:null,text:"Au joueur 1 de jouer."}
  };
  return game;
}

export function playServerAwaleMove(game,side,index){
  side=Number(side); index=Number(index);
  if(side!==0&&side!==1) return {ok:false,error:"Camp invalide."};
  if(game?.result?.over||game?.state?.over) return {ok:false,error:"La partie est terminée."};
  if(Number(game?.state?.player)!==side) return {ok:false,error:"Ce n’est pas votre tour."};
  if(!isLegalAwaleMove(game.state,index)) return {ok:false,error:"Ce coup n’est pas légal."};

  const before=snapshot(game);
  const seedsPicked=Number(game.state.pits[index]||0);
  const nextState=sowOnly(game.state,index);
  const sowPath=[...(nextState.sowPath||[])];
  const current=side;
  let captured=[];
  let pos=nextState.last;
  const opponentStart=current===0?6:0;
  const opponentEnd=opponentStart+5;
  while(pos>=opponentStart&&pos<=opponentEnd&&(nextState.pits[pos]===2||nextState.pits[pos]===3)){
    captured.push(pos);
    pos=(pos+11)%12;
  }
  const totalCaptured=captured.reduce((sum,p)=>sum+nextState.pits[p],0);
  const opponentTotalBefore=sideSeeds(nextState,1-current);
  if(totalCaptured>0 && totalCaptured<opponentTotalBefore){
    for(const p of captured){ nextState.scores[current]+=nextState.pits[p]; nextState.pits[p]=0; }
  }else{
    captured=[];
  }
  nextState.player=1-current;
  nextState.over=false;
  delete nextState.last;
  delete nextState.sowPath;

  const move={player:current,index,seedsPicked,sowPath,captured:[...captured],capturedSeeds:captured.length?totalCaptured:0};
  const next={state:nextState,history:[...(game.history||[]),{state:before,move}],moves:[...(game.moves||[]),move],result:null};
  finalizeIfNeeded(next);
  return {ok:true,state:next,move};
}
