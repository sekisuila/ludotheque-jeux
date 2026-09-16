export { AbaloneRoom } from "./abalone-room.js";

const SESSION_COOKIE="ludo_session";
const SESSION_DAYS=30;
// Cloudflare Workers WebCrypto refuse PBKDF2 au-delà de 100 000 itérations.
const PBKDF2_ITERATIONS=100000;
const enc=new TextEncoder();
const json=(data,status=200,headers={})=>new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store",...headers}});

function b64url(bytes){ return btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,''); }
function bytesToHex(bytes){ return [...new Uint8Array(bytes)].map(b=>b.toString(16).padStart(2,'0')).join(''); }
async function sha256(text){ return bytesToHex(await crypto.subtle.digest("SHA-256",enc.encode(text))); }
function randomToken(n=32){ const a=new Uint8Array(n); crypto.getRandomValues(a); return b64url(a); }
function cookieValue(request,name){
  const raw=request.headers.get("cookie")||"";
  for(const part of raw.split(';')){ const [k,...v]=part.trim().split('='); if(k===name) return decodeURIComponent(v.join('=')); }
  return null;
}
function setSessionCookie(token,maxAge=SESSION_DAYS*86400){ return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`; }
function clearSessionCookie(){ return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`; }

async function hashPassword(password,saltB64){
  let b64=saltB64.replaceAll('-','+').replaceAll('_','/'); b64 += '='.repeat((4 - b64.length % 4) % 4);
  const salt=Uint8Array.from(atob(b64),c=>c.charCodeAt(0));
  const key=await crypto.subtle.importKey("raw",enc.encode(password),"PBKDF2",false,["deriveBits"]);
  const bits=await crypto.subtle.deriveBits({name:"PBKDF2",hash:"SHA-256",salt,iterations:PBKDF2_ITERATIONS},key,256);
  return bytesToHex(bits);
}
function newSalt(){ const a=new Uint8Array(16); crypto.getRandomValues(a); return b64url(a); }
function validUsername(s){ return typeof s==='string' && /^[A-Za-zÀ-ÖØ-öø-ÿ0-9_-]{3,24}$/u.test(s); }
function validPassword(s){ return typeof s==="string" && s.length>=10 && s.length<=128; }
function formatRecoveryKey(raw){
  return raw.replace(/[^A-Z0-9]/g,"").match(/.{1,5}/g)?.join("-") || raw;
}
function newRecoveryKey(){
  const alphabet="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes=new Uint8Array(20); crypto.getRandomValues(bytes);
  let raw=""; for(const b of bytes) raw+=alphabet[b%alphabet.length];
  return formatRecoveryKey(raw);
}
function normalizeRecoveryKey(value){ return String(value||"").toUpperCase().replace(/[^A-Z0-9]/g,""); }
async function recoveryKeyHash(key){ return sha256(`ludo-recovery:${normalizeRecoveryKey(key)}`); }

async function readJson(request){ try{return await request.json();}catch{return null;} }
async function currentUser(request,env){
  const token=cookieValue(request,SESSION_COOKIE); if(!token) return null;
  const tokenHash=await sha256(token);
  const row=await env.DB.prepare(`SELECT u.id,u.username FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at > datetime('now')`).bind(tokenHash).first();
  return row||null;
}
async function requireUser(request,env){ const user=await currentUser(request,env); return user?{user}:{response:json({error:"Connexion requise."},401)}; }

async function register(request,env){
  const body=await readJson(request); const username=(body?.username||'').trim(); const password=body?.password||'';
  if(!validUsername(username)) return json({error:"Le pseudo doit contenir 3 à 24 caractères : lettres, chiffres, _ ou -."},400);
  if(!validPassword(password)) return json({error:"Le mot de passe doit contenir entre 10 et 128 caractères."},400);
  const exists=await env.DB.prepare("SELECT 1 FROM users WHERE username=? COLLATE NOCASE").bind(username).first();
  if(exists) return json({error:"Ce pseudo est déjà utilisé."},409);
  const id=crypto.randomUUID(),salt=newSalt(),hash=await hashPassword(password,salt);
  const recoveryKey=newRecoveryKey(),recoveryHash=await recoveryKeyHash(recoveryKey);
  await env.DB.prepare("INSERT INTO users(id,username,password_hash,password_salt,recovery_key_hash,recovery_key_created_at) VALUES(?,?,?,?,?,CURRENT_TIMESTAMP)")
    .bind(id,username,hash,salt,recoveryHash).run();
  return createSession(id,username,env,201,{recoveryKey});
}
async function login(request,env){
  const body=await readJson(request); const username=(body?.username||'').trim(); const password=body?.password||'';
  const user=await env.DB.prepare("SELECT id,username,password_hash,password_salt FROM users WHERE username=? COLLATE NOCASE").bind(username).first();
  if(!user) return json({error:"Pseudo ou mot de passe incorrect."},401);
  const hash=await hashPassword(password,user.password_salt);
  if(hash!==user.password_hash) return json({error:"Pseudo ou mot de passe incorrect."},401);
  return createSession(user.id,user.username,env,200);
}
async function createSession(userId,username,env,status,extra={}){
  const token=randomToken(),tokenHash=await sha256(token);
  await env.DB.prepare("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,datetime('now', '+30 days'))").bind(tokenHash,userId).run();
  return json({user:{id:userId,username},...extra},status,{"set-cookie":setSessionCookie(token)});
}
async function logout(request,env){
  const token=cookieValue(request,SESSION_COOKIE);
  if(token) await env.DB.prepare("DELETE FROM sessions WHERE token_hash=?").bind(await sha256(token)).run();
  return json({ok:true},200,{"set-cookie":clearSessionCookie()});
}

async function changePassword(request,env,user){
  const body=await readJson(request);
  const currentPassword=body?.currentPassword||"",newPassword=body?.newPassword||"";
  if(!validPassword(newPassword)) return json({error:"Le nouveau mot de passe doit contenir entre 10 et 128 caractères."},400);
  const row=await env.DB.prepare("SELECT password_hash,password_salt FROM users WHERE id=?").bind(user.id).first();
  if(!row) return json({error:"Compte introuvable."},404);
  const currentHash=await hashPassword(currentPassword,row.password_salt);
  if(currentHash!==row.password_hash) return json({error:"Le mot de passe actuel est incorrect."},401);
  const salt=newSalt(),hash=await hashPassword(newPassword,salt);
  await env.DB.prepare("UPDATE users SET password_hash=?,password_salt=? WHERE id=?").bind(hash,salt,user.id).run();
  await env.DB.prepare("DELETE FROM sessions WHERE user_id=?").bind(user.id).run();
  return createSession(user.id,user.username,env,200,{message:"Mot de passe modifié."});
}

async function generateRecoveryKey(env,user){
  const key=newRecoveryKey(),hash=await recoveryKeyHash(key);
  await env.DB.prepare("UPDATE users SET recovery_key_hash=?,recovery_key_created_at=CURRENT_TIMESTAMP WHERE id=?").bind(hash,user.id).run();
  return json({recoveryKey:key,message:"Nouvelle clé de récupération générée. L'ancienne n'est plus valable."});
}

async function resetWithRecovery(request,env){
  const body=await readJson(request);
  const username=(body?.username||"").trim(),key=body?.recoveryKey||"",newPassword=body?.newPassword||"";
  if(!validUsername(username) || !normalizeRecoveryKey(key) || !validPassword(newPassword)){
    return json({error:"Pseudo, clé de récupération ou nouveau mot de passe invalide."},400);
  }
  const user=await env.DB.prepare("SELECT id,username,recovery_key_hash FROM users WHERE username=? COLLATE NOCASE").bind(username).first();
  if(!user?.recovery_key_hash) return json({error:"Pseudo ou clé de récupération incorrect."},401);
  const suppliedHash=await recoveryKeyHash(key);
  if(suppliedHash!==user.recovery_key_hash) return json({error:"Pseudo ou clé de récupération incorrect."},401);

  const salt=newSalt(),passwordHash=await hashPassword(newPassword,salt);
  const replacementKey=newRecoveryKey(),replacementHash=await recoveryKeyHash(replacementKey);
  await env.DB.batch([
    env.DB.prepare("UPDATE users SET password_hash=?,password_salt=?,recovery_key_hash=?,recovery_key_created_at=CURRENT_TIMESTAMP WHERE id=?")
      .bind(passwordHash,salt,replacementHash,user.id),
    env.DB.prepare("DELETE FROM sessions WHERE user_id=?").bind(user.id)
  ]);
  return json({
    ok:true,
    message:"Mot de passe réinitialisé. Votre ancienne clé de récupération a été remplacée.",
    recoveryKey:replacementKey
  });
}

async function listSaves(request,env,user){
  const url=new URL(request.url),game=url.searchParams.get('game')||'abalone';
  const {results=[]}=await env.DB.prepare("SELECT id,game,name,created_at,updated_at FROM saves WHERE user_id=? AND game=? ORDER BY updated_at DESC LIMIT 100").bind(user.id,game).all();
  return json({saves:results});
}
async function createSave(request,env,user){
  const body=await readJson(request); if(!body?.state||typeof body.state!=="object") return json({error:"État de partie manquant."},400);
  const game=String(body.game||'abalone').slice(0,32),name=String(body.name||'Partie sans nom').trim().slice(0,60)||'Partie sans nom';
  const id=crypto.randomUUID();
  await env.DB.prepare("INSERT INTO saves(id,user_id,game,name,state_json) VALUES(?,?,?,?,?)").bind(id,user.id,game,name,JSON.stringify(body.state)).run();
  return json({id,name,game},201);
}
async function saveById(request,env,user,id){
  if(request.method==='GET'){
    const row=await env.DB.prepare("SELECT id,game,name,state_json,created_at,updated_at FROM saves WHERE id=? AND user_id=?").bind(id,user.id).first();
    if(!row) return json({error:"Sauvegarde introuvable."},404);
    return json({save:{...row,state:JSON.parse(row.state_json)}});
  }
  if(request.method==='DELETE'){
    await env.DB.prepare("DELETE FROM saves WHERE id=? AND user_id=?").bind(id,user.id).run(); return json({ok:true});
  }
  return json({error:"Méthode non autorisée."},405);
}

const ROOM_ALPHABET="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function roomCode(){ let s=''; const a=new Uint8Array(6); crypto.getRandomValues(a); for(const b of a) s+=ROOM_ALPHABET[b%ROOM_ALPHABET.length]; return s; }
function validRoomGame(game){ return game === "chess" || game === "abalone"; }

async function createRoom(request,env,user){
  const body=await readJson(request);
  const game=validRoomGame(body?.game)?body.game:"abalone";

  // Abalone garde le créateur en Noir. Pour les Échecs, le créateur
  // peut choisir Blancs, Noirs ou laisser le serveur tirer au sort.
  let creatorSide=game==="chess"?String(body?.creatorColor||"random").toLowerCase():"black";
  if(game==="chess"){
    if(creatorSide!=="white" && creatorSide!=="black"){
      const random=new Uint8Array(1); crypto.getRandomValues(random);
      creatorSide=(random[0]&1)===0?"white":"black";
    }
  }else{
    creatorSide="black";
  }

  const blackId=creatorSide==="black"?user.id:null;
  const whiteId=creatorSide==="white"?user.id:null;
  let code=null;

  for(let i=0;i<8;i++){
    const candidate=roomCode();
    try{
      await env.DB.prepare("INSERT INTO rooms(code,game,black_user_id,white_user_id,status) VALUES(?,?,?,?, 'waiting')")
        .bind(candidate,game,blackId,whiteId).run();
      code=candidate;
      break;
    }catch{}
  }
  if(!code) return json({error:"Impossible de créer un salon."},500);

  const stub=env.ABALONE_ROOMS.getByName(code);
  await stub.fetch("https://room/init",{
    method:"POST",
    headers:{"content-type":"application/json"},
    body:JSON.stringify({
      code,game,userId:user.id,username:user.username,
      creatorSide:creatorSide==="white"?"w":"b"
    })
  });

  return json({
    code,game,
    side:game==="chess"?(creatorSide==="white"?"w":"b"):1,
    creatorColor:creatorSide
  },201);
}

async function joinRoom(request,env,user){
  const body=await readJson(request),code=String(body?.code||'').trim().toUpperCase();
  if(!/^[A-Z2-9]{6}$/.test(code)) return json({error:"Code de salon invalide."},400);

  let room=await env.DB.prepare("SELECT * FROM rooms WHERE code=?").bind(code).first();
  if(!room) return json({error:"Salon introuvable."},404);

  // Un joueur déjà inscrit dans le salon peut se reconnecter même si la
  // partie vient de se terminer : cela lui permet notamment de proposer
  // ou d'accepter une revanche.
  if(room.black_user_id===user.id){
    return json({code,game:room.game,side:room.game==="chess"?"b":1});
  }
  if(room.white_user_id===user.id){
    return json({code,game:room.game,side:room.game==="chess"?"w":2});
  }

  if(room.status==='finished') return json({error:"Cette partie est terminée."},409);
  if(room.black_user_id && room.white_user_id) return json({error:"Ce salon est déjà complet."},409);

  const joinSlot=!room.black_user_id?"black":"white";
  const update=joinSlot==="black"
    ? await env.DB.prepare("UPDATE rooms SET black_user_id=?,status=CASE WHEN white_user_id IS NULL THEN 'waiting' ELSE 'playing' END,updated_at=CURRENT_TIMESTAMP WHERE code=? AND black_user_id IS NULL")
        .bind(user.id,code).run()
    : await env.DB.prepare("UPDATE rooms SET white_user_id=?,status=CASE WHEN black_user_id IS NULL THEN 'waiting' ELSE 'playing' END,updated_at=CURRENT_TIMESTAMP WHERE code=? AND white_user_id IS NULL")
        .bind(user.id,code).run();

  if((update?.meta?.changes ?? 0)===0){
    room=await env.DB.prepare("SELECT * FROM rooms WHERE code=?").bind(code).first();
    if(room?.black_user_id!==user.id && room?.white_user_id!==user.id){
      return json({error:"Ce salon vient d’être rejoint par un autre joueur."},409);
    }
  }

  const stub=env.ABALONE_ROOMS.getByName(code);
  const r=await stub.fetch("https://room/join",{
    method:"POST",
    headers:{"content-type":"application/json"},
    body:JSON.stringify({userId:user.id,username:user.username,side:joinSlot})
  });
  if(!r.ok) return json({error:(await r.json()).error||"Impossible de rejoindre."},r.status);

  return json({
    code,game:room.game,
    side:room.game==="chess"?(joinSlot==="black"?"b":"w"):(joinSlot==="black"?1:2)
  });
}

async function roomInfo(env,user,code){
  const room=await env.DB.prepare(`SELECT r.code,r.game,r.status,r.created_at,r.updated_at,
    ub.username AS black_username,uw.username AS white_username,
    r.black_user_id,r.white_user_id FROM rooms r
    LEFT JOIN users ub ON ub.id=r.black_user_id LEFT JOIN users uw ON uw.id=r.white_user_id WHERE r.code=?`).bind(code).first();
  if(!room) return json({error:"Salon introuvable."},404);
  const side=room.black_user_id===user.id?(room.game==="chess"?"b":1):room.white_user_id===user.id?(room.game==="chess"?"w":2):null;
  return json({room:{code:room.code,game:room.game,status:room.status,blackUsername:room.black_username,whiteUsername:room.white_username,createdAt:room.created_at},side});
}

async function roomWebSocket(request,env,user,code){
  const room=await env.DB.prepare("SELECT game,black_user_id,white_user_id FROM rooms WHERE code=?").bind(code).first();
  if(!room || (room.black_user_id!==user.id && room.white_user_id!==user.id)) return new Response("Accès refusé",{status:403});
  const headers=new Headers(request.headers);
  headers.set("x-ludo-user-id",user.id);
  headers.set("x-ludo-username",user.username);
  const target=new URL(request.url); target.pathname="/ws"; target.search="";
  return env.ABALONE_ROOMS.getByName(code).fetch(new Request(target.toString(),{headers,method:"GET"}));
}

async function api(request,env){
  const url=new URL(request.url),p=url.pathname;
  if(p==="/api/auth/register"&&request.method==="POST") return register(request,env);
  if(p==="/api/auth/login"&&request.method==="POST") return login(request,env);
  if(p==="/api/auth/logout"&&request.method==="POST") return logout(request,env);
  if(p==="/api/auth/me"&&request.method==="GET") return json({user:await currentUser(request,env)});
  if(p==="/api/auth/reset-with-recovery"&&request.method==="POST") return resetWithRecovery(request,env);

  const auth=await requireUser(request,env); if(auth.response) return auth.response; const user=auth.user;
  if(p==="/api/auth/change-password"&&request.method==="POST") return changePassword(request,env,user);
  if(p==="/api/auth/recovery-key"&&request.method==="POST") return generateRecoveryKey(env,user);
  if(p==="/api/saves"&&request.method==="GET") return listSaves(request,env,user);
  if(p==="/api/saves"&&request.method==="POST") return createSave(request,env,user);
  const saveMatch=p.match(/^\/api\/saves\/([0-9a-f-]{36})$/i); if(saveMatch) return saveById(request,env,user,saveMatch[1]);
  if(p==="/api/rooms"&&request.method==="POST") return createRoom(request,env,user);
  if(p==="/api/rooms/join"&&request.method==="POST") return joinRoom(request,env,user);
  const roomMatch=p.match(/^\/api\/rooms\/([A-Z2-9]{6})$/i); if(roomMatch&&request.method==="GET") return roomInfo(env,user,roomMatch[1].toUpperCase());
  const wsMatch=p.match(/^\/api\/rooms\/([A-Z2-9]{6})\/ws$/i); if(wsMatch&&request.headers.get("Upgrade")==="websocket") return roomWebSocket(request,env,user,wsMatch[1].toUpperCase());
  return json({error:"API inconnue."},404);
}

export default {
  async fetch(request,env){
    const url=new URL(request.url);
    try{
      if(url.pathname.startsWith('/api/')) return await api(request,env);
      return env.ASSETS.fetch(request);
    }catch(error){
      console.error("Erreur serveur Ludothèque:", error?.stack || error?.message || error);
      if(url.pathname.startsWith('/api/')){
        return json({error:"Erreur interne du serveur. Consultez les logs Cloudflare."},500);
      }
      throw error;
    }
  }
};
