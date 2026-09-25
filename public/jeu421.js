// ============================================================
// 421 — jeu local, IA et multijoueur Cloudflare
// Variante : 2 joueurs, 21 jetons, charge puis décharge.
// ============================================================
(() => {
  const PIPS={1:[5],2:[1,9],3:[1,5,9],4:[1,3,7,9],5:[1,3,5,7,9],6:[1,3,4,6,7,9]};
  const clone=v=>JSON.parse(JSON.stringify(v));
  const newGame=()=>({state:{phase:"charge",pot:21,tokens:[0,0],round:1,starter:0,turn:0,dice:[0,0,0],held:[false,false,false],rolls:0,roundResults:[null,null]},result:null,history:[]});

  function sorted(dice){return [...dice].map(Number).sort((a,b)=>b-a);}
  function evaluate(dice){
    const d=sorted(dice); if(d.length!==3||d.some(n=>n<1||n>6))return{key:"",name:"—",rank:-1,value:0};
    const key=d.join("");
    const sp={
      "421":["421",1000,10],"111":["Triple As",990,7],"611":["Deux As + Six",980,6],"666":["Brelan de Six",970,6],
      "511":["Deux As + Cinq",960,5],"555":["Brelan de Cinq",950,5],"411":["Deux As + Quatre",940,4],"444":["Brelan de Quatre",930,4],
      "311":["Deux As + Trois",920,3],"333":["Brelan de Trois",910,3],"211":["Deux As + Deux",900,2],"222":["Brelan de Deux",890,2],
      "654":["Suite 6-5-4",880,2],"543":["Suite 5-4-3",870,2],"432":["Suite 4-3-2",860,2],"321":["Suite 3-2-1",850,2],"221":["Nénette",0,2]
    };
    if(sp[key])return{key,name:sp[key][0],rank:sp[key][1],value:sp[key][2]};
    return{key,name:`${d[0]}-${d[1]}-${d[2]}`,rank:100+d[0]*36+d[1]*6+d[2],value:1};
  }
  function localDie(){return Math.floor(Math.random()*6)+1;}
  function startTurn(s,side){s.turn=side;s.dice=[0,0,0];s.held=[false,false,false];s.rolls=0;}
  function startRound(s,starter){s.round++;s.starter=starter;s.roundResults=[null,null];startTurn(s,starter);}
  function settleRound(g){
    const s=g.state,a=s.roundResults[0],b=s.roundResults[1];if(!a||!b)return;
    const c0=evaluate(a.dice),c1=evaluate(b.dice);let winner=null,loser=null;
    if(c0.rank>c1.rank){winner=0;loser=1;}else if(c1.rank>c0.rank){winner=1;loser=0;}
    if(winner===null){g.history.push({type:"round",round:s.round,phase:s.phase,tie:true,results:clone(s.roundResults),tokens:[...s.tokens],pot:s.pot});startRound(s,s.starter);return;}
    let transfer=evaluate(s.roundResults[winner].dice).value;
    if(s.phase==="charge"&&evaluate(s.roundResults[loser].dice).key==="221")transfer=2;
    if(s.phase==="charge"){
      transfer=Math.min(transfer,s.pot);s.tokens[loser]+=transfer;s.pot-=transfer;
      g.history.push({type:"round",round:s.round,phase:"charge",winner,loser,transfer,results:clone(s.roundResults),tokens:[...s.tokens],pot:s.pot});
      if(s.pot<=0){s.phase="decharge";const immediate=s.tokens[0]===0?0:s.tokens[1]===0?1:null;if(immediate!==null){g.result={over:true,type:"tokens",winner:immediate};return;}}
    }else{
      transfer=Math.min(transfer,s.tokens[winner]);s.tokens[winner]-=transfer;s.tokens[loser]+=transfer;
      g.history.push({type:"round",round:s.round,phase:"decharge",winner,loser,transfer,results:clone(s.roundResults),tokens:[...s.tokens],pot:s.pot});
      if(s.tokens[winner]===0){g.result={over:true,type:"tokens",winner};return;}
    }
    startRound(s,loser);
  }
  function localRoll(g){
    const s=g.state;if(g.result?.over||s.rolls>=3)return;if(s.rolls===0)s.held=[false,false,false];
    for(let i=0;i<3;i++)if(s.rolls===0||!s.held[i])s.dice[i]=localDie();s.rolls++;
    g.history.push({type:"roll",side:s.turn,round:s.round,phase:s.phase,roll:s.rolls,dice:[...s.dice],held:[...s.held]});
  }
  function localStop(g){
    const s=g.state;if(g.result?.over||s.rolls<1)return;const side=s.turn,combo=evaluate(s.dice);
    s.roundResults[side]={dice:[...s.dice],combo,rolls:s.rolls};g.history.push({type:"stop",side,round:s.round,phase:s.phase,dice:[...s.dice],combo,rolls:s.rolls});
    const other=1-side;if(!s.roundResults[other])startTurn(s,other);else settleRound(g);
  }

  let ui=null,aiTimer=null,aiRunId=0,reconnectTimer=null;
  const onlineEmpty=()=>({ws:null,code:null,connected:false,side:null,players:{black:null,white:null},game:null,ratings:null,ratingUpdate:null,settings:null,reconnectAttempts:0,manualClose:false});
  function game(){return ui.mode==="online"?(ui.online.game||newGame()):ui.game;}
  function names(){if(ui.mode==="online")return[ui.online.players?.black?.username||"Joueur 1",ui.online.players?.white?.username||"Joueur 2"];if(ui.mode==="ai")return["Vous","IA"];return["Joueur 1","Joueur 2"];}
  function mySide(){return ui.mode==="online"?Number(ui.online.side):null;}
  function canPlay(g){if(g.result?.over)return false;if(ui.mode==="online")return ui.online.connected&&mySide()===Number(g.state.turn)&&ui.online.players.black&&ui.online.players.white;if(ui.mode==="ai")return g.state.turn===0;return true;}
  function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));}
  function dieFace(v){if(!v)return`<span class="yams-die-empty">?</span>`;return`<span class="yams-die-face" aria-hidden="true">${PIPS[v].map(p=>`<i class="pip p${p}"></i>`).join("")}</span>`;}
  function renderDice(g){
    const box=document.getElementById("game421Dice");if(!box)return;const enabled=canPlay(g)&&g.state.rolls>0;
    box.innerHTML=g.state.dice.map((v,i)=>`<button type="button" class="yams-die ${g.state.held[i]?"held":""}" data-die="${i}" ${enabled?"":"disabled"}>${dieFace(v)}<span class="yams-hold-label">${g.state.held[i]?"Conservé":"Garder"}</span></button>`).join("");
    const combo=document.getElementById("game421Combo");if(combo)combo.innerHTML=g.state.rolls?`<strong>${esc(evaluate(g.state.dice).name)}</strong><span>Valeur : ${evaluate(g.state.dice).value} jeton${evaluate(g.state.dice).value>1?"s":""}</span>`:`<strong>—</strong><span>Lancez les dés</span>`;
  }
  function renderTokens(g){
    const box=document.getElementById("game421Tokens");if(!box)return;const n=names(),s=g.state;
    const phase=s.phase==="charge"?"Charge":"Décharge";
    box.innerHTML=`<div class="game421-phase"><span>Phase</span><strong>${phase}</strong><small>Manche ${s.round}</small></div><div class="game421-pot"><span>Pot</span><strong>${s.pot}</strong><small>jetons</small></div><div class="game421-player ${s.turn===0&&!g.result?.over?"active":""}"><span>${esc(n[0])}</span><strong>${s.tokens[0]}</strong><small>jetons</small></div><div class="game421-player ${s.turn===1&&!g.result?.over?"active":""}"><span>${esc(n[1])}</span><strong>${s.tokens[1]}</strong><small>jetons</small></div>`;
  }
  function setStatus(t){const e=document.getElementById("game421Status");if(e)e.textContent=t||"";}
  function renderStatus(g){
    const n=names(),s=g.state;if(g.result?.over){if(g.result.winner===null||g.result.winner===undefined)setStatus("Partie nulle.");else setStatus(`${n[g.result.winner]} gagne la partie.`);return;}
    if(ui.mode==="online"&&(!ui.online.players.black||!ui.online.players.white)){setStatus("Salon créé. En attente du deuxième joueur…");return;}
    const rr=s.roundResults?.[1-s.turn];const prev=rr?` ${n[1-s.turn]} a validé ${rr.combo?.name||evaluate(rr.dice).name}.`:"";
    setStatus(`${n[s.turn]} joue — ${s.rolls?`${s.rolls}/3 lancer${s.rolls>1?"s":""}`:"premier lancer"}.${prev}`);
  }
  function renderOnline(g){
    const settings=document.getElementById("game421OnlineSettings"),actions=document.getElementById("game421OnlineActions"),rematch=document.getElementById("rematch421"),rating=document.getElementById("game421RatingResult");
    if(settings)settings.hidden=ui.mode!=="online";if(actions)actions.hidden=ui.mode!=="online"||!ui.online.connected||!ui.online.players.black||!ui.online.players.white;if(rematch)rematch.hidden=!g.result?.over;
    if(rating){const up=ui.online.ratingUpdate;if(ui.mode==="online"&&up?.rated){const mine=mySide()===0?up.player0:up.player1;rating.hidden=false;rating.textContent=`Elo : ${mine.before} → ${mine.after} (${mine.delta>=0?"+":""}${mine.delta})`;}else rating.hidden=true;}
    const rs=document.getElementById("game421RoomState");if(rs&&ui.mode==="online"){const r=ui.online.ratings;rs.innerHTML=ui.online.connected?`<strong>Salon ${esc(ui.online.code||"")}</strong><span>Vous êtes Joueur ${mySide()+1}${r?` · Elo ${mySide()===0?(r.player0?.rating??1200):(r.player1?.rating??1200)}`:""}</span>`:"";}
  }
  function render(){if(!ui)return;const g=game();renderDice(g);renderTokens(g);renderStatus(g);renderOnline(g);const roll=document.getElementById("roll421"),stop=document.getElementById("stop421");if(roll){roll.disabled=!canPlay(g)||g.state.rolls>=3;roll.textContent=g.state.rolls?`Relancer (${3-g.state.rolls} restant${3-g.state.rolls>1?"s":""})`:`Lancer les dés`;}if(stop)stop.disabled=!canPlay(g)||g.state.rolls<1;}
  function cancelAi(){
    aiRunId++;
    clearTimeout(aiTimer);
    aiTimer=null;
  }
  function resetLocal(){cancelAi();ui.game=newGame();render();}
  function toggleHold(i){const g=game();if(!canPlay(g)||g.state.rolls<1)return;g.state.held[i]=!g.state.held[i];renderDice(g);if(ui.mode==="online")ui.online.ws?.send(JSON.stringify({type:"game421_hold",index:i,held:g.state.held[i]}));}
  function roll(){const g=game();if(!canPlay(g)||g.state.rolls>=3)return;if(ui.mode==="online")ui.online.ws?.send(JSON.stringify({type:"game421_roll",held:g.state.held}));else{localRoll(g);render();}}
  function stop(){const g=game();if(!canPlay(g)||g.state.rolls<1)return;if(ui.mode==="online")ui.online.ws?.send(JSON.stringify({type:"game421_stop"}));else{localStop(g);render();if(ui.mode==="ai"&&!g.result?.over&&g.state.turn===1)scheduleAi();}}

  function aiHolds(dice){
    const c=evaluate(dice);if(c.rank>=850)return[true,true,true];
    const count={};dice.forEach(v=>count[v]=(count[v]||0)+1);const pair=Object.entries(count).find(([,n])=>n>=2);if(pair)return dice.map(v=>v===Number(pair[0]));
    // Priorité à un As, puis à 4/2 pour tenter 421.
    if(dice.includes(1)){const needed=new Set([1,4,2]);return dice.map(v=>needed.has(v));}
    const high=Math.max(...dice);return dice.map(v=>v===high);
  }
  function scheduleAi(){
    cancelAi();
    const runId=aiRunId;
    const queueStep=(step,delay)=>{
      aiTimer=setTimeout(()=>{
        aiTimer=null;
        if(runId===aiRunId) step();
      },delay);
    };
    const step=()=>{
      if(runId!==aiRunId||!ui||ui.mode!=="ai")return;
      const g=ui.game;
      if(!g||g.result?.over||g.state.turn!==1)return;

      if(g.state.rolls===0){
        localRoll(g);
        // On programme la suite AVANT le rendu : même si l'affichage rencontre
        // un problème, le tour de l'IA ne reste pas bloqué.
        queueStep(step,420);
        render();
        return;
      }

      const c=evaluate(g.state.dice);
      if(c.rank>=850||g.state.rolls>=3){
        localStop(g);
        // Toujours revérifier l'état après une manche. Si l'IA a perdu,
        // startRound() lui redonne le trait et ce même step démarre sa
        // nouvelle manche. Si le tour revient à l'humain, step() s'arrête.
        if(!g.result?.over) queueStep(step,450);
        render();
        return;
      }

      g.state.held=aiHolds(g.state.dice);
      localRoll(g);
      queueStep(step,420);
      render();
    };
    queueStep(step,450);
  }

  function onlineStatus(t){const e=document.getElementById("game421OnlineStatus");if(e)e.textContent=t||"";}
  function disconnect(manual=true){if(!ui)return;clearTimeout(reconnectTimer);ui.online.manualClose=manual;try{ui.online.ws?.close();}catch{}ui.online.ws=null;ui.online.connected=false;}
  async function connect(code,side){
    disconnect(false);ui.online.code=code;ui.online.side=Number(side);ui.online.manualClose=false;
    const ws=LudoOnline.rooms.connect(code,{open:()=>{ui.online.ws=ws;ui.online.connected=true;ui.online.reconnectAttempts=0;onlineStatus(`Connecté au salon ${code}.`);render();},message:data=>{
      if(data.gameType&&data.gameType!=="421")return;
      if(data.type==="welcome"||data.type==="state"){ui.online.game=data.game||ui.online.game;ui.online.players=data.players||ui.online.players;ui.online.ratings=data.ratings||ui.online.ratings;ui.online.settings=data.settings||ui.online.settings;ui.online.ratingUpdate=data.ratingUpdate||ui.online.ratingUpdate;render();}
      else if(data.type==="players"){ui.online.players=data.players||ui.online.players;ui.online.ratings=data.ratings||ui.online.ratings;render();}
      else if(data.type==="draw_offer")showPrompt(`${data.offer?.username||"Votre adversaire"} propose une partie nulle.`,`draw`);
      else if(data.type==="draw_declined")onlineStatus("La proposition de nulle a été refusée.");
      else if(data.type==="rematch_offer")showPrompt(`${data.offer?.username||"Votre adversaire"} propose une revanche.`,`rematch`);
      else if(data.type==="rematch_declined")onlineStatus("La revanche a été refusée.");
      else if(data.type==="rematch_started"){ui.online.side=Number(data.side);ui.online.players=data.players;ui.online.game=data.game;ui.online.ratings=data.ratings||null;ui.online.ratingUpdate=null;hidePrompt();render();}
      else if(data.type==="error")onlineStatus(data.message||"Erreur du salon.");
    },close:()=>{ui.online.connected=false;render();if(!ui.online.manualClose&&ui.mode==="online"&&ui.online.code){const d=Math.min(6000,1000*(++ui.online.reconnectAttempts));reconnectTimer=setTimeout(()=>connect(ui.online.code,ui.online.side),d);}},error:()=>onlineStatus("Connexion instable. Nouvelle tentative…")});ui.online.ws=ws;
  }
  function showPrompt(text,kind){const p=document.getElementById("game421Prompt");if(!p)return;p.hidden=false;p.querySelector("span").textContent=text;p.dataset.kind=kind;}
  function hidePrompt(){const p=document.getElementById("game421Prompt");if(p)p.hidden=true;}
  async function createRoom(){try{const user=await LudoOnline.me(true);if(!user){onlineStatus("Connectez-vous d’abord dans Compte.");return;}const creatorSide=document.getElementById("game421CreatorSide")?.value||"random",rated=document.getElementById("game421Rated")?.checked!==false;const data=await LudoOnline.rooms.create("421",{creatorSide,rated});ui.online=onlineEmpty();await connect(data.code,data.side);}catch(e){onlineStatus(e.message);}}
  async function joinRoom(){const code=(document.getElementById("game421RoomCode")?.value||"").trim().toUpperCase();if(!code){onlineStatus("Saisissez le code du salon.");return;}try{const user=await LudoOnline.me(true);if(!user){onlineStatus("Connectez-vous d’abord dans Compte.");return;}const data=await LudoOnline.rooms.join(code);if(data.game!=="421")throw new Error("Ce code ne correspond pas à une partie de 421.");ui.online=onlineEmpty();await connect(data.code,data.side);}catch(e){onlineStatus(e.message);}}

  window.init421=function(){
    ui={mode:"online",game:newGame(),online:onlineEmpty()};const mode=document.getElementById("game421Mode");
    mode?.addEventListener("change",()=>{disconnect();ui.mode=mode.value;resetLocal();document.getElementById("game421OnlineSettings").hidden=ui.mode!=="online";if(ui.mode==="ai")setStatus("À vous de commencer.");render();});
    document.getElementById("new421")?.addEventListener("click",()=>ui.mode==="online"?onlineStatus("Créez un nouveau salon pour recommencer."):resetLocal());
    document.getElementById("roll421")?.addEventListener("click",roll);document.getElementById("stop421")?.addEventListener("click",stop);
    document.getElementById("game421Dice")?.addEventListener("click",e=>{const b=e.target.closest("[data-die]");if(b)toggleHold(Number(b.dataset.die));});
    document.getElementById("create421Room")?.addEventListener("click",createRoom);document.getElementById("join421Room")?.addEventListener("click",joinRoom);
    document.getElementById("resign421")?.addEventListener("click",()=>{if(confirm("Abandonner cette partie ?"))ui.online.ws?.send(JSON.stringify({type:"resign"}));});
    document.getElementById("draw421")?.addEventListener("click",()=>ui.online.ws?.send(JSON.stringify({type:"draw_offer"})));
    document.getElementById("rematch421")?.addEventListener("click",()=>ui.online.ws?.send(JSON.stringify({type:"rematch_offer"})));
    document.getElementById("accept421")?.addEventListener("click",()=>{const p=document.getElementById("game421Prompt");ui.online.ws?.send(JSON.stringify({type:p?.dataset.kind==="draw"?"draw_response":"rematch_response",accept:true}));hidePrompt();});
    document.getElementById("decline421")?.addEventListener("click",()=>{const p=document.getElementById("game421Prompt");ui.online.ws?.send(JSON.stringify({type:p?.dataset.kind==="draw"?"draw_response":"rematch_response",accept:false}));hidePrompt();});
    render();
  };
})();
