// ============================================================
// YAMS — jeu local, IA et multijoueur Cloudflare
// Variante : feuille type Yahtzee/Yams classique.
// ============================================================
(() => {
  const CATEGORIES = [
    ["ones","As"],["twos","Deux"],["threes","Trois"],["fours","Quatre"],["fives","Cinq"],["sixes","Six"],
    ["threeKind","Brelan"],["fourKind","Carré"],["fullHouse","Full"],["smallStraight","Petite suite"],
    ["largeStraight","Grande suite"],["yams","Yams"],["chance","Chance"]
  ];
  const UPPER = new Set(["ones","twos","threes","fours","fives","sixes"]);
  const FACE = {ones:1,twos:2,threes:3,fours:4,fives:5,sixes:6};
  const PIPS = {
    1:[5],2:[1,9],3:[1,5,9],4:[1,3,7,9],5:[1,3,5,7,9],6:[1,3,4,6,7,9]
  };

  const emptyScores = () => Object.fromEntries(CATEGORIES.map(([k])=>[k,null]));
  const newGame = () => ({state:{turn:0,dice:[0,0,0,0,0],held:[false,false,false,false,false],rolls:0},sheets:[emptyScores(),emptyScores()],result:null,history:[]});
  const clone = v => JSON.parse(JSON.stringify(v));

  function scoreCategory(dice,cat){
    const d=dice.map(Number); if(d.length!==5||d.some(n=>n<1||n>6)) return 0;
    const counts=Array(7).fill(0); d.forEach(n=>counts[n]++); const sum=d.reduce((a,b)=>a+b,0);
    if(FACE[cat]) return counts[FACE[cat]]*FACE[cat];
    if(cat==="threeKind") return counts.some(c=>c>=3)?sum:0;
    if(cat==="fourKind"){
      const face=counts.findIndex(c=>c>=4);
      return face>=1 ? face*4 : 0;
    }
    if(cat==="fullHouse") return counts.includes(3)&&counts.includes(2)?25:0;
    const u=[...new Set(d)].sort((a,b)=>a-b).join("");
    if(cat==="smallStraight") return (u.includes("1234")||u.includes("2345")||u.includes("3456"))?30:0;
    if(cat==="largeStraight") return (u==="12345"||u==="23456")?40:0;
    if(cat==="yams") return counts.some(c=>c===5)?50:0;
    if(cat==="chance") return sum;
    return 0;
  }
  function upperSubtotal(sheet){ return [...UPPER].reduce((s,k)=>s+Number(sheet[k]??0),0); }
  function bonus(sheet){ return upperSubtotal(sheet)>=63?35:0; }
  function total(sheet){ return CATEGORIES.reduce((s,[k])=>s+Number(sheet[k]??0),0)+bonus(sheet); }
  function localDie(){ return Math.floor(Math.random()*6)+1; }
  function localRoll(game){
    if(game.result?.over||game.state.rolls>=3) return;
    if(game.state.rolls===0) game.state.held=[false,false,false,false,false];
    for(let i=0;i<5;i++) if(game.state.rolls===0||!game.state.held[i]) game.state.dice[i]=localDie();
    game.state.rolls++; game.history.push({type:"roll",side:game.state.turn,roll:game.state.rolls,dice:[...game.state.dice],held:[...game.state.held]});
  }
  function localScore(game,cat){
    const side=game.state.turn; if(game.state.rolls<1||game.sheets[side][cat]!==null) return;
    const score=scoreCategory(game.state.dice,cat); game.sheets[side][cat]=score;
    game.history.push({type:"score",side,category:cat,score,dice:[...game.state.dice],sheets:clone(game.sheets)});
    if(game.sheets.every(s=>CATEGORIES.every(([k])=>s[k]!==null))){
      const totals=game.sheets.map(total),winner=totals[0]===totals[1]?null:(totals[0]>totals[1]?0:1);
      game.result={over:true,type:"score",winner,totals};
    }else{
      game.state.turn=side===0?1:0; game.state.dice=[0,0,0,0,0]; game.state.held=[false,false,false,false,false]; game.state.rolls=0;
    }
  }

  let ui=null,aiTimer=null,reconnectTimer=null;
  const onlineEmpty=()=>({ws:null,code:null,connected:false,side:null,players:{black:null,white:null},game:null,ratings:null,ratingUpdate:null,settings:null,reconnectAttempts:0,manualClose:false});

  function names(){
    if(ui.mode==="online") return [ui.online.players?.black?.username||"Joueur 1",ui.online.players?.white?.username||"Joueur 2"];
    if(ui.mode==="ai") return ["Vous","IA"];
    return ["Joueur 1","Joueur 2"];
  }
  function game(){ return ui.mode==="online"?(ui.online.game||newGame()):ui.game; }
  function mySide(){ return ui.mode==="online"?Number(ui.online.side):null; }
  function isInteractiveTurn(g){
    if(g.result?.over) return false;
    if(ui.mode==="online") return ui.online.connected&&mySide()===Number(g.state.turn)&&ui.online.players.black&&ui.online.players.white;
    if(ui.mode==="ai") return Number(g.state.turn)===0;
    return true;
  }
  function dieFace(value){
    if(!value) return `<span class="yams-die-empty">?</span>`;
    return `<span class="yams-die-face" aria-hidden="true">${PIPS[value].map(p=>`<i class="pip p${p}"></i>`).join("")}</span>`;
  }
  function renderDice(g){
    const box=document.getElementById("yamsDice"); if(!box) return;
    const enabled=isInteractiveTurn(g)&&g.state.rolls>0;
    box.innerHTML=g.state.dice.map((v,i)=>`<button type="button" class="yams-die ${g.state.held[i]?"held":""}" data-die="${i}" ${enabled?"":"disabled"} aria-pressed="${g.state.held[i]?"true":"false"}" aria-label="Dé ${i+1}${v?`, valeur ${v}`:""}${g.state.held[i]?", conservé":""}">${dieFace(v)}<span class="yams-hold-label">${g.state.held[i]?"Conservé":"Garder"}</span></button>`).join("");
  }
  function renderSheet(g){
    const table=document.getElementById("yamsScoreSheet"); if(!table) return;
    const n=names(),turn=Number(g.state.turn),can=isInteractiveTurn(g)&&g.state.rolls>0;
    const rows=CATEGORIES.map(([k,label],idx)=>{
      const vals=[0,1].map(side=>{
        const val=g.sheets[side][k];
        const clickable=can&&side===turn&&val===null;
        const preview=clickable?scoreCategory(g.state.dice,k):null;
        return `<td class="${clickable?"score-choice":""}">${val!==null?`<strong>${val}</strong>`:clickable?`<button type="button" data-score="${k}" title="Inscrire ${preview} points">${preview}</button>`:"—"}</td>`;
      }).join("");
      return `${idx===6?`<tr class="yams-section-row"><th colspan="3">Combinaisons</th></tr>`:""}<tr><th>${label}</th>${vals}</tr>`;
    }).join("");
    table.innerHTML=`<thead><tr><th>Catégorie</th><th class="${turn===0&&!g.result?.over?"active-player":""}">${escapeHtml(n[0])}</th><th class="${turn===1&&!g.result?.over?"active-player":""}">${escapeHtml(n[1])}</th></tr></thead><tbody>${rows}<tr class="yams-summary"><th>Sous-total 1–6</th><td>${upperSubtotal(g.sheets[0])}</td><td>${upperSubtotal(g.sheets[1])}</td></tr><tr class="yams-summary"><th>Bonus (≥63)</th><td>${bonus(g.sheets[0])}</td><td>${bonus(g.sheets[1])}</td></tr><tr class="yams-total"><th>Total</th><td>${total(g.sheets[0])}</td><td>${total(g.sheets[1])}</td></tr></tbody>`;
  }
  function escapeHtml(v){return String(v??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[ch]));}
  function status(text){const el=document.getElementById("yamsStatus");if(el)el.textContent=text||"";}
  function renderStatus(g){
    const n=names();
    if(g.result?.over){
      const totals=g.result.totals||g.sheets.map(total);
      if(g.result.winner===null||g.result.winner===undefined) status(`Égalité : ${totals[0]} à ${totals[1]}.`);
      else status(`${n[g.result.winner]} gagne ${totals[g.result.winner]} à ${totals[1-g.result.winner]}.`);
      return;
    }
    if(ui.mode==="online"&&(!ui.online.players.black||!ui.online.players.white)){ status("Salon créé. En attente du deuxième joueur…"); return; }
    const rolls=Number(g.state.rolls||0);
    status(`${n[g.state.turn]} joue — ${rolls===0?"lancez les 5 dés":`${rolls}/3 lancer${rolls>1?"s":""} utilisé${rolls>1?"s":""}`}.`);
  }
  function renderOnline(g){
    const area=document.getElementById("yamsOnlineSettings"),actions=document.getElementById("yamsOnlineActions"),rematch=document.getElementById("offerRematchYams"),rating=document.getElementById("yamsRatingResult");
    if(area) area.hidden=ui.mode!=="online";
    if(actions) actions.hidden=ui.mode!=="online"||!ui.online.connected||!ui.online.players.black||!ui.online.players.white;
    if(rematch) rematch.hidden=!g.result?.over;
    if(rating){
      const up=ui.online.ratingUpdate;
      if(ui.mode==="online"&&up?.rated){ const mine=mySide()===0?up.player0:up.player1; rating.hidden=false; rating.textContent=`Elo : ${mine.before} → ${mine.after} (${mine.delta>=0?"+":""}${mine.delta})`; } else rating.hidden=true;
    }
    const rs=document.getElementById("yamsRoomState");
    if(rs&&ui.mode==="online"){
      const r=ui.online.ratings;
      rs.innerHTML=ui.online.connected?`<strong>Salon ${escapeHtml(ui.online.code||"")}</strong><span>Vous êtes Joueur ${mySide()+1}${r?` · Elo ${mySide()===0?(r.player0?.rating??1200):(r.player1?.rating??1200)}`:""}</span>`:"";
    }
  }
  function render(){
    if(!ui) return; const g=game(); renderDice(g);renderSheet(g);renderStatus(g);renderOnline(g);
    const roll=document.getElementById("rollYams"); if(roll){roll.disabled=!isInteractiveTurn(g)||g.state.rolls>=3;roll.textContent=g.state.rolls?`Relancer (${3-g.state.rolls} restant${3-g.state.rolls>1?"s":""})`:`Lancer les dés`;}
  }

  function localReset(){ clearTimeout(aiTimer); ui.game=newGame(); render(); }
  function toggleHold(index){
    const g=game(); if(!isInteractiveTurn(g)||g.state.rolls<1) return;
    const value=!g.state.held[index]; g.state.held[index]=value; renderDice(g);
    if(ui.mode==="online") ui.online.ws?.send(JSON.stringify({type:"yams_hold",index,held:value}));
  }
  function roll(){
    const g=game(); if(!isInteractiveTurn(g)||g.state.rolls>=3) return;
    if(ui.mode==="online") ui.online.ws?.send(JSON.stringify({type:"yams_roll",held:g.state.held}));
    else {localRoll(g);render();}
  }
  function chooseScore(cat){
    const g=game(); if(!isInteractiveTurn(g)||g.state.rolls<1) return;
    if(ui.mode==="online") ui.online.ws?.send(JSON.stringify({type:"yams_score",category:cat}));
    else {localScore(g,cat);render(); if(ui.mode==="ai"&&!g.result?.over&&g.state.turn===1) scheduleAi();}
  }

  function bestHold(dice){
    const counts=Array(7).fill(0);dice.forEach(n=>counts[n]++);
    const best=Math.max(...counts),face=counts.findIndex(c=>c===best);
    if(best>=2) return dice.map(n=>n===face);
    const unique=new Set(dice),straightNeed=[1,2,3,4,5].filter(n=>unique.has(n)).length>=[2,3,4,5,6].filter(n=>unique.has(n)).length?[1,2,3,4,5]:[2,3,4,5,6];
    if(straightNeed.filter(n=>unique.has(n)).length>=3) return dice.map(n=>straightNeed.includes(n));
    const max=Math.max(...dice); return dice.map(n=>n===max);
  }
  function aiCategory(g){
    const sheet=g.sheets[1],dice=g.state.dice;
    const options=CATEGORIES.filter(([k])=>sheet[k]===null).map(([k])=>({k,score:scoreCategory(dice,k)}));
    const weight={yams:14,largeStraight:8,smallStraight:5,fullHouse:5,fourKind:4,threeKind:2,chance:0};
    options.forEach(o=>{o.value=o.score+(weight[o.k]||0); if(UPPER.has(o.k)&&o.score>=FACE[o.k]*3)o.value+=4;});
    options.sort((a,b)=>b.value-a.value);
    if(options[0]?.score===0){ const sacr=options.filter(o=>UPPER.has(o.k)).sort((a,b)=>FACE[a.k]-FACE[b.k]); return (sacr[0]||options[0]).k; }
    return options[0].k;
  }
  function scheduleAi(){
    clearTimeout(aiTimer); status("L’IA réfléchit…");
    const step=()=>{
      const g=ui.game;if(ui.mode!=="ai"||g.result?.over||g.state.turn!==1)return;
      if(g.state.rolls<3){
        if(g.state.rolls>0) g.state.held=bestHold(g.state.dice);
        localRoll(g);render(); aiTimer=setTimeout(step,450);
      }else{ localScore(g,aiCategory(g));render(); }
    };
    aiTimer=setTimeout(step,450);
  }

  function onlineStatus(text){const e=document.getElementById("yamsOnlineStatus");if(e)e.textContent=text||"";}
  function disconnectOnline(manual=true){
    if(!ui) return; clearTimeout(reconnectTimer);ui.online.manualClose=manual;
    try{ui.online.ws?.close();}catch{} ui.online.ws=null;ui.online.connected=false;
  }
  async function connectOnline(code,side){
    disconnectOnline(false); ui.online.code=code;ui.online.side=Number(side);ui.online.manualClose=false;
    const ws=LudoOnline.rooms.connect(code,{
      open:()=>{ui.online.ws=ws;ui.online.connected=true;ui.online.reconnectAttempts=0;onlineStatus(`Connecté au salon ${code}.`);render();},
      message:data=>{
        if(data.gameType&&data.gameType!=="yams") return;
        if(data.type==="welcome"||data.type==="state"){ui.online.game=data.game||ui.online.game;ui.online.players=data.players||ui.online.players;ui.online.ratings=data.ratings||ui.online.ratings;ui.online.settings=data.settings||ui.online.settings;ui.online.ratingUpdate=data.ratingUpdate||ui.online.ratingUpdate;render();}
        else if(data.type==="players"){ui.online.players=data.players||ui.online.players;ui.online.ratings=data.ratings||ui.online.ratings;render();}
        else if(data.type==="rematch_offer"){showPrompt(`${data.offer?.username||"Votre adversaire"} propose une revanche.`,true);}
        else if(data.type==="rematch_declined"){onlineStatus("La revanche a été refusée.");}
        else if(data.type==="rematch_started"){ui.online.side=Number(data.side);ui.online.players=data.players;ui.online.game=data.game;ui.online.ratings=data.ratings||null;ui.online.ratingUpdate=null;hidePrompt();render();}
        else if(data.type==="error") onlineStatus(data.message||"Erreur du salon.");
      },
      close:()=>{ui.online.connected=false;render();if(!ui.online.manualClose&&ui.mode==="online"&&ui.online.code){const delay=Math.min(6000,1000*(++ui.online.reconnectAttempts));reconnectTimer=setTimeout(()=>connectOnline(ui.online.code,ui.online.side),delay);}},
      error:()=>onlineStatus("Connexion instable. Nouvelle tentative automatique…")
    });
    ui.online.ws=ws;
  }
  function showPrompt(text,rematch){const p=document.getElementById("yamsOnlinePrompt");if(!p)return;p.hidden=false;p.querySelector("span").textContent=text;p.dataset.kind=rematch?"rematch":"";}
  function hidePrompt(){const p=document.getElementById("yamsOnlinePrompt");if(p)p.hidden=true;}
  async function createRoom(){
    try{const user=await LudoOnline.me(true);if(!user){onlineStatus("Connectez-vous d’abord dans Compte.");return;}const side=document.getElementById("yamsCreatorSide")?.value||"random";const rated=document.getElementById("yamsRated")?.checked!==false;const data=await LudoOnline.rooms.create("yams",{creatorSide:side,rated});ui.online=onlineEmpty();onlineStatus(`Salon ${data.code} créé.`);await connectOnline(data.code,data.side);}catch(e){onlineStatus(e.message);}
  }
  async function joinRoom(){
    const code=(document.getElementById("yamsRoomCode")?.value||"").trim().toUpperCase();if(!code){onlineStatus("Saisissez le code du salon.");return;}
    try{const user=await LudoOnline.me(true);if(!user){onlineStatus("Connectez-vous d’abord dans Compte.");return;}const data=await LudoOnline.rooms.join(code);if(data.game!=="yams")throw new Error("Ce code ne correspond pas à une partie de Yams.");ui.online=onlineEmpty();await connectOnline(data.code,data.side);}catch(e){onlineStatus(e.message);}
  }

  window.initYams=function(){
    ui={mode:"online",game:newGame(),online:onlineEmpty()};
    const mode=document.getElementById("yamsMode");
    mode?.addEventListener("change",()=>{disconnectOnline();ui.mode=mode.value;localReset();document.getElementById("yamsOnlineSettings").hidden=ui.mode!=="online";if(ui.mode==="ai")status("À vous de commencer.");render();});
    document.getElementById("newYams")?.addEventListener("click",()=>{if(ui.mode==="online")onlineStatus("Créez un nouveau salon pour recommencer.");else localReset();});
    document.getElementById("rollYams")?.addEventListener("click",roll);
    document.getElementById("yamsDice")?.addEventListener("click",e=>{const b=e.target.closest("[data-die]");if(b)toggleHold(Number(b.dataset.die));});
    document.getElementById("yamsScoreSheet")?.addEventListener("click",e=>{const b=e.target.closest("[data-score]");if(b)chooseScore(b.dataset.score);});
    document.getElementById("createYamsRoom")?.addEventListener("click",createRoom);
    document.getElementById("joinYamsRoom")?.addEventListener("click",joinRoom);
    document.getElementById("resignYams")?.addEventListener("click",()=>{if(confirm("Abandonner cette partie ?"))ui.online.ws?.send(JSON.stringify({type:"resign"}));});
    document.getElementById("offerRematchYams")?.addEventListener("click",()=>ui.online.ws?.send(JSON.stringify({type:"rematch_offer"})));
    document.getElementById("acceptYamsProposal")?.addEventListener("click",()=>{ui.online.ws?.send(JSON.stringify({type:"rematch_response",accept:true}));hidePrompt();});
    document.getElementById("declineYamsProposal")?.addEventListener("click",()=>{ui.online.ws?.send(JSON.stringify({type:"rematch_response",accept:false}));hidePrompt();});
    render();
    LudoOnline?.invites?.autoJoin?.("yams","yamsRoomCode",joinRoom);
  };
})();
