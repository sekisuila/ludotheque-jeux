// ============================================================
// Dominos double-six — jeu local, IA et multijoueur Cloudflare
// ============================================================
(() => {
  const clone=v=>JSON.parse(JSON.stringify(v));
  const PIP_POS={
    0:[],
    1:[5],
    2:[1,9],
    3:[1,5,9],
    4:[1,3,7,9],
    5:[1,3,5,7,9],
    6:[1,3,4,6,7,9]
  };

  function makeSet(){
    const out=[];
    for(let a=0;a<=6;a++)for(let b=a;b<=6;b++)out.push({id:`${a}-${b}`,a,b});
    return out;
  }
  function shuffle(list){
    const a=list.map(t=>({...t}));
    for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}
    return a;
  }
  const pips=t=>Number(t?.a||0)+Number(t?.b||0);
  const handPips=hand=>(hand||[]).reduce((s,t)=>s+pips(t),0);
  function startWeight(t){return t.a===t.b?1000+t.a:(t.a+t.b)*10+Math.max(t.a,t.b);}
  function chooseStarter(hands){
    let best=null;
    for(let side=0;side<2;side++)for(const tile of hands[side]){
      const c={side,tile,weight:startWeight(tile)};
      if(!best||c.weight>best.weight)best=c;
    }
    return best;
  }
  function orient(tile,end,where){
    const a=Number(tile.a),b=Number(tile.b),e=Number(end);
    if(where==="left"){
      if(b===e)return{id:tile.id,left:a,right:b};
      if(a===e)return{id:tile.id,left:b,right:a};
    }else{
      if(a===e)return{id:tile.id,left:a,right:b};
      if(b===e)return{id:tile.id,left:b,right:a};
    }
    return null;
  }
  function legalSides(g,tile){
    const chain=g?.state?.chain||[];
    if(!chain.length)return["right"];
    const l=chain[0].left,r=chain[chain.length-1].right,out=[];
    if(tile.a===l||tile.b===l)out.push("left");
    if(tile.a===r||tile.b===r)out.push("right");
    return out;
  }
  function playable(g,side){return (g.state.hands[side]||[]).filter(t=>legalSides(g,t).length);}

  function dealRound(scores=[0,0],round=1,lastRound=null){
    const set=shuffle(makeSet()),hands=[set.splice(0,7),set.splice(0,7)],starter=chooseStarter(hands),tile=starter.tile;
    hands[starter.side]=hands[starter.side].filter(t=>t.id!==tile.id);
    return{
      state:{target:100,round,scores:[...scores],hands,boneyard:set,chain:[{id:tile.id,left:tile.a,right:tile.b}],turn:1-starter.side,starter:starter.side,passCount:0,lastRound,awaitingNextRound:false},
      result:null,history:[{type:"round_start",round,starter:starter.side,tile:{...tile}}]
    };
  }
  function newGame(){return dealRound([0,0],1,null);}
  function finishLocalRound(g,winner,reason){
    const s=g.state,tot=[handPips(s.hands[0]),handPips(s.hands[1])];let points=0;
    if(winner===0||winner===1){
      points=reason==="empty"?tot[1-winner]:Math.max(0,tot[1-winner]-tot[winner]);
      s.scores[winner]+=points;
    }
    const summary={round:s.round,winner,reason,points,pips:tot,scores:[...s.scores]};
    g.history.push({type:"round_end",...clone(summary)});
    s.lastRound=summary;
    s.turn=null;
    s.awaitingNextRound=true;
    if((winner===0||winner===1)&&s.scores[winner]>=s.target){
      s.awaitingNextRound=false;
      g.result={over:true,type:"score",winner,scores:[...s.scores],target:s.target,lastRound:summary};
    }
    return g;
  }
  function advanceLocalRound(g){
    if(g?.result?.over||!g?.state?.awaitingNextRound)return g;
    const s=g.state,next=dealRound(s.scores,s.round+1,s.lastRound);
    next.history=[...(g.history||[]),...next.history];
    return next;
  }
  function localPlay(g,side,tileId,where){
    const hand=g.state.hands[side],tile=hand.find(t=>t.id===tileId);if(!tile)return false;
    const sides=legalSides(g,tile);if(!sides.includes(where))return false;
    const end=where==="left"?g.state.chain[0].left:g.state.chain[g.state.chain.length-1].right;
    const o=orient(tile,end,where);g.state.hands[side]=hand.filter(t=>t.id!==tile.id);
    if(where==="left")g.state.chain.unshift(o);else g.state.chain.push(o);
    g.state.passCount=0;g.history.push({type:"play",side,round:g.state.round,tile:{...tile},placement:where});
    if(!g.state.hands[side].length)return finishLocalRound(g,side,"empty");
    g.state.turn=1-side;return g;
  }
  function localDraw(g,side){
    if(playable(g,side).length)return g;
    let n=0;
    while(g.state.boneyard.length&&!playable(g,side).length){g.state.hands[side].push(g.state.boneyard.pop());n++;}
    if(n){g.state.passCount=0;g.history.push({type:"draw",side,round:g.state.round,count:n});if(playable(g,side).length)return g;}
    g.state.passCount++;g.history.push({type:"pass",side,round:g.state.round});
    if(g.state.passCount>=2){
      const tot=[handPips(g.state.hands[0]),handPips(g.state.hands[1])];
      const winner=tot[0]<tot[1]?0:tot[1]<tot[0]?1:null;
      return finishLocalRound(g,winner,"blocked");
    }
    g.state.turn=1-side;return g;
  }

  let ui=null,aiTimer=null,reconnectTimer=null,dominoBoardResizeObserver=null,dominoMoveGhost=null,dominoMoveAnimation=null;
  const onlineEmpty=()=>({ws:null,code:null,connected:false,side:null,players:{black:null,white:null},game:null,ratings:null,ratingUpdate:null,settings:null,reconnectAttempts:0,manualClose:false});
  function game(){return ui.mode==="online"?(ui.online.game||newGame()):ui.game;}
  function mySide(){return ui.mode==="online"?Number(ui.online.side):0;}
  function names(){
    if(ui.mode==="online")return[ui.online.players?.black?.username||"Joueur 1",ui.online.players?.white?.username||"Joueur 2"];
    if(ui.mode==="ai")return["Vous","IA"];
    return["Joueur 1","Joueur 2"];
  }
  function canAct(g){if(g.result?.over||g.state?.awaitingNextRound)return false;if(ui.mode==="online")return ui.online.connected&&Number(g.state.turn)===mySide()&&ui.online.players.black&&ui.online.players.white;if(ui.mode==="ai")return Number(g.state.turn)===0;return true;}
  function handForView(g){
    if(ui.mode==="online")return g.state.hands?.[mySide()]||[];
    if(ui.mode==="ai")return g.state.hands[0]||[];
    return g.state.hands[g.state.turn]||[];
  }
  function opponentCount(g){
    if(ui.mode==="online")return Number(g.state.handCounts?.[1-mySide()]??0);
    if(ui.mode==="ai")return g.state.hands[1]?.length||0;
    return g.state.hands[1-g.state.turn]?.length||0;
  }
  function ownLabel(g){
    const n=names();
    return ui.mode==="online"?n[mySide()]:ui.mode==="local"?n[g.state.turn]:n[0];
  }

  function latestPlayEvent(g){
    const history=g?.history||[];
    for(let i=history.length-1;i>=0;i--){
      const event=history[i];
      if(event?.type==="play"){
        return{
          event,
          index:i,
          key:`${i}:${event.round??""}:${event.side??""}:${event.tile?.id||""}:${event.placement||""}`
        };
      }
    }
    return null;
  }
  function isOpponentMove(side){
    side=Number(side);
    if(ui.mode==="online")return side!==mySide();
    if(ui.mode==="ai")return side===1;
    // En mode local, l'écran passe au joueur suivant : le coup qui vient
    // d'être joué est donc le coup de son adversaire.
    return ui.mode==="local";
  }
  function cancelDominoMoveAnimation(){
    try{dominoMoveAnimation?.cancel();}catch{}
    dominoMoveAnimation=null;
    dominoMoveGhost?.remove();
    dominoMoveGhost=null;
    document.querySelectorAll(".domino-board-piece.domino-arriving").forEach(el=>el.classList.remove("domino-arriving"));
  }
  function syncMoveFeedbackFromGame(g,{animate=true}={}){
    const latest=latestPlayEvent(g);
    if(!latest){ui.moveFeedback=null;ui.lastSeenPlayKey=null;return;}
    const event=latest.event;
    // Une nouvelle manche conserve l’historique précédent, mais son dernier domino
    // ne doit plus rester surligné sur le nouveau plateau.
    if(Number(event.round)!==Number(g?.state?.round)){
      ui.lastSeenPlayKey=latest.key;
      cancelDominoMoveAnimation();
      ui.moveFeedback=null;
      return;
    }
    if(latest.key===ui.lastSeenPlayKey)return;
    ui.lastSeenPlayKey=latest.key;
    cancelDominoMoveAnimation();
    if(!isOpponentMove(event.side)){
      ui.moveFeedback=null;
      return;
    }
    ui.moveFeedback={
      key:latest.key,
      side:Number(event.side),
      tile:{...(event.tile||{})},
      placement:event.placement==="left"?"left":"right",
      animate:Boolean(animate)
    };
  }
  function renderMoveNotice(){
    const el=document.getElementById("dominoMoveNotice");if(!el)return;
    const move=ui.moveFeedback;
    if(!move){
      el.hidden=true;
      el.textContent="";
      return;
    }
    const who=names()[move.side]||`Joueur ${move.side+1}`;
    const sideText=move.placement==="left"?"gauche":"droite";
    el.hidden=false;
    el.textContent=`${who} a placé le domino ${move.tile.a}–${move.tile.b} sur l’extrémité ${sideText}.`;
  }

  function roundResultText(g){
    const summary=g?.state?.lastRound||g?.result?.lastRound;
    if(!summary)return "";
    if(summary.winner===null||summary.winner===undefined){
      return `Manche ${summary.round} : égalité. Aucun point n’est attribué.`;
    }
    const winnerName=names()[summary.winner]||`Joueur ${summary.winner+1}`;
    const pts=Number(summary.points||0);
    return `${winnerName} gagne la manche ${summary.round} et marque ${pts} point${pts>1?"s":""}.`;
  }
  function renderRoundDecision(g){
    const box=document.getElementById("dominoRoundDecision");if(!box)return;
    const title=document.getElementById("dominoRoundDecisionTitle");
    const text=document.getElementById("dominoRoundDecisionText");
    const next=document.getElementById("dominoNextRound");
    const restart=document.getElementById("dominoNewMatch");
    const home=document.getElementById("dominoHome");

    if(g.result?.over){
      box.hidden=false;
      const winnerName=g.result.winner===0||g.result.winner===1?names()[g.result.winner]:"";
      if(title)title.textContent="Partie terminée";
      if(text)text.textContent=`${roundResultText(g)} ${winnerName?`${winnerName} gagne la partie ${g.state.scores[0]}–${g.state.scores[1]}.`:(g.result.text||"Partie terminée.")}`;
      if(next)next.hidden=true;
      if(restart){
        restart.hidden=false;
        restart.disabled=Boolean(ui.mode==="online"&&ui.rematchRequested);
        restart.textContent=ui.mode==="online"?(ui.rematchRequested?"Proposition envoyée…":"Nouvelle partie"):"Nouvelle partie";
      }
      if(home)home.hidden=false;
      return;
    }

    if(g.state?.awaitingNextRound){
      box.hidden=false;
      if(title)title.textContent=`Manche ${g.state.lastRound?.round||g.state.round} terminée`;
      if(text)text.textContent=roundResultText(g);
      if(next){next.hidden=false;next.disabled=false;}
      if(restart)restart.hidden=true;
      if(home)home.hidden=true;
      return;
    }

    box.hidden=true;
  }

  function pipFace(v){return `<span class="domino-half" aria-label="${v}">${PIP_POS[v].map(p=>`<i class="domino-pip p${p}"></i>`).join("")}</span>`;}
  function dominoHtml(tile,{back=false,selected=false,small=false,oriented=false}={}){
    if(back)return `<span class="domino-tile domino-back ${small?"small":""}"><span class="domino-back-mark">S</span></span>`;
    const a=oriented?tile.left:tile.a,b=oriented?tile.right:tile.b;
    const dbl=Number(a)===Number(b);
    return `<span class="domino-tile ${dbl?"double":""} ${selected?"selected":""} ${small?"small":""}">${pipFace(a)}<i class="domino-divider"></i>${pipFace(b)}</span>`;
  }
  function renderScore(g){
    const n=names(),el=document.getElementById("dominoScore");if(!el)return;
    const s=g.state.scores||[0,0],lr=g.state.lastRound;
    el.innerHTML=`<div class="domino-score-card ${g.state.turn===0&&!g.result?.over?"active":""}"><span>${n[0]}</span><strong>${s[0]}</strong><small>points</small></div>
      <div class="domino-round-card"><span>Manche</span><strong>${g.state.round}</strong><small>objectif ${g.state.target||100}</small></div>
      <div class="domino-stock-card"><span>Pioche</span><strong>${ui.mode==="online"?Number(g.state.boneyardCount||0):g.state.boneyard.length}</strong><small>dominos</small></div>
      <div class="domino-score-card ${g.state.turn===1&&!g.result?.over?"active":""}"><span>${n[1]}</span><strong>${s[1]}</strong><small>points</small></div>
      ${lr?`<div class="domino-last-round">Manche précédente : ${lr.winner===null?"égalité":`${n[lr.winner]} +${lr.points} pt${lr.points>1?"s":""}`}</div>`:""}`;
  }
  function layoutDominoBoard(){
    const el=document.getElementById("dominoBoard");if(!el)return;
    const pieces=[...el.querySelectorAll(".domino-board-piece")];
    if(!pieces.length){el.style.height="110px";return;}

    // Dimensions réelles des petits dominos du plateau.
    // Un chevauchement de 2 px fait se toucher les bordures comme sur une table.
    const TILE_W=56,TILE_H=30,OVERLAP=2;
    const H_STEP=TILE_W-OVERLAP,V_STEP=TILE_W-OVERLAP;
    const TURN_DOMINOES=2;
    const width=Math.max(180,el.clientWidth||180);

    // On limite volontairement une ligne à 11 dominos même sur grand écran :
    // la chaîne reste lisible et forme rapidement le serpentin demandé.
    const fit=Math.floor((width-16-TILE_W)/H_STEP)+1;
    const rowCapacity=Math.max(3,Math.min(11,fit));
    const rowSpan=TILE_W+(rowCapacity-1)*H_STEP;

    let x=(width-rowSpan)/2+TILE_W/2;
    let y=8+TILE_H/2;
    let direction=1;
    let index=0;
    let maxBottom=y+TILE_H/2;

    const place=(piece,cx,cy,rotation)=>{
      piece.style.left=`${cx-TILE_W/2}px`;
      piece.style.top=`${cy-TILE_H/2}px`;
      piece.style.transform=`rotate(${rotation}deg)`;
      const visualHalfHeight=(rotation%180===0)?TILE_H/2:TILE_W/2;
      maxBottom=Math.max(maxBottom,cy+visualHalfHeight);
    };

    while(index<pieces.length){
      let used=0;

      // Ligne horizontale : gauche -> droite, puis droite -> gauche.
      while(index<pieces.length&&used<rowCapacity){
        place(pieces[index],x,y,direction===1?0:180);
        index++;used++;
        if(index<pieces.length&&used<rowCapacity)x+=direction*H_STEP;
      }
      if(index>=pieces.length)break;

      // Arrivé au bord, la chaîne descend avec deux dominos verticaux.
      // La colonne est placée sous la moitié extérieure du dernier domino,
      // ce qui donne visuellement un virage continu plutôt qu'une nouvelle ligne isolée.
      const columnX=x+direction*((TILE_W-TILE_H)/2);
      let verticalY=y;
      for(let turn=0;turn<TURN_DOMINOES&&index<pieces.length;turn++){
        verticalY=turn===0
          ? y+TILE_H/2+TILE_W/2-OVERLAP
          : verticalY+V_STEP;
        place(pieces[index],columnX,verticalY,90);
        index++;
      }
      if(index>=pieces.length)break;

      // On repart dans le sens opposé, directement sous la colonne.
      y=verticalY+TILE_W/2+TILE_H/2-OVERLAP;
      x=columnX-direction*((TILE_W-TILE_H)/2);
      direction*=-1;
    }

    el.style.height=`${Math.max(110,Math.ceil(maxBottom+8))}px`;
  }

  function animateOpponentDomino(move,target){
    if(!move?.animate||!target)return;
    move.animate=false;

    const reduced=window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    if(reduced)return;

    const source=document.querySelector("#dominoOpponent .domino-back-row")||document.getElementById("dominoOpponent");
    if(!source)return;
    const sr=source.getBoundingClientRect(),tr=target.getBoundingClientRect();
    if(!sr.width||!tr.width)return;

    cancelDominoMoveAnimation();
    const startX=sr.left+sr.width/2,startY=sr.top+sr.height/2;
    const endX=tr.left+tr.width/2,endY=tr.top+tr.height/2;
    const rotation=Number((/rotate\((-?[\d.]+)deg\)/.exec(target.style.transform)||[])[1]||0);

    const ghost=document.createElement("span");
    ghost.className="domino-move-ghost";
    ghost.setAttribute("aria-hidden","true");
    ghost.innerHTML=dominoHtml(move.tile,{small:true});
    ghost.style.left=`${endX-28}px`;
    ghost.style.top=`${endY-15}px`;
    document.body.appendChild(ghost);
    dominoMoveGhost=ghost;
    target.classList.add("domino-arriving");

    const dx=startX-endX,dy=startY-endY;
    if(typeof ghost.animate!=="function"){
      target.classList.remove("domino-arriving");
      ghost.remove();dominoMoveGhost=null;
      return;
    }
    dominoMoveAnimation=ghost.animate([
      {transform:`translate(${dx}px,${dy}px) rotate(0deg) scale(.78)`,opacity:.28},
      {offset:.72,transform:`translate(${dx*.14}px,${dy*.14}px) rotate(${rotation*.82}deg) scale(1.08)`,opacity:1},
      {transform:`translate(0,0) rotate(${rotation}deg) scale(1)`,opacity:1}
    ],{duration:680,easing:"cubic-bezier(.22,.75,.25,1)",fill:"forwards"});
    dominoMoveAnimation.onfinish=()=>{
      target.classList.remove("domino-arriving");
      ghost.remove();
      if(dominoMoveGhost===ghost)dominoMoveGhost=null;
      dominoMoveAnimation=null;
    };
    dominoMoveAnimation.oncancel=()=>{
      target.classList.remove("domino-arriving");
      ghost.remove();
      if(dominoMoveGhost===ghost)dominoMoveGhost=null;
      dominoMoveAnimation=null;
    };
  }

  function renderBoard(g){
    const el=document.getElementById("dominoBoard");if(!el)return;
    const chain=g.state.chain||[];
    const move=ui.moveFeedback;
    const highlightId=move?.tile?.id||null;
    el.innerHTML=chain.map((t,i)=>`<span class="domino-board-piece ${highlightId===t.id?"domino-last-opponent":""}" data-chain-index="${i}" data-domino-id="${t.id}">${dominoHtml(t,{oriented:true,small:true})}</span>`).join("");
    requestAnimationFrame(()=>{
      layoutDominoBoard();
      if(move?.animate){
        const target=[...el.querySelectorAll(".domino-board-piece")].find(piece=>piece.dataset.dominoId===move.tile?.id);
        animateOpponentDomino(move,target);
      }
    });
    const ends=document.getElementById("dominoEnds");if(ends){
      const l=chain[0]?.left,r=chain[chain.length-1]?.right;
      ends.textContent=chain.length?`Extrémités libres : ${l} et ${r}`:"";
    }
  }
  function renderOpponent(g){
    const el=document.getElementById("dominoOpponent");if(!el)return;
    const count=opponentCount(g),n=names();
    const label=ui.mode==="online"?n[1-mySide()]:ui.mode==="ai"?"IA":n[1-g.state.turn];
    el.innerHTML=`<div class="domino-opponent-head"><strong>${label}</strong><span>${count} domino${count>1?"s":""}</span></div><div class="domino-back-row">${Array.from({length:Math.min(count,14)},()=>dominoHtml(null,{back:true,small:true})).join("")}</div>`;
  }
  function renderHand(g){
    const el=document.getElementById("dominoHand");if(!el)return;
    const hand=handForView(g),active=canAct(g);
    el.innerHTML=`<div class="domino-hand-title"><strong>${ownLabel(g)}</strong><span>${hand.length} domino${hand.length>1?"s":""}</span></div><div class="domino-hand-row">${hand.map(t=>{
      const sides=legalSides(g,t),playableNow=active&&sides.length;
      return `<button type="button" class="domino-hand-button ${playableNow?"playable":""}" data-domino="${t.id}" ${active?"":"disabled"} aria-label="Domino ${t.a}-${t.b}">${dominoHtml(t,{selected:ui.selected===t.id})}</button>`;
    }).join("")}</div>`;
  }
  function renderActions(g){
    const tile=handForView(g).find(t=>t.id===ui.selected),sides=tile?legalSides(g,tile):[];
    const left=document.getElementById("dominoPlayLeft"),right=document.getElementById("dominoPlayRight"),draw=document.getElementById("dominoDraw");
    if(left)left.disabled=!canAct(g)||!tile||!sides.includes("left");
    if(right)right.disabled=!canAct(g)||!tile||!sides.includes("right");
    const hasPlayable=ui.mode==="online"?handForView(g).some(t=>legalSides(g,t).length):playable(g,ui.mode==="local"?g.state.turn:ui.mode==="ai"?0:mySide()).length>0;
    if(draw){
      draw.disabled=!canAct(g)||hasPlayable;
      const stock=ui.mode==="online"?Number(g.state.boneyardCount||0):g.state.boneyard.length;
      draw.textContent=stock>0?"Piocher jusqu’à pouvoir jouer":"Passer";
    }
  }
  function setStatus(t){const el=document.getElementById("dominoStatus");if(el)el.textContent=t||"";}
  function renderStatus(g){
    if(g.result?.over){setStatus(`${names()[g.result.winner]} gagne la partie ${g.state.scores[0]}–${g.state.scores[1]}.`);return;}
    if(ui.mode==="online"&&(!ui.online.players.black||!ui.online.players.white)){setStatus("Salon créé. En attente du deuxième joueur…");return;}
    const n=names(),turnName=n[g.state.turn];
    if(ui.mode==="online"&&g.state.turn!==mySide()){setStatus(`${turnName} joue.`);return;}
    const hand=ui.mode==="online"?handForView(g):g.state.hands[g.state.turn];
    const can=hand.some?.(t=>legalSides(g,t).length);
    setStatus(`${turnName} joue.${can?" Choisissez un domino puis une extrémité.":" Aucun domino jouable : piochez ou passez si la pioche est vide."}`);
  }
  function renderOnline(g){
    const settings=document.getElementById("dominoOnlineSettings"),actions=document.getElementById("dominoOnlineActions"),rematch=document.getElementById("rematchDomino"),rating=document.getElementById("dominoRatingResult");
    if(settings)settings.hidden=ui.mode!=="online";
    if(actions)actions.hidden=ui.mode!=="online"||!ui.online.connected||!ui.online.players.black||!ui.online.players.white;
    if(rematch)rematch.hidden=!g.result?.over;
    if(rating){
      const up=ui.online.ratingUpdate;
      if(ui.mode==="online"&&up?.rated){const mine=mySide()===0?up.player0:up.player1;rating.hidden=false;rating.textContent=`Elo : ${mine.before} → ${mine.after} (${mine.delta>=0?"+":""}${mine.delta})`;}
      else rating.hidden=true;
    }
    const rs=document.getElementById("dominoRoomState");
    if(rs&&ui.mode==="online"&&ui.online.connected){
      const r=ui.online.ratings,mine=mySide()===0?r?.player0:r?.player1;
      rs.innerHTML=`<strong>Salon ${ui.online.code||""}</strong><span>Vous êtes Joueur ${mySide()+1}${mine?` · Elo ${mine.rating??1200}`:""}</span>`;
    }
    const ai=document.getElementById("dominoAiSettings");if(ai)ai.hidden=ui.mode!=="ai";
  }
  function render(){
    if(!ui)return;const g=game();
    renderScore(g);renderOpponent(g);renderMoveNotice();renderBoard(g);renderHand(g);renderActions(g);renderStatus(g);renderOnline(g);
  }

  function cancelAi(){clearTimeout(aiTimer);aiTimer=null;}
  function resetLocal(){
    cancelAi();cancelDominoMoveAnimation();
    ui.game=newGame();ui.selected=null;ui.moveFeedback=null;ui.lastSeenPlayKey=null;
    render();
    if(ui.mode==="ai"&&ui.game.state.turn===1)scheduleAi();
  }
  function selectTile(id){const g=game();if(!canAct(g))return;ui.selected=ui.selected===id?null:id;renderHand(g);renderActions(g);}
  function play(where){
    const g=game(),tile=handForView(g).find(t=>t.id===ui.selected);if(!tile||!canAct(g))return;
    ui.selected=null;
    if(ui.mode==="online"){ui.online.ws?.send(JSON.stringify({type:"domino_play",tileId:tile.id,placement:where}));return;}
    const side=ui.mode==="ai"?0:g.state.turn;
    const next=localPlay(g,side,tile.id,where);if(next)ui.game=next;
    syncMoveFeedbackFromGame(ui.game);
    render();
    if(ui.mode==="ai"&&!ui.game.result?.over&&ui.game.state.turn===1)scheduleAi();
  }
  function drawOrPass(){
    const g=game();if(!canAct(g))return;ui.selected=null;
    if(ui.mode==="online"){ui.online.ws?.send(JSON.stringify({type:"domino_draw"}));return;}
    const side=ui.mode==="ai"?0:g.state.turn;ui.game=localDraw(g,side);render();
    if(ui.mode==="ai"&&!ui.game.result?.over&&ui.game.state.turn===1)scheduleAi();
  }

  function aiScoreMove(g,tile,where,level){
    let score=0;
    if(level==="easy")return Math.random();
    score+=pips(tile)*3;
    if(tile.a===tile.b)score+=4;
    const chain=g.state.chain,end=where==="left"?chain[0].left:chain[chain.length-1].right,o=orient(tile,end,where);
    const exposed=where==="left"?o.left:o.right;
    const remaining=(g.state.hands[1]||[]).filter(t=>t.id!==tile.id);
    score+=remaining.filter(t=>t.a===exposed||t.b===exposed).length*4;
    if(level==="hard"){
      const seen=new Set(g.state.chain.map(t=>t.id));
      for(const t of g.state.hands[1])seen.add(t.id);
      const unseen=makeSet().filter(t=>!seen.has(t.id));
      const supply=unseen.filter(t=>t.a===exposed||t.b===exposed).length;
      score+=(7-supply)*2;
      if(g.state.hands[0].length<=3)score+=(6-supply)*2;
    }
    return score+Math.random()*.01;
  }
  function chooseAiMove(g){
    const moves=[];
    for(const tile of playable(g,1))for(const where of legalSides(g,tile))moves.push({tile,where});
    if(!moves.length)return null;
    const level=ui.aiLevel||"medium";
    return moves.sort((a,b)=>aiScoreMove(g,b.tile,b.where,level)-aiScoreMove(g,a.tile,a.where,level))[0];
  }
  function scheduleAi(){
    cancelAi();
    const step=()=>{
      if(!ui||ui.mode!=="ai"||ui.game.result?.over||ui.game.state.turn!==1)return;
      const move=chooseAiMove(ui.game);
      if(move){
        ui.game=localPlay(ui.game,1,move.tile.id,move.where);
        syncMoveFeedbackFromGame(ui.game);
        render();
        if(!ui.game.result?.over&&ui.game.state.turn===1)aiTimer=setTimeout(step,550);
        return;
      }
      ui.game=localDraw(ui.game,1);render();
      if(!ui.game.result?.over&&ui.game.state.turn===1)aiTimer=setTimeout(step,550);
    };
    aiTimer=setTimeout(step,600);
  }

  function onlineStatus(t){const e=document.getElementById("dominoOnlineStatus");if(e)e.textContent=t||"";}
  function disconnect(manual=true){if(!ui)return;clearTimeout(reconnectTimer);ui.online.manualClose=manual;try{ui.online.ws?.close();}catch{}ui.online.ws=null;ui.online.connected=false;}
  async function connect(code,side){
    disconnect(false);ui.online.code=code;ui.online.side=Number(side);ui.online.manualClose=false;
    const ws=LudoOnline.rooms.connect(code,{
      open:()=>{ui.online.ws=ws;ui.online.connected=true;ui.online.reconnectAttempts=0;onlineStatus(`Connecté au salon ${code}.`);render();},
      message:data=>{
        if(data.gameType&&data.gameType!=="dominos")return;
        if(data.type==="welcome"||data.type==="state"){
          ui.online.game=data.game||ui.online.game;ui.online.players=data.players||ui.online.players;ui.online.ratings=data.ratings||ui.online.ratings;ui.online.settings=data.settings||ui.online.settings;ui.online.ratingUpdate=data.ratingUpdate||ui.online.ratingUpdate;ui.selected=null;
          syncMoveFeedbackFromGame(ui.online.game,{animate:true});
          render();
        }else if(data.type==="players"){ui.online.players=data.players||ui.online.players;ui.online.ratings=data.ratings||ui.online.ratings;render();}
        else if(data.type==="rematch_offer")showPrompt(`${data.offer?.username||"Votre adversaire"} propose une revanche.`,"rematch");
        else if(data.type==="rematch_declined")onlineStatus("La revanche a été refusée.");
        else if(data.type==="rematch_started"){
          cancelDominoMoveAnimation();ui.moveFeedback=null;ui.lastSeenPlayKey=null;
          ui.online.side=Number(data.side);ui.online.players=data.players;ui.online.game=data.game;ui.online.ratings=data.ratings||null;ui.online.ratingUpdate=null;ui.selected=null;hidePrompt();render();
        }
        else if(data.type==="error")onlineStatus(data.message||"Erreur du salon.");
      },
      close:()=>{ui.online.connected=false;render();if(!ui.online.manualClose&&ui.mode==="online"&&ui.online.code){const d=Math.min(6000,1000*(++ui.online.reconnectAttempts));reconnectTimer=setTimeout(()=>connect(ui.online.code,ui.online.side),d);}},
      error:()=>onlineStatus("Connexion instable. Nouvelle tentative…")
    });
    ui.online.ws=ws;
  }
  function showPrompt(text,kind){const p=document.getElementById("dominoPrompt");if(!p)return;p.hidden=false;p.querySelector("span").textContent=text;p.dataset.kind=kind;}
  function hidePrompt(){const p=document.getElementById("dominoPrompt");if(p)p.hidden=true;}
  async function createRoom(){
    try{
      const user=await LudoOnline.me(true);if(!user){onlineStatus("Connectez-vous d’abord dans Compte.");return;}
      const creatorSide=document.getElementById("dominoCreatorSide")?.value||"random",rated=document.getElementById("dominoRated")?.checked!==false;
      const data=await LudoOnline.rooms.create("dominos",{creatorSide,rated});
      cancelDominoMoveAnimation();ui.moveFeedback=null;ui.lastSeenPlayKey=null;ui.online=onlineEmpty();
      await connect(data.code,data.side);
    }catch(e){onlineStatus(e.message);}
  }
  async function joinRoom(){
    const code=(document.getElementById("dominoRoomCode")?.value||"").trim().toUpperCase();if(!code){onlineStatus("Saisissez le code du salon.");return;}
    try{
      const user=await LudoOnline.me(true);if(!user){onlineStatus("Connectez-vous d’abord dans Compte.");return;}
      const data=await LudoOnline.rooms.join(code);if(data.game!=="dominos")throw new Error("Ce code ne correspond pas à une partie de Dominos.");
      cancelDominoMoveAnimation();ui.moveFeedback=null;ui.lastSeenPlayKey=null;ui.online=onlineEmpty();
      await connect(data.code,data.side);
    }catch(e){onlineStatus(e.message);}
  }

  window.initDominos=function(){
    ui={mode:"online",game:newGame(),selected:null,aiLevel:"medium",online:onlineEmpty(),moveFeedback:null,lastSeenPlayKey:null};

    // Recalcule automatiquement le serpentin si la fenêtre ou la colonne de jeu change de largeur.
    dominoBoardResizeObserver?.disconnect();
    const board=document.getElementById("dominoBoard");
    if(board&&window.ResizeObserver){
      dominoBoardResizeObserver=new ResizeObserver(()=>layoutDominoBoard());
      dominoBoardResizeObserver.observe(board);
    }

    const mode=document.getElementById("dominoMode");
    mode?.addEventListener("change",()=>{disconnect();ui.mode=mode.value;resetLocal();document.getElementById("dominoOnlineSettings").hidden=ui.mode!=="online";document.getElementById("dominoAiSettings").hidden=ui.mode!=="ai";render();});
    document.getElementById("dominoAiLevel")?.addEventListener("change",e=>{ui.aiLevel=e.target.value;});
    document.getElementById("newDomino")?.addEventListener("click",()=>ui.mode==="online"?onlineStatus("Créez un nouveau salon pour recommencer."):resetLocal());
    document.getElementById("dominoHand")?.addEventListener("click",e=>{const b=e.target.closest("[data-domino]");if(b)selectTile(b.dataset.domino);});
    document.getElementById("dominoPlayLeft")?.addEventListener("click",()=>play("left"));
    document.getElementById("dominoPlayRight")?.addEventListener("click",()=>play("right"));
    document.getElementById("dominoDraw")?.addEventListener("click",drawOrPass);
    document.getElementById("createDominoRoom")?.addEventListener("click",createRoom);
    document.getElementById("joinDominoRoom")?.addEventListener("click",joinRoom);
    document.getElementById("resignDomino")?.addEventListener("click",()=>{if(confirm("Abandonner cette partie ?"))ui.online.ws?.send(JSON.stringify({type:"resign"}));});
    document.getElementById("rematchDomino")?.addEventListener("click",()=>ui.online.ws?.send(JSON.stringify({type:"rematch_offer"})));
    document.getElementById("acceptDomino")?.addEventListener("click",()=>{ui.online.ws?.send(JSON.stringify({type:"rematch_response",accept:true}));hidePrompt();});
    document.getElementById("declineDomino")?.addEventListener("click",()=>{ui.online.ws?.send(JSON.stringify({type:"rematch_response",accept:false}));hidePrompt();});
    render();
  };
})();
