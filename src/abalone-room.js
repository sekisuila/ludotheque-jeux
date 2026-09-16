import { DurableObject } from "cloudflare:workers";
import { AB_BLACK, AB_WHITE, initialGameState, playServerMove } from "./abalone-engine.js";
import { initialChessGameState, playServerChessMove } from "./chess-engine.js";

const json = (data,status=200) => new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=utf-8"}});

// Ce Durable Object garde son ancien nom "AbaloneRoom" afin de rester
// compatible avec le wrangler.jsonc déjà déployé. Il sert maintenant de
// salle générique pour Abalone ET les Échecs.
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

  async fetch(request){
    const url = new URL(request.url);

    if(request.method==="POST" && url.pathname==="/init"){
      const body=await request.json();
      const existing=await this.ctx.storage.get("players");
      if(!existing){
        const gameType=body.game === "chess" ? "chess" : "abalone";
        await this.ctx.storage.put("gameType",gameType);
        await this.ctx.storage.put("players",{black:{id:body.userId,username:body.username},white:null});
        await this.ctx.storage.put("game",gameType === "chess" ? initialChessGameState() : initialGameState());
        await this.ctx.storage.put("code",body.code);
      }
      return json({ok:true});
    }

    if(request.method==="POST" && url.pathname==="/join"){
      const body=await request.json();
      const players=await this.getPlayers();
      if(players.black?.id===body.userId || players.white?.id===body.userId) return json({ok:true,players});
      if(players.white) return json({error:"Ce salon est complet."},409);
      players.white={id:body.userId,username:body.username};
      await this.ctx.storage.put("players",players);
      await this.broadcast({type:"players",players,gameType:await this.getGameType()});
      return json({ok:true,players});
    }

    if(request.method==="GET" && url.pathname==="/state"){
      return json({gameType:await this.getGameType(),players:await this.getPlayers(),game:await this.getGame()});
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
      server.send(JSON.stringify({type:"welcome",gameType,side,players,game:await this.getGame()}));
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
        result=playServerChessMove(game,session.side,data.move||{});
      }else{
        result=playServerMove(game,session.side,Array.isArray(data.group)?data.group:[],Number(data.dir));
      }

      if(!result.ok){ ws.send(JSON.stringify({type:"error",message:result.error})); return; }
      await this.ctx.storage.put("game",result.state);

      const finished = gameType === "chess" ? Boolean(result.state?.result?.over) : Boolean(result.state?.over);
      const winner = gameType === "chess" ? result.state?.result?.winner : result.state?.winner;
      if(finished) await this.markFinished(winner ?? null);

      await this.broadcast({type:"state",gameType,game:result.state,lastMove:result.move});
      return;
    }

    if(data.type==="resign"){
      const game=await this.getGame();

      if(gameType === "chess"){
        if(game?.result?.over) return;
        const winner=session.side === "w" ? "b" : "w";
        const resignedColor=session.side === "w" ? "Les Blancs" : "Les Noirs";
        const winnerColor=winner === "w" ? "les Blancs" : "les Noirs";
        game.result={over:true,type:"resign",winner,text:`${resignedColor} abandonnent : ${winnerColor} gagnent.`};
        await this.ctx.storage.put("game",game);
        await this.markFinished(winner);
        await this.broadcast({type:"state",gameType,game,resigned:session.side});
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

    if(data.type==="sync"){
      ws.send(JSON.stringify({type:"state",gameType,game:await this.getGame(),players:await this.getPlayers()}));
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
