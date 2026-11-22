import {alternatives,analyse,ginAI,ginView,label,newGin,playGin} from "./gin-engine.js?v=20261122";

// Chaque position de la planche correspond à l’une des images fournies.
function card(c) {
  const name=c===52?"Dos rouge":label(c);
  return `<span class="gin-card" role="img" aria-label="${name}" style="background-position:${c%13*100/12}% ${Math.floor(c/13)*25}%"></span>`;
}
// Afficher les combinaisons optimales avant le bois mort, sans déplacer la sélection.
function drawHand(hand, selected, locked, canDiscard) {
  const layout=analyse(hand);
  const choices=alternatives(hand,layout);
  const highlighted=new Set(choices.flat().filter(c=>layout.loose.includes(c)));
  const sections=layout.groups.map(cards=>({
    title:cards[0]%13!==cards[1]%13?"Suite":cards.length===4?"Carré":"Brelan",cards
  }));
  if(layout.loose.length)sections.push({title:"Bois mort",cards:layout.loose});
  const html=sections.map(({title,cards})=>`<section class="gin-group"><strong>${title}</strong><div>${
    cards.map(c=>`<button aria-label="${label(c)}" aria-pressed="${c===selected}" class="${c===selected?"picked":""} ${highlighted.has(c)?"gin-alternate":""}" data-c="${c}" ${!canDiscard || c===locked?"disabled":""}>${card(c)}</button>`).join("")
  }</div></section>`).join("");
  return {html,choices,layout};
}
window.ginArt=()=>`<div class="gin-art">${[17,18,19].map(card).join("")}</div>`;
window.ginRules=(app,game)=>{
  app.innerHTML=`<div class="page"><div class="breadcrumb"><a href="#/catalogue">Catalogue</a> › Cartes</div>
    <section class="game-hero"><div class="game-hero-visual">${window.ginArt()}</div><div><h1>Gin Rummy</h1><p>${game.goal}</p>
    <a class="btn" href="#/jouer/gin-rummy">Jouer au Gin Rummy</a></div></section>
    <article class="panel"><h2>Règles du jeu</h2><ol class="rule-list">${game.rules.map(r=>'<li>'+r+'</li>').join("")}</ol>
    <h3>Exemple de knock</h3><p>Vous frappez avec 6 points. Après ses compléments, votre adversaire en a 14. Vous marquez 8 points. S’il descend à 4, il vous contre et marque 27 points.</p></article></div>`;
};

window.ginTable=app=>{
  app.innerHTML=`<div class="page gin-page"><div class="breadcrumb"><a href="#/jouer">Jouer</a> › Cartes</div>
    <div class="section-head"><h1>Gin Rummy</h1><a class="btn outline small" href="#/jeu/gin-rummy">Règles du jeu</a></div>
    <div class="gin-layout"><section class="gin-felt">
    <div id="gin-table"><div id="gin-opponent"></div><div class="gin-piles">
    <button id="gin-stock"></button><button id="gin-pile"></button></div>
    <p id="gin-prompt" aria-live="polite"></p><div class="gin-hand" id="gin-hand"></div><p id="gin-alternatives"></p></div>
    <div id="gin-curtain" hidden><p></p><button class="btn" id="gin-reveal">Afficher ma main</button></div></section>
    <aside class="panel gin-controls"><label>Mode de jeu <select id="gin-mode"><option value="ai">Contre l’ordinateur</option><option value="local">À deux sur cet écran</option><option value="online">Multijoueur en ligne</option></select></label>
    <div id="gin-room" hidden><button class="btn small" id="gin-create">Créer un salon</button><label>Code du salon <input maxlength="6" id="gin-code"></label>
    <button class="btn outline small" id="gin-join">Rejoindre</button><p role="status" id="gin-connection"></p></div>
    <strong id="gin-score"></strong><p id="gin-notice" aria-live="polite"></p><p id="gin-analysis"></p>
    <button id="gin-pass" class="btn outline small">Passer</button><button id="gin-discard" class="btn small">Défausser</button><button id="gin-knock" class="btn small">Frapper</button>
    <div id="gin-summary"></div><button class="btn small" id="gin-next">Manche suivante</button><button class="btn outline small" id="gin-new">Nouvelle partie</button>
    <button class="btn outline small" id="gin-resign">Abandonner</button><div id="gin-rematch"></div></aside></div></div>`;
  const root=app.querySelector(".gin-page"),el=name=>root.querySelector("#gin-"+name);
  let mode="ai",game=newGin(),selected=null,curtain=false,side=null,players={},socket=null;
  let room="",generation=0,busy=false,offer=null,timer,retry;
  const viewer=()=>mode==="online"?side:mode==="local"?game.turn:0;
  const current=()=>mode==="online"?game:ginView(game,viewer());
  let lastView=null;
  // Les trajets sont déduits des données déjà visibles par ce joueur.
  function transition(before, after, me) {
    if(!before || !after || before.round!==after.round || after.revision!==before.revision+1) return null;
    const own=before.turn===me;
    const sourceCard=c=>own?'[data-c="'+c+'"] .gin-card':'.gin-fan .gin-card:last-child';
    const pile="#gin-pile .gin-card";
    let source,destination,face;
    if(after.phase==="discard" && before.phase!=="discard") {
      const stock=after.stockCount<before.stockCount;
      const drawn=own?after.hand.find(c=>!before.hand.includes(c)):null;
      source=stock?"#gin-stock .gin-card":pile;
      destination=sourceCard(drawn);
      face=stock?52:before.top;
    } else if(before.phase==="discard" && after.phase!=="discard") {
      source=sourceCard(after.top);
      destination=pile;
      face=after.top;
    } else return null;
    const start=root.querySelector(source)?.getBoundingClientRect();
    const priorEnd=root.querySelector(destination)?.getBoundingClientRect();
    return {start,destination,priorEnd,face};
  }
  function animateMove(move) {
    if(!move?.start?.width || !root.animate || window.matchMedia("(prefers-reduced-motion: reduce)").matches)return;
    const end=root.querySelector(move.destination)?.getBoundingClientRect();
    const target=end?.width?end:move.priorEnd;
    if(!target?.width)return;
    const ghost=document.createElement("div");
    ghost.className="gin-flight";
    ghost.setAttribute("aria-hidden","true");
    ghost.innerHTML=card(move.face);
    const start=move.start;
    Object.assign(ghost.style,{left:start.left+"px",top:start.top+"px",width:start.width+"px"});
    root.append(ghost);
    const dx=target.left-start.left,dy=target.top-start.top;
    const motion=ghost.animate([{transform:"none"},{transform:`translate(${dx}px,${dy}px) scale(${target.width/start.width})`}],
      {duration:540,easing:"ease-in-out"});
    motion.onfinish=()=>ghost.remove();
  }
  function send(payload){if(socket?.readyState===WebSocket.OPEN)socket.send(JSON.stringify(payload));}
  function disconnect(){
    lastView=null;
    generation++;clearTimeout(timer);clearTimeout(retry);
    const old=socket;socket=null;old?.close();
    room="";side=null;players={};busy=false;offer=null;
  }
  window.addEventListener("hashchange",disconnect,{once:true});
  function act(kind,cardId){
    if(mode==="online"){send({type:"gin-rummy",kind,card:cardId,revision:game.revision});return;}
    const old=game.turn;
    game=playGin(game,old,{kind,card:cardId});
    if(mode==="local" && game.phase!=="end" && (old!==game.turn || kind==="next"))curtain=true;
    selected=null;render();
  }
  function render(){
    clearTimeout(timer);
    const online=mode==="online";
    const ready=!online || (side!==null && socket?.readyState===WebSocket.OPEN && players.black && players.white);
    const v=ready?current():null;
    const motion=transition(lastView,v,mode==="local"?lastView?.turn:viewer());
    lastView=v;
    const concealed=mode==="local" && curtain;
    el("table").hidden=!ready || concealed;el("curtain").hidden=!concealed && ready;
    el("curtain").querySelector("p").textContent=concealed?"Passez l’écran au joueur "+(game.turn+1)+".":"En attente des deux joueurs.";
    el("reveal").hidden=!concealed;
    el("room").hidden=!online;el("create").disabled=el("join").disabled=busy || !!room;
    el("new").hidden=online;el("resign").hidden=!online || !ready || !!v?.result;
    for(const id of ["discard","next","pass"])el(id).hidden=true;
    for(const id of ["hand","analysis","summary","notice","rematch","score","opponent"])el(id).replaceChildren();
    el("knock").hidden=concealed || !ready;
    el("knock").disabled=true;
    el("knock").textContent="Frapper (knock)";
    if(!ready)return;
    const me=viewer(),mine=!v.result && v.turn===me && !concealed;
    const names=mode==="ai"?["Vous","Ordinateur"]:mode==="online"?[players.black.username,players.white.username]:["Joueur 1","Joueur 2"];
    el("score").textContent=`Manche ${v.round} · ${names[0]} ${v.scores[0]} — ${v.scores[1]} ${names[1]}`;
    if(concealed){animateMove(motion);return;}
    el("opponent").innerHTML='<div class="gin-fan" aria-hidden="true">'+card(52).repeat(v.otherCount)+'</div><span class="gin-opponent-name"></span>';
    el("opponent").querySelector(".gin-opponent-name").textContent=names[1-me]+" · "+v.otherCount+" cartes";
    el("stock").innerHTML=card(52)+`<b>Pioche · ${v.stockCount}</b>`;
    el("pile").innerHTML=(v.top===null?"":card(v.top))+"<b>Défausse</b>";
    el("stock").disabled=!mine || v.phase!=="draw";
    el("pile").disabled=!mine || !["offer","draw"].includes(v.phase) || v.passes===2 || v.top===null;
    el("notice").textContent=v.notice;
    el("prompt").textContent=v.result?"Partie terminée":v.phase==="end"?"Manche terminée":!mine?names[v.turn]+" joue…":
      v.phase==="offer"?"Prenez la carte retournée ou passez.":v.phase==="draw"?(v.passes===2?"Les deux joueurs ont passé. Piochez face cachée.":"Prenez une carte dans la pioche ou la défausse."):"Choisissez une carte à défausser.";
    const canDiscard=mine && v.phase==="discard",has=selected!==null && v.hand.includes(selected);
    const arrangement=drawHand(v.hand,selected,v.locked,canDiscard);
    el("hand").innerHTML=arrangement.html;
    el("alternatives").textContent=arrangement.choices.length?"Autre combinaison possible · "+arrangement.choices.map(group=>group.map(label).join(" ")).join(" / "):"";
    const layout=has?analyse(v.hand.filter(c=>c!==selected)):arrangement.layout;
    el("analysis").textContent=(has?"Après défausse":"Votre main")+" · "+layout.points+" point(s) isolé(s). "+layout.groups.map(g=>g.map(label).join(" ")).join(" / ");
    el("pass").hidden=!mine || v.phase!=="offer";el("discard").hidden=!canDiscard;
    el("discard").disabled=!has;el("knock").disabled=!canDiscard || !has || layout.points>10;
    el("knock").textContent=canDiscard && has && layout.points===0?"Annoncer gin":"Frapper (knock)";
    if(v.summary){
      el("summary").textContent=v.summary.text+(v.summary.points?" "+names[v.summary.winner]+" +"+v.summary.points+" points.":"");
      for(const [i,l] of v.summary.layouts.entries()){
        const p=document.createElement("p");
        p.textContent=names[i]+" · "+l.points+" pts isolés ("+(l.loose.map(label).join(" ")||"aucun")+") · Combinaisons : "+(l.groups.map(g=>g.map(label).join(" ")).join(" / ")||"aucune")+(l.added.length?" · Compléments : "+l.added.map(label).join(" "):"");
        el("summary").append(p);
      }
    }
    if(v.result)el("prompt").textContent=names[v.result.winner]+" remporte la partie. "+v.result.text;
    el("next").hidden=v.phase!=="end" || !!v.result;
    if(online && v.result)el("rematch").innerHTML=!offer?'<button class="btn small" data-reply="offer">Proposer une revanche</button>':offer.side===side?"Revanche proposée…":'<button class="btn small" data-reply="yes">Accepter la revanche</button> <button class="btn outline small" data-reply="no">Refuser</button>';
    animateMove(motion);
    if(mode==="ai" && !v.result && v.phase!=="end" && game.turn===1)timer=setTimeout(()=>{
      if(!root.isConnected)return;
      const a=ginAI(ginView(game,1));act(a.kind,a.card);
    },750);
  }
  function connect(code) {
    room = code;
    el("connection").textContent = "Connexion au salon "+code+"…";
    socket = LudoOnline.rooms.connect(code, {
      message(data, ws) {
        if (ws !== socket) return;
        if (data.game) { game = data.game; selected = null; }
        if (data.side != null) side = data.side;
        if (data.players) players = data.players;
        if ("rematchOffer" in data) offer = data.rematchOffer;
        if (data.type === "rematch_offer") offer = data.offer;
        if (["rematch_declined","rematch_started"].includes(data.type)) offer = null;
        if (data.type === "error") { el("connection").textContent = data.message; return; }
        if (side !== null) el("connection").textContent = `Salon ${code} · Vous êtes le joueur ${side+1}.`;
        render();
      },
      close(e, ws) {
        if (ws !== socket) return;
        el("connection").textContent = "Connexion interrompue. Reconnexion au salon "+code+"…";
        render(); retry = setTimeout(() => connect(code), 2500);
      }
    });
  }
  async function openRoom(create) {
    const attempt = generation, code = el("code").value.trim().toUpperCase();
    busy = true; render();
    try {
      if (!create && (await LudoOnline.rooms.info(code)).room.game !== "gin-rummy") throw new Error("Ce salon appartient à un autre jeu.");
      if (attempt !== generation) return;
      const response = create ? await LudoOnline.rooms.create("gin-rummy",{rated:false}) : await LudoOnline.rooms.join(code);
      if (attempt === generation) connect(response.code);
    } catch (err) { if (attempt === generation) el("connection").textContent = err.message; }
    finally { if (attempt === generation) {busy = false; render();} }
  }
  for(const kind of ["pile","stock","pass","discard","knock","next"])el(kind).onclick=()=>act(kind,selected);
  el("hand").onclick=e=>{const b=e.target.closest("button");if(b && !b.disabled){selected=Number(b.dataset.c);render();}};
  el("new").onclick=()=>{lastView=null;game=newGin();curtain=mode==="local";selected=null;render();};
  el("reveal").onclick=()=>{curtain=false;render();};
  el("mode").onchange=()=>{disconnect();mode=el("mode").value;el("connection").textContent="";el("new").onclick();};
  el("create").onclick=()=>openRoom(true);el("join").onclick=()=>openRoom(false);
  el("resign").onclick=()=>{if(confirm("Abandonner la partie ?"))act("resign");};
  el("rematch").onclick=e=>{const r=e.target.dataset.reply;if(r)send(r==="offer"?{type:"rematch_offer"}:{type:"rematch_response",accept:r==="yes"});};
  const pending=LudoOnline.invites.consumePendingRoom("gin-rummy");
  if(pending){mode=el("mode").value="online";el("code").value=pending.code;openRoom(false);}
  render();
};
