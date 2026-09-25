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
function normalizeEmail(value){ return String(value||"").trim().toLowerCase(); }
function validEmail(value){
  const email=normalizeEmail(value);
  return email.length>=5 && email.length<=254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/u.test(email);
}
function publicUser(row){
  if(!row) return null;
  return {id:row.id,username:row.username,email:row.email||null,emailVerified:Boolean(row.email_verified_at??row.emailVerified)};
}
function emailEscape(value){
  return String(value??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
}
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
  const row=await env.DB.prepare(`SELECT u.id,u.username,u.email,u.email_verified_at FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at > datetime('now') AND u.deleted_at IS NULL`).bind(tokenHash).first();
  return publicUser(row);
}
async function requireUser(request,env){ const user=await currentUser(request,env); return user?{user}:{response:json({error:"Connexion requise."},401)}; }

function clientIp(request){ return request.headers.get("CF-Connecting-IP") || request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() || "unknown"; }
async function securityKey(...parts){ return sha256(parts.map(v=>String(v??"").toLowerCase()).join("|")); }

async function securityCounter(env,key){
  const row=await env.DB.prepare("SELECT attempts,window_started_at,blocked_until,updated_at FROM security_counters WHERE key=?").bind(key).first();
  return row?{
    attempts:Number(row.attempts||0),
    windowStartedAt:Number(row.window_started_at||0),
    blockedUntil:Number(row.blocked_until||0),
    updatedAt:Number(row.updated_at||0)
  }:null;
}

async function hitFixedWindow(env,key,{limit,windowSeconds,blockSeconds=windowSeconds}){
  const now=Math.floor(Date.now()/1000);
  const current=await securityCounter(env,key);
  if(current && current.blockedUntil>now){
    return {allowed:false,attempts:current.attempts,retryAfter:Math.max(1,current.blockedUntil-now)};
  }
  let attempts=1,windowStartedAt=now;
  if(current && now-current.windowStartedAt<windowSeconds){
    attempts=current.attempts+1;
    windowStartedAt=current.windowStartedAt;
  }
  const allowed=attempts<=limit;
  const blockedUntil=allowed?0:now+blockSeconds;
  await env.DB.prepare(`INSERT INTO security_counters(key,attempts,window_started_at,blocked_until,updated_at)
    VALUES(?,?,?,?,?)
    ON CONFLICT(key) DO UPDATE SET attempts=excluded.attempts,window_started_at=excluded.window_started_at,
      blocked_until=excluded.blocked_until,updated_at=excluded.updated_at`)
    .bind(key,attempts,windowStartedAt,blockedUntil,now).run();
  return {allowed,attempts,retryAfter:allowed?0:Math.max(1,blockedUntil-now)};
}

async function clearSecurityCounter(env,key){
  await env.DB.prepare("DELETE FROM security_counters WHERE key=?").bind(key).run();
}

function loginBackoffSeconds(attempts){
  if(attempts>=16) return 1800;
  if(attempts>=12) return 600;
  if(attempts>=8) return 120;
  return 0;
}

async function recordLoginFailure(env,key){
  const now=Math.floor(Date.now()/1000),windowSeconds=900;
  const current=await securityCounter(env,key);
  const attempts=current && now-current.windowStartedAt<windowSeconds ? current.attempts+1 : 1;
  const windowStartedAt=current && now-current.windowStartedAt<windowSeconds ? current.windowStartedAt : now;
  const blockedUntil=now+loginBackoffSeconds(attempts);
  await env.DB.prepare(`INSERT INTO security_counters(key,attempts,window_started_at,blocked_until,updated_at)
    VALUES(?,?,?,?,?)
    ON CONFLICT(key) DO UPDATE SET attempts=excluded.attempts,window_started_at=excluded.window_started_at,
      blocked_until=excluded.blocked_until,updated_at=excluded.updated_at`)
    .bind(key,attempts,windowStartedAt,blockedUntil,now).run();
  return {attempts,blockedUntil,retryAfter:blockedUntil>now?blockedUntil-now:0};
}

function turnstileConfigured(env){ return Boolean(env.TURNSTILE_SITE_KEY && env.TURNSTILE_SECRET_KEY); }

async function verifyTurnstile(request,env,token,expectedAction){
  if(!turnstileConfigured(env)) return {ok:false,configurationError:true};
  if(typeof token!=="string" || token.length<10 || token.length>2048) return {ok:false};
  const form=new FormData();
  form.append("secret",env.TURNSTILE_SECRET_KEY);
  form.append("response",token);
  const ip=clientIp(request); if(ip && ip!=="unknown") form.append("remoteip",ip);
  form.append("idempotency_key",crypto.randomUUID());
  let response;
  try{
    response=await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify",{method:"POST",body:form});
  }catch(error){
    console.error("Turnstile Siteverify network error:",error);
    return {ok:false,serviceError:true};
  }
  const outcome=await response.json().catch(()=>({success:false}));
  if(!outcome?.success) return {ok:false,outcome};
  if(expectedAction && outcome.action!==expectedAction) return {ok:false,outcome};
  const requestHost=new URL(request.url).hostname.toLowerCase();
  if(outcome.hostname && outcome.hostname.toLowerCase()!==requestHost) return {ok:false,outcome};
  return {ok:true,outcome};
}

async function requireTurnstile(request,env,token,action){
  if(!turnstileConfigured(env)){
    return {response:json({error:"Turnstile n’est pas encore configuré sur le serveur."},503)};
  }
  const verification=await verifyTurnstile(request,env,token,action);
  if(!verification.ok){
    const status=verification.serviceError?503:403;
    return {response:json({
      error:verification.serviceError?"La vérification anti-robot est momentanément indisponible. Réessayez dans quelques instants.":"La vérification anti-robot a échoué. Merci de recommencer.",
      turnstileRequired:true
    },status)};
  }
  return {ok:true};
}

async function cleanupSecurityData(env){
  try{
    await env.DB.batch([
      env.DB.prepare("DELETE FROM email_verification_tokens WHERE expires_at <= datetime('now')"),
      env.DB.prepare("DELETE FROM password_reset_tokens WHERE expires_at <= datetime('now')"),
      env.DB.prepare("DELETE FROM security_counters WHERE updated_at < ?").bind(Math.floor(Date.now()/1000)-172800)
    ]);
    const {results=[]}=await env.DB.prepare(`
      SELECT u.id FROM users u
      WHERE u.deleted_at IS NULL
        AND u.email_verified_at IS NULL
        AND u.email_verification_required_at IS NOT NULL
        AND u.email_verification_required_at <= datetime('now','-14 days')
        AND NOT EXISTS(SELECT 1 FROM saves s WHERE s.user_id=u.id)
        AND NOT EXISTS(SELECT 1 FROM rooms r WHERE r.black_user_id=u.id OR r.white_user_id=u.id OR r.winner_user_id=u.id)
        AND NOT EXISTS(SELECT 1 FROM chess_results r WHERE r.white_user_id=u.id OR r.black_user_id=u.id)
        AND NOT EXISTS(SELECT 1 FROM checkers_results r WHERE r.side0_user_id=u.id OR r.side1_user_id=u.id)
        AND NOT EXISTS(SELECT 1 FROM go_results r WHERE r.black_user_id=u.id OR r.white_user_id=u.id)
        AND NOT EXISTS(SELECT 1 FROM awale_results r WHERE r.side0_user_id=u.id OR r.side1_user_id=u.id)
        AND NOT EXISTS(SELECT 1 FROM abalone_results r WHERE r.black_user_id=u.id OR r.white_user_id=u.id)
        AND NOT EXISTS(SELECT 1 FROM yams_results r WHERE r.player0_user_id=u.id OR r.player1_user_id=u.id)
        AND NOT EXISTS(SELECT 1 FROM jeu421_results r WHERE r.player0_user_id=u.id OR r.player1_user_id=u.id)
      LIMIT 20`).all();
    for(const row of results){
      await env.DB.batch([
        env.DB.prepare("DELETE FROM sessions WHERE user_id=?").bind(row.id),
        env.DB.prepare("DELETE FROM email_verification_tokens WHERE user_id=?").bind(row.id),
        env.DB.prepare("DELETE FROM password_reset_tokens WHERE user_id=?").bind(row.id),
        env.DB.prepare("DELETE FROM chess_ratings WHERE user_id=?").bind(row.id),
        env.DB.prepare("DELETE FROM checkers_ratings WHERE user_id=?").bind(row.id),
        env.DB.prepare("DELETE FROM go_ratings WHERE user_id=?").bind(row.id),
        env.DB.prepare("DELETE FROM awale_ratings WHERE user_id=?").bind(row.id),
        env.DB.prepare("DELETE FROM abalone_ratings WHERE user_id=?").bind(row.id),
        env.DB.prepare("DELETE FROM yams_ratings WHERE user_id=?").bind(row.id),
        env.DB.prepare("DELETE FROM jeu421_ratings WHERE user_id=?").bind(row.id),
        env.DB.prepare("DELETE FROM users WHERE id=?").bind(row.id)
      ]);
    }
  }catch(error){
    console.error("Security cleanup:",error?.message||error);
  }
}

async function sendResendEmail(env,{to,subject,html,text}){
  if(!env.RESEND_API_KEY) throw new Error("Le service d’e-mail n’est pas encore configuré.");
  const response=await fetch("https://api.resend.com/emails",{
    method:"POST",
    headers:{"content-type":"application/json","authorization":`Bearer ${env.RESEND_API_KEY}`},
    body:JSON.stringify({
      from:"Strathasard <noreply@strathasard.com>",
      to:[to],
      subject,
      html,
      text
    })
  });
  if(!response.ok){
    const detail=await response.text().catch(()=>"");
    console.error("Resend:",response.status,detail);
    throw new Error("L’e-mail n’a pas pu être envoyé pour le moment.");
  }
  return response.json().catch(()=>({ok:true}));
}

async function createEmailVerification(env,userId,email,username,origin){
  const recent=await env.DB.prepare("SELECT 1 FROM email_verification_tokens WHERE user_id=? AND created_at > datetime('now','-2 minutes') LIMIT 1").bind(userId).first();
  if(recent) return {sent:false,throttled:true};
  const raw=randomToken(32),hash=await sha256(`email-verify:${raw}`);
  await env.DB.batch([
    env.DB.prepare("DELETE FROM email_verification_tokens WHERE user_id=? OR expires_at <= datetime('now')").bind(userId),
    env.DB.prepare("INSERT INTO email_verification_tokens(token_hash,user_id,email,expires_at) VALUES(?,?,?,datetime('now','+24 hours'))").bind(hash,userId,email)
  ]);
  const url=`${origin}/#/verification?token=${encodeURIComponent(raw)}`;
  try{
    await sendResendEmail(env,{
      to:email,
      subject:"Vérifiez votre adresse e-mail — Strathasard",
      text:`Bonjour ${username},\n\nPour vérifier votre adresse e-mail sur Strathasard, ouvrez ce lien :\n${url}\n\nCe lien est valable 24 heures. Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.`,
      html:`<div style="font-family:Arial,sans-serif;line-height:1.55;color:#2d2924"><h2>Bienvenue sur Strathasard</h2><p>Bonjour <strong>${emailEscape(username)}</strong>,</p><p>Confirmez votre adresse e-mail pour sécuriser votre compte et permettre la récupération du mot de passe.</p><p><a href="${emailEscape(url)}" style="display:inline-block;padding:12px 18px;background:#765b3b;color:white;text-decoration:none;border-radius:8px">Vérifier mon adresse</a></p><p>Ce lien est valable 24 heures.</p><p style="color:#6d6258;font-size:13px">Votre adresse est utilisée uniquement pour l'accès et la sécurité de votre compte Strathasard. Elle n'est pas utilisée pour la publicité et n'est jamais vendue.</p></div>`
    });
  }catch(error){
    await env.DB.prepare("DELETE FROM email_verification_tokens WHERE token_hash=?").bind(hash).run();
    throw error;
  }
  return {sent:true};
}

async function requestPasswordReset(request,env){
  if(!env.RESEND_API_KEY) return json({error:"Le service de récupération par e-mail n’est pas encore configuré."},503);
  const body=await readJson(request),email=normalizeEmail(body?.email),turnstileToken=String(body?.turnstileToken||"");
  if(!validEmail(email)) return json({error:"Saisissez une adresse e-mail valide."},400);
  const challenge=await requireTurnstile(request,env,turnstileToken,"forgot_password"); if(challenge.response) return challenge.response;
  const ipKey=await securityKey("forgot-ip",clientIp(request));
  const emailKey=await securityKey("forgot-email",email);
  const ipLimit=await hitFixedWindow(env,ipKey,{limit:10,windowSeconds:3600,blockSeconds:3600});
  const emailLimit=await hitFixedWindow(env,emailKey,{limit:4,windowSeconds:3600,blockSeconds:3600});
  if(!ipLimit.allowed || !emailLimit.allowed){
    const retryAfter=Math.max(ipLimit.retryAfter||0,emailLimit.retryAfter||0);
    return json({error:"Trop de demandes de récupération. Réessayez plus tard.",retryAfter,turnstileRequired:true},429,{"retry-after":String(retryAfter||60)});
  }
  await cleanupSecurityData(env);
  const generic={ok:true,message:"Si cette adresse correspond à un compte vérifié, un e-mail de réinitialisation vient d’être envoyé."};
  const user=await env.DB.prepare("SELECT id,username,email FROM users WHERE email=? COLLATE NOCASE AND email_verified_at IS NOT NULL AND deleted_at IS NULL").bind(email).first();
  if(!user) return json(generic);
  const recent=await env.DB.prepare("SELECT 1 FROM password_reset_tokens WHERE user_id=? AND created_at > datetime('now','-5 minutes') LIMIT 1").bind(user.id).first();
  if(recent) return json(generic);
  const raw=randomToken(32),hash=await sha256(`password-reset:${raw}`);
  await env.DB.batch([
    env.DB.prepare("DELETE FROM password_reset_tokens WHERE user_id=? OR expires_at <= datetime('now')").bind(user.id),
    env.DB.prepare("INSERT INTO password_reset_tokens(token_hash,user_id,expires_at) VALUES(?,?,datetime('now','+30 minutes'))").bind(hash,user.id)
  ]);
  const origin=new URL(request.url).origin;
  const url=`${origin}/#/reinitialiser?token=${encodeURIComponent(raw)}`;
  try{
    await sendResendEmail(env,{
      to:user.email,
      subject:"Réinitialisation de votre mot de passe — Strathasard",
      text:`Bonjour ${user.username},

Vous avez demandé un nouveau mot de passe Strathasard. Ouvrez ce lien :
${url}

Ce lien est valable 30 minutes et ne peut être utilisé qu'une fois. Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.`,
      html:`<div style="font-family:Arial,sans-serif;line-height:1.55;color:#2d2924"><h2>Réinitialisation du mot de passe</h2><p>Bonjour <strong>${emailEscape(user.username)}</strong>,</p><p>Utilisez le bouton ci-dessous pour choisir un nouveau mot de passe Strathasard.</p><p><a href="${emailEscape(url)}" style="display:inline-block;padding:12px 18px;background:#765b3b;color:white;text-decoration:none;border-radius:8px">Choisir un nouveau mot de passe</a></p><p>Ce lien est valable 30 minutes et ne peut être utilisé qu'une fois.</p><p style="color:#6d6258;font-size:13px">Si vous n'avez pas demandé cette réinitialisation, vous pouvez ignorer ce message.</p></div>`
    });
  }catch(error){
    console.error("Reset email:",error);
    await env.DB.prepare("DELETE FROM password_reset_tokens WHERE token_hash=?").bind(hash).run();
    return json(generic);
  }
  return json(generic);
}

async function resetPasswordByEmail(request,env){
  const body=await readJson(request),raw=String(body?.token||""),newPassword=body?.newPassword||"";
  if(raw.length<20 || !validPassword(newPassword)) return json({error:"Lien invalide ou nouveau mot de passe incorrect."},400);
  const hash=await sha256(`password-reset:${raw}`);
  const token=await env.DB.prepare(`SELECT t.user_id,u.username,u.email,u.email_verified_at FROM password_reset_tokens t JOIN users u ON u.id=t.user_id WHERE t.token_hash=? AND t.expires_at > datetime('now') AND u.deleted_at IS NULL`).bind(hash).first();
  if(!token) return json({error:"Ce lien de réinitialisation est invalide ou a expiré."},400);
  const salt=newSalt(),passwordHash=await hashPassword(newPassword,salt);
  await env.DB.batch([
    env.DB.prepare("UPDATE users SET password_hash=?,password_salt=? WHERE id=?").bind(passwordHash,salt,token.user_id),
    env.DB.prepare("DELETE FROM sessions WHERE user_id=?").bind(token.user_id),
    env.DB.prepare("DELETE FROM password_reset_tokens WHERE user_id=?").bind(token.user_id)
  ]);
  return json({ok:true,message:"Votre mot de passe a été réinitialisé. Vous pouvez maintenant vous connecter."});
}

async function verifyEmail(request,env){
  const body=await readJson(request),raw=String(body?.token||"");
  if(raw.length<20) return json({error:"Lien de vérification invalide."},400);
  const hash=await sha256(`email-verify:${raw}`);
  const token=await env.DB.prepare(`SELECT t.user_id,t.email,u.email AS current_email FROM email_verification_tokens t JOIN users u ON u.id=t.user_id WHERE t.token_hash=? AND t.expires_at > datetime('now') AND u.deleted_at IS NULL`).bind(hash).first();
  if(!token || normalizeEmail(token.email)!==normalizeEmail(token.current_email)) return json({error:"Ce lien de vérification est invalide ou a expiré."},400);
  await env.DB.batch([
    env.DB.prepare("UPDATE users SET email_verified_at=CURRENT_TIMESTAMP,email_verification_required_at=NULL WHERE id=?").bind(token.user_id),
    env.DB.prepare("DELETE FROM email_verification_tokens WHERE user_id=?").bind(token.user_id)
  ]);
  return json({ok:true,message:"Votre adresse e-mail est maintenant vérifiée."});
}

async function setAccountEmail(request,env,user){
  const body=await readJson(request),email=normalizeEmail(body?.email),password=body?.password||"";
  if(!validEmail(email)) return json({error:"Saisissez une adresse e-mail valide."},400);
  const current=await env.DB.prepare("SELECT email,email_verified_at,password_hash,password_salt FROM users WHERE id=? AND deleted_at IS NULL").bind(user.id).first();
  if(!current) return json({error:"Compte introuvable."},404);
  const supplied=await hashPassword(password,current.password_salt);
  if(supplied!==current.password_hash) return json({error:"Le mot de passe est incorrect."},401);
  if(normalizeEmail(current.email)===email && current.email_verified_at) return json({ok:true,email,message:"Cette adresse e-mail est déjà vérifiée."});
  const exists=await env.DB.prepare("SELECT id FROM users WHERE email=? COLLATE NOCASE AND id<>? AND deleted_at IS NULL").bind(email,user.id).first();
  if(exists) return json({error:"Cette adresse e-mail est déjà associée à un autre compte."},409);
  await env.DB.batch([
    env.DB.prepare("UPDATE users SET email=?,email_verified_at=NULL,email_verification_required_at=CURRENT_TIMESTAMP WHERE id=?").bind(email,user.id),
    env.DB.prepare("DELETE FROM email_verification_tokens WHERE user_id=?").bind(user.id),
    env.DB.prepare("DELETE FROM password_reset_tokens WHERE user_id=?").bind(user.id)
  ]);
  try{
    await createEmailVerification(env,user.id,email,user.username,new URL(request.url).origin);
    return json({ok:true,email,message:"Adresse enregistrée. Consultez votre boîte mail pour la vérifier."});
  }catch(error){
    console.error("Verification email:",error);
    return json({ok:true,email,emailSent:false,message:"Adresse enregistrée, mais l’e-mail de vérification n’a pas pu être envoyé. Vous pourrez le renvoyer depuis cette page."});
  }
}

async function resendEmailVerification(request,env,user){
  const limitKey=await securityKey("verify-email-user",user.id);
  const limit=await hitFixedWindow(env,limitKey,{limit:5,windowSeconds:3600,blockSeconds:3600});
  if(!limit.allowed) return json({error:"Trop de demandes de vérification. Réessayez plus tard.",retryAfter:limit.retryAfter},429,{"retry-after":String(limit.retryAfter||60)});
  const row=await env.DB.prepare("SELECT email,email_verified_at FROM users WHERE id=? AND deleted_at IS NULL").bind(user.id).first();
  if(!row?.email) return json({error:"Ajoutez d’abord une adresse e-mail à votre compte."},400);
  if(row.email_verified_at) return json({ok:true,message:"Cette adresse e-mail est déjà vérifiée."});
  try{
    const r=await createEmailVerification(env,user.id,row.email,user.username,new URL(request.url).origin);
    return json({ok:true,message:r.throttled?"Un e-mail vient déjà d’être envoyé. Patientez quelques instants avant d’en demander un autre.":"Un nouvel e-mail de vérification a été envoyé."});
  }catch(error){
    console.error("Resend verification:",error);
    return json({error:error.message||"Impossible d’envoyer l’e-mail."},503);
  }
}

async function deleteAccount(request,env,user){
  const body=await readJson(request),password=body?.password||"",confirmation=String(body?.confirmation||"").trim().toUpperCase();
  if(confirmation!=="SUPPRIMER") return json({error:"Pour confirmer, saisissez exactement SUPPRIMER."},400);
  const row=await env.DB.prepare("SELECT password_hash,password_salt FROM users WHERE id=? AND deleted_at IS NULL").bind(user.id).first();
  if(!row) return json({error:"Compte introuvable."},404);
  const supplied=await hashPassword(password,row.password_salt);
  if(supplied!==row.password_hash) return json({error:"Le mot de passe est incorrect."},401);
  const placeholder=`Compte-supprime-${user.id.slice(0,8)}`;
  const salt=newSalt(),disabledHash=await hashPassword(randomToken(48),salt);
  await env.DB.batch([
    env.DB.prepare("DELETE FROM sessions WHERE user_id=?").bind(user.id),
    env.DB.prepare("DELETE FROM saves WHERE user_id=?").bind(user.id),
    env.DB.prepare("DELETE FROM rooms WHERE black_user_id=? OR white_user_id=? OR winner_user_id=?").bind(user.id,user.id,user.id),
    env.DB.prepare("DELETE FROM chess_ratings WHERE user_id=?").bind(user.id),
    env.DB.prepare("DELETE FROM checkers_ratings WHERE user_id=?").bind(user.id),
    env.DB.prepare("DELETE FROM go_ratings WHERE user_id=?").bind(user.id),
    env.DB.prepare("DELETE FROM awale_ratings WHERE user_id=?").bind(user.id),
    env.DB.prepare("DELETE FROM abalone_ratings WHERE user_id=?").bind(user.id),
    env.DB.prepare("DELETE FROM yams_ratings WHERE user_id=?").bind(user.id),
    env.DB.prepare("DELETE FROM jeu421_ratings WHERE user_id=?").bind(user.id),
    env.DB.prepare("DELETE FROM email_verification_tokens WHERE user_id=?").bind(user.id),
    env.DB.prepare("DELETE FROM password_reset_tokens WHERE user_id=?").bind(user.id),
    env.DB.prepare("UPDATE users SET username=?,email=NULL,email_verified_at=NULL,email_verification_required_at=NULL,password_hash=?,password_salt=?,recovery_key_hash=NULL,recovery_key_created_at=NULL,deleted_at=CURRENT_TIMESTAMP WHERE id=?")
      .bind(placeholder,disabledHash,salt,user.id)
  ]);
  return json({ok:true,message:"Votre compte a été supprimé. Les anciennes parties restent anonymisées dans l’historique de vos adversaires."},200,{"set-cookie":clearSessionCookie()});
}

async function register(request,env){
  const body=await readJson(request);
  const username=(body?.username||'').trim(),email=normalizeEmail(body?.email),password=body?.password||'',turnstileToken=String(body?.turnstileToken||"");
  if(!validUsername(username)) return json({error:"Le pseudo doit contenir 3 à 24 caractères : lettres, chiffres, _ ou -."},400);
  if(!validEmail(email)) return json({error:"Une adresse e-mail valide est nécessaire pour créer le compte."},400);
  if(!validPassword(password)) return json({error:"Le mot de passe doit contenir entre 10 et 128 caractères."},400);
  const challenge=await requireTurnstile(request,env,turnstileToken,"register"); if(challenge.response) return challenge.response;
  const regKey=await securityKey("register-ip",clientIp(request));
  const regLimit=await hitFixedWindow(env,regKey,{limit:5,windowSeconds:3600,blockSeconds:3600});
  if(!regLimit.allowed) return json({error:"Trop de créations de comptes depuis cette connexion. Réessayez plus tard.",retryAfter:regLimit.retryAfter},429,{"retry-after":String(regLimit.retryAfter||60)});
  await cleanupSecurityData(env);
  const exists=await env.DB.prepare("SELECT 1 FROM users WHERE username=? COLLATE NOCASE AND deleted_at IS NULL").bind(username).first();
  if(exists) return json({error:"Ce pseudo est déjà utilisé."},409);
  const emailExists=await env.DB.prepare("SELECT 1 FROM users WHERE email=? COLLATE NOCASE AND deleted_at IS NULL").bind(email).first();
  if(emailExists) return json({error:"Cette adresse e-mail est déjà associée à un compte."},409);
  const id=crypto.randomUUID(),salt=newSalt(),hash=await hashPassword(password,salt);
  const recoveryKey=newRecoveryKey(),recoveryHash=await recoveryKeyHash(recoveryKey);
  await env.DB.prepare("INSERT INTO users(id,username,password_hash,password_salt,recovery_key_hash,recovery_key_created_at,email,email_verification_required_at) VALUES(?,?,?,?,?,CURRENT_TIMESTAMP,?,CURRENT_TIMESTAMP)")
    .bind(id,username,hash,salt,recoveryHash,email).run();
  let emailSent=true,emailWarning=null;
  try{ await createEmailVerification(env,id,email,username,new URL(request.url).origin); }
  catch(error){ emailSent=false; emailWarning="Le compte a été créé, mais l’e-mail de vérification n’a pas pu être envoyé. Vous pourrez le renvoyer depuis votre compte."; console.error("Registration verification:",error); }
  return createSession(id,username,env,201,{user:{id,username,email,emailVerified:false},recoveryKey,emailSent,emailWarning});
}
async function login(request,env){
  const body=await readJson(request),identifier=String(body?.username||body?.identifier||'').trim(),password=body?.password||'',turnstileToken=String(body?.turnstileToken||"");
  const email=normalizeEmail(identifier);
  const pairKey=await securityKey("login-pair",clientIp(request),identifier);
  const ipKey=await securityKey("login-ip",clientIp(request));
  const now=Math.floor(Date.now()/1000);
  const pairState=await securityCounter(env,pairKey),ipState=await securityCounter(env,ipKey);
  const pairActive=pairState && now-pairState.windowStartedAt<900 ? pairState : null;
  const ipActive=ipState && now-ipState.windowStartedAt<900 ? ipState : null;
  const blockedUntil=Math.max(pairActive?.blockedUntil||0,ipActive?.blockedUntil||0);
  if(blockedUntil>now){
    const retryAfter=Math.max(1,blockedUntil-now);
    return json({error:`Trop de tentatives. Réessayez dans ${retryAfter} seconde${retryAfter>1?"s":""}.`,retryAfter,turnstileRequired:true},429,{"retry-after":String(retryAfter)});
  }
  if((ipActive?.attempts||0)>=30){
    const gate=await hitFixedWindow(env,ipKey,{limit:30,windowSeconds:900,blockSeconds:900});
    if(!gate.allowed) return json({error:"Trop de tentatives de connexion depuis cette connexion Internet. Réessayez plus tard.",retryAfter:gate.retryAfter,turnstileRequired:true},429,{"retry-after":String(gate.retryAfter||60)});
  }
  const turnstileRequired=(pairActive?.attempts||0)>=5;
  if(turnstileRequired){
    if(!turnstileToken) return json({error:"Après plusieurs essais, une vérification anti-robot est nécessaire.",turnstileRequired:true},403);
    const challenge=await requireTurnstile(request,env,turnstileToken,"login"); if(challenge.response) return challenge.response;
  }
  const user=await env.DB.prepare("SELECT id,username,email,email_verified_at,password_hash,password_salt FROM users WHERE deleted_at IS NULL AND (username=? COLLATE NOCASE OR email=? COLLATE NOCASE) LIMIT 1").bind(identifier,email).first();
  let valid=false;
  if(user){
    const hash=await hashPassword(password,user.password_salt);
    valid=hash===user.password_hash;
  }
  if(!valid){
    const pairFailure=await recordLoginFailure(env,pairKey);
    const ipFailure=await recordLoginFailure(env,ipKey);
    const retryAfter=Math.max(pairFailure.retryAfter||0,ipFailure.attempts>=30?900:0);
    if(ipFailure.attempts>=30){
      await env.DB.prepare("UPDATE security_counters SET blocked_until=? WHERE key=?").bind(now+900,ipKey).run();
    }
    if(retryAfter>0) return json({error:"Trop de tentatives. Un délai de sécurité est appliqué.",retryAfter,turnstileRequired:true},429,{"retry-after":String(retryAfter)});
    return json({error:"Pseudo/e-mail ou mot de passe incorrect.",turnstileRequired:pairFailure.attempts>=5},401);
  }
  await Promise.all([clearSecurityCounter(env,pairKey),clearSecurityCounter(env,ipKey)]);
  return createSession(user.id,user.username,env,200,{user:publicUser(user)});
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
  return createSession(user.id,user.username,env,200,{message:"Mot de passe modifié.",user:publicUser(user)});
}

async function generateRecoveryKey(env,user){
  const key=newRecoveryKey(),hash=await recoveryKeyHash(key);
  await env.DB.prepare("UPDATE users SET recovery_key_hash=?,recovery_key_created_at=CURRENT_TIMESTAMP WHERE id=?").bind(hash,user.id).run();
  return json({recoveryKey:key,message:"Nouvelle clé de récupération générée. L'ancienne n'est plus valable."});
}

async function resetWithRecovery(request,env){
  const recoveryLimit=await hitFixedWindow(env,await securityKey("recovery-key-ip",clientIp(request)),{limit:10,windowSeconds:900,blockSeconds:900});
  if(!recoveryLimit.allowed) return json({error:"Trop de tentatives de récupération. Réessayez plus tard.",retryAfter:recoveryLimit.retryAfter},429,{"retry-after":String(recoveryLimit.retryAfter||60)});
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
function validRoomGame(game){
  return game === "chess" || game === "abalone" || game === "go" || game === "awale" || game === "yams" || game === "421" || game === "dominos" || game === "checkers-international" || game === "checkers-english";
}
function isCheckersRoomGame(game){ return game === "checkers-international" || game === "checkers-english"; }
function checkersVariantFromRoomGame(game){ return game === "checkers-english" ? "english" : "international"; }
function isTimedRoomGame(game){ return game === "chess" || game === "abalone" || game === "go" || game === "awale" || isCheckersRoomGame(game); }
function publicSideForRoomGame(game,slot){
  if(game==="chess") return slot==="black"?"b":"w";
  if(isCheckersRoomGame(game)) return slot==="black"?0:1;
  if(game==="go") return slot==="black"?1:2;
  if(game==="awale" || game==="yams" || game==="421" || game==="dominos") return slot==="black"?0:1;
  return slot==="black"?1:2;
}

function clampInt(value,min,max,fallback){
  const n=Number.parseInt(value,10);
  if(!Number.isFinite(n)) return fallback;
  return Math.min(max,Math.max(min,n));
}

function chessRatingCategory(initialSeconds,incrementSeconds){
  const estimated=initialSeconds + incrementSeconds * 40;
  if(estimated < 180) return "bullet";
  if(estimated < 600) return "blitz";
  if(estimated < 1800) return "rapid";
  return "classical";
}

const CHESS_RATING_LABELS={bullet:"Bullet",blitz:"Blitz",rapid:"Rapide",classical:"Classique"};

async function createRoom(request,env,user){
  const roomLimit=await hitFixedWindow(env,await securityKey("room-create-user",user.id),{limit:12,windowSeconds:300,blockSeconds:600});
  if(!roomLimit.allowed) return json({error:"Trop de salons créés en peu de temps. Réessayez dans quelques minutes.",retryAfter:roomLimit.retryAfter},429,{"retry-after":String(roomLimit.retryAfter||60)});
  const body=await readJson(request);
  const game=validRoomGame(body?.game)?body.game:"abalone";
  const checkers=isCheckersRoomGame(game);
  const go=game==="go";
  const awale=game==="awale";
  const yams=game==="yams";
  const game421=game==="421";
  const dominos=game==="dominos";

  // Les colonnes historiques black/white de rooms servent maintenant de
  // "slot 0 / slot 1" pour les Dames. Les libellés visibles dépendent de la variante.
  let creatorSlot="black";
  let creatorColor="black";
  if(game==="chess" || game==="abalone" || go){
    creatorColor=String(body?.creatorColor||"random").toLowerCase();
    if(creatorColor!=="white" && creatorColor!=="black"){
      const random=new Uint8Array(1); crypto.getRandomValues(random);
      creatorColor=(random[0]&1)===0?"white":"black";
    }
    creatorSlot=creatorColor;
  }else if(checkers || awale || yams || game421 || dominos){
    const requested=String(body?.creatorSide??"random").toLowerCase();
    let sideIndex;
    if(requested==="0"||requested==="side0") sideIndex=0;
    else if(requested==="1"||requested==="side1") sideIndex=1;
    else { const random=new Uint8Array(1); crypto.getRandomValues(random); sideIndex=random[0]&1; }
    creatorSlot=sideIndex===0?"black":"white";
    creatorColor=String(sideIndex);
  }

  const timed=isTimedRoomGame(game);
  const initialSeconds=timed?clampInt(body?.initialSeconds,30,10800,600):0;
  const incrementSeconds=timed?clampInt(body?.incrementSeconds,0,60,0):0;
  const rated=(timed || yams || game421 || dominos) ? body?.rated!==false : false;
  const ratingCategory=timed?chessRatingCategory(initialSeconds,incrementSeconds):((yams||game421||dominos)?"standard":null);
  const goSize=go?[9,13,19].includes(Number(body?.goSize))?Number(body.goSize):19:null;
  const goKomi=go&&Number.isFinite(Number(body?.goKomi))?Number(body.goKomi):go?7.5:null;
  const goScoring=go&&body?.goScoring==="territory"?"territory":go?"area":null;

  const blackId=creatorSlot==="black"?user.id:null;
  const whiteId=creatorSlot==="white"?user.id:null;
  let code=null;

  for(let i=0;i<8;i++){
    const candidate=roomCode();
    try{
      await env.DB.prepare(`INSERT INTO rooms(
        code,game,black_user_id,white_user_id,status,
        time_initial_seconds,time_increment_seconds,rated,rating_category,go_size,go_komi,go_scoring
      ) VALUES(?,?,?,?, 'waiting',?,?,?,?,?,?,?)`)
        .bind(candidate,game,blackId,whiteId,initialSeconds,incrementSeconds,rated?1:0,ratingCategory,goSize,goKomi,goScoring).run();
      code=candidate;
      break;
    }catch(error){ console.error("Création salon:",error?.message||error); }
  }
  if(!code) return json({error:"Impossible de créer un salon."},500);

  const stub=env.ABALONE_ROOMS.getByName(code);
  const creatorSideForRoom=game==="chess"?(creatorSlot==="white"?"w":"b"):game==="abalone"?(creatorSlot==="white"?2:1):checkers?(creatorSlot==="white"?1:0):go?(creatorSlot==="white"?2:1):(awale||yams||game421||dominos)?(creatorSlot==="white"?1:0):null;
  await stub.fetch("https://room/init",{
    method:"POST",headers:{"content-type":"application/json"},
    body:JSON.stringify({
      code,game,userId:user.id,username:user.username,
      creatorSide:creatorSideForRoom,
      timeControl:{initialSeconds,incrementSeconds},rated,ratingCategory,
      goSettings:go?{size:goSize,komi:goKomi,scoring:goScoring}:null
    })
  });

  return json({
    code,game,
    side:game==="chess"?(creatorSlot==="white"?"w":"b"):game==="abalone"?(creatorSlot==="white"?2:1):checkers?(creatorSlot==="white"?1:0):go?(creatorSlot==="white"?2:1):(awale||yams||game421||dominos)?(creatorSlot==="white"?1:0):1,
    creatorColor,
    creatorSide:(checkers||awale||yams||game421||dominos)?Number(creatorColor):null,
    variant:checkers?checkersVariantFromRoomGame(game):null,
    goSettings:go?{size:goSize,komi:goKomi,scoring:goScoring}:null,
    timeControl:timed?{initialSeconds,incrementSeconds}:null,
    rated,ratingCategory,ratingLabel:ratingCategory?CHESS_RATING_LABELS[ratingCategory]:null
  },201);
}

async function joinRoom(request,env,user){
  const body=await readJson(request),code=String(body?.code||'').trim().toUpperCase();
  if(!/^[A-Z2-9]{6}$/.test(code)) return json({error:"Code de salon invalide."},400);

  let room=await env.DB.prepare("SELECT * FROM rooms WHERE code=?").bind(code).first();
  if(!room) return json({error:"Salon introuvable."},404);
  const timed=isTimedRoomGame(room.game);
  const payloadForSlot=slot=>({
    code,game:room.game,side:publicSideForRoomGame(room.game,slot),
    variant:isCheckersRoomGame(room.game)?checkersVariantFromRoomGame(room.game):null,
    goSettings:room.game==="go"?{size:Number(room.go_size||19),komi:Number(room.go_komi??7.5),scoring:room.go_scoring||"area"}:null,
    timeControl:timed?{initialSeconds:Number(room.time_initial_seconds||600),incrementSeconds:Number(room.time_increment_seconds||0)}:null,
    rated:(timed||room.game==="yams"||room.game==="421"||room.game==="dominos")?Boolean(room.rated):false,ratingCategory:room.rating_category||null
  });

  // Reconnexion : un joueur déjà inscrit peut revenir, y compris après la fin
  // pour accepter/proposer une revanche.
  if(room.black_user_id===user.id) return json(payloadForSlot("black"));
  if(room.white_user_id===user.id) return json(payloadForSlot("white"));

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
    method:"POST",headers:{"content-type":"application/json"},
    body:JSON.stringify({userId:user.id,username:user.username,side:joinSlot})
  });
  if(!r.ok) return json({error:(await r.json()).error||"Impossible de rejoindre."},r.status);

  return json(payloadForSlot(joinSlot));
}

async function roomInfo(env,user,code){
  const room=await env.DB.prepare(`SELECT r.code,r.game,r.status,r.created_at,r.updated_at,
    r.time_initial_seconds,r.time_increment_seconds,r.rated,r.rating_category,r.go_size,r.go_komi,r.go_scoring,
    ub.username AS black_username,uw.username AS white_username,
    r.black_user_id,r.white_user_id FROM rooms r
    LEFT JOIN users ub ON ub.id=r.black_user_id LEFT JOIN users uw ON uw.id=r.white_user_id WHERE r.code=?`).bind(code).first();
  if(!room) return json({error:"Salon introuvable."},404);
  let side=null;
  if(room.black_user_id===user.id) side=publicSideForRoomGame(room.game,"black");
  else if(room.white_user_id===user.id) side=publicSideForRoomGame(room.game,"white");
  const timed=isTimedRoomGame(room.game);
  return json({room:{
    code:room.code,game:room.game,status:room.status,
    blackUsername:room.black_username,whiteUsername:room.white_username,
    createdAt:room.created_at,
    variant:isCheckersRoomGame(room.game)?checkersVariantFromRoomGame(room.game):null,
    goSettings:room.game==="go"?{size:Number(room.go_size||19),komi:Number(room.go_komi??7.5),scoring:room.go_scoring||"area"}:null,
    timeControl:timed?{
      initialSeconds:Number(room.time_initial_seconds||600),
      incrementSeconds:Number(room.time_increment_seconds||0)
    }:null,
    rated:(timed||room.game==="yams"||room.game==="421"||room.game==="dominos")?Boolean(room.rated):false,
    ratingCategory:room.rating_category||null
  },side});
}

async function chessRatingsForUser(env,userId){
  const {results=[]}=await env.DB.prepare(
    "SELECT category,rating,games,wins,draws,losses,updated_at FROM chess_ratings WHERE user_id=?"
  ).bind(userId).all();
  const ratings={};
  for(const category of ["bullet","blitz","rapid","classical"]){
    const row=results.find(r=>r.category===category);
    ratings[category]=row?{
      rating:Number(row.rating),games:Number(row.games),wins:Number(row.wins),
      draws:Number(row.draws),losses:Number(row.losses),updatedAt:row.updated_at
    }:{rating:1200,games:0,wins:0,draws:0,losses:0,updatedAt:null};
  }
  return ratings;
}

async function myChessRatings(env,user){
  return json({ratings:await chessRatingsForUser(env,user.id)});
}

async function chessLeaderboard(request,env){
  const url=new URL(request.url);
  const category=["bullet","blitz","rapid","classical"].includes(url.searchParams.get("category"))
    ? url.searchParams.get("category")
    : "rapid";
  const limit=clampInt(url.searchParams.get("limit"),1,100,30);
  const {results=[]}=await env.DB.prepare(`SELECT u.username,r.rating,r.games,r.wins,r.draws,r.losses
    FROM chess_ratings r JOIN users u ON u.id=r.user_id
    WHERE r.category=? AND r.games>0
    ORDER BY r.rating DESC,r.games DESC,u.username COLLATE NOCASE ASC
    LIMIT ?`).bind(category,limit).all();
  return json({category,label:CHESS_RATING_LABELS[category],players:results});
}


async function listChessGames(env,user){
  const {results=[]}=await env.DB.prepare(`SELECT r.id,r.room_code,r.game_number,r.category,r.rated,r.result,r.reason,
    r.white_rating_before,r.black_rating_before,r.white_rating_after,r.black_rating_after,r.white_delta,r.black_delta,
    r.time_initial_seconds,r.time_increment_seconds,r.created_at,
    uw.username AS white_username,ub.username AS black_username,
    CASE WHEN r.game_json IS NULL THEN 0 ELSE 1 END AS replay_available
    FROM chess_results r
    JOIN users uw ON uw.id=r.white_user_id
    JOIN users ub ON ub.id=r.black_user_id
    WHERE r.white_user_id=? OR r.black_user_id=?
    ORDER BY r.created_at DESC LIMIT 200`).bind(user.id,user.id).all();
  return json({games:results.map(row=>({
    id:row.id,roomCode:row.room_code,gameNumber:Number(row.game_number),category:row.category,rated:Boolean(row.rated),
    result:row.result,reason:row.reason,createdAt:row.created_at,whiteUsername:row.white_username,blackUsername:row.black_username,
    whiteRatingBefore:row.white_rating_before,blackRatingBefore:row.black_rating_before,whiteRatingAfter:row.white_rating_after,blackRatingAfter:row.black_rating_after,
    whiteDelta:row.white_delta,blackDelta:row.black_delta,initialSeconds:row.time_initial_seconds,incrementSeconds:row.time_increment_seconds,
    replayAvailable:Boolean(row.replay_available)
  }))});
}

async function chessGameById(env,user,id){
  const row=await env.DB.prepare(`SELECT r.*,uw.username AS white_username,ub.username AS black_username
    FROM chess_results r JOIN users uw ON uw.id=r.white_user_id JOIN users ub ON ub.id=r.black_user_id
    WHERE r.id=? AND (r.white_user_id=? OR r.black_user_id=?)`).bind(id,user.id,user.id).first();
  if(!row) return json({error:"Partie introuvable."},404);
  return json({game:{
    id:row.id,roomCode:row.room_code,gameNumber:Number(row.game_number),category:row.category,rated:Boolean(row.rated),
    result:row.result,reason:row.reason,createdAt:row.created_at,whiteUsername:row.white_username,blackUsername:row.black_username,
    initialSeconds:row.time_initial_seconds,incrementSeconds:row.time_increment_seconds,
    whiteRatingBefore:row.white_rating_before,blackRatingBefore:row.black_rating_before,whiteRatingAfter:row.white_rating_after,blackRatingAfter:row.black_rating_after,
    whiteDelta:row.white_delta,blackDelta:row.black_delta,
    replay:row.game_json?JSON.parse(row.game_json):null
  }});
}


async function checkersRatingsForUser(env,userId,variant){
  variant=variant==="english"?"english":"international";
  const {results=[]}=await env.DB.prepare(`SELECT category,rating,games,wins,draws,losses,updated_at
    FROM checkers_ratings WHERE user_id=? AND variant=?`).bind(userId,variant).all();
  const ratings={};
  for(const category of ["bullet","blitz","rapid","classical"]){
    const row=results.find(r=>r.category===category);
    ratings[category]=row?{
      rating:Number(row.rating),games:Number(row.games),wins:Number(row.wins),draws:Number(row.draws),losses:Number(row.losses),updatedAt:row.updated_at
    }:{rating:1200,games:0,wins:0,draws:0,losses:0,updatedAt:null};
  }
  return ratings;
}

async function myCheckersRatings(request,env,user){
  const url=new URL(request.url),variant=url.searchParams.get("variant")==="english"?"english":"international";
  return json({variant,ratings:await checkersRatingsForUser(env,user.id,variant)});
}

async function checkersLeaderboard(request,env){
  const url=new URL(request.url);
  const variant=url.searchParams.get("variant")==="english"?"english":"international";
  const category=["bullet","blitz","rapid","classical"].includes(url.searchParams.get("category"))?url.searchParams.get("category"):"rapid";
  const limit=clampInt(url.searchParams.get("limit"),1,100,30);
  const {results=[]}=await env.DB.prepare(`SELECT u.username,r.rating,r.games,r.wins,r.draws,r.losses
    FROM checkers_ratings r JOIN users u ON u.id=r.user_id
    WHERE r.variant=? AND r.category=? AND r.games>0
    ORDER BY r.rating DESC,r.games DESC,u.username COLLATE NOCASE ASC LIMIT ?`).bind(variant,category,limit).all();
  return json({variant,category,label:CHESS_RATING_LABELS[category],players:results});
}

async function listCheckersGames(request,env,user){
  const url=new URL(request.url);
  const requested=url.searchParams.get("variant");
  const variant=requested==="english"||requested==="international"?requested:null;
  const sql=`SELECT r.id,r.room_code,r.game_number,r.variant,r.category,r.rated,r.result,r.reason,
    r.side0_rating_before,r.side1_rating_before,r.side0_rating_after,r.side1_rating_after,r.side0_delta,r.side1_delta,
    r.time_initial_seconds,r.time_increment_seconds,r.created_at,
    u0.username AS side0_username,u1.username AS side1_username,
    CASE WHEN r.game_json IS NULL THEN 0 ELSE 1 END AS replay_available
    FROM checkers_results r
    JOIN users u0 ON u0.id=r.side0_user_id JOIN users u1 ON u1.id=r.side1_user_id
    WHERE (r.side0_user_id=? OR r.side1_user_id=?) ${variant?"AND r.variant=?":""}
    ORDER BY r.created_at DESC LIMIT 200`;
  const stmt=env.DB.prepare(sql);
  const {results=[]}=variant?await stmt.bind(user.id,user.id,variant).all():await stmt.bind(user.id,user.id).all();
  return json({games:results.map(row=>({
    id:row.id,roomCode:row.room_code,gameNumber:Number(row.game_number),variant:row.variant,category:row.category,rated:Boolean(row.rated),
    result:row.result,reason:row.reason,createdAt:row.created_at,side0Username:row.side0_username,side1Username:row.side1_username,
    side0RatingBefore:row.side0_rating_before,side1RatingBefore:row.side1_rating_before,side0RatingAfter:row.side0_rating_after,side1RatingAfter:row.side1_rating_after,
    side0Delta:row.side0_delta,side1Delta:row.side1_delta,initialSeconds:row.time_initial_seconds,incrementSeconds:row.time_increment_seconds,
    replayAvailable:Boolean(row.replay_available)
  }))});
}

async function checkersGameById(env,user,id){
  const row=await env.DB.prepare(`SELECT r.*,u0.username AS side0_username,u1.username AS side1_username
    FROM checkers_results r JOIN users u0 ON u0.id=r.side0_user_id JOIN users u1 ON u1.id=r.side1_user_id
    WHERE r.id=? AND (r.side0_user_id=? OR r.side1_user_id=?)`).bind(id,user.id,user.id).first();
  if(!row) return json({error:"Partie introuvable."},404);
  return json({game:{
    id:row.id,roomCode:row.room_code,gameNumber:Number(row.game_number),variant:row.variant,category:row.category,rated:Boolean(row.rated),
    result:row.result,reason:row.reason,createdAt:row.created_at,side0Username:row.side0_username,side1Username:row.side1_username,
    initialSeconds:row.time_initial_seconds,incrementSeconds:row.time_increment_seconds,
    side0RatingBefore:row.side0_rating_before,side1RatingBefore:row.side1_rating_before,side0RatingAfter:row.side0_rating_after,side1RatingAfter:row.side1_rating_after,
    side0Delta:row.side0_delta,side1Delta:row.side1_delta,replay:row.game_json?JSON.parse(row.game_json):null
  }});
}

async function goRatingsForUser(env,userId,size){
  size=[9,13,19].includes(Number(size))?Number(size):19;
  const {results=[]}=await env.DB.prepare(`SELECT category,rating,games,wins,draws,losses,updated_at FROM go_ratings WHERE user_id=? AND board_size=?`).bind(userId,size).all();
  const ratings={};
  for(const category of ["bullet","blitz","rapid","classical"]){
    const row=results.find(r=>r.category===category);
    ratings[category]=row?{rating:Number(row.rating),games:Number(row.games),wins:Number(row.wins),draws:Number(row.draws),losses:Number(row.losses),updatedAt:row.updated_at}
      :{rating:1200,games:0,wins:0,draws:0,losses:0,updatedAt:null};
  }
  return ratings;
}
async function myGoRatings(request,env,user){ const u=new URL(request.url),size=[9,13,19].includes(Number(u.searchParams.get("size")))?Number(u.searchParams.get("size")):19; return json({size,ratings:await goRatingsForUser(env,user.id,size)}); }
async function goLeaderboard(request,env){
  const u=new URL(request.url),size=[9,13,19].includes(Number(u.searchParams.get("size")))?Number(u.searchParams.get("size")):19;
  const category=["bullet","blitz","rapid","classical"].includes(u.searchParams.get("category"))?u.searchParams.get("category"):"rapid";
  const limit=clampInt(u.searchParams.get("limit"),1,100,30);
  const {results=[]}=await env.DB.prepare(`SELECT u.username,r.rating,r.games,r.wins,r.draws,r.losses FROM go_ratings r JOIN users u ON u.id=r.user_id WHERE r.board_size=? AND r.category=? AND r.games>0 ORDER BY r.rating DESC,r.games DESC,u.username COLLATE NOCASE ASC LIMIT ?`).bind(size,category,limit).all();
  return json({size,category,label:CHESS_RATING_LABELS[category],players:results});
}
async function listGoGames(request,env,user){
  const u=new URL(request.url),requested=Number(u.searchParams.get("size")),size=[9,13,19].includes(requested)?requested:null;
  const sql=`SELECT r.id,r.room_code,r.game_number,r.board_size,r.category,r.rated,r.result,r.reason,r.black_rating_before,r.white_rating_before,r.black_rating_after,r.white_rating_after,r.black_delta,r.white_delta,r.time_initial_seconds,r.time_increment_seconds,r.komi,r.scoring,r.created_at,ub.username AS black_username,uw.username AS white_username,CASE WHEN r.game_json IS NULL THEN 0 ELSE 1 END AS replay_available FROM go_results r JOIN users ub ON ub.id=r.black_user_id JOIN users uw ON uw.id=r.white_user_id WHERE (r.black_user_id=? OR r.white_user_id=?) ${size?"AND r.board_size=?":""} ORDER BY r.created_at DESC LIMIT 200`;
  const stmt=env.DB.prepare(sql); const {results=[]}=size?await stmt.bind(user.id,user.id,size).all():await stmt.bind(user.id,user.id).all();
  return json({games:results.map(r=>({id:r.id,roomCode:r.room_code,gameNumber:Number(r.game_number),size:Number(r.board_size),category:r.category,rated:Boolean(r.rated),result:r.result,reason:r.reason,createdAt:r.created_at,blackUsername:r.black_username,whiteUsername:r.white_username,blackRatingBefore:r.black_rating_before,whiteRatingBefore:r.white_rating_before,blackRatingAfter:r.black_rating_after,whiteRatingAfter:r.white_rating_after,blackDelta:r.black_delta,whiteDelta:r.white_delta,initialSeconds:r.time_initial_seconds,incrementSeconds:r.time_increment_seconds,komi:Number(r.komi),scoring:r.scoring,replayAvailable:Boolean(r.replay_available)}))});
}
async function goGameById(env,user,id){
  const r=await env.DB.prepare(`SELECT r.*,ub.username AS black_username,uw.username AS white_username FROM go_results r JOIN users ub ON ub.id=r.black_user_id JOIN users uw ON uw.id=r.white_user_id WHERE r.id=? AND (r.black_user_id=? OR r.white_user_id=?)`).bind(id,user.id,user.id).first();
  if(!r) return json({error:"Partie introuvable."},404);
  return json({game:{id:r.id,roomCode:r.room_code,gameNumber:Number(r.game_number),size:Number(r.board_size),category:r.category,rated:Boolean(r.rated),result:r.result,reason:r.reason,createdAt:r.created_at,blackUsername:r.black_username,whiteUsername:r.white_username,initialSeconds:r.time_initial_seconds,incrementSeconds:r.time_increment_seconds,komi:Number(r.komi),scoring:r.scoring,blackRatingBefore:r.black_rating_before,whiteRatingBefore:r.white_rating_before,blackRatingAfter:r.black_rating_after,whiteRatingAfter:r.white_rating_after,blackDelta:r.black_delta,whiteDelta:r.white_delta,replay:r.game_json?JSON.parse(r.game_json):null}});
}


async function awaleRatingsForUser(env,userId){
  const {results=[]}=await env.DB.prepare(`SELECT category,rating,games,wins,draws,losses,updated_at FROM awale_ratings WHERE user_id=?`).bind(userId).all();
  const ratings={};
  for(const category of ["bullet","blitz","rapid","classical"]){
    const row=results.find(r=>r.category===category);
    ratings[category]=row?{rating:Number(row.rating),games:Number(row.games),wins:Number(row.wins),draws:Number(row.draws),losses:Number(row.losses),updatedAt:row.updated_at}
      :{rating:1200,games:0,wins:0,draws:0,losses:0,updatedAt:null};
  }
  return ratings;
}
async function myAwaleRatings(env,user){ return json({ratings:await awaleRatingsForUser(env,user.id)}); }
async function awaleLeaderboard(request,env){
  const u=new URL(request.url);
  const category=["bullet","blitz","rapid","classical"].includes(u.searchParams.get("category"))?u.searchParams.get("category"):"rapid";
  const limit=clampInt(u.searchParams.get("limit"),1,100,30);
  const {results=[]}=await env.DB.prepare(`SELECT u.username,r.rating,r.games,r.wins,r.draws,r.losses FROM awale_ratings r JOIN users u ON u.id=r.user_id WHERE r.category=? AND r.games>0 ORDER BY r.rating DESC,r.games DESC,u.username COLLATE NOCASE ASC LIMIT ?`).bind(category,limit).all();
  return json({category,label:CHESS_RATING_LABELS[category],players:results});
}
async function listAwaleGames(request,env,user){
  const {results=[]}=await env.DB.prepare(`SELECT r.id,r.room_code,r.game_number,r.category,r.rated,r.result,r.reason,
    r.side0_rating_before,r.side1_rating_before,r.side0_rating_after,r.side1_rating_after,r.side0_delta,r.side1_delta,
    r.time_initial_seconds,r.time_increment_seconds,r.created_at,
    u0.username AS side0_username,u1.username AS side1_username,
    CASE WHEN r.game_json IS NULL THEN 0 ELSE 1 END AS replay_available
    FROM awale_results r JOIN users u0 ON u0.id=r.side0_user_id JOIN users u1 ON u1.id=r.side1_user_id
    WHERE r.side0_user_id=? OR r.side1_user_id=? ORDER BY r.created_at DESC LIMIT 200`).bind(user.id,user.id).all();
  return json({games:results.map(r=>({
    id:r.id,roomCode:r.room_code,gameNumber:Number(r.game_number),category:r.category,rated:Boolean(r.rated),result:r.result,reason:r.reason,
    createdAt:r.created_at,side0Username:r.side0_username,side1Username:r.side1_username,
    side0RatingBefore:r.side0_rating_before,side1RatingBefore:r.side1_rating_before,side0RatingAfter:r.side0_rating_after,side1RatingAfter:r.side1_rating_after,
    side0Delta:r.side0_delta,side1Delta:r.side1_delta,initialSeconds:r.time_initial_seconds,incrementSeconds:r.time_increment_seconds,replayAvailable:Boolean(r.replay_available)
  }))});
}
async function awaleGameById(env,user,id){
  const r=await env.DB.prepare(`SELECT r.*,u0.username AS side0_username,u1.username AS side1_username FROM awale_results r
    JOIN users u0 ON u0.id=r.side0_user_id JOIN users u1 ON u1.id=r.side1_user_id
    WHERE r.id=? AND (r.side0_user_id=? OR r.side1_user_id=?)`).bind(id,user.id,user.id).first();
  if(!r) return json({error:"Partie introuvable."},404);
  return json({game:{
    id:r.id,roomCode:r.room_code,gameNumber:Number(r.game_number),category:r.category,rated:Boolean(r.rated),result:r.result,reason:r.reason,createdAt:r.created_at,
    side0Username:r.side0_username,side1Username:r.side1_username,initialSeconds:r.time_initial_seconds,incrementSeconds:r.time_increment_seconds,
    side0RatingBefore:r.side0_rating_before,side1RatingBefore:r.side1_rating_before,side0RatingAfter:r.side0_rating_after,side1RatingAfter:r.side1_rating_after,
    side0Delta:r.side0_delta,side1Delta:r.side1_delta,replay:r.game_json?JSON.parse(r.game_json):null
  }});
}



async function yamsRatingForUser(env,userId){
  const row=await env.DB.prepare(`SELECT rating,games,wins,draws,losses,updated_at FROM yams_ratings WHERE user_id=?`).bind(userId).first();
  return row?{rating:Number(row.rating),games:Number(row.games),wins:Number(row.wins),draws:Number(row.draws),losses:Number(row.losses),updatedAt:row.updated_at}
    :{rating:1200,games:0,wins:0,draws:0,losses:0,updatedAt:null};
}
async function myYamsRating(env,user){ return json({rating:await yamsRatingForUser(env,user.id)}); }
async function yamsLeaderboard(request,env){
  const u=new URL(request.url),limit=clampInt(u.searchParams.get("limit"),1,100,30);
  const {results=[]}=await env.DB.prepare(`SELECT u.username,r.rating,r.games,r.wins,r.draws,r.losses FROM yams_ratings r JOIN users u ON u.id=r.user_id WHERE r.games>0 ORDER BY r.rating DESC,r.games DESC,u.username COLLATE NOCASE ASC LIMIT ?`).bind(limit).all();
  return json({players:results});
}
async function listYamsGames(env,user){
  const {results=[]}=await env.DB.prepare(`SELECT r.id,r.room_code,r.game_number,r.rated,r.result,r.reason,r.player0_score,r.player1_score,
    r.player0_rating_before,r.player1_rating_before,r.player0_rating_after,r.player1_rating_after,r.player0_delta,r.player1_delta,r.created_at,
    u0.username AS player0_username,u1.username AS player1_username,CASE WHEN r.game_json IS NULL THEN 0 ELSE 1 END AS replay_available
    FROM yams_results r JOIN users u0 ON u0.id=r.player0_user_id JOIN users u1 ON u1.id=r.player1_user_id
    WHERE r.player0_user_id=? OR r.player1_user_id=? ORDER BY r.created_at DESC LIMIT 200`).bind(user.id,user.id).all();
  return json({games:results.map(r=>({id:r.id,roomCode:r.room_code,gameNumber:Number(r.game_number),rated:Boolean(r.rated),result:r.result,reason:r.reason,
    player0Score:Number(r.player0_score||0),player1Score:Number(r.player1_score||0),createdAt:r.created_at,player0Username:r.player0_username,player1Username:r.player1_username,
    player0RatingBefore:r.player0_rating_before,player1RatingBefore:r.player1_rating_before,player0RatingAfter:r.player0_rating_after,player1RatingAfter:r.player1_rating_after,
    player0Delta:r.player0_delta,player1Delta:r.player1_delta,replayAvailable:Boolean(r.replay_available)}))});
}
async function yamsGameById(env,user,id){
  const r=await env.DB.prepare(`SELECT r.*,u0.username AS player0_username,u1.username AS player1_username FROM yams_results r
    JOIN users u0 ON u0.id=r.player0_user_id JOIN users u1 ON u1.id=r.player1_user_id
    WHERE r.id=? AND (r.player0_user_id=? OR r.player1_user_id=?)`).bind(id,user.id,user.id).first();
  if(!r) return json({error:"Partie introuvable."},404);
  return json({game:{id:r.id,roomCode:r.room_code,gameNumber:Number(r.game_number),rated:Boolean(r.rated),result:r.result,reason:r.reason,createdAt:r.created_at,
    player0Username:r.player0_username,player1Username:r.player1_username,player0Score:Number(r.player0_score||0),player1Score:Number(r.player1_score||0),
    player0RatingBefore:r.player0_rating_before,player1RatingBefore:r.player1_rating_before,player0RatingAfter:r.player0_rating_after,player1RatingAfter:r.player1_rating_after,
    player0Delta:r.player0_delta,player1Delta:r.player1_delta,replay:r.game_json?JSON.parse(r.game_json):null}});
}

async function game421RatingForUser(env,userId){
  const row=await env.DB.prepare(`SELECT rating,games,wins,draws,losses,updated_at FROM jeu421_ratings WHERE user_id=?`).bind(userId).first();
  return row?{rating:Number(row.rating),games:Number(row.games),wins:Number(row.wins),draws:Number(row.draws),losses:Number(row.losses),updatedAt:row.updated_at}
    :{rating:1200,games:0,wins:0,draws:0,losses:0,updatedAt:null};
}
async function my421Rating(env,user){ return json({rating:await game421RatingForUser(env,user.id)}); }
async function game421Leaderboard(request,env){
  const u=new URL(request.url),limit=clampInt(u.searchParams.get("limit"),1,100,30);
  const {results=[]}=await env.DB.prepare(`SELECT u.username,r.rating,r.games,r.wins,r.draws,r.losses FROM jeu421_ratings r JOIN users u ON u.id=r.user_id WHERE r.games>0 ORDER BY r.rating DESC,r.games DESC,u.username COLLATE NOCASE ASC LIMIT ?`).bind(limit).all();
  return json({players:results});
}
async function list421Games(env,user){
  const {results=[]}=await env.DB.prepare(`SELECT r.id,r.room_code,r.game_number,r.rated,r.result,r.reason,r.player0_tokens,r.player1_tokens,
    r.player0_rating_before,r.player1_rating_before,r.player0_rating_after,r.player1_rating_after,r.player0_delta,r.player1_delta,r.created_at,
    u0.username AS player0_username,u1.username AS player1_username,CASE WHEN r.game_json IS NULL THEN 0 ELSE 1 END AS replay_available
    FROM jeu421_results r JOIN users u0 ON u0.id=r.player0_user_id JOIN users u1 ON u1.id=r.player1_user_id
    WHERE r.player0_user_id=? OR r.player1_user_id=? ORDER BY r.created_at DESC LIMIT 200`).bind(user.id,user.id).all();
  return json({games:results.map(r=>({id:r.id,roomCode:r.room_code,gameNumber:Number(r.game_number),rated:Boolean(r.rated),result:r.result,reason:r.reason,
    player0Tokens:Number(r.player0_tokens||0),player1Tokens:Number(r.player1_tokens||0),createdAt:r.created_at,player0Username:r.player0_username,player1Username:r.player1_username,
    player0RatingBefore:r.player0_rating_before,player1RatingBefore:r.player1_rating_before,player0RatingAfter:r.player0_rating_after,player1RatingAfter:r.player1_rating_after,
    player0Delta:r.player0_delta,player1Delta:r.player1_delta,replayAvailable:Boolean(r.replay_available)}))});
}
async function game421ById(env,user,id){
  const r=await env.DB.prepare(`SELECT r.*,u0.username AS player0_username,u1.username AS player1_username FROM jeu421_results r
    JOIN users u0 ON u0.id=r.player0_user_id JOIN users u1 ON u1.id=r.player1_user_id
    WHERE r.id=? AND (r.player0_user_id=? OR r.player1_user_id=?)`).bind(id,user.id,user.id).first();
  if(!r) return json({error:"Partie introuvable."},404);
  return json({game:{id:r.id,roomCode:r.room_code,gameNumber:Number(r.game_number),rated:Boolean(r.rated),result:r.result,reason:r.reason,createdAt:r.created_at,
    player0Username:r.player0_username,player1Username:r.player1_username,player0Tokens:Number(r.player0_tokens||0),player1Tokens:Number(r.player1_tokens||0),
    player0RatingBefore:r.player0_rating_before,player1RatingBefore:r.player1_rating_before,player0RatingAfter:r.player0_rating_after,player1RatingAfter:r.player1_rating_after,
    player0Delta:r.player0_delta,player1Delta:r.player1_delta,replay:r.game_json?JSON.parse(r.game_json):null}});
}

async function dominoRatingForUser(env,userId){
  try{
    const row=await env.DB.prepare(`SELECT rating,games,wins,draws,losses,updated_at FROM domino_ratings WHERE user_id=?`).bind(userId).first();
    return row?{rating:Number(row.rating),games:Number(row.games),wins:Number(row.wins),draws:Number(row.draws),losses:Number(row.losses),updatedAt:row.updated_at}
      :{rating:1200,games:0,wins:0,draws:0,losses:0,updatedAt:null};
  }catch{return{rating:1200,games:0,wins:0,draws:0,losses:0,updatedAt:null};}
}
async function myDominoRating(env,user){ return json({rating:await dominoRatingForUser(env,user.id)}); }
async function dominoLeaderboard(request,env){
  const u=new URL(request.url),limit=clampInt(u.searchParams.get("limit"),1,100,30);
  try{
    const {results=[]}=await env.DB.prepare(`SELECT u.username,r.rating,r.games,r.wins,r.draws,r.losses FROM domino_ratings r JOIN users u ON u.id=r.user_id WHERE r.games>0 ORDER BY r.rating DESC,r.games DESC,u.username COLLATE NOCASE ASC LIMIT ?`).bind(limit).all();
    return json({players:results});
  }catch{return json({players:[]});}
}
async function listDominoGames(env,user){
  try{
    const {results=[]}=await env.DB.prepare(`SELECT r.id,r.room_code,r.game_number,r.rated,r.result,r.reason,r.player0_score,r.player1_score,
      r.player0_rating_before,r.player1_rating_before,r.player0_rating_after,r.player1_rating_after,r.player0_delta,r.player1_delta,r.created_at,
      u0.username AS player0_username,u1.username AS player1_username,CASE WHEN r.game_json IS NULL THEN 0 ELSE 1 END AS replay_available
      FROM domino_results r JOIN users u0 ON u0.id=r.player0_user_id JOIN users u1 ON u1.id=r.player1_user_id
      WHERE r.player0_user_id=? OR r.player1_user_id=? ORDER BY r.created_at DESC LIMIT 200`).bind(user.id,user.id).all();
    return json({games:results.map(r=>({id:r.id,roomCode:r.room_code,gameNumber:Number(r.game_number),rated:Boolean(r.rated),result:r.result,reason:r.reason,
      player0Score:Number(r.player0_score||0),player1Score:Number(r.player1_score||0),createdAt:r.created_at,player0Username:r.player0_username,player1Username:r.player1_username,
      player0RatingBefore:r.player0_rating_before,player1RatingBefore:r.player1_rating_before,player0RatingAfter:r.player0_rating_after,player1RatingAfter:r.player1_rating_after,
      player0Delta:r.player0_delta,player1Delta:r.player1_delta,replayAvailable:Boolean(r.replay_available)}))});
  }catch{return json({games:[]});}
}
async function dominoGameById(env,user,id){
  try{
    const r=await env.DB.prepare(`SELECT r.*,u0.username AS player0_username,u1.username AS player1_username FROM domino_results r
      JOIN users u0 ON u0.id=r.player0_user_id JOIN users u1 ON u1.id=r.player1_user_id
      WHERE r.id=? AND (r.player0_user_id=? OR r.player1_user_id=?)`).bind(id,user.id,user.id).first();
    if(!r)return json({error:"Partie introuvable."},404);
    return json({game:{id:r.id,roomCode:r.room_code,gameNumber:Number(r.game_number),rated:Boolean(r.rated),result:r.result,reason:r.reason,createdAt:r.created_at,
      player0Username:r.player0_username,player1Username:r.player1_username,player0Score:Number(r.player0_score||0),player1Score:Number(r.player1_score||0),
      player0RatingBefore:r.player0_rating_before,player1RatingBefore:r.player1_rating_before,player0RatingAfter:r.player0_rating_after,player1RatingAfter:r.player1_rating_after,
      player0Delta:r.player0_delta,player1Delta:r.player1_delta,replay:r.game_json?JSON.parse(r.game_json):null}});
  }catch{return json({error:"Partie introuvable."},404);}
}

async function abaloneRatingsForUser(env,userId){
  const {results=[]}=await env.DB.prepare(`SELECT category,rating,games,wins,draws,losses,updated_at FROM abalone_ratings WHERE user_id=?`).bind(userId).all();
  const ratings={};
  for(const category of ["bullet","blitz","rapid","classical"]){
    const row=results.find(r=>r.category===category);
    ratings[category]=row?{rating:Number(row.rating),games:Number(row.games),wins:Number(row.wins),draws:Number(row.draws),losses:Number(row.losses),updatedAt:row.updated_at}
      :{rating:1200,games:0,wins:0,draws:0,losses:0,updatedAt:null};
  }
  return ratings;
}
async function myAbaloneRatings(env,user){ return json({ratings:await abaloneRatingsForUser(env,user.id)}); }
async function abaloneLeaderboard(request,env){
  const u=new URL(request.url);
  const category=["bullet","blitz","rapid","classical"].includes(u.searchParams.get("category"))?u.searchParams.get("category"):"rapid";
  const limit=clampInt(u.searchParams.get("limit"),1,100,30);
  const {results=[]}=await env.DB.prepare(`SELECT u.username,r.rating,r.games,r.wins,r.draws,r.losses FROM abalone_ratings r JOIN users u ON u.id=r.user_id WHERE r.category=? AND r.games>0 ORDER BY r.rating DESC,r.games DESC,u.username COLLATE NOCASE ASC LIMIT ?`).bind(category,limit).all();
  return json({category,label:CHESS_RATING_LABELS[category],players:results});
}
async function listAbaloneGames(env,user){
  const {results=[]}=await env.DB.prepare(`SELECT r.id,r.room_code,r.game_number,r.category,r.rated,r.result,r.reason,
    r.black_rating_before,r.white_rating_before,r.black_rating_after,r.white_rating_after,r.black_delta,r.white_delta,
    r.time_initial_seconds,r.time_increment_seconds,r.created_at,
    ub.username AS black_username,uw.username AS white_username,
    CASE WHEN r.game_json IS NULL THEN 0 ELSE 1 END AS replay_available
    FROM abalone_results r JOIN users ub ON ub.id=r.black_user_id JOIN users uw ON uw.id=r.white_user_id
    WHERE r.black_user_id=? OR r.white_user_id=? ORDER BY r.created_at DESC LIMIT 200`).bind(user.id,user.id).all();
  return json({games:results.map(r=>({
    id:r.id,roomCode:r.room_code,gameNumber:Number(r.game_number),category:r.category,rated:Boolean(r.rated),result:r.result,reason:r.reason,
    createdAt:r.created_at,blackUsername:r.black_username,whiteUsername:r.white_username,
    blackRatingBefore:r.black_rating_before,whiteRatingBefore:r.white_rating_before,blackRatingAfter:r.black_rating_after,whiteRatingAfter:r.white_rating_after,
    blackDelta:r.black_delta,whiteDelta:r.white_delta,initialSeconds:r.time_initial_seconds,incrementSeconds:r.time_increment_seconds,replayAvailable:Boolean(r.replay_available)
  }))});
}
async function abaloneGameById(env,user,id){
  const r=await env.DB.prepare(`SELECT r.*,ub.username AS black_username,uw.username AS white_username FROM abalone_results r
    JOIN users ub ON ub.id=r.black_user_id JOIN users uw ON uw.id=r.white_user_id
    WHERE r.id=? AND (r.black_user_id=? OR r.white_user_id=?)`).bind(id,user.id,user.id).first();
  if(!r) return json({error:"Partie introuvable."},404);
  return json({game:{id:r.id,roomCode:r.room_code,gameNumber:Number(r.game_number),category:r.category,rated:Boolean(r.rated),result:r.result,reason:r.reason,createdAt:r.created_at,
    blackUsername:r.black_username,whiteUsername:r.white_username,initialSeconds:r.time_initial_seconds,incrementSeconds:r.time_increment_seconds,
    blackRatingBefore:r.black_rating_before,whiteRatingBefore:r.white_rating_before,blackRatingAfter:r.black_rating_after,whiteRatingAfter:r.white_rating_after,
    blackDelta:r.black_delta,whiteDelta:r.white_delta,replay:r.game_json?JSON.parse(r.game_json):null}});
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
  if(p==="/api/security/config"&&request.method==="GET") return json({turnstileEnabled:turnstileConfigured(env),turnstileSiteKey:env.TURNSTILE_SITE_KEY||null});
  if(p==="/api/auth/register"&&request.method==="POST") return register(request,env);
  if(p==="/api/auth/login"&&request.method==="POST") return login(request,env);
  if(p==="/api/auth/logout"&&request.method==="POST") return logout(request,env);
  if(p==="/api/auth/me"&&request.method==="GET") return json({user:await currentUser(request,env)});
  if(p==="/api/auth/reset-with-recovery"&&request.method==="POST") return resetWithRecovery(request,env);
  if(p==="/api/auth/forgot-password"&&request.method==="POST") return requestPasswordReset(request,env);
  if(p==="/api/auth/reset-password"&&request.method==="POST") return resetPasswordByEmail(request,env);
  if(p==="/api/auth/verify-email"&&request.method==="POST") return verifyEmail(request,env);

  const auth=await requireUser(request,env); if(auth.response) return auth.response; const user=auth.user;
  if(p==="/api/auth/change-password"&&request.method==="POST") return changePassword(request,env,user);
  if(p==="/api/auth/recovery-key"&&request.method==="POST") return generateRecoveryKey(env,user);
  if(p==="/api/auth/email"&&request.method==="POST") return setAccountEmail(request,env,user);
  if(p==="/api/auth/resend-verification"&&request.method==="POST") return resendEmailVerification(request,env,user);
  if(p==="/api/auth/account"&&request.method==="DELETE") return deleteAccount(request,env,user);
  if(p==="/api/saves"&&request.method==="GET") return listSaves(request,env,user);
  if(p==="/api/saves"&&request.method==="POST") return createSave(request,env,user);
  const saveMatch=p.match(/^\/api\/saves\/([0-9a-f-]{36})$/i); if(saveMatch) return saveById(request,env,user,saveMatch[1]);
  if(p==="/api/ratings/me"&&request.method==="GET") return myChessRatings(env,user);
  if(p==="/api/ratings/chess"&&request.method==="GET") return chessLeaderboard(request,env);
  if(p==="/api/ratings/checkers/me"&&request.method==="GET") return myCheckersRatings(request,env,user);
  if(p==="/api/ratings/checkers"&&request.method==="GET") return checkersLeaderboard(request,env);
  if(p==="/api/ratings/go/me"&&request.method==="GET") return myGoRatings(request,env,user);
  if(p==="/api/ratings/go"&&request.method==="GET") return goLeaderboard(request,env);
  if(p==="/api/ratings/awale/me"&&request.method==="GET") return myAwaleRatings(env,user);
  if(p==="/api/ratings/awale"&&request.method==="GET") return awaleLeaderboard(request,env);
  if(p==="/api/ratings/yams/me"&&request.method==="GET") return myYamsRating(env,user);
  if(p==="/api/ratings/yams"&&request.method==="GET") return yamsLeaderboard(request,env);
  if(p==="/api/ratings/421/me"&&request.method==="GET") return my421Rating(env,user);
  if(p==="/api/ratings/421"&&request.method==="GET") return game421Leaderboard(request,env);
  if(p==="/api/ratings/dominos/me"&&request.method==="GET") return myDominoRating(env,user);
  if(p==="/api/ratings/dominos"&&request.method==="GET") return dominoLeaderboard(request,env);
  if(p==="/api/ratings/abalone/me"&&request.method==="GET") return myAbaloneRatings(env,user);
  if(p==="/api/ratings/abalone"&&request.method==="GET") return abaloneLeaderboard(request,env);
  if(p==="/api/chess/games"&&request.method==="GET") return listChessGames(env,user);
  const chessGameMatch=p.match(/^\/api\/chess\/games\/([0-9a-f-]{36})$/i); if(chessGameMatch&&request.method==="GET") return chessGameById(env,user,chessGameMatch[1]);
  if(p==="/api/checkers/games"&&request.method==="GET") return listCheckersGames(request,env,user);
  const checkersGameMatch=p.match(/^\/api\/checkers\/games\/([0-9a-f-]{36})$/i); if(checkersGameMatch&&request.method==="GET") return checkersGameById(env,user,checkersGameMatch[1]);
  if(p==="/api/go/games"&&request.method==="GET") return listGoGames(request,env,user);
  const goGameMatch=p.match(/^\/api\/go\/games\/([0-9a-f-]{36})$/i); if(goGameMatch&&request.method==="GET") return goGameById(env,user,goGameMatch[1]);
  if(p==="/api/awale/games"&&request.method==="GET") return listAwaleGames(request,env,user);
  const awaleGameMatch=p.match(/^\/api\/awale\/games\/([0-9a-f-]{36})$/i); if(awaleGameMatch&&request.method==="GET") return awaleGameById(env,user,awaleGameMatch[1]);
  if(p==="/api/yams/games"&&request.method==="GET") return listYamsGames(env,user);
  const yamsGameMatch=p.match(/^\/api\/yams\/games\/([0-9a-f-]{36})$/i); if(yamsGameMatch&&request.method==="GET") return yamsGameById(env,user,yamsGameMatch[1]);
  if(p==="/api/421/games"&&request.method==="GET") return list421Games(env,user);
  const game421Match=p.match(/^\/api\/421\/games\/([0-9a-f-]{36})$/i); if(game421Match&&request.method==="GET") return game421ById(env,user,game421Match[1]);
  if(p==="/api/dominos/games"&&request.method==="GET") return listDominoGames(env,user);
  const dominoGameMatch=p.match(/^\/api\/dominos\/games\/([0-9a-f-]{36})$/i); if(dominoGameMatch&&request.method==="GET") return dominoGameById(env,user,dominoGameMatch[1]);
  if(p==="/api/abalone/games"&&request.method==="GET") return listAbaloneGames(env,user);
  const abaloneGameMatch=p.match(/^\/api\/abalone\/games\/([0-9a-f-]{36})$/i); if(abaloneGameMatch&&request.method==="GET") return abaloneGameById(env,user,abaloneGameMatch[1]);
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
      console.error("Erreur serveur Strathasard:", error?.stack || error?.message || error);
      if(url.pathname.startsWith('/api/')){
        return json({error:"Erreur interne du serveur. Consultez les logs Cloudflare."},500);
      }
      throw error;
    }
  }
};
