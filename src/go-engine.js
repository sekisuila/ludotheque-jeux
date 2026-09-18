// ============================================================
// GO — moteur serveur pour gobans 9×9, 13×13 et 19×19.
// ============================================================
// Le serveur recalcule chaque coup : intersection libre, captures,
// suicide interdit et ko simple. Deux passes consécutives terminent
// la partie et déclenchent le calcul du score.

export const GO_EMPTY = 0;
export const GO_BLACK = 1;
export const GO_WHITE = 2;
const DIRS=[[-1,0],[1,0],[0,-1],[0,1]];
const VALID_SIZES=new Set([9,13,19]);

export const otherGoSide=side=>Number(side)===GO_BLACK?GO_WHITE:GO_BLACK;
const inside=(size,r,c)=>r>=0&&r<size&&c>=0&&c<size;
const idx=(size,r,c)=>r*size+c;
const cloneBoard=board=>board.slice();
const boardHash=board=>board.join("");

function neighbors(size,r,c){
  const out=[];
  for(const [dr,dc] of DIRS){ const rr=r+dr,cc=c+dc; if(inside(size,rr,cc)) out.push([rr,cc]); }
  return out;
}

function groupInfo(board,size,r,c){
  const color=board[idx(size,r,c)];
  if(!color) return {stones:[],liberties:new Set()};
  const stack=[[r,c]],seen=new Set([`${r},${c}`]),stones=[],liberties=new Set();
  while(stack.length){
    const [rr,cc]=stack.pop(); stones.push([rr,cc]);
    for(const [nr,nc] of neighbors(size,rr,cc)){
      const v=board[idx(size,nr,nc)];
      if(v===GO_EMPTY) liberties.add(`${nr},${nc}`);
      else if(v===color){ const key=`${nr},${nc}`; if(!seen.has(key)){ seen.add(key); stack.push([nr,nc]); } }
    }
  }
  return {stones,liberties};
}

function simulateMove(board,size,player,r,c,koForbiddenHash=null){
  if(!inside(size,r,c)) return {legal:false,error:"Intersection hors du goban."};
  const at=idx(size,r,c);
  if(board[at]!==GO_EMPTY) return {legal:false,error:"Cette intersection est déjà occupée."};
  const next=cloneBoard(board); next[at]=player;
  const opponent=otherGoSide(player),checked=new Set(); let captured=0;
  for(const [nr,nc] of neighbors(size,r,c)){
    if(next[idx(size,nr,nc)]!==opponent) continue;
    const key=`${nr},${nc}`; if(checked.has(key)) continue;
    const group=groupInfo(next,size,nr,nc);
    group.stones.forEach(([gr,gc])=>checked.add(`${gr},${gc}`));
    if(group.liberties.size===0){
      captured+=group.stones.length;
      group.stones.forEach(([gr,gc])=>{ next[idx(size,gr,gc)]=GO_EMPTY; });
    }
  }
  const own=groupInfo(next,size,r,c);
  if(own.liberties.size===0) return {legal:false,error:"Suicide interdit : cette pierre n’aurait aucune liberté."};
  const hash=boardHash(next);
  if(koForbiddenHash!==null && hash===koForbiddenHash) return {legal:false,error:"Ko : il faut jouer ailleurs avant de reprendre."};
  return {legal:true,board:next,captured,hash};
}

function territory(board,size){
  const visited=new Set(),out={[GO_BLACK]:0,[GO_WHITE]:0,neutral:0};
  for(let r=0;r<size;r++) for(let c=0;c<size;c++){
    const start=idx(size,r,c);
    if(board[start]!==GO_EMPTY||visited.has(start)) continue;
    const stack=[[r,c]],region=[],borders=new Set(); visited.add(start);
    while(stack.length){
      const [rr,cc]=stack.pop(); region.push([rr,cc]);
      for(const [nr,nc] of neighbors(size,rr,cc)){
        const ni=idx(size,nr,nc),v=board[ni];
        if(v===GO_EMPTY){ if(!visited.has(ni)){ visited.add(ni); stack.push([nr,nc]); } }
        else borders.add(v);
      }
    }
    if(borders.size===1) out[[...borders][0]]+=region.length; else out.neutral+=region.length;
  }
  return out;
}

function stoneCounts(board){
  let black=0,white=0;
  for(const v of board){ if(v===GO_BLACK) black++; else if(v===GO_WHITE) white++; }
  return {[GO_BLACK]:black,[GO_WHITE]:white};
}

export function scoreGoGame(game){
  const terr=territory(game.board,game.size),stones=stoneCounts(game.board);
  let black,white;
  if(game.scoring==="territory"){
    black=terr[GO_BLACK]+Number(game.captures?.[GO_BLACK]||0);
    white=terr[GO_WHITE]+Number(game.captures?.[GO_WHITE]||0)+Number(game.komi||0);
  }else{
    black=terr[GO_BLACK]+stones[GO_BLACK];
    white=terr[GO_WHITE]+stones[GO_WHITE]+Number(game.komi||0);
  }
  const winner=black>white?GO_BLACK:white>black?GO_WHITE:null;
  return {over:true,type:"score",winner,black,white,margin:Math.abs(black-white),territory:terr,stones,komi:Number(game.komi||0),scoring:game.scoring};
}

function snapshot(game){
  return {
    board:cloneBoard(game.board),turn:game.turn,captures:{...game.captures},passes:game.passes,
    lastMove:game.lastMove?{...game.lastMove}:null,boardHashes:[...(game.boardHashes||[])]
  };
}

function moveLabel(size,r,c){
  const letters="ABCDEFGHJKLMNOPQRST";
  return `${letters[c]||c+1}${size-r}`;
}

export function initialGoGameState(options={}){
  const size=VALID_SIZES.has(Number(options.size))?Number(options.size):19;
  const komi=Number.isFinite(Number(options.komi))?Number(options.komi):7.5;
  const scoring=options.scoring==="territory"?"territory":"area";
  const board=Array(size*size).fill(GO_EMPTY);
  return {
    size,komi,scoring,board,turn:GO_BLACK,captures:{[GO_BLACK]:0,[GO_WHITE]:0},passes:0,
    lastMove:null,moves:[],history:[],boardHashes:[boardHash(board)],result:{over:false,type:"play",winner:null,text:"Noir au trait."}
  };
}

function koForbiddenHash(game){
  const hashes=game.boardHashes||[];
  return hashes.length>=2?hashes[hashes.length-2]:null;
}

export function playServerGoMove(game,side,clientMove={}){
  side=Number(side);
  if(side!==GO_BLACK&&side!==GO_WHITE) return {ok:false,error:"Couleur invalide."};
  if(game?.result?.over) return {ok:false,error:"La partie est terminée."};
  if(Number(game.turn)!==side) return {ok:false,error:"Ce n’est pas votre tour."};
  const r=Number(clientMove.r),c=Number(clientMove.c);
  if(!Number.isInteger(r)||!Number.isInteger(c)) return {ok:false,error:"Coordonnées invalides."};
  const sim=simulateMove(game.board,game.size,side,r,c,koForbiddenHash(game));
  if(!sim.legal) return {ok:false,error:sim.error};
  const next={...game};
  next.history=[...(game.history||[]),{state:snapshot(game),move:{type:"move",player:side,r,c,captured:sim.captured,label:moveLabel(game.size,r,c)}}];
  next.board=sim.board;
  next.captures={...game.captures,[side]:Number(game.captures?.[side]||0)+sim.captured};
  next.passes=0;
  next.lastMove={type:"move",player:side,r,c,captured:sim.captured,label:moveLabel(game.size,r,c)};
  next.moves=[...(game.moves||[]),next.lastMove];
  next.boardHashes=[...(game.boardHashes||[]),sim.hash];
  next.turn=otherGoSide(side);
  next.result={over:false,type:"play",winner:null,text:`${next.turn===GO_BLACK?"Noir":"Blanc"} au trait.`};
  return {ok:true,state:next,move:next.lastMove};
}

export function playServerGoPass(game,side){
  side=Number(side);
  if(side!==GO_BLACK&&side!==GO_WHITE) return {ok:false,error:"Couleur invalide."};
  if(game?.result?.over) return {ok:false,error:"La partie est terminée."};
  if(Number(game.turn)!==side) return {ok:false,error:"Ce n’est pas votre tour."};
  const move={type:"pass",player:side,label:"Passe"};
  const next={...game};
  next.history=[...(game.history||[]),{state:snapshot(game),move}];
  next.moves=[...(game.moves||[]),move];
  next.lastMove=move;
  next.passes=Number(game.passes||0)+1;
  next.boardHashes=[...(game.boardHashes||[]),boardHash(game.board)];
  next.turn=otherGoSide(side);
  if(next.passes>=2){
    next.result=scoreGoGame(next);
    next.result.text=next.result.winner
      ? `${next.result.winner===GO_BLACK?"Noir":"Blanc"} gagne de ${next.result.margin.toFixed(1).replace(".0","")} point${next.result.margin>1?"s":""}.`
      : "Partie terminée : égalité.";
  }else{
    next.result={over:false,type:"pass",winner:null,text:`${side===GO_BLACK?"Noir":"Blanc"} passe. ${next.turn===GO_BLACK?"Noir":"Blanc"} au trait.`};
  }
  return {ok:true,state:next,move};
}
