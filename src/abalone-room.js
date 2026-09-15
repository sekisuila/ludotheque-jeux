import { DurableObject } from "cloudflare:workers";
import { AB_BLACK, AB_WHITE, initialGameState, playServerMove } from "./abalone-engine.js";

const json = (data,status=200) => new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=utf-8"}});

export class AbaloneRoom extends DurableObject {
  constructor(ctx, env){
    super(ctx, env);
    this.ctx = ctx;
    this.env = env;
    this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair("ping","pong"));
  }

  async getPlayers(){ return (await this.ctx.storage.get("players")) || {black:null,white:null}; }
  async getGame(){ return (await this.ctx.storage.get("game")) || initialGameState(); }

  async fetch(request){
    const url = new URL(request.url);
    if(request.method==="POST" && url.pathname==="/init"){
      const body=await request.json();
      const existing=await this.ctx.storage.get("players");
      if(!existing){
        await this.ctx.storage.put("players",{black:{id:body.userId,username:body.username},white:null});
        await this.ctx.storage.put("game",initialGameState());
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
      await this.broadcast({type:"players",players});
      return json({ok:true,players});
    }
    if(request.method==="GET" && url.pathname==="/state"){
      return json({players:await this.getPlayers(),game:await this.getGame()});
    }
    if(url.pathname==="/ws"){
      if(request.headers.get("Upgrade")!=="websocket") return new Response("WebSocket requis",{status:426});
      const userId=request.headers.get("x-ludo-user-id");
      const username=request.headers.get("x-ludo-username")||"Joueur";
      const players=await this.getPlayers();
      let side=null;
      if(players.black?.id===userId) side=AB_BLACK;
      if(players.white?.id===userId) side=AB_WHITE;
      if(!side) return new Response("Vous ne participez pas à cette partie.",{status:403});
      const pair=new WebSocketPair();
      const [client,server]=Object.values(pair);
      this.ctx.acceptWebSocket(server);
      server.serializeAttachment({userId,username,side});
      server.send(JSON.stringify({type:"welcome",side,players,game:await this.getGame()}));
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
    if(data.type==="move"){
      const game=await this.getGame();
      const result=playServerMove(game,session.side,Array.isArray(data.group)?data.group:[],Number(data.dir));
      if(!result.ok){ ws.send(JSON.stringify({type:"error",message:result.error})); return; }
      await this.ctx.storage.put("game",result.state);
      const code=await this.ctx.storage.get("code");
      if(result.state.over && this.env.DB && code){
        const players=await this.getPlayers();
        const winnerId=result.state.winner===AB_BLACK?players.black?.id:players.white?.id;
        await this.env.DB.prepare("UPDATE rooms SET status='finished', winner_user_id=?, updated_at=CURRENT_TIMESTAMP WHERE code=?").bind(winnerId||null,code).run();
      }
      await this.broadcast({type:"state",game:result.state,lastMove:result.move});
      return;
    }
    if(data.type==="resign"){
      const game=await this.getGame();
      if(game.over) return;
      game.over=true; game.winner=session.side===AB_BLACK?AB_WHITE:AB_BLACK;
      await this.ctx.storage.put("game",game);
      const code=await this.ctx.storage.get("code");
      if(this.env.DB && code){
        const players=await this.getPlayers();
        const winnerId=game.winner===AB_BLACK?players.black?.id:players.white?.id;
        await this.env.DB.prepare("UPDATE rooms SET status='finished', winner_user_id=?, updated_at=CURRENT_TIMESTAMP WHERE code=?").bind(winnerId||null,code).run();
      }
      await this.broadcast({type:"state",game,resigned:session.side});
      return;
    }
    if(data.type==="sync") ws.send(JSON.stringify({type:"state",game:await this.getGame(),players:await this.getPlayers()}));
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
    await this.broadcast({type:"presence",connected:connected.map(x=>({userId:x.userId,username:x.username,side:x.side}))});
  }
}
