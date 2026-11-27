import {aiStep,checkGroup,compulsory,deal,discard,draw,frozen,hand,label,pickBase,points,preview,put,rank,ranks,seats,side,threshold,top,wild} from "./canasta-engine.js?v=1";

function card(c) {
  const face=c===-1?52:c%52;
  const style=c>=104?'background-image:url(canasta-joker.webp);background-size:cover':
    'background-position:'+face%13*100/12+'% '+Math.floor(face/13)*25+'%';
  return '<span class="gin-card" role="img" aria-label="'+(c===-1?"Dos rouge":label(c))+'" style="'+style+'"></span>';
}
window.canastaArt=()=>'<div class="gin-art ca-art">'+[12,25,104].map(card).join("")+'</div>';
const teams=["Nord–Sud","Est–Ouest"];
let game, timer;
window.canastaTable=app=>{
  clearTimeout(timer);
  game??=deal();
  let plan={},pick=false,selected=[],notice="";
  app.innerHTML='<div class="page ca-page"><div class="breadcrumb"><a href="#/jouer">Jouer</a> › Cartes</div><div class="section-head"><h1>Canasta</h1><a class="btn outline small" href="#/jeu/canasta">Règles du jeu</a></div><div id="ca-game"></div></div>';
  const root=app.querySelector("#ca-game");
  const button=(key,title,enabled=true)=>'<button class="btn small" data-act="'+key+'" '+(enabled?'':'disabled')+'>'+title+'</button>';
  function reset() {plan={};pick=false;selected=[];}
  function commit() { put(game,plan,pick); reset(); }
  function zone(r) {
    if(!selected.length) throw Error("Sélectionnez d’abord les cartes à poser.");
    const target=r ?? rank(selected.find(c=>!wild(c)) ?? 104);
    if(target===13) throw Error("Cliquez sur la combinaison à compléter avec votre carte libre.");
    const added=[...(plan[target]||[]),...selected];
    checkGroup(target,[...(side(game).melds[target]||[]),...added]);
    plan[target]=added; selected=[];
  }
  function seat(p) {
    return '<div class="ca-seat '+(p===game.turn && game.phase!=="end"?'ca-active':'')+'"><b>'+seats[p]+(p===2?' · Partenaire':'')+'</b><span>'+game.hands[p].length+' cartes</span><i aria-hidden="true">'+Array.from({length:Math.min(8,game.hands[p].length)},()=>card(-1)).join("")+'</i></div>';
  }
  function displayTeam(i) {
    const t=game.teams[i], draft=i===0?plan:{};
    const groups=[...new Set([...Object.keys(t.melds),...Object.keys(draft)])];
    const active=i===0 && game.turn===0 && (game.phase==="play" || pick);
    const chips=groups.map(r=>{
      const cards=[...(t.melds[r]||[]),...(draft[r]||[])];
      const status=cards.length>=7?(cards.some(wild)?" · Canasta mixte":" · Canasta naturelle"):"";
      return '<button class="ca-meld" data-r="'+r+'" '+(active?'':'disabled')+'><b>'+ranks[r]+' × '+cards.length+status+'</b><span>'+cards.map(c=>'<span class="'+(draft[r]?.includes(c)?'ca-draft':'')+'">'+card(c)+'</span>').join("")+'</span></button>';
    }).join("");
    return '<section class="ca-side"><h3>'+teams[i]+'</h3><div class="ca-reds">3 rouges · '+t.reds.length+t.reds.map(card).join("")+'</div><div class="ca-groups">'+chips+'</div>'+
      (i===0?'<button class="ca-drop" data-act="zone" '+(active?'':'disabled')+'>Déposer les cartes sélectionnées</button>':(!groups.length?'<small>Aucune combinaison</small>':''))+'</section>';
  }
  function summary() {
    const rows=[["Cartes posées","laid"],["Cartes en main","held"],["Canastas","bonuses"],["3 rouges","reds"],["Sortie","exit"],["Manche","total"]];
    return '<section class="panel"><h2>'+game.reason+'</h2><table><thead><tr><th>Décompte</th><th>Nord–Sud</th><th>Est–Ouest</th></tr></thead><tbody>'+
      rows.map(([title,k])=>'<tr><th>'+title+'</th>'+game.result.map(r=>'<td>'+(k==="held"?-r[k]:r[k])+'</td>').join("")+'</tr>').join("")+
      '</tbody></table>'+(game.over?'<p>Victoire de '+teams[game.scores[0]>game.scores[1]?0:1]+' !</p>':'')+button("next",game.over?"Nouvelle partie":"Manche suivante")+'</section>';
  }
  function paint() {
    const g=game, mine=g.turn===0 && g.phase!=="end", drawing=mine && g.phase==="draw" && !pick;
    const canPose=mine && (pick || g.phase==="play"), used=Object.values(plan).flat();
    let error="", canExit=false;
    if(used.length) { try {canExit=preview(g,plan,pick).canExit;} catch(e) {error=e.message;} }
    const replyPossible=mine && !pick && !g.meldedThisTurn && g.permission===null && (canExit || (g.phase==="play" && hand(g).length===1 && Object.values(side(g).melds).some(cs=>cs.length>=7)));
    const prompt=g.phase==="end"?"Manche terminée":!mine?"Au tour de "+seats[g.turn]+".":drawing?
      (compulsory(g)?"Pioche vide. Ramassez la défausse.":"À vous de piocher ou de ramasser la défausse."):
      pick?"Préparez la pose du sommet puis confirmez la prise.":"Choisissez vos cartes, puis cliquez sur la zone de dépôt ou sur une combinaison.";
    const controls=canPose?'<div class="ca-actions">'+(used.length?button("commit",pick?"Confirmer la prise":"Confirmer la pose",!error)+button("undo","Annuler la préparation"):'')+
      (replyPossible?button("ask","Demander à Nord si je peux sortir"):'')+
      (!pick?button("discard","Défausser",selected.length===1 && !used.length):'')+'</div>':'';
    const pile=top(g), freezeText=frozen(g)?"Gelée":"Libre";
    let pileHint="";
    if(drawing && pile!==undefined) {
      if(wild(pile) || rank(pile)===2) pileHint="La carte visible bloque la défausse pour ce tour.";
      else if(frozen(g)) pileHint="Pour ramasser, posez deux "+ranks[rank(pile)]+" naturels de votre main avec le sommet.";
    }
    const stockButton='<button data-act="draw" '+(drawing&&!compulsory(g)?'':'disabled')+'>'+card(-1)+'<b>'+(g.stock.length?'Piocher · '+g.stock.length:'Terminer la manche')+'</b></button>';
    const pileButton='<button data-act="pick" '+(drawing&&pickBase(g)?'':'disabled')+'>'+(pile===undefined?'<span class="ca-empty"></span>':card(pile))+'<b>Défausse · '+g.pile.length+'</b><small>'+freezeText+'</small></button>';
    root.innerHTML='<div class="ca-score"><strong>Manche '+g.number+'</strong><span>Nord–Sud <b>'+g.scores[0]+'</b></span><span>Est–Ouest <b>'+g.scores[1]+'</b></span></div>'+
      (g.phase==="end"?summary():'')+'<div class="ca-felt"><div class="ca-north">'+seat(2)+'</div><div class="ca-middle">'+seat(1)+'<div class="ca-piles">'+stockButton+pileButton+'</div>'+seat(3)+'</div>'+
      '<div class="ca-sides">'+displayTeam(0)+displayTeam(1)+'</div><div class="ca-south"><h3>Sud · Votre main</h3><div class="ca-hand">'+g.hands[0].filter(c=>!used.includes(c)).map(c=>
        '<button data-card="'+c+'" aria-label="'+label(c)+'" aria-pressed="'+selected.includes(c)+'" '+(canPose?'':'disabled')+'>'+card(c)+'</button>').join("")+'</div></div></div>'+
      '<div class="ca-status" role="status"><b>'+prompt+'</b>'+(used.length?'<p>Pose en préparation · '+points(used)+' points. '+error+'</p>':'')+
      (!Object.keys(g.teams[0].melds).length?'<p>Minimum d’ouverture de Nord–Sud · '+threshold(g.scores[0])+' points</p>':'')+
      (pileHint?'<p>'+pileHint+'</p>':'')+(notice?'<p>'+notice+'</p>':'')+'</div>'+controls+
      '<details class="ca-log" open><summary>Dernières actions</summary><ol>'+g.log.slice(-5).reverse().map(s=>'<li>'+s+'</li>').join("")+'</ol></details>';
    clearTimeout(timer);
    if(!mine && g.phase!=="end") timer=setTimeout(()=>{if(root.isConnected){aiStep(g);paint();}},800);
  }
  root.addEventListener("click",e=>{
    const b=e.target.closest("button");
    if(!b || b.disabled) return;
    notice="";
    try {
      if(b.dataset.card!==undefined) {
        const c=Number(b.dataset.card);
        selected=selected.includes(c)?selected.filter(x=>x!==c):[...selected,c];
      } else if(b.dataset.r!==undefined) zone(Number(b.dataset.r));
      else switch(b.dataset.act) {
        case "next": game=deal(game.over?null:game); reset(); break;
        case "draw": draw(game); break;
        case "pick": plan=pickBase(game); pick=true; break;
        case "zone": zone(); break;
        case "undo": reset(); break;
        case "commit": commit(); break;
        case "discard": discard(game,selected[0]); reset(); break;
        case "ask": {
          const yes=hand(game).length===1 || points(game.hands[2])<=65 || game.stock.length<8;
          game.permission=yes;
          if(yes) { if(Object.keys(plan).length) commit(); if(game.phase==="play") discard(game,hand(game)[0]); }
          else reset();
          notice=yes?"Nord accepte. Vous sortez.":"Nord préfère attendre. Gardez au moins une carte après votre défausse.";
          break;
        }
      }
    } catch(err) { notice=err.message; }
    paint();
  });
  paint();
};
