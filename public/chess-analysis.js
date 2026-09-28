// Analyse post-partie des Échecs avec Stockfish 19.
// Fonctionne sur les replays multijoueurs et IA sans modifier aucun classement Elo.

(() => {
  const PIECES={K:"♔",Q:"♕",R:"♖",B:"♗",N:"♘",P:"♙",k:"♚",q:"♛",r:"♜",b:"♝",n:"♞",p:"♟"};
  let activeJob=null;

  const clone=v=>JSON.parse(JSON.stringify(v));

  function escapeHtml(value){
    return String(value??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
  }

  function snapshots(replay){
    if(!replay?.state)return[];
    const history=Array.isArray(replay.history)?replay.history:[];
    return [...history.map(x=>x?.state).filter(Boolean),replay.state];
  }

  function uciFromMove(move){
    if(!move)return"";
    const sq=(r,c)=>"abcdefgh"[c]+String(8-r);
    return `${sq(move.fr,move.fc)}${sq(move.tr,move.tc)}${move.promotion?String(move.promotion).toLowerCase():""}`;
  }

  function gameFromState(state){
    const game=new ChessGame();
    game.state=clone(state);
    game.history=[];
    game.positionHistory=[chessPositionKey(game.state)];
    return game;
  }

  function legalMoveFromUci(state,uci){
    if(!uci||uci==="(none)"||uci.length<4)return null;
    const fc="abcdefgh".indexOf(uci[0]),fr=8-Number(uci[1]),tc="abcdefgh".indexOf(uci[2]),tr=8-Number(uci[3]);
    const promotion=uci[4]?uci[4].toUpperCase():null;
    if([fr,fc,tr,tc].some(Number.isNaN)||fc<0||tc<0)return null;
    const game=gameFromState(state);
    return game.legalMoves().find(m=>m.fr===fr&&m.fc===fc&&m.tr===tr&&m.tc===tc&&(m.promotion||null)===promotion)||null;
  }

  function sanForUci(state,uci){
    const move=legalMoveFromUci(state,uci);
    if(!move)return uci||"—";
    const game=gameFromState(state);
    const after=game.applyMoveToState(game.state,move);
    return game.notation(move,game.state,after);
  }

  function terminalScore(state){
    try{
      const game=gameFromState(state);
      const legal=game.legalMoves();
      if(legal.length)return null;
      if(game.inCheck(game.state,game.state.turn))return{type:"mate",value:-1};
      return{type:"cp",value:0};
    }catch{return null;}
  }

  function scoreToCp(score){
    if(!score)return null;
    if(score.type==="cp")return Number(score.value);
    const mate=Number(score.value);
    if(!Number.isFinite(mate))return null;
    return mate>0?100000-Math.min(9900,Math.abs(mate)*100):-100000+Math.min(9900,Math.abs(mate)*100);
  }

  function whiteEvalCp(state,score){
    const cp=scoreToCp(score);
    if(cp==null)return null;
    return state?.turn==="b"?-cp:cp;
  }

  function evalLabel(state,score){
    if(!score)return"—";
    if(score.type==="mate"){
      const whiteMate=state?.turn==="b"?-Number(score.value):Number(score.value);
      return whiteMate>0?`M${Math.abs(whiteMate)}`:`−M${Math.abs(whiteMate)}`;
    }
    const cp=whiteEvalCp(state,score);
    if(cp==null)return"—";
    const pawns=cp/100;
    return `${pawns>=0?"+":""}${pawns.toFixed(2)}`;
  }

  function classifyLoss(loss,bestSame){
    if(bestSame||loss<=20)return{key:"best",label:"Meilleur coup",icon:"✓"};
    if(loss<=55)return{key:"good",label:"Bon coup",icon:"●"};
    if(loss<=110)return{key:"inaccuracy",label:"Imprécision",icon:"?!"};
    if(loss<=250)return{key:"mistake",label:"Erreur",icon:"?"};
    return{key:"blunder",label:"Gaffe",icon:"??"};
  }

  function boardHtml(state,lastMove,bestMove){
    const lastFrom=lastMove?`${lastMove.fr},${lastMove.fc}`:"";
    const lastTo=lastMove?`${lastMove.tr},${lastMove.tc}`:"";
    const bestFrom=bestMove?`${bestMove.fr},${bestMove.fc}`:"";
    const bestTo=bestMove?`${bestMove.tr},${bestMove.tc}`:"";
    return Array.from({length:64},(_,i)=>{
      const r=Math.floor(i/8),c=i%8,key=`${r},${c}`,piece=state?.board?.[r]?.[c]||"";
      const classes=["analysis-square",(r+c)%2?"dark":"light"];
      if(key===lastFrom)classes.push("last-from");
      if(key===lastTo)classes.push("last-to");
      if(key===bestFrom)classes.push("best-from");
      if(key===bestTo)classes.push("best-to");
      return `<div class="${classes.join(" ")}"><span>${PIECES[piece]||""}</span></div>`;
    }).join("");
  }

  function cancel(){
    if(activeJob)activeJob.cancelled=true;
    activeJob=null;
    try{window.StrathasardStockfish?.destroy?.();}catch{}
  }

  async function analyseReplay(replay,onProgress,job){
    const engine=window.StrathasardStockfish;
    if(!engine?.analyseState)throw new Error("Le module d’analyse Stockfish n’est pas disponible.");
    const states=snapshots(replay);
    const history=Array.isArray(replay?.history)?replay.history:[];
    if(!history.length||states.length<2)throw new Error("Cette partie ne contient pas assez de coups pour être analysée.");

    const positionAnalysis=[];
    for(let i=0;i<states.length;i++){
      if(job.cancelled)throw new Error("Analyse interrompue.");
      onProgress?.(i,states.length);
      const terminal=i===states.length-1?terminalScore(states[i]):null;
      if(terminal){
        positionAnalysis.push({score:terminal,bestmove:null,depth:null,pv:[]});
      }else{
        const result=await engine.analyseState(states[i],{movetime:220});
        positionAnalysis.push(result||{score:null,bestmove:null,depth:null,pv:[]});
      }
    }
    onProgress?.(states.length,states.length);

    const moves=history.map((entry,i)=>{
      const before=states[i],after=states[i+1],best=positionAnalysis[i],afterEval=positionAnalysis[i+1];
      const playedUci=uciFromMove(entry.move);
      const bestUci=best?.bestmove||"";
      const beforeCp=scoreToCp(best?.score);
      const afterCp=scoreToCp(afterEval?.score);
      const playedCp=afterCp==null?beforeCp:-afterCp;
      let loss=beforeCp==null||playedCp==null?0:Math.max(0,beforeCp-playedCp);
      const same=Boolean(bestUci&&playedUci&&bestUci===playedUci);
      if(same)loss=0;
      const quality=classifyLoss(loss,same);
      return{
        index:i,
        number:Math.floor(i/2)+1,
        color:before.turn,
        san:entry.san||playedUci,
        playedUci,
        bestUci,
        bestSan:bestUci?sanForUci(before,bestUci):"—",
        loss:Math.round(Math.min(loss,9999)),
        quality,
        evalBefore:evalLabel(before,best?.score),
        evalAfter:evalLabel(after,afterEval?.score),
        whiteCpAfter:whiteEvalCp(after,afterEval?.score),
        depth:best?.depth||null,
        before,
        after,
        move:entry.move,
        bestMove:legalMoveFromUci(before,bestUci)
      };
    });

    return{states,moves,positionAnalysis};
  }

  function summaryFor(moves,color){
    const side=moves.filter(m=>m.color===color);
    const count=key=>side.filter(m=>m.quality.key===key).length;
    return{moves:side.length,best:count("best"),good:count("good"),inaccuracy:count("inaccuracy"),mistake:count("mistake"),blunder:count("blunder")};
  }

  function graphValue(cp){
    if(cp==null||!Number.isFinite(Number(cp)))return 0;
    return Math.max(-800,Math.min(800,Number(cp)));
  }

  function analysisGraphHtml(result){
    const moves=result?.moves||[];
    if(!moves.length)return "";
    const initialState=result?.states?.[0];
    const initialScore=result?.positionAnalysis?.[0]?.score;
    const initialCp=whiteEvalCp(initialState,initialScore);
    const values=[initialCp,...moves.map(m=>m.whiteCpAfter)].map(graphValue);
    const width=1000,height=250,padX=36,padTop=25,padBottom=34;
    const innerW=width-padX*2,innerH=height-padTop-padBottom,midY=padTop+innerH/2;
    const maxAbs=Math.max(100,...values.map(v=>Math.abs(v)));
    const visualMax=Math.min(800,Math.max(200,Math.ceil(maxAbs/100)*100));
    const xFor=i=>padX+(values.length<=1?0:i/(values.length-1)*innerW);
    const yFor=value=>midY-(Math.max(-visualMax,Math.min(visualMax,value))/visualMax)*(innerH/2);
    const line=values.map((v,i)=>`${i?"L":"M"} ${xFor(i).toFixed(2)} ${yFor(v).toFixed(2)}`).join(" ");
    const points=moves.map((m,i)=>{
      const x=xFor(i+1),y=yFor(values[i+1]);
      return `<button type="button" class="analysis-chart-point" data-analysis-chart-point="${i}" style="--chart-x:${(x/width*100).toFixed(3)}%;--chart-y:${(y/height*100).toFixed(3)}%" aria-label="Coup ${m.number}${m.color==="w"?".":"…"} ${escapeHtml(m.san)}, évaluation ${escapeHtml(m.evalAfter)}"></button>`;
    }).join("");
    const labels=[visualMax,visualMax/2,0,-visualMax/2,-visualMax].map(cp=>{
      const y=yFor(cp),pawns=cp/100;
      return `<g class="analysis-chart-grid"><line x1="${padX}" y1="${y}" x2="${width-padX}" y2="${y}"></line><text x="8" y="${y+4}">${pawns>0?"+":""}${pawns.toFixed(pawns%1?1:0)}</text></g>`;
    }).join("");
    return `
      <section class="analysis-eval-chart">
        <div class="analysis-chart-head">
          <div><strong>Évolution de la partie</strong><span>Au-dessus de 0 : avantage aux Blancs · en dessous : avantage aux Noirs</span></div>
          <span class="analysis-chart-scale">Échelle limitée à ±${(visualMax/100).toFixed(visualMax%100?1:0)}</span>
        </div>
        <div class="analysis-chart-wrap" data-analysis-chart>
          <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Graphique de l’évolution de l’évaluation Stockfish">
            <rect class="analysis-chart-white-zone" x="${padX}" y="${padTop}" width="${innerW}" height="${innerH/2}"></rect>
            <rect class="analysis-chart-black-zone" x="${padX}" y="${midY}" width="${innerW}" height="${innerH/2}"></rect>
            ${labels}
            <line class="analysis-chart-zero" x1="${padX}" y1="${midY}" x2="${width-padX}" y2="${midY}"></line>
            <path class="analysis-chart-line" d="${line}"></path>
            <text class="analysis-chart-side-label white" x="${width-padX-4}" y="${padTop+15}" text-anchor="end">Blancs</text>
            <text class="analysis-chart-side-label black" x="${width-padX-4}" y="${height-padBottom-7}" text-anchor="end">Noirs</text>
          </svg>
          ${points}
          <span class="analysis-chart-cursor" data-analysis-chart-cursor></span>
        </div>
      </section>`;
  }

  function renderFinished(container,replay,result,meta){
    const moves=result.moves,white=summaryFor(moves,"w"),black=summaryFor(moves,"b");
    container.innerHTML=`
      <div class="chess-analysis-head">
        <div><div class="eyebrow">Analyse Stockfish</div><h3>${escapeHtml(meta?.title||"Analyse de la partie")}</h3><p>${escapeHtml(meta?.subtitle||"Stockfish examine chaque position à force maximale.")}</p></div>
        <button type="button" class="btn outline small" data-analysis-close>Fermer</button>
      </div>
      <div class="analysis-summary-grid">
        <div><span>${escapeHtml(meta?.whiteName||"Blancs")}</span><strong>${white.blunder} gaffe${white.blunder>1?"s":""}</strong><small>${white.mistake} erreur${white.mistake>1?"s":""} · ${white.inaccuracy} imprécision${white.inaccuracy>1?"s":""}</small></div>
        <div><span>${escapeHtml(meta?.blackName||"Noirs")}</span><strong>${black.blunder} gaffe${black.blunder>1?"s":""}</strong><small>${black.mistake} erreur${black.mistake>1?"s":""} · ${black.inaccuracy} imprécision${black.inaccuracy>1?"s":""}</small></div>
      </div>
      ${analysisGraphHtml(result)}
      <div class="chess-analysis-workspace">
        <div class="analysis-board-column">
          <div class="analysis-board" data-analysis-board></div>
          <div class="analysis-position-info" data-analysis-info></div>
          <div class="analysis-nav">
            <button class="btn outline small" type="button" data-analysis-nav="prev">◀ Coup précédent</button>
            <button class="btn outline small" type="button" data-analysis-nav="next">Coup suivant ▶</button>
          </div>
          <div class="note analysis-legend"><strong>Évaluation :</strong> +1,00 favorise les Blancs ; −1,00 favorise les Noirs. La perte est exprimée en centi-pions par rapport au meilleur coup trouvé.</div>
        </div>
        <div class="analysis-move-list" data-analysis-list>
          ${moves.map(m=>`<button type="button" class="analysis-move-row quality-${m.quality.key}" data-analysis-move="${m.index}">
            <span class="analysis-move-no">${m.number}${m.color==="w"?".":"…"}</span>
            <strong>${escapeHtml(m.san)}</strong>
            <span class="analysis-quality">${m.quality.icon} ${m.quality.label}</span>
            <small>Éval. ${escapeHtml(m.evalAfter)}${m.loss? ` · perte ${m.loss} cp`:""}${m.bestSan&&m.bestSan!==m.san?` · mieux : ${escapeHtml(m.bestSan)}`:""}</small>
          </button>`).join("")}
        </div>
      </div>`;

    let selected=0;
    const board=container.querySelector("[data-analysis-board]");
    const info=container.querySelector("[data-analysis-info]");
    const rows=[...container.querySelectorAll("[data-analysis-move]")];
    const chartPoints=[...container.querySelectorAll("[data-analysis-chart-point]")];
    const chartCursor=container.querySelector("[data-analysis-chart-cursor]");
    const show=index=>{
      selected=Math.max(0,Math.min(moves.length-1,index));
      const m=moves[selected];
      rows.forEach((row,i)=>row.classList.toggle("selected",i===selected));
      chartPoints.forEach((point,i)=>point.classList.toggle("selected",i===selected));
      if(chartCursor&&chartPoints[selected]){
        chartCursor.style.left=chartPoints[selected].style.getPropertyValue("--chart-x");
        chartCursor.hidden=false;
      }
      board.innerHTML=boardHtml(m.before,m.move,m.bestMove);
      info.innerHTML=`<strong>${m.number}${m.color==="w"?".":"…"} ${escapeHtml(m.san)} — ${m.quality.label}</strong><span>Évaluation après le coup : ${escapeHtml(m.evalAfter)}</span>${m.bestSan&&m.bestSan!==m.san?`<span>Stockfish préfère <b>${escapeHtml(m.bestSan)}</b> (${escapeHtml(m.evalBefore)} avant le coup).</span>`:"<span>Le coup joué correspond au meilleur choix de Stockfish ou en est très proche.</span>"}`;
      rows[selected]?.scrollIntoView?.({block:"nearest"});
      container.querySelector('[data-analysis-nav="prev"]').disabled=selected===0;
      container.querySelector('[data-analysis-nav="next"]').disabled=selected===moves.length-1;
    };
    rows.forEach(row=>row.addEventListener("click",()=>show(Number(row.dataset.analysisMove))));
    chartPoints.forEach(point=>point.addEventListener("click",()=>show(Number(point.dataset.analysisChartPoint))));
    container.querySelector('[data-analysis-nav="prev"]')?.addEventListener("click",()=>show(selected-1));
    container.querySelector('[data-analysis-nav="next"]')?.addEventListener("click",()=>show(selected+1));
    container.querySelector("[data-analysis-close]")?.addEventListener("click",()=>{cancel();container.hidden=true;container.innerHTML="";});
    show(0);
  }

  async function mount(container,replay,meta={}){
    if(!container||!replay)return;
    cancel();
    const job={cancelled:false,id:crypto.randomUUID()};
    activeJob=job;
    container.hidden=false;
    container.innerHTML=`<div class="chess-analysis-head"><div><div class="eyebrow">Analyse Stockfish</div><h3>${escapeHtml(meta.title||"Analyse de la partie")}</h3><p>Préparation de l’analyse…</p></div><button type="button" class="btn outline small" data-analysis-cancel>Interrompre</button></div><div class="analysis-progress"><div data-analysis-progress-bar></div></div><p data-analysis-progress-text>Chargement de Stockfish…</p>`;
    container.querySelector("[data-analysis-cancel]")?.addEventListener("click",()=>{cancel();container.hidden=true;container.innerHTML="";});
    const bar=container.querySelector("[data-analysis-progress-bar]");
    const status=container.querySelector("[data-analysis-progress-text]");
    try{
      const result=await analyseReplay(replay,(done,total)=>{
        if(job.cancelled||!container.isConnected)return;
        const pct=total?Math.round(done/total*100):0;
        if(bar)bar.style.width=`${pct}%`;
        if(status)status.textContent=`Analyse des positions : ${done}/${total}`;
      },job);
      if(job.cancelled||!container.isConnected)return;
      renderFinished(container,replay,result,meta);
      activeJob=null;
      container.scrollIntoView?.({behavior:"smooth",block:"start"});
    }catch(error){
      if(job.cancelled)return;
      container.innerHTML=`<div class="chess-analysis-head"><div><h3>Analyse impossible</h3><p>${escapeHtml(error.message)}</p></div><button type="button" class="btn outline small" data-analysis-close>Fermer</button></div>`;
      container.querySelector("[data-analysis-close]")?.addEventListener("click",()=>{container.hidden=true;container.innerHTML="";});
      activeJob=null;
    }
  }

  function clear(container){
    cancel();
    if(container){container.hidden=true;container.innerHTML="";}
  }

  window.StrathasardChessAnalysis={mount,clear,cancel};
})();
