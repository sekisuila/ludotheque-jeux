// ============================================================
// 421 — moteur serveur autoritatif (variante 2 joueurs / 21 jetons)
// ============================================================
// Variante retenue : charge puis décharge. Chaque joueur dispose d'au plus
// trois lancers par tour et peut conserver un ou plusieurs dés.

const clone = v => JSON.parse(JSON.stringify(v));

function secureDie(){
  const a=new Uint32Array(1); crypto.getRandomValues(a); return (a[0]%6)+1;
}

export function sorted421(dice){ return [...dice].map(Number).sort((a,b)=>b-a); }

export function evaluate421(dice){
  const d=sorted421(dice);
  if(d.length!==3 || d.some(n=>n<1||n>6)) return {key:"",name:"—",rank:-1,value:0};
  const key=d.join("");
  const special={
    "421":{name:"421",rank:1000,value:10},
    "111":{name:"Triple As",rank:990,value:7},
    "611":{name:"Deux As + Six",rank:980,value:6},
    "666":{name:"Brelan de Six",rank:970,value:6},
    "511":{name:"Deux As + Cinq",rank:960,value:5},
    "555":{name:"Brelan de Cinq",rank:950,value:5},
    "411":{name:"Deux As + Quatre",rank:940,value:4},
    "444":{name:"Brelan de Quatre",rank:930,value:4},
    "311":{name:"Deux As + Trois",rank:920,value:3},
    "333":{name:"Brelan de Trois",rank:910,value:3},
    "211":{name:"Deux As + Deux",rank:900,value:2},
    "222":{name:"Brelan de Deux",rank:890,value:2},
    "654":{name:"Suite 6-5-4",rank:880,value:2},
    "543":{name:"Suite 5-4-3",rank:870,value:2},
    "432":{name:"Suite 4-3-2",rank:860,value:2},
    "321":{name:"Suite 3-2-1",rank:850,value:2},
    "221":{name:"Nénette",rank:0,value:2}
  };
  if(special[key]) return {key,...special[key]};
  // Combinaisons ordinaires : ordre lexicographique décroissant 6 → 1.
  // Elles restent toutes sous les suites et au-dessus de Nénette.
  const rank=100 + d[0]*36 + d[1]*6 + d[2];
  return {key,name:`${d[0]}-${d[1]}-${d[2]}`,rank,value:1};
}

export function initial421GameState(){
  return {
    state:{
      phase:"charge", pot:21, tokens:[0,0], round:1,
      starter:0, turn:0, dice:[0,0,0], held:[false,false,false], rolls:0,
      roundResults:[null,null]
    },
    result:null,
    history:[]
  };
}

function startTurn(state,side){
  state.turn=side;
  state.dice=[0,0,0]; state.held=[false,false,false]; state.rolls=0;
}

function startNextRound(state,starter){
  state.round+=1;
  state.starter=starter;
  state.roundResults=[null,null];
  startTurn(state,starter);
}

function finishRound(next){
  const s=next.state;
  const a=s.roundResults[0], b=s.roundResults[1];
  if(!a||!b) return;
  const c0=evaluate421(a.dice), c1=evaluate421(b.dice);
  let winner=null, loser=null;
  if(c0.rank>c1.rank){winner=0;loser=1;} else if(c1.rank>c0.rank){winner=1;loser=0;}

  if(winner===null){
    next.history.push({type:"round",round:s.round,phase:s.phase,tie:true,results:clone(s.roundResults),tokens:[...s.tokens],pot:s.pot});
    startNextRound(s,s.starter);
    return;
  }

  let transfer=evaluate421(s.roundResults[winner].dice).value;
  // Nénette reçoit toujours 2 jetons pendant la charge.
  if(s.phase==="charge" && evaluate421(s.roundResults[loser].dice).key==="221") transfer=2;

  if(s.phase==="charge"){
    transfer=Math.min(transfer,s.pot);
    s.tokens[loser]+=transfer; s.pot-=transfer;
    next.history.push({type:"round",round:s.round,phase:"charge",winner,loser,transfer,results:clone(s.roundResults),tokens:[...s.tokens],pot:s.pot});
    if(s.pot<=0){
      s.phase="decharge";
      const immediate=s.tokens[0]===0?0:s.tokens[1]===0?1:null;
      if(immediate!==null){
        next.result={over:true,type:"tokens",winner:immediate,text:`Le joueur ${immediate+1} n’a aucun jeton : il gagne.`};
        return;
      }
    }
  }else{
    transfer=Math.min(transfer,s.tokens[winner]);
    s.tokens[winner]-=transfer; s.tokens[loser]+=transfer;
    next.history.push({type:"round",round:s.round,phase:"decharge",winner,loser,transfer,results:clone(s.roundResults),tokens:[...s.tokens],pot:s.pot});
    if(s.tokens[winner]===0){
      next.result={over:true,type:"tokens",winner,text:`Le joueur ${winner+1} se débarrasse de tous ses jetons et gagne.`};
      return;
    }
  }
  // Dans cette variante, le perdant ouvre la manche suivante.
  startNextRound(s,loser);
}

export function playServer421Roll(game,side,heldInput=null){
  const next=clone(game||initial421GameState());
  side=Number(side);
  if(next.result?.over) return {ok:false,error:"La partie est terminée."};
  if(side!==0&&side!==1) return {ok:false,error:"Joueur invalide."};
  if(Number(next.state.turn)!==side) return {ok:false,error:"Ce n’est pas votre tour."};
  if(Number(next.state.rolls)>=3) return {ok:false,error:"Vous avez déjà utilisé trois lancers."};
  if(next.state.rolls===0) next.state.held=[false,false,false];
  else if(Array.isArray(heldInput)&&heldInput.length===3) next.state.held=heldInput.map(Boolean);
  for(let i=0;i<3;i++) if(next.state.rolls===0||!next.state.held[i]) next.state.dice[i]=secureDie();
  next.state.rolls+=1;
  next.history.push({type:"roll",side,round:next.state.round,phase:next.state.phase,roll:next.state.rolls,dice:[...next.state.dice],held:[...next.state.held]});
  return {ok:true,state:next};
}

export function playServer421Hold(game,side,index,held){
  const next=clone(game); side=Number(side); index=Number(index);
  if(next.result?.over) return {ok:false,error:"La partie est terminée."};
  if(Number(next.state.turn)!==side) return {ok:false,error:"Ce n’est pas votre tour."};
  if(Number(next.state.rolls)<1) return {ok:false,error:"Lancez d’abord les dés."};
  if(!Number.isInteger(index)||index<0||index>2) return {ok:false,error:"Dé invalide."};
  next.state.held[index]=Boolean(held);
  return {ok:true,state:next};
}

export function playServer421Stop(game,side){
  const next=clone(game); side=Number(side);
  if(next.result?.over) return {ok:false,error:"La partie est terminée."};
  if(Number(next.state.turn)!==side) return {ok:false,error:"Ce n’est pas votre tour."};
  if(Number(next.state.rolls)<1) return {ok:false,error:"Vous devez lancer les dés avant de valider."};
  const combo=evaluate421(next.state.dice);
  next.state.roundResults[side]={dice:[...next.state.dice],combo,rolls:next.state.rolls};
  next.history.push({type:"stop",side,round:next.state.round,phase:next.state.phase,dice:[...next.state.dice],combo,rolls:next.state.rolls});
  const other=side===0?1:0;
  if(!next.state.roundResults[other]) startTurn(next.state,other);
  else finishRound(next);
  return {ok:true,state:next,combo};
}
