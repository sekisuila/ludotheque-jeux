export const AB_EMPTY = 0;
export const AB_BLACK = 1;
export const AB_WHITE = 2;
export const AB_RADIUS = 4;
export const AB_DIRS = [[1,0],[0,1],[-1,1],[-1,0],[0,-1],[1,-1]];
const AB_AXES = [[1,0],[0,1],[1,-1]];

export const abOther = p => p === AB_BLACK ? AB_WHITE : AB_BLACK;
export const abKey = (q,r) => `${q},${r}`;
const abParse = key => key.split(',').map(Number);
export const abInside = (q,r) => Math.abs(q)<=AB_RADIUS && Math.abs(r)<=AB_RADIUS && Math.abs(q+r)<=AB_RADIUS;
const abAddKey = (key,dir) => { const [q,r]=abParse(key); return abKey(q+dir[0],r+dir[1]); };
const abNeg = d => [-d[0],-d[1]];
const abSameDir = (a,b) => a[0]===b[0] && a[1]===b[1];
const abDirectionName = dir => ["→","↘","↙","←","↖","↗"][AB_DIRS.findIndex(d=>abSameDir(d,dir))] || "•";
const abProjection = (key,dir) => { const [q,r]=abParse(key); return q*dir[0]+r*dir[1]; };
const abNormalizeGroup = group => [...group].sort().join('|');

const AB_CELLS = (() => {
  const cells=[];
  for(let r=-AB_RADIUS;r<=AB_RADIUS;r++) for(let q=-AB_RADIUS;q<=AB_RADIUS;q++) if(abInside(q,r)) cells.push([q,r]);
  return cells;
})();

function abEmptyBoard(){ const b={}; for(const [q,r] of AB_CELLS) b[abKey(q,r)]=AB_EMPTY; return b; }
export function abStandardBoard(){
  const board=abEmptyBoard();
  for(const [q,r] of AB_CELLS){
    if(r===-4||r===-3) board[abKey(q,r)]=AB_BLACK;
    if(r===4||r===3) board[abKey(q,r)]=AB_WHITE;
  }
  for(const q of [0,1,2]) board[abKey(q,-2)]=AB_BLACK;
  for(const q of [-2,-1,0]) board[abKey(q,2)]=AB_WHITE;
  return board;
}

function abGroupAxis(group){
  if(group.length<2) return null;
  for(const axis of AB_AXES){
    const sorted=[...group].sort((a,b)=>abProjection(a,axis)-abProjection(b,axis));
    let ok=true;
    for(let i=1;i<sorted.length;i++) if(abAddKey(sorted[i-1],axis)!==sorted[i]) {ok=false;break;}
    if(ok) return axis;
  }
  return null;
}

function abIsContiguousAligned(group){
  if(!Array.isArray(group)||group.length<1||group.length>3) return false;
  if(new Set(group).size!==group.length) return false;
  if(group.length===1) return true;
  return Boolean(abGroupAxis(group));
}

function abGroupsForPlayer(board,player){
  const groups=[],seen=new Set();
  const own=AB_CELLS.map(([q,r])=>abKey(q,r)).filter(k=>board[k]===player);
  for(const key of own){ seen.add(key); groups.push([key]); }
  for(const axis of AB_AXES){
    for(const start of own){
      for(const len of [2,3]){
        const g=[start]; let cur=start,ok=true;
        for(let i=1;i<len;i++){ cur=abAddKey(cur,axis); const [q,r]=abParse(cur); if(!abInside(q,r)||board[cur]!==player){ok=false;break;} g.push(cur); }
        if(!ok) continue;
        const sig=abNormalizeGroup(g); if(!seen.has(sig)){seen.add(sig);groups.push(g);}
      }
    }
  }
  return groups;
}

export function abAnalyzeMove(board,player,group,dir){
  if(!abIsContiguousAligned(group)) return null;
  if(!AB_DIRS.some(d=>abSameDir(d,dir))) return null;
  if(group.some(k=>board[k]!==player)) return null;
  const opponent=abOther(player);
  if(group.length===1){
    const dest=abAddKey(group[0],dir),[q,r]=abParse(dest);
    if(!abInside(q,r)||board[dest]!==AB_EMPTY) return null;
    return {group:[...group],dir:[...dir],type:'single',push:[],eject:0,destinations:[dest]};
  }
  const axis=abGroupAxis(group);
  const inline=abSameDir(dir,axis)||abSameDir(dir,abNeg(axis));
  if(!inline){
    const destinations=group.map(k=>abAddKey(k,dir));
    for(const dest of destinations){ const [q,r]=abParse(dest); if(!abInside(q,r)||board[dest]!==AB_EMPTY) return null; }
    return {group:[...group],dir:[...dir],type:'broadside',push:[],eject:0,destinations};
  }
  const set=new Set(group);
  const front=group.find(k=>!set.has(abAddKey(k,dir)));
  if(!front) return null;
  const ahead=abAddKey(front,dir),[aq,ar]=abParse(ahead);
  if(!abInside(aq,ar)) return null;
  if(board[ahead]===AB_EMPTY) return {group:[...group],dir:[...dir],type:'inline',push:[],eject:0,destinations:group.map(k=>abAddKey(k,dir))};
  if(board[ahead]===player) return null;
  const push=[]; let cursor=ahead;
  while(true){ const [q,r]=abParse(cursor); if(!abInside(q,r)||board[cursor]!==opponent) break; push.push(cursor); cursor=abAddKey(cursor,dir); }
  if(!push.length||push.length>=group.length||push.length>2) return null;
  const [cq,cr]=abParse(cursor);
  if(abInside(cq,cr)&&board[cursor]!==AB_EMPTY) return null;
  return {group:[...group],dir:[...dir],type:'sumito',push,eject:abInside(cq,cr)?0:1,destinations:group.map(k=>abAddKey(k,dir))};
}

export function abApplyMoveToBoard(board,player,move){
  const next={...board},opponent=abOther(player);
  for(const k of move.group) next[k]=AB_EMPTY;
  for(const k of move.push||[]) next[k]=AB_EMPTY;
  for(const k of move.push||[]){ const dest=abAddKey(k,move.dir),[q,r]=abParse(dest); if(abInside(q,r)) next[dest]=opponent; }
  for(const k of move.group) next[abAddKey(k,move.dir)]=player;
  return next;
}

export function abMoveLabel(move){
  const kind=move.type==='sumito'?`Sumito ${move.group.length}–${move.push.length}`:(move.type==='broadside'?'Latéral':'Ligne');
  return `${kind} ${abDirectionName(move.dir)}${move.eject?' • éjection':''}`;
}

export function initialGameState(){
  return {board:abStandardBoard(),turn:AB_BLACK,ejected:{[AB_BLACK]:0,[AB_WHITE]:0},over:false,winner:null,moves:[]};
}

export function playServerMove(state,player,group,dirIndex){
  if(!state||state.over) return {ok:false,error:'Partie terminée.'};
  if(state.turn!==player) return {ok:false,error:"Ce n’est pas votre tour."};
  const dir=AB_DIRS[Number(dirIndex)];
  if(!dir) return {ok:false,error:'Direction invalide.'};
  const move=abAnalyzeMove(state.board,player,group,dir);
  if(!move) return {ok:false,error:'Coup Abalone illégal.'};
  const next={...state,board:abApplyMoveToBoard(state.board,player,move),ejected:{...state.ejected},moves:[...(state.moves||[])]};
  if(move.eject) next.ejected[player]=(next.ejected[player]||0)+move.eject;
  next.moves.push({group:[...move.group],dir:[...move.dir],push:[...(move.push||[])],destinations:[...(move.destinations||[])],type:move.type,eject:move.eject,player,label:abMoveLabel(move)});
  if(next.ejected[player]>=6){ next.over=true; next.winner=player; }
  else next.turn=abOther(player);
  return {ok:true,state:next,move};
}
