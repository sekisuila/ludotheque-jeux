// ============================================================
// DAMES — moteur serveur pour les deux variantes du site.
//  • international : 10 × 10
//  • english       : 8 × 8
// ============================================================
// Le serveur recalcule tous les coups légaux : le navigateur ne peut donc
// pas imposer un déplacement, une rafle ou une promotion interdite.

export const CHECKERS_VARIANTS = {
  international: {
    id: "international",
    title: "Dames françaises / internationales",
    size: 10,
    rows: 4,
    firstSide: 0,
    sideNames: ["Blancs", "Noirs"],
    setupTopSide: 1,
    setupBottomSide: 0,
    forward: [-1, 1],
    kingFlying: true,
    manCaptureBackwards: true,
    maximumCapture: true,
    promotionStopsCapture: false,
    drawPlyLimit: 50
  },
  english: {
    id: "english",
    title: "Dames anglaises",
    size: 8,
    rows: 3,
    firstSide: 0,
    sideNames: ["Rouges", "Blancs"],
    setupTopSide: 0,
    setupBottomSide: 1,
    forward: [1, -1],
    kingFlying: false,
    manCaptureBackwards: false,
    maximumCapture: false,
    promotionStopsCapture: true,
    drawPlyLimit: 80
  }
};

const DIRS=[[-1,-1],[-1,1],[1,-1],[1,1]];
const inside=(n,r,c)=>r>=0&&r<n&&c>=0&&c<n;
const playable=(r,c)=>(r+c)%2===1;
const cloneBoard=board=>board.map(row=>row.map(p=>p?{...p}:null));
const cloneState=state=>({board:cloneBoard(state.board),turn:Number(state.turn),quietPly:Number(state.quietPly||0)});

function createBoard(cfg){
  const board=Array.from({length:cfg.size},()=>Array(cfg.size).fill(null));
  for(let r=0;r<cfg.rows;r++) for(let c=0;c<cfg.size;c++) if(playable(r,c)) board[r][c]={side:cfg.setupTopSide,king:false};
  for(let r=cfg.size-cfg.rows;r<cfg.size;r++) for(let c=0;c<cfg.size;c++) if(playable(r,c)) board[r][c]={side:cfg.setupBottomSide,king:false};
  return board;
}

function promotionRow(cfg,side){ return cfg.forward[side]<0?0:cfg.size-1; }

function squareNumber(cfg,r,c){
  if(!playable(r,c)) return null;
  let n=0;
  for(let rr=0;rr<cfg.size;rr++) for(let cc=0;cc<cfg.size;cc++){
    if(!playable(rr,cc)) continue;
    n++;
    if(rr===r&&cc===c) return n;
  }
  return null;
}

function positionKey(state,cfg){
  const cells=[];
  for(let r=0;r<cfg.size;r++) for(let c=0;c<cfg.size;c++){
    if(!playable(r,c)) continue;
    const p=state.board[r][c];
    cells.push(!p?".":`${p.side}${p.king?"K":"M"}`);
  }
  return `${state.turn}|${cells.join("")}`;
}

function notation(cfg,move){
  const sep=move.captures.length?"x":"-";
  return move.path.map(([r,c])=>squareNumber(cfg,r,c)).join(sep);
}

function captureDirections(cfg,piece){
  if(piece.king||cfg.manCaptureBackwards) return DIRS;
  const d=cfg.forward[piece.side];
  return [[d,-1],[d,1]];
}

function simpleMovesForPiece(cfg,state,r,c){
  const piece=state.board[r][c];
  if(!piece) return [];
  const moves=[];
  if(!piece.king){
    const d=cfg.forward[piece.side];
    for(const dc of [-1,1]){
      const tr=r+d,tc=c+dc;
      if(inside(cfg.size,tr,tc)&&!state.board[tr][tc]) moves.push({from:[r,c],to:[tr,tc],path:[[r,c],[tr,tc]],captures:[],piece:{...piece}});
    }
    return moves;
  }
  if(!cfg.kingFlying){
    for(const [dr,dc] of DIRS){
      const tr=r+dr,tc=c+dc;
      if(inside(cfg.size,tr,tc)&&!state.board[tr][tc]) moves.push({from:[r,c],to:[tr,tc],path:[[r,c],[tr,tc]],captures:[],piece:{...piece}});
    }
    return moves;
  }
  for(const [dr,dc] of DIRS){
    let tr=r+dr,tc=c+dc;
    while(inside(cfg.size,tr,tc)&&!state.board[tr][tc]){
      moves.push({from:[r,c],to:[tr,tc],path:[[r,c],[tr,tc]],captures:[],piece:{...piece}});
      tr+=dr;tc+=dc;
    }
  }
  return moves;
}

function captureSequencesForPiece(cfg,state,startR,startC){
  const piece=state.board[startR][startC];
  if(!piece) return [];
  const results=[];

  const search=(board,r,c,capturedSet,currentPath,captureList)=>{
    const choices=[];
    const dirs=captureDirections(cfg,piece);

    if(piece.king&&cfg.kingFlying){
      for(const [dr,dc] of dirs){
        let rr=r+dr,cc=c+dc,opponent=null;
        while(inside(cfg.size,rr,cc)){
          const cell=board[rr][cc];
          if(!opponent){
            if(!cell){ rr+=dr;cc+=dc;continue; }
            if(cell.side===piece.side||capturedSet.has(`${rr},${cc}`)) break;
            opponent=[rr,cc]; rr+=dr;cc+=dc; continue;
          }
          if(cell) break;
          choices.push({landing:[rr,cc],taken:opponent});
          rr+=dr;cc+=dc;
        }
      }
    }else{
      for(const [dr,dc] of dirs){
        const mr=r+dr,mc=c+dc,lr=r+dr*2,lc=c+dc*2;
        if(!inside(cfg.size,lr,lc)) continue;
        const middle=board[mr]?.[mc];
        if(!middle||middle.side===piece.side||capturedSet.has(`${mr},${mc}`)||board[lr][lc]) continue;
        choices.push({landing:[lr,lc],taken:[mr,mc]});
      }
    }

    const reachedPromotionAsMan=!piece.king&&cfg.promotionStopsCapture&&currentPath.length>1&&r===promotionRow(cfg,piece.side);
    if(!choices.length||reachedPromotionAsMan){
      if(captureList.length) results.push({
        from:[...currentPath[0]],to:[...currentPath.at(-1)],path:currentPath.map(p=>[...p]),captures:captureList.map(p=>[...p]),piece:{...piece}
      });
      return;
    }

    for(const choice of choices){
      const [lr,lc]=choice.landing,[cr,cc]=choice.taken;
      const next=cloneBoard(board);
      next[r][c]=null;
      next[lr][lc]={...piece};
      const captured=new Set(capturedSet); captured.add(`${cr},${cc}`);
      search(next,lr,lc,captured,[...currentPath,[lr,lc]],[...captureList,[cr,cc]]);
    }
  };

  search(cloneBoard(state.board),startR,startC,new Set(),[[startR,startC]],[]);
  return results;
}

export function legalCheckersMoves(state,variant="international"){
  const cfg=CHECKERS_VARIANTS[variant]||CHECKERS_VARIANTS.international;
  const captures=[];
  for(let r=0;r<cfg.size;r++) for(let c=0;c<cfg.size;c++){
    const p=state.board[r][c];
    if(p&&p.side===state.turn) captures.push(...captureSequencesForPiece(cfg,state,r,c));
  }
  if(captures.length){
    if(!cfg.maximumCapture) return captures;
    const max=Math.max(...captures.map(m=>m.captures.length));
    return captures.filter(m=>m.captures.length===max);
  }
  const moves=[];
  for(let r=0;r<cfg.size;r++) for(let c=0;c<cfg.size;c++){
    const p=state.board[r][c];
    if(p&&p.side===state.turn) moves.push(...simpleMovesForPiece(cfg,state,r,c));
  }
  return moves;
}

function applyMove(cfg,state,move){
  const next=cloneState(state);
  const [fr,fc]=move.from,[tr,tc]=move.to;
  const piece=next.board[fr]?.[fc];
  if(!piece) return next;
  next.board[fr][fc]=null;
  for(const [cr,cc] of move.captures) next.board[cr][cc]=null;
  const moved={...piece};
  if(!moved.king&&tr===promotionRow(cfg,moved.side)) moved.king=true;
  next.board[tr][tc]=moved;
  next.turn=1-state.turn;
  next.quietPly=(!piece.king||move.captures.length)?0:Number(state.quietPly||0)+1;
  return next;
}

function pieceCounts(state){
  const out=[{men:0,kings:0,total:0},{men:0,kings:0,total:0}];
  for(const row of state.board) for(const p of row){
    if(!p) continue;
    out[p.side].total++;
    if(p.king) out[p.side].kings++; else out[p.side].men++;
  }
  return out;
}

function status(game){
  const cfg=CHECKERS_VARIANTS[game.variant]||CHECKERS_VARIANTS.international;
  const state=game.state,moves=legalCheckersMoves(state,game.variant),counts=pieceCounts(state);
  const current=state.turn,opponent=1-current;
  if(!counts[current].total||!moves.length){
    return {over:true,type:"win",winner:opponent,text:`${cfg.sideNames[opponent]} gagnent : ${cfg.sideNames[current].toLowerCase()} n’ont plus de coup légal.`};
  }
  const key=positionKey(state,cfg);
  const repetitions=(game.positionHistory||[]).filter(k=>k===key).length;
  if(repetitions>=3) return {over:true,type:"repetition",winner:null,text:"Partie nulle : même position répétée trois fois."};
  if(Number(state.quietPly||0)>=cfg.drawPlyLimit){
    const label=game.variant==="international"?"25 coups de chaque joueur sans pion ni prise":"40 coups de chaque joueur sans avance de pion ni prise";
    return {over:true,type:"quiet-draw",winner:null,text:`Partie nulle : ${label}.`};
  }
  const forced=Boolean(moves.length&&moves[0].captures.length);
  let text=`${cfg.sideNames[current]} au trait.`;
  if(forced) text+=cfg.maximumCapture?` Prise obligatoire : rafle maximale de ${moves[0].captures.length} pièce${moves[0].captures.length>1?"s":""}.`:" Prise obligatoire.";
  return {over:false,type:forced?"capture":"play",winner:null,text};
}

export function initialCheckersGameState(variant="international"){
  if(!CHECKERS_VARIANTS[variant]) variant="international";
  const cfg=CHECKERS_VARIANTS[variant];
  const state={board:createBoard(cfg),turn:cfg.firstSide,quietPly:0};
  const game={variant,state,history:[],positionHistory:[positionKey(state,cfg)],result:null};
  game.result=status(game);
  return game;
}

function samePath(a,b){
  return Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((p,i)=>Array.isArray(p)&&p[0]===b[i][0]&&p[1]===b[i][1]);
}

export function playServerCheckersMove(game,side,clientMove={}){
  if(!game||!game.state) return {ok:false,error:"État de partie invalide."};
  if(game.result?.over) return {ok:false,error:"La partie est terminée."};
  side=Number(side);
  if(side!==0&&side!==1) return {ok:false,error:"Camp invalide."};
  if(Number(game.state.turn)!==side) return {ok:false,error:"Ce n’est pas votre tour."};

  const legal=legalCheckersMoves(game.state,game.variant);
  const path=Array.isArray(clientMove.path)?clientMove.path.map(p=>[Number(p?.[0]),Number(p?.[1])]):null;
  const found=legal.find(m=>samePath(m.path,path));
  if(!found) return {ok:false,error:"Ce coup n’est pas légal."};

  const cfg=CHECKERS_VARIANTS[game.variant]||CHECKERS_VARIANTS.international;
  const before=cloneState(game.state);
  const nextState=applyMove(cfg,game.state,found);
  const next={
    variant:game.variant,
    state:nextState,
    history:[...(game.history||[]),{state:before,move:found,notation:notation(cfg,found)}],
    positionHistory:[...(game.positionHistory||[]),positionKey(nextState,cfg)],
    result:null
  };
  next.result=status(next);
  return {ok:true,state:next,move:found};
}
