// ============================================================
// LUDOTHÈQUE EN LIGNE — client API Cloudflare Worker
// ============================================================
(() => {
  const state = { user: null, loaded: false, lobby: { snapshot:null, mountedListId:null, mountedGameSelectId:null } };
  let lobbyHeartbeatTimer=null;
  let lobbyPollTimer=null;
  let shownInviteId=null;
  const notifiedOutgoing=new Set();

  const LOBBY_GAME_LABELS={
    chess:"Échecs",
    "checkers-international":"Dames françaises / internationales",
    "checkers-english":"Dames anglaises",
    go:"Go",
    awale:"Awélé",
    abalone:"Abalone",
    yams:"Yams",
    "421":"421",
    dominos:"Dominos"
  };
  const LOBBY_GAME_ROUTES={
    chess:"#/jouer/echecs",
    "checkers-international":"#/jouer/dames-internationales",
    "checkers-english":"#/jouer/dames-anglaises",
    go:"#/jouer/go",
    awale:"#/jouer/awale",
    abalone:"#/jouer/abalone",
    yams:"#/jouer/yams",
    "421":"#/jouer/421",
    dominos:"#/jouer/dominos"
  };

  async function request(path, options = {}) {
    const headers = new Headers(options.headers || {});
    let body = options.body;
    if (body && typeof body === "object" && !(body instanceof FormData)) {
      headers.set("content-type", "application/json");
      body = JSON.stringify(body);
    }
    const response = await fetch(path, { ...options, headers, body, credentials: "same-origin" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data.error || `Erreur ${response.status}`);
      error.status = response.status;
      error.data = data;
      if (data && typeof data === "object") Object.assign(error, data);
      throw error;
    }
    return data;
  }

  function updateNav() {
    const el = document.getElementById("accountNavLabel");
    if (el) el.textContent = state.user ? state.user.username : "Compte";
  }

  async function me(force = false) {
    if (state.loaded && !force) return state.user;
    const data = await request("/api/auth/me");
    state.user = data.user || null;
    state.loaded = true;
    updateNav();
    return state.user;
  }

  async function register(username, email, password, turnstileToken = "") {
    const data = await request("/api/auth/register", { method: "POST", body: { username, email, password, turnstileToken } });
    state.user = data.user; state.loaded = true; updateNav(); startLobbyPresence(); return data;
  }
  async function login(username, password, turnstileToken = "") {
    const data = await request("/api/auth/login", { method: "POST", body: { username, password, turnstileToken } });
    state.user = data.user; state.loaded = true; updateNav(); startLobbyPresence(); return state.user;
  }
  async function logout() {
    await request("/api/auth/logout", { method: "POST" });
    state.user = null; state.loaded = true; updateNav(); stopLobbyPresence(); hideInvitePrompt(); renderLobbyMount();
  }

  async function changePassword(currentPassword, newPassword) {
    return request("/api/auth/change-password", { method: "POST", body: { currentPassword, newPassword } });
  }

  async function generateRecoveryKey() {
    return request("/api/auth/recovery-key", { method: "POST" });
  }

  async function resetWithRecovery(username, recoveryKey, newPassword) {
    return request("/api/auth/reset-with-recovery", {
      method: "POST",
      body: { username, recoveryKey, newPassword }
    });
  }

  async function requestPasswordReset(email, turnstileToken = "") {
    return request("/api/auth/forgot-password", { method: "POST", body: { email, turnstileToken } });
  }

  async function resetPasswordWithEmail(token, newPassword) {
    return request("/api/auth/reset-password", { method: "POST", body: { token, newPassword } });
  }

  async function verifyEmail(token) {
    return request("/api/auth/verify-email", { method: "POST", body: { token } });
  }

  async function setEmail(email, password) {
    return request("/api/auth/email", { method: "POST", body: { email, password } });
  }

  async function resendVerification() {
    return request("/api/auth/resend-verification", { method: "POST" });
  }

  async function deleteAccount(password, confirmation) {
    const data=await request("/api/auth/account", { method: "DELETE", body: { password, confirmation } });
    state.user=null; state.loaded=true; updateNav(); return data;
  }

  const security = (() => {
    let configPromise = null;
    let scriptPromise = null;

    async function config(force = false) {
      if (!configPromise || force) configPromise = request("/api/security/config");
      return configPromise;
    }

    async function loadTurnstile() {
      if (window.turnstile) return window.turnstile;
      if (scriptPromise) return scriptPromise;
      scriptPromise = new Promise((resolve, reject) => {
        const existing = document.querySelector('script[data-strathasard-turnstile="1"]');
        const ready = () => window.turnstile ? resolve(window.turnstile) : reject(new Error("Turnstile n’a pas pu être chargé."));
        if (existing) {
          const started = Date.now();
          const timer = setInterval(() => {
            if (window.turnstile) { clearInterval(timer); resolve(window.turnstile); }
            else if (Date.now() - started > 10000) { clearInterval(timer); reject(new Error("Turnstile n’a pas pu être chargé.")); }
          }, 100);
          return;
        }
        const script = document.createElement("script");
        script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
        script.async = true;
        script.defer = true;
        script.dataset.strathasardTurnstile = "1";
        script.onload = ready;
        script.onerror = () => reject(new Error("Impossible de charger la vérification anti-robot."));
        document.head.appendChild(script);
      });
      return scriptPromise;
    }

    async function render(container, action, options = {}) {
      const cfg = await config();
      const el = typeof container === "string" ? document.querySelector(container) : container;
      if (!el) return null;
      if (!cfg.turnstileEnabled || !cfg.turnstileSiteKey) {
        el.innerHTML = '<div class="turnstile-config-warning">Protection anti-robot non configurée.</div>';
        return null;
      }
      const api = await loadTurnstile();
      el.innerHTML = "";
      let latestToken = "";
      let executionPromise = null;
      let resolveExecution = null;
      let rejectExecution = null;

      const finishExecution = token => {
        latestToken = token || "";
        if (resolveExecution) resolveExecution(latestToken);
        executionPromise = null;
        resolveExecution = null;
        rejectExecution = null;
        options.callback?.(latestToken);
      };

      const failExecution = error => {
        latestToken = "";
        if (rejectExecution) rejectExecution(error instanceof Error ? error : new Error(String(error || "Échec de la vérification anti-robot.")));
        executionPromise = null;
        resolveExecution = null;
        rejectExecution = null;
      };

      const widgetId = api.render(el, {
        sitekey: cfg.turnstileSiteKey,
        action,
        theme: "auto",
        language: "fr",
        size: "flexible",
        appearance: options.appearance || "interaction-only",
        execution: options.execution || "render",
        callback: finishExecution,
        "expired-callback": () => {
          latestToken = "";
          failExecution(new Error("La vérification anti-robot a expiré. Merci de recommencer."));
          options.expired?.();
        },
        "error-callback": code => {
          failExecution(new Error("La vérification anti-robot a échoué."));
          options.error?.(code);
        }
      });

      return {
        id: widgetId,
        getToken: () => api.getResponse(widgetId) || latestToken || "",
        execute: () => {
          const existing = api.getResponse(widgetId) || latestToken || "";
          if (existing) return Promise.resolve(existing);
          if (executionPromise) return executionPromise;
          executionPromise = new Promise((resolve, reject) => {
            resolveExecution = resolve;
            rejectExecution = reject;
            try {
              api.execute(widgetId);
            } catch (error) {
              failExecution(error);
            }
          });
          return executionPromise;
        },
        reset: () => {
          latestToken = "";
          executionPromise = null;
          resolveExecution = null;
          rejectExecution = null;
          try { api.reset(widgetId); } catch {}
        },
        remove: () => {
          latestToken = "";
          executionPromise = null;
          resolveExecution = null;
          rejectExecution = null;
          try { api.remove(widgetId); } catch {}
        }
      };
    }

    return { config, render };
  })();

  const saves = {
    list: async (game = "abalone") => (await request(`/api/saves?game=${encodeURIComponent(game)}`)).saves,
    create: async (game, name, saveState) => request("/api/saves", { method: "POST", body: { game, name, state: saveState } }),
    get: async id => (await request(`/api/saves/${id}`)).save,
    remove: async id => request(`/api/saves/${id}`, { method: "DELETE" })
  };


  const ratings = {
    mine: async () => (await request("/api/ratings/me")).ratings,
    leaderboard: async (category = "rapid", limit = 30) =>
      request(`/api/ratings/chess?category=${encodeURIComponent(category)}&limit=${encodeURIComponent(limit)}`)
  };

  const chessGames = {
    list: async () => (await request("/api/chess/games")).games,
    get: async id => (await request(`/api/chess/games/${encodeURIComponent(id)}`)).game
  };

  const checkersRatings = {
    mine: async (variant = "international") => (await request(`/api/ratings/checkers/me?variant=${encodeURIComponent(variant)}`)).ratings,
    leaderboard: async (variant = "international", category = "rapid", limit = 30) =>
      request(`/api/ratings/checkers?variant=${encodeURIComponent(variant)}&category=${encodeURIComponent(category)}&limit=${encodeURIComponent(limit)}`)
  };

  const checkersGames = {
    list: async (variant = "") => (await request(`/api/checkers/games${variant?`?variant=${encodeURIComponent(variant)}`:""}`)).games,
    get: async id => (await request(`/api/checkers/games/${encodeURIComponent(id)}`)).game
  };


  const goRatings = {
    mine: async (size = 19) => (await request(`/api/ratings/go/me?size=${encodeURIComponent(size)}`)).ratings,
    leaderboard: async (size = 19, category = "rapid", limit = 30) =>
      request(`/api/ratings/go?size=${encodeURIComponent(size)}&category=${encodeURIComponent(category)}&limit=${encodeURIComponent(limit)}`)
  };

  const goGames = {
    list: async (size = "") => (await request(`/api/go/games${size?`?size=${encodeURIComponent(size)}`:""}`)).games,
    get: async id => (await request(`/api/go/games/${encodeURIComponent(id)}`)).game
  };

  const awaleRatings = {
    mine: async () => (await request("/api/ratings/awale/me")).ratings,
    leaderboard: async (category = "rapid", limit = 30) => request(`/api/ratings/awale?category=${encodeURIComponent(category)}&limit=${encodeURIComponent(limit)}`)
  };

  const awaleGames = {
    list: async () => (await request("/api/awale/games")).games,
    get: async id => (await request(`/api/awale/games/${encodeURIComponent(id)}`)).game
  };

  const abaloneRatings = {
    mine: async () => (await request("/api/ratings/abalone/me")).ratings,
    leaderboard: async (category = "rapid", limit = 30) => request(`/api/ratings/abalone?category=${encodeURIComponent(category)}&limit=${encodeURIComponent(limit)}`)
  };

  const abaloneGames = {
    list: async () => (await request("/api/abalone/games")).games,
    get: async id => (await request(`/api/abalone/games/${encodeURIComponent(id)}`)).game
  };


  const yamsRatings = {
    mine: async () => (await request("/api/ratings/yams/me")).rating,
    leaderboard: async (limit = 30) => request(`/api/ratings/yams?limit=${encodeURIComponent(limit)}`)
  };

  const yamsGames = {
    list: async () => (await request("/api/yams/games")).games,
    get: async id => (await request(`/api/yams/games/${encodeURIComponent(id)}`)).game
  };


  const game421Ratings = {
    mine: async () => (await request("/api/ratings/421/me")).rating,
    leaderboard: async (limit = 30) => request(`/api/ratings/421?limit=${encodeURIComponent(limit)}`)
  };

  const game421Games = {
    list: async () => (await request("/api/421/games")).games,
    get: async id => (await request(`/api/421/games/${encodeURIComponent(id)}`)).game
  };

  const dominoRatings = {
    mine: async () => (await request("/api/ratings/dominos/me")).rating,
    leaderboard: async (limit = 30) => request(`/api/ratings/dominos?limit=${encodeURIComponent(limit)}`)
  };

  const dominoGames = {
    list: async () => (await request("/api/dominos/games")).games,
    get: async id => (await request(`/api/dominos/games/${encodeURIComponent(id)}`)).game
  };

  function lobbyCurrentGame(){
    const h=location.hash||"";
    if(h.includes("/jouer/echecs"))return"chess";
    if(h.includes("/jouer/dames-internationales"))return"checkers-international";
    if(h.includes("/jouer/dames-anglaises"))return"checkers-english";
    if(h.includes("/jouer/go"))return"go";
    if(h.includes("/jouer/awale"))return"awale";
    if(h.includes("/jouer/abalone"))return"abalone";
    if(h.includes("/jouer/yams"))return"yams";
    if(h.includes("/jouer/421"))return"421";
    if(h.includes("/jouer/dominos"))return"dominos";
    return null;
  }

  async function lobbyHeartbeat(){
    if(!state.user)return null;
    return request("/api/lobby/heartbeat",{method:"POST",body:{page:location.hash||"#/accueil",game:lobbyCurrentGame()}});
  }

  async function lobbySnapshot(){
    if(!state.user)return {online:[],incoming:[],outgoing:[]};
    const data=await request("/api/lobby");
    state.lobby.snapshot=data;
    renderLobbyMount();
    showPendingInvite(data.incoming?.[0]||null);
    notifyOutgoing(data.outgoing||[]);
    return data;
  }

  function pendingRoomKey(){return"strathasard_pending_room_v1";}

  function setPendingRoom(game,code){
    sessionStorage.setItem(pendingRoomKey(),JSON.stringify({game,code,createdAt:Date.now()}));
  }

  function consumePendingRoom(game){
    let value=null;
    try{value=JSON.parse(sessionStorage.getItem(pendingRoomKey())||"null");}catch{}
    if(!value||value.game!==game||!value.code)return null;
    sessionStorage.removeItem(pendingRoomKey());
    return value;
  }

  function routeForGame(game){return LOBBY_GAME_ROUTES[game]||"#/jouer";}

  async function createInvite(inviteeId,game){
    const data=await request("/api/invites",{method:"POST",body:{inviteeId,game}});
    setPendingRoom(data.room.game,data.room.code);
    location.hash=routeForGame(data.room.game);
    return data;
  }

  async function respondInvite(id,accept){
    const data=await request(`/api/invites/${encodeURIComponent(id)}/respond`,{method:"POST",body:{accept:Boolean(accept)}});
    if(data.accepted&&data.room){
      setPendingRoom(data.room.game,data.room.code);
      location.hash=routeForGame(data.room.game);
    }
    return data;
  }

  function ensureInvitePrompt(){
    let box=document.getElementById("globalGameInvite");
    if(box)return box;
    box=document.createElement("section");
    box.id="globalGameInvite";
    box.className="global-game-invite";
    box.hidden=true;
    box.innerHTML=`<div><span class="global-invite-kicker">Invitation à jouer</span><strong id="globalGameInviteTitle"></strong><span id="globalGameInviteText"></span></div><div class="global-invite-actions"><button id="globalGameInviteAccept" class="btn small" type="button">Accepter</button><button id="globalGameInviteDecline" class="btn outline small" type="button">Refuser</button></div>`;
    document.body.appendChild(box);
    return box;
  }

  function hideInvitePrompt(){
    const box=document.getElementById("globalGameInvite");
    if(box)box.hidden=true;
    shownInviteId=null;
  }

  function showPendingInvite(invite){
    if(!invite){if(shownInviteId)hideInvitePrompt();return;}
    if(shownInviteId===invite.id)return;
    shownInviteId=invite.id;
    const box=ensureInvitePrompt();
    document.getElementById("globalGameInviteTitle").textContent=`${invite.inviterUsername} vous invite à jouer`;
    document.getElementById("globalGameInviteText").textContent=`${LOBBY_GAME_LABELS[invite.game]||invite.game} — accepter vous conduira directement dans la partie.`;
    box.hidden=false;
    const accept=document.getElementById("globalGameInviteAccept");
    const decline=document.getElementById("globalGameInviteDecline");
    accept.onclick=async()=>{
      accept.disabled=decline.disabled=true;
      try{await respondInvite(invite.id,true);hideInvitePrompt();}
      catch(e){document.getElementById("globalGameInviteText").textContent=e.message;}
      finally{accept.disabled=decline.disabled=false;}
    };
    decline.onclick=async()=>{
      accept.disabled=decline.disabled=true;
      try{await respondInvite(invite.id,false);hideInvitePrompt();await lobbySnapshot();}
      catch(e){document.getElementById("globalGameInviteText").textContent=e.message;}
      finally{accept.disabled=decline.disabled=false;}
    };
  }

  function showLobbyToast(text){
    let box=document.getElementById("globalLobbyToast");
    if(!box){
      box=document.createElement("div");
      box.id="globalLobbyToast";
      box.className="global-lobby-toast";
      document.body.appendChild(box);
    }
    box.textContent=text;
    box.hidden=false;
    clearTimeout(showLobbyToast.timer);
    showLobbyToast.timer=setTimeout(()=>{box.hidden=true;},4500);
  }

  function notifyOutgoing(outgoing){
    for(const invite of outgoing){
      if((invite.status==="declined"||invite.status==="expired")&&!notifiedOutgoing.has(invite.id)){
        notifiedOutgoing.add(invite.id);
        showLobbyToast(invite.status==="declined"
          ? `${invite.inviteeUsername} a refusé votre invitation à ${LOBBY_GAME_LABELS[invite.game]||invite.game}.`
          : `L’invitation envoyée à ${invite.inviteeUsername} a expiré.`);
      }
    }
  }

  function renderLobbyMount(){
    const list=document.getElementById(state.lobby.mountedListId||"");
    if(!list)return;
    if(!state.user){
      list.innerHTML='<p class="lobby-empty">Connectez-vous pour voir les joueurs présents et les inviter.</p>';
      return;
    }
    const players=state.lobby.snapshot?.online||[];
    if(!players.length){
      list.innerHTML='<p class="lobby-empty">Aucun autre joueur n’est en ligne pour le moment.</p>';
      return;
    }
    list.innerHTML=players.map(p=>`<div class="lobby-player-row"><span class="lobby-online-dot" aria-hidden="true"></span><strong>${String(p.username).replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]))}</strong><button class="btn small" type="button" data-lobby-invite="${p.id}">Inviter</button></div>`).join("");
    list.querySelectorAll("[data-lobby-invite]").forEach(btn=>btn.addEventListener("click",async()=>{
      const select=document.getElementById(state.lobby.mountedGameSelectId||"");
      const game=select?.value||"chess";
      btn.disabled=true;btn.textContent="Invitation…";
      try{await createInvite(btn.dataset.lobbyInvite,game);}
      catch(e){btn.disabled=false;btn.textContent="Inviter";showLobbyToast(e.message);}
    }));
  }

  function mountLobby(listId,gameSelectId){
    state.lobby.mountedListId=listId;
    state.lobby.mountedGameSelectId=gameSelectId;
    renderLobbyMount();
    if(state.user)lobbySnapshot().catch(()=>{});
  }

  function startLobbyPresence(){
    if(!state.user)return;
    if(lobbyHeartbeatTimer||lobbyPollTimer)return;
    lobbyHeartbeat().catch(()=>{});
    lobbySnapshot().catch(()=>{});
    lobbyHeartbeatTimer=setInterval(()=>lobbyHeartbeat().catch(()=>{}),15000);
    lobbyPollTimer=setInterval(()=>lobbySnapshot().catch(()=>{}),4000);
  }

  function stopLobbyPresence(){
    if(lobbyHeartbeatTimer)clearInterval(lobbyHeartbeatTimer);
    if(lobbyPollTimer)clearInterval(lobbyPollTimer);
    lobbyHeartbeatTimer=lobbyPollTimer=null;
    state.lobby.snapshot=null;
  }

  function autoJoinPending(game,inputId,joinFn){
    const pending=consumePendingRoom(game);
    if(!pending)return false;
    const input=document.getElementById(inputId);
    if(input)input.value=pending.code;
    setTimeout(()=>Promise.resolve(joinFn()).catch(e=>showLobbyToast(e.message)),0);
    return true;
  }

  const lobby={
    heartbeat:lobbyHeartbeat,
    snapshot:lobbySnapshot,
    mount:mountLobby,
    createInvite,
    respondInvite,
    gameLabels:LOBBY_GAME_LABELS
  };
  const invites={
    setPendingRoom,
    consumePendingRoom,
    autoJoin: autoJoinPending,
    respond:respondInvite
  };

  const rooms = {
    create: async (game = "abalone", options = {}) => request("/api/rooms", { method: "POST", body: { game, ...options } }),
    join: async code => request("/api/rooms/join", { method: "POST", body: { code } }),
    info: async code => request(`/api/rooms/${encodeURIComponent(code.toUpperCase())}`),
    connect(code, handlers = {}) {
      const scheme = location.protocol === "https:" ? "wss:" : "ws:";
      const ws = new WebSocket(`${scheme}//${location.host}/api/rooms/${encodeURIComponent(code.toUpperCase())}/ws`);
      ws.addEventListener("open", e => handlers.open?.(e, ws));
      ws.addEventListener("message", e => {
        try { handlers.message?.(JSON.parse(e.data), ws); }
        catch (err) { handlers.error?.(err, ws); }
      });
      ws.addEventListener("close", e => handlers.close?.(e, ws));
      ws.addEventListener("error", e => handlers.error?.(e, ws));
      return ws;
    }
  };

  window.LudoOnline = {
    state, request, me, register, login, logout,
    changePassword, generateRecoveryKey, resetWithRecovery, requestPasswordReset, resetPasswordWithEmail, verifyEmail, setEmail, resendVerification, deleteAccount, security,
    saves, ratings, chessGames, checkersRatings, checkersGames, goRatings, goGames, awaleRatings, awaleGames, abaloneRatings, abaloneGames, yamsRatings, yamsGames, game421Ratings, game421Games, dominoRatings, dominoGames, rooms, lobby, invites, updateNav
  };
  window.addEventListener("DOMContentLoaded", () => me().then(user=>{if(user)startLobbyPresence();}).catch(() => updateNav()));
  window.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible"&&state.user){lobbyHeartbeat().catch(()=>{});lobbySnapshot().catch(()=>{});}});
})();
