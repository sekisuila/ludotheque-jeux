export const YAMS_CATEGORIES = [
  "ones","twos","threes","fours","fives","sixes",
  "threeKind","fourKind","fullHouse","smallStraight","largeStraight","yams","chance"
];

export const YAMS_LABELS = {
  ones:"As",twos:"Deux",threes:"Trois",fours:"Quatre",fives:"Cinq",sixes:"Six",
  threeKind:"Brelan",fourKind:"Carré",fullHouse:"Full",smallStraight:"Petite suite",
  largeStraight:"Grande suite",yams:"Yams",chance:"Chance"
};

const clone = value => JSON.parse(JSON.stringify(value));

export function initialYamsScores(){
  return Object.fromEntries(YAMS_CATEGORIES.map(k=>[k,null]));
}

export function yamsUpperSubtotal(scores={}){
  return ["ones","twos","threes","fours","fives","sixes"].reduce((s,k)=>s+Number(scores[k]??0),0);
}

export function yamsBonus(scores={}){ return yamsUpperSubtotal(scores)>=63 ? 35 : 0; }
export function yamsTotal(scores={}){
  return YAMS_CATEGORIES.reduce((s,k)=>s+Number(scores[k]??0),0)+yamsBonus(scores);
}

export function scoreYamsCategory(dice,category){
  const d=(Array.isArray(dice)?dice:[]).map(Number).filter(n=>n>=1&&n<=6);
  if(d.length!==5) return 0;
  const counts=Array(7).fill(0); d.forEach(n=>counts[n]++);
  const sum=d.reduce((a,b)=>a+b,0);
  const faceMap={ones:1,twos:2,threes:3,fours:4,fives:5,sixes:6};
  if(faceMap[category]) return counts[faceMap[category]]*faceMap[category];
  if(category==="threeKind") return counts.some(c=>c>=3)?sum:0;
  if(category==="fourKind") return counts.some(c=>c>=4)?sum:0;
  if(category==="fullHouse") return counts.includes(3)&&counts.includes(2)?25:0;
  const uniq=[...new Set(d)].sort((a,b)=>a-b);
  if(category==="smallStraight"){
    const key=uniq.join("");
    return (key.includes("1234")||key.includes("2345")||key.includes("3456"))?30:0;
  }
  if(category==="largeStraight"){
    const key=uniq.join(""); return (key==="12345"||key==="23456")?40:0;
  }
  if(category==="yams") return counts.some(c=>c===5)?50:0;
  if(category==="chance") return sum;
  return 0;
}

function secureDie(){
  const a=new Uint32Array(1); crypto.getRandomValues(a); return (a[0]%6)+1;
}

export function initialYamsGameState(){
  return {
    state:{turn:0,dice:[0,0,0,0,0],held:[false,false,false,false,false],rolls:0},
    sheets:[initialYamsScores(),initialYamsScores()],
    result:null,
    history:[]
  };
}

export function playServerYamsRoll(game,side,heldInput=null){
  const next=clone(game||initialYamsGameState());
  if(next.result?.over) return {ok:false,error:"La partie est terminée."};
  side=Number(side);
  if(side!==0&&side!==1) return {ok:false,error:"Joueur invalide."};
  if(Number(next.state?.turn)!==side) return {ok:false,error:"Ce n’est pas votre tour."};
  if(Number(next.state?.rolls||0)>=3) return {ok:false,error:"Vous avez déjà utilisé vos trois lancers."};
  if(Number(next.state?.rolls||0)===0) next.state.held=[false,false,false,false,false];
  else if(Array.isArray(heldInput)&&heldInput.length===5) next.state.held=heldInput.map(Boolean);
  const before=[...next.state.dice];
  for(let i=0;i<5;i++){
    if(Number(next.state.rolls)===0 || !next.state.held[i]) next.state.dice[i]=secureDie();
  }
  next.state.rolls=Number(next.state.rolls||0)+1;
  next.history.push({type:"roll",side,roll:next.state.rolls,dice:[...next.state.dice],held:[...next.state.held],before});
  return {ok:true,state:next};
}

export function playServerYamsHold(game,side,index,held){
  const next=clone(game);
  if(next.result?.over) return {ok:false,error:"La partie est terminée."};
  side=Number(side); index=Number(index);
  if(Number(next.state?.turn)!==side) return {ok:false,error:"Ce n’est pas votre tour."};
  if(Number(next.state?.rolls||0)<1) return {ok:false,error:"Lancez d’abord les dés."};
  if(!Number.isInteger(index)||index<0||index>4) return {ok:false,error:"Dé invalide."};
  next.state.held[index]=Boolean(held);
  return {ok:true,state:next};
}

export function playServerYamsScore(game,side,category){
  const next=clone(game);
  side=Number(side); category=String(category||"");
  if(next.result?.over) return {ok:false,error:"La partie est terminée."};
  if(Number(next.state?.turn)!==side) return {ok:false,error:"Ce n’est pas votre tour."};
  if(Number(next.state?.rolls||0)<1) return {ok:false,error:"Vous devez lancer les dés avant de choisir une case."};
  if(!YAMS_CATEGORIES.includes(category)) return {ok:false,error:"Catégorie inconnue."};
  if(next.sheets?.[side]?.[category]!==null && next.sheets?.[side]?.[category]!==undefined) return {ok:false,error:"Cette case est déjà utilisée."};
  const score=scoreYamsCategory(next.state.dice,category);
  next.sheets[side][category]=score;
  next.history.push({type:"score",side,category,score,dice:[...next.state.dice],sheets:clone(next.sheets)});
  const complete=next.sheets.every(sheet=>YAMS_CATEGORIES.every(k=>sheet[k]!==null&&sheet[k]!==undefined));
  if(complete){
    const totals=next.sheets.map(yamsTotal);
    const winner=totals[0]===totals[1]?null:(totals[0]>totals[1]?0:1);
    next.result={over:true,type:"score",winner,totals,text:winner===null?`Égalité : ${totals[0]} à ${totals[1]}.`:`Le joueur ${winner+1} gagne ${totals[winner]} à ${totals[1-winner]}.`};
  }else{
    next.state.turn=side===0?1:0;
    next.state.dice=[0,0,0,0,0]; next.state.held=[false,false,false,false,false]; next.state.rolls=0;
  }
  return {ok:true,state:next,score};
}
