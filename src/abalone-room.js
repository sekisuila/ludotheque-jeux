import { DurableObject } from "cloudflare:workers";
import { AB_BLACK, AB_WHITE, initialGameState, playServerMove } from "./abalone-engine.js";
import { initialChessGameState, playServerChessMove } from "./chess-engine.js";

const json = (data,status=200) => new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=utf-8"}});
const CHESS_CATEGORIES = new Set(["bullet","blitz","rapid","classical"]);
const ELO_INITIAL = 1200;
const ELO_K = 32;

function formatChessDuration(ms){
  let total=Math.max(0,Math.ceil(Number(ms||0)/1000));
  const hours=Math.floor(total/3600);
  total%=3600;
  const minutes=Math.floor(total/60);
  const seconds=total%60;
  if(hours>0) return `${hours} h ${String(minutes).padStart(2,"0")} min ${String(seconds).padStart(2,"0")} s`;
  if(minutes>0) return `${minutes} min ${String(seconds).padStart(2,"0")} s`;
  return `${seconds} s`;
}

// Ce Durable Object garde son ancien nom "AbaloneRoom" pour rester compatible
// avec le wrangler.jsonc déjà déployé. Il sert de salle générique à plusieurs jeux.
export class AbaloneRoom extends DurableObject {
  constructor(ctx, env){
    super(ctx, env);
    this.ctx = ctx;
    this.env = env;
    this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair("ping","pong"));
  }

  async getGameType(){ return (await this.ctx.storage.get("gameType")) || "abalone"; }
  async getPlayers(){ return (await this.ctx.storage.get("players")) || {black:null,white:null}; }
  async getGame(){
    const stored = await this.ctx.storage.get("game");
    if (stored) return stored;
    return (await this.getGameType()) === "chess" ? initialChessGameState() : initialGameState();
  }
  async getDrawOffer(){ return (await this.ctx.storage.get("drawOffer")) || null; }
  async getRematchOffer(){ return (await this.ctx.storage.get("rematchOffer")) || null; }
  async getChessSettings(){
    return (await this.ctx.storage.get("chessSettings")) || {
      timeControl:{initialSeconds:600,incrementSeconds:0},
      rated:true,
      ratingCategory:"rapid"
    };
  }
  async getGameNumber(){ return Number((await this.ctx.storage.get("gameNumber")) || 1); }
  async getRatingUpdate(){ return (await this.ctx.storage.get("ratingUpdate")) || null; }

  sideForUser(gameType, players, userId){
    if(players.black?.id===userId) return gameType === "chess" ? "b" : AB_BLACK;
    if(players.white?.id===userId) return gameType === "chess" ? "w" : AB_WHITE;
    return null;
  }

  winnerUserId(gameType, winner, players){
    if(gameType === "chess"){
      if(winner === "b") return players.black?.id || null;
      if(winner === "w") return players.white?.id || null;
      return null;
    }
    if(winner === AB_BLACK) return players.black?.id || null;
    if(winner === AB_WHITE) return players.white?.id || null;
    return null;
  }

  async markFinished(winner){
    const code=await this.ctx.storage.get("code");
    if(!this.env.DB || !code) return;
    const gameType=await this.getGameType();
    const players=await this.getPlayers();
    const winnerId=this.winnerUserId(gameType,winner,players);
    await this.env.DB.prepare("UPDATE rooms SET status='finished', winner_user_id=?, updated_at=CURRENT_TIMESTAMP WHERE code=?")
      .bind(winnerId,code).run();
  }

  async markPlaying(players){
    const code=await this.ctx.storage.get("code");
    if(!this.env.DB || !code) return;
    await this.env.DB.prepare("UPDATE rooms SET black_user_id=?, white_user_id=?, status='playing', winner_user_id=NULL, updated_at=CURRENT_TIMESTAMP WHERE code=?")
      .bind(players.black?.id || null, players.white?.id || null, code).run();
  }

  // ----------------------------
  // Pendule serveur des Échecs.
  // ----------------------------
  async initialChessClock(){
    const settings=await this.getChessSettings();
    const initialMs=Math.max(30000,Number(settings.timeControl?.initialSeconds||600)*1000);
    return {
      whiteMs:initialMs,
      blackMs:initialMs,
      runningSide:null,
      lastStartedAt:null,
      started:false
    };
  }

  async getChessClock(){
    let clock=await this.ctx.storage.get("chessClock");
    if(!clock){
      clock=await this.initialChessClock();
      await this.ctx.storage.put("chessClock",clock);
    }
    return clock;
  }

  clockKey(side){ return side === "w" ? "whiteMs" : "blackMs"; }

  async clockSnapshot(now=Date.now()){
    if((await this.getGameType())!=="chess") return null;
    const clock={...(await this.getChessClock())};
    if(clock.started && clock.runningSide && clock.lastStartedAt){
      const key=this.clockKey(clock.runningSide);
      clock[key]=Math.max(0,Number(clock[key]||0)-Math.max(0,now-Number(clock.lastStartedAt)));
    }
    return {...clock,serverNow:now};
  }

  async settleClock(now=Date.now()){
    const clock=await this.getChessClock();
    if(!clock.started || !clock.runningSide || !clock.lastStartedAt) return {clock,flagged:null};
    const side=clock.runningSide;
    const key=this.clockKey(side);
    const elapsed=Math.max(0,now-Number(clock.lastStartedAt));
    clock[key]=Math.max(0,Number(clock[key]||0)-elapsed);
    clock.lastStartedAt=now;
    const flagged=clock[key]<=0 ? side : null;
    if(flagged){
      clock[key]=0;
      clock.started=false;
      clock.runningSide=null;
      clock.lastStartedAt=null;
    }
    await this.ctx.storage.put("chessClock",clock);
    return {clock,flagged};
  }

  async scheduleClockAlarm(clock=null){
    if((await this.getGameType())!=="chess") return;
    clock=clock || await this.getChessClock();
    if(!clock.started || !clock.runningSide){
      try{ await this.ctx.storage.deleteAlarm(); }catch{}
      return;
    }
    const key=this.clockKey(clock.runningSide);
    const remaining=Math.max(1,Number(clock[key]||0));
    await this.ctx.storage.setAlarm(Date.now()+remaining+25);
  }

  async stopClock(){
    if((await this.getGameType())!=="chess") return null;
    const {clock}=await this.settleClock(Date.now());
    clock.started=false;
    clock.runningSide=null;
    clock.lastStartedAt=null;
    await this.ctx.storage.put("chessClock",clock);
    try{ await this.ctx.storage.deleteAlarm(); }catch{}
    return clock;
  }

  bothPlayersConnected(players){
    const ids=new Set(this.ctx.getWebSockets().map(ws=>ws.deserializeAttachment()?.userId).filter(Boolean));
    return Boolean(players.black?.id && players.white?.id && ids.has(players.black.id) && ids.has(players.white.id));
  }

  async maybeStartChessClock(){
    if((await this.getGameType())!=="chess") return;
    const game=await this.getGame();
    if(game?.result?.over) return;
    const players=await this.getPlayers();
    if(!this.bothPlayersConnected(players)) return;
    const clock=await this.getChessClock();
    if(clock.started) return;
    // Une pendule neuve démarre sur le trait courant dès que les deux joueurs
    // sont réellement connectés. Une pendule arrêtée après une fin de partie
    // n'est jamais relancée car game.result.over est testé plus haut.
    clock.started=true;
    clock.runningSide=game?.state?.turn || "w";
    clock.lastStartedAt=Date.now();
    await this.ctx.storage.put("chessClock",clock);
    await this.scheduleClockAlarm(clock);
    await this.broadcast({type:"clock",gameType:"chess",clock:await this.clockSnapshot()});
  }

  async resetChessClock(){
    const clock=await this.initialChessClock();
    await this.ctx.storage.put("chessClock",clock);
    try{ await this.ctx.storage.deleteAlarm(); }catch{}
    return clock;
  }

  // ----------------------------
  // Classement Elo des Échecs.
  // ----------------------------
  async currentRating(userId,category){
    const row=await this.env.DB.prepare("SELECT rating,games,wins,draws,losses FROM chess_ratings WHERE user_id=? AND category=?")
      .bind(userId,category).first();
    return row?{
      rating:Number(row.rating),games:Number(row.games),wins:Number(row.wins),draws:Number(row.draws),losses:Number(row.losses)
    }:{rating:ELO_INITIAL,games:0,wins:0,draws:0,losses:0};
  }

  async roomRatings(){
    if((await this.getGameType())!=="chess") return null;
    const settings=await this.getChessSettings();
    const category=CHESS_CATEGORIES.has(settings.ratingCategory)?settings.ratingCategory:"rapid";
    const players=await this.getPlayers();
    return {
      category,
      white:players.white ? await this.currentRating(players.white.id,category) : null,
      black:players.black ? await this.currentRating(players.black.id,category) : null
    };
  }

  eloExpected(a,b){ return 1/(1+Math.pow(10,(b-a)/400)); }

  async recordChessResult(game,reason){
    const settings=await this.getChessSettings();
    if(!settings.rated) return null;
    const players=await this.getPlayers();
    if(!players.white?.id || !players.black?.id) return null;
    const code=await this.ctx.storage.get("code");
    const gameNumber=await this.getGameNumber();
    if(!code) return null;

    const already=await this.env.DB.prepare("SELECT id FROM chess_results WHERE room_code=? AND game_number=?")
      .bind(code,gameNumber).first();
    if(already) return await this.getRatingUpdate();

    const category=CHESS_CATEGORIES.has(settings.ratingCategory)?settings.ratingCategory:"rapid";
    await this.env.DB.batch([
      this.env.DB.prepare("INSERT OR IGNORE INTO chess_ratings(user_id,category,rating) VALUES(?,?,?)")
        .bind(players.white.id,category,ELO_INITIAL),
      this.env.DB.prepare("INSERT OR IGNORE INTO chess_ratings(user_id,category,rating) VALUES(?,?,?)")
        .bind(players.black.id,category,ELO_INITIAL)
    ]);

    const white=await this.currentRating(players.white.id,category);
    const black=await this.currentRating(players.black.id,category);
    const winner=game?.result?.winner ?? null;
    const scoreWhite=winner==="w"?1:winner==="b"?0:0.5;
    const expectedWhite=this.eloExpected(white.rating,black.rating);
    let whiteDelta=Math.round(ELO_K*(scoreWhite-expectedWhite));
    let blackDelta=-whiteDelta;
    const whiteAfter=Math.max(100,white.rating+whiteDelta);
    const blackAfter=Math.max(100,black.rating+blackDelta);
    whiteDelta=whiteAfter-white.rating;
    blackDelta=blackAfter-black.rating;

    const whiteWin=scoreWhite===1?1:0, blackWin=scoreWhite===0?1:0, isDraw=scoreWhite===0.5?1:0;
    const result=scoreWhite===1?"1-0":scoreWhite===0?"0-1":"1/2-1/2";
    const resultId=crypto.randomUUID();

    await this.env.DB.batch([
      this.env.DB.prepare(`UPDATE chess_ratings SET rating=?,games=games+1,wins=wins+?,draws=draws+?,losses=losses+?,updated_at=CURRENT_TIMESTAMP
        WHERE user_id=? AND category=?`)
        .bind(whiteAfter,whiteWin,isDraw,blackWin,players.white.id,category),
      this.env.DB.prepare(`UPDATE chess_ratings SET rating=?,games=games+1,wins=wins+?,draws=draws+?,losses=losses+?,updated_at=CURRENT_TIMESTAMP
        WHERE user_id=? AND category=?`)
        .bind(blackAfter,blackWin,isDraw,whiteWin,players.black.id,category),
      this.env.DB.prepare(`INSERT INTO chess_results(
        id,room_code,game_number,white_user_id,black_user_id,category,rated,result,reason,
        white_rating_before,black_rating_before,white_rating_after,black_rating_after,white_delta,black_delta
      ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
        .bind(resultId,code,gameNumber,players.white.id,players.black.id,category,1,result,String(reason||"game"),
          white.rating,black.rating,whiteAfter,blackAfter,whiteDelta,blackDelta)
    ]);

    const update={
      rated:true,category,result,reason:String(reason||"game"),gameNumber,
      white:{username:players.white.username,before:white.rating,after:whiteAfter,delta:whiteDelta},
      black:{username:players.black.username,before:black.rating,after:blackAfter,delta:blackDelta}
    };
    await this.ctx.storage.put("ratingUpdate",update);
    return update;
  }

  async archiveChessGame(game,reason){
    const players=await this.getPlayers();
    const code=await this.ctx.storage.get("code");
    const gameNumber=await this.getGameNumber();
    if(!this.env.DB || !code || !players.white?.id || !players.black?.id) return;
    const settings=await this.getChessSettings();
    const winner=game?.result?.winner ?? null;
    const result=winner==="w"?"1-0":winner==="b"?"0-1":"1/2-1/2";
    const initialSeconds=Math.max(0,Number(settings.timeControl?.initialSeconds||0));
    const incrementSeconds=Math.max(0,Number(settings.timeControl?.incrementSeconds||0));
    const existing=await this.env.DB.prepare("SELECT id FROM chess_results WHERE room_code=? AND game_number=?")
      .bind(code,gameNumber).first();
    if(existing){
      await this.env.DB.prepare(`UPDATE chess_results SET game_json=?,time_initial_seconds=?,time_increment_seconds=?,reason=?,result=? WHERE id=?`)
        .bind(JSON.stringify(game),initialSeconds,incrementSeconds,String(reason||"game"),result,existing.id).run();
      return;
    }
    await this.env.DB.prepare(`INSERT INTO chess_results(
      id,room_code,game_number,white_user_id,black_user_id,category,rated,result,reason,game_json,time_initial_seconds,time_increment_seconds
    ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`)
      .bind(crypto.randomUUID(),code,gameNumber,players.white.id,players.black.id,
        CHESS_CATEGORIES.has(settings.ratingCategory)?settings.ratingCategory:"rapid",settings.rated?1:0,result,String(reason||"game"),
        JSON.stringify(game),initialSeconds,incrementSeconds).run();
  }

  async finishChessGame(game,reason){
    await this.stopClock();
    await this.ctx.storage.put("game",game);
    await this.ctx.storage.delete(["drawOffer","rematchOffer"]);
    await this.markFinished(game?.result?.winner ?? null);
    const ratingUpdate=await this.recordChessResult(game,reason);
    await this.archiveChessGame(game,reason);
    return ratingUpdate;
  }

  async finishOnTime(flaggedSide){
    const game=await this.getGame();
    if(game?.result?.over) return;

    // On capture l'état de la pendule AVANT d'arrêter officiellement la partie.
    // Cela permet d'indiquer dans le message final combien de temps il restait
    // exactement au vainqueur lorsque l'adversaire est tombé à zéro.
    const clock=await this.clockSnapshot();
    const players=await this.getPlayers();
    const winner=flaggedSide==="w"?"b":"w";
    const winnerPlayer=winner==="w"?players.white:players.black;
    const loserPlayer=flaggedSide==="w"?players.white:players.black;
    const winnerName=winnerPlayer?.username || (winner==="w"?"les Blancs":"les Noirs");
    const loserName=loserPlayer?.username || (flaggedSide==="w"?"les Blancs":"les Noirs");
    const winnerRemainingMs=winner==="w"?Number(clock?.whiteMs||0):Number(clock?.blackMs||0);
    const remainingText=formatChessDuration(winnerRemainingMs);

    game.result={
      over:true,
      type:"timeout",
      winner,
      winnerUsername:winnerPlayer?.username || null,
      loserUsername:loserPlayer?.username || null,
      winnerRemainingMs,
      text:`La partie se termine par la victoire de ${winnerName} par manque de temps de ${loserName}. Il reste ${remainingText} à ${winnerName}.`
    };
    const ratingUpdate=await this.finishChessGame(game,"timeout");
    await this.broadcast({
      type:"state",gameType:"chess",game,clock:await this.clockSnapshot(),
      settings:await this.getChessSettings(),ratings:await this.roomRatings(),ratingUpdate
    });
  }

  async alarm(){
    if((await this.getGameType())!=="chess") return;
    const game=await this.getGame();
    if(game?.result?.over) return;
    const {clock,flagged}=await this.settleClock(Date.now());
    if(flagged){
      await this.finishOnTime(flagged);
      return;
    }
    await this.scheduleClockAlarm(clock);
  }

  async fetch(request){
    const url = new URL(request.url);

    if(request.method==="POST" && url.pathname==="/init"){
      const body=await request.json();
      const existing=await this.ctx.storage.get("players");
      if(!existing){
        const gameType=body.game === "chess" ? "chess" : "abalone";
        const creatorSlot = gameType === "chess" && body.creatorSide === "w" ? "white" : "black";
        const players={black:null,white:null};
        players[creatorSlot]={id:body.userId,username:body.username};
        await this.ctx.storage.put("gameType",gameType);
        await this.ctx.storage.put("players",players);
        await this.ctx.storage.put("game",gameType === "chess" ? initialChessGameState() : initialGameState());
        await this.ctx.storage.put("code",body.code);
        await this.ctx.storage.put("gameNumber",1);
        await this.ctx.storage.delete(["drawOffer","rematchOffer","ratingUpdate"]);
        if(gameType==="chess"){
          const initialSeconds=Math.min(10800,Math.max(30,Number(body.timeControl?.initialSeconds||600)));
          const incrementSeconds=Math.min(60,Math.max(0,Number(body.timeControl?.incrementSeconds||0)));
          const category=CHESS_CATEGORIES.has(body.ratingCategory)?body.ratingCategory:"rapid";
          await this.ctx.storage.put("chessSettings",{
            timeControl:{initialSeconds,incrementSeconds},
            rated:body.rated!==false,
            ratingCategory:category
          });
          await this.resetChessClock();
        }
      }
      return json({ok:true});
    }

    if(request.method==="POST" && url.pathname==="/join"){
      const body=await request.json();
      const players=await this.getPlayers();
      if(players.black?.id===body.userId || players.white?.id===body.userId) return json({ok:true,players});
      if(players.black && players.white) return json({error:"Ce salon est complet."},409);
      const slot = body.side === "black" ? "black" : body.side === "white" ? "white" : (!players.black ? "black" : "white");
      if(players[slot]) return json({error:"Cette couleur est déjà occupée."},409);
      players[slot]={id:body.userId,username:body.username};
      await this.ctx.storage.put("players",players);
      await this.broadcast({
        type:"players",players,gameType:await this.getGameType(),
        clock:await this.clockSnapshot(),settings:await this.getChessSettings(),ratings:await this.roomRatings()
      });
      return json({ok:true,players});
    }

    if(request.method==="GET" && url.pathname==="/state"){
      return json({
        gameType:await this.getGameType(),players:await this.getPlayers(),game:await this.getGame(),
        drawOffer:await this.getDrawOffer(),rematchOffer:await this.getRematchOffer(),
        clock:await this.clockSnapshot(),settings:await this.getChessSettings(),ratings:await this.roomRatings(),
        ratingUpdate:await this.getRatingUpdate()
      });
    }

    if(url.pathname==="/ws"){
      if(request.headers.get("Upgrade")!=="websocket") return new Response("WebSocket requis",{status:426});
      const userId=request.headers.get("x-ludo-user-id");
      const username=request.headers.get("x-ludo-username")||"Joueur";
      const players=await this.getPlayers();
      const gameType=await this.getGameType();
      const side=this.sideForUser(gameType,players,userId);
      if(side===null) return new Response("Vous ne participez pas à cette partie.",{status:403});

      const pair=new WebSocketPair();
      const [client,server]=Object.values(pair);
      this.ctx.acceptWebSocket(server);
      server.serializeAttachment({userId,username,side,gameType});
      if(gameType==="chess") await this.maybeStartChessClock();
      server.send(JSON.stringify({
        type:"welcome",gameType,side,players,game:await this.getGame(),
        drawOffer:await this.getDrawOffer(),rematchOffer:await this.getRematchOffer(),
        clock:await this.clockSnapshot(),settings:gameType==="chess"?await this.getChessSettings():null,
        ratings:gameType==="chess"?await this.roomRatings():null,ratingUpdate:await this.getRatingUpdate()
      }));
      await this.broadcastPresence();
      return new Response(null,{status:101,webSocket:client});
    }

    return new Response("Not found",{status:404});
  }

  async webSocketMessage(ws,message){
    let data;
    try { data=JSON.parse(typeof message==="string"?message:new TextDecoder().decode(message)); }
    catch { ws.send(JSON.stringify({type:"error",message:"Message invalide."})); return; }

    const session=ws.deserializeAttachment();
    const gameType=session?.gameType || await this.getGameType();

    if(data.type==="move"){
      const game=await this.getGame();
      let result;

      if(gameType === "chess"){
        const players=await this.getPlayers();
        if(!players.black || !players.white){ ws.send(JSON.stringify({type:"error",message:"Attendez le deuxième joueur."})); return; }
        await this.maybeStartChessClock();
        const now=Date.now();
        const settled=await this.settleClock(now);
        if(settled.flagged){ await this.finishOnTime(settled.flagged); return; }
        result=playServerChessMove(game,session.side,data.move||{});
        if(!result.ok){
          await this.scheduleClockAlarm(settled.clock);
          ws.send(JSON.stringify({type:"error",message:result.error}));
          return;
        }

        const settings=await this.getChessSettings();
        const clock=settled.clock;
        const moverKey=this.clockKey(session.side);
        clock[moverKey]=Number(clock[moverKey]||0)+Number(settings.timeControl?.incrementSeconds||0)*1000;
        if(result.state?.result?.over){
          clock.started=false; clock.runningSide=null; clock.lastStartedAt=null;
          await this.ctx.storage.put("chessClock",clock);
          try{ await this.ctx.storage.deleteAlarm(); }catch{}
        }else{
          clock.started=true;
          clock.runningSide=result.state?.state?.turn || (session.side==="w"?"b":"w");
          clock.lastStartedAt=now;
          await this.ctx.storage.put("chessClock",clock);
          await this.scheduleClockAlarm(clock);
        }
      }else{
        result=playServerMove(game,session.side,Array.isArray(data.group)?data.group:[],Number(data.dir));
      }

      if(!result.ok){ ws.send(JSON.stringify({type:"error",message:result.error})); return; }
      await this.ctx.storage.put("game",result.state);

      if(gameType === "chess"){
        const offer=await this.getDrawOffer();
        if(offer && offer.userId!==session.userId){
          await this.ctx.storage.delete("drawOffer");
          await this.broadcast({type:"draw_declined",bySide:session.side,implicit:true});
        }
      }

      const finished = gameType === "chess" ? Boolean(result.state?.result?.over) : Boolean(result.state?.over);
      const winner = gameType === "chess" ? result.state?.result?.winner : result.state?.winner;
      let ratingUpdate=null;
      if(finished){
        await this.ctx.storage.delete(["drawOffer","rematchOffer"]);
        if(gameType==="chess") ratingUpdate=await this.finishChessGame(result.state,result.state?.result?.type||"game");
        else await this.markFinished(winner ?? null);
      }

      await this.broadcast({
        type:"state",gameType,game:result.state,lastMove:result.move,
        clock:gameType==="chess"?await this.clockSnapshot():null,
        settings:gameType==="chess"?await this.getChessSettings():null,
        ratings:gameType==="chess"?await this.roomRatings():null,
        ratingUpdate
      });
      return;
    }

    if(data.type==="resign"){
      const game=await this.getGame();

      if(gameType === "chess"){
        if(game?.result?.over) return;
        const players=await this.getPlayers();
        if(!players.black || !players.white){ ws.send(JSON.stringify({type:"error",message:"La partie n’a pas encore commencé."})); return; }
        const winner=session.side === "w" ? "b" : "w";
        const resignedColor=session.side === "w" ? "Les Blancs" : "Les Noirs";
        const winnerColor=winner === "w" ? "les Blancs" : "les Noirs";
        game.result={over:true,type:"resign",winner,text:`${resignedColor} abandonnent : ${winnerColor} gagnent.`};
        const ratingUpdate=await this.finishChessGame(game,"resign");
        await this.broadcast({
          type:"state",gameType,game,resigned:session.side,clock:await this.clockSnapshot(),
          settings:await this.getChessSettings(),ratings:await this.roomRatings(),ratingUpdate
        });
        return;
      }

      if(game.over) return;
      game.over=true;
      game.winner=session.side===AB_BLACK?AB_WHITE:AB_BLACK;
      await this.ctx.storage.put("game",game);
      await this.markFinished(game.winner);
      await this.broadcast({type:"state",gameType,game,resigned:session.side});
      return;
    }

    if(data.type==="draw_offer"){
      if(gameType!=="chess"){ ws.send(JSON.stringify({type:"error",message:"Action réservée aux Échecs."})); return; }
      const game=await this.getGame();
      const players=await this.getPlayers();
      if(game?.result?.over){ ws.send(JSON.stringify({type:"error",message:"La partie est terminée."})); return; }
      if(!players.black || !players.white){ ws.send(JSON.stringify({type:"error",message:"Attendez le deuxième joueur."})); return; }
      const existing=await this.getDrawOffer();
      if(existing){ ws.send(JSON.stringify({type:"error",message:"Une proposition de nulle est déjà en attente."})); return; }
      const offer={userId:session.userId,side:session.side,username:session.username,createdAt:Date.now()};
      await this.ctx.storage.put("drawOffer",offer);
      await this.broadcast({type:"draw_offer",offer});
      return;
    }

    if(data.type==="draw_response"){
      if(gameType!=="chess") return;
      const offer=await this.getDrawOffer();
      if(!offer || offer.userId===session.userId){ ws.send(JSON.stringify({type:"error",message:"Aucune proposition de nulle à laquelle répondre."})); return; }
      const accept=data.accept===true;
      await this.ctx.storage.delete("drawOffer");
      if(!accept){
        await this.broadcast({type:"draw_declined",bySide:session.side,implicit:false});
        return;
      }
      const game=await this.getGame();
      if(game?.result?.over) return;
      game.result={over:true,type:"draw-agreement",winner:null,text:"Partie nulle d’un commun accord."};
      const ratingUpdate=await this.finishChessGame(game,"draw-agreement");
      await this.broadcast({
        type:"state",gameType,game,drawAccepted:true,clock:await this.clockSnapshot(),
        settings:await this.getChessSettings(),ratings:await this.roomRatings(),ratingUpdate
      });
      return;
    }

    if(data.type==="rematch_offer"){
      if(gameType!=="chess"){ ws.send(JSON.stringify({type:"error",message:"Action réservée aux Échecs."})); return; }
      const game=await this.getGame();
      const players=await this.getPlayers();
      if(!game?.result?.over){ ws.send(JSON.stringify({type:"error",message:"La partie doit être terminée avant de proposer une revanche."})); return; }
      if(!players.black || !players.white){ ws.send(JSON.stringify({type:"error",message:"Le deuxième joueur n’est plus disponible."})); return; }
      const existing=await this.getRematchOffer();
      if(existing){ ws.send(JSON.stringify({type:"error",message:"Une proposition de revanche est déjà en attente."})); return; }
      const offer={userId:session.userId,side:session.side,username:session.username,createdAt:Date.now()};
      await this.ctx.storage.put("rematchOffer",offer);
      await this.broadcast({type:"rematch_offer",offer});
      return;
    }

    if(data.type==="rematch_response"){
      if(gameType!=="chess") return;
      const offer=await this.getRematchOffer();
      if(!offer || offer.userId===session.userId){ ws.send(JSON.stringify({type:"error",message:"Aucune proposition de revanche à laquelle répondre."})); return; }
      const accept=data.accept===true;
      await this.ctx.storage.delete("rematchOffer");
      if(!accept){
        await this.broadcast({type:"rematch_declined",bySide:session.side});
        return;
      }

      const players=await this.getPlayers();
      const swapped={black:players.white,white:players.black};
      const newGame=initialChessGameState();
      const nextGameNumber=(await this.getGameNumber())+1;
      await this.ctx.storage.put("players",swapped);
      await this.ctx.storage.put("game",newGame);
      await this.ctx.storage.put("gameNumber",nextGameNumber);
      await this.ctx.storage.delete(["drawOffer","ratingUpdate"]);
      await this.resetChessClock();
      await this.markPlaying(swapped);

      for(const socket of this.ctx.getWebSockets()){
        const att=socket.deserializeAttachment();
        if(!att) continue;
        const side=this.sideForUser("chess",swapped,att.userId);
        socket.serializeAttachment({...att,side,gameType:"chess"});
      }
      await this.maybeStartChessClock();

      const clock=await this.clockSnapshot();
      const settings=await this.getChessSettings();
      const ratings=await this.roomRatings();
      for(const socket of this.ctx.getWebSockets()){
        const att=socket.deserializeAttachment();
        if(!att) continue;
        const side=this.sideForUser("chess",swapped,att.userId);
        try{
          socket.send(JSON.stringify({type:"rematch_started",gameType:"chess",side,players:swapped,game:newGame,clock,settings,ratings}));
        }catch{}
      }
      return;
    }

    if(data.type==="sync"){
      ws.send(JSON.stringify({
        type:"state",gameType,game:await this.getGame(),players:await this.getPlayers(),
        drawOffer:await this.getDrawOffer(),rematchOffer:await this.getRematchOffer(),
        clock:await this.clockSnapshot(),settings:gameType==="chess"?await this.getChessSettings():null,
        ratings:gameType==="chess"?await this.roomRatings():null,ratingUpdate:await this.getRatingUpdate()
      }));
    }
  }

  async webSocketClose(ws,code,reason){
    try{ ws.close(code,reason); }catch{}
    await this.broadcastPresence();
  }

  async broadcast(payload){
    const text=JSON.stringify(payload);
    for(const ws of this.ctx.getWebSockets()){
      try{ ws.send(text); }catch{}
    }
  }

  async broadcastPresence(){
    const connected=this.ctx.getWebSockets().map(ws=>ws.deserializeAttachment()).filter(Boolean);
    await this.broadcast({type:"presence",gameType:await this.getGameType(),connected:connected.map(x=>({userId:x.userId,username:x.username,side:x.side}))});
  }
}
