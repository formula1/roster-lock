
import { IncomingMessage, Server } from "http";
import { WebSocketServer, WebSocket } from 'ws';
import { Duplex } from "stream";
import { WebSocketRouter, WSRequest } from "./utils/websocket-router";

export class MatchAgentServer {
  private httpServer: Server;
  private wss: WebSocketServer;
  private router = new WebSocketRouter();
  constructor(){
    this.httpServer = new Server();
    this.wss = new WebSocketServer({ server: this.httpServer });
    this.httpServer.on('upgrade', async (request, socket, head)=>{
      const ws = await (async ()=>{
        try {
          if(!request.url) throw new Error("No URL");
          const url = new URL(request.url, "ws://localhost");
          const ws = await handleUpgrade(this.wss, request, socket, head) as WSRequest;
          ws.httpRequest = request;
          return ws;
        }catch(e){
          console.log("Failed to upgrade connection", e);
          socket.destroy();
          throw e;
        }
      })()
      try {
        await routeRequest(this.router, ws);
      }catch(e){
        console.log("Failed to route request", e);
        ws.terminate();
      }
    });
  }
  use(...args: Parameters<WebSocketRouter["use"]>){
    this.router.use(...args);
    return this;
  }
  mount(...args: Parameters<WebSocketRouter["mount"]>){
    this.router.mount(...args);
    return this;
  }
  listen(...args: Parameters<Server["listen"]>){
    return this.httpServer.listen(...args);
  }
  close(...args: Parameters<Server["close"]>){
    return this.httpServer.close(...args);
  }
}

function handleUpgrade(wss: WebSocketServer, request: IncomingMessage, socket: Duplex, head: Buffer){
  return new Promise<WebSocket>((resolve, reject)=>{
    wss.handleUpgrade(request, socket, head, function done(ws) {
      resolve(ws);
    });
  });
}

function routeRequest(router: WebSocketRouter, request: WSRequest){
  return new Promise((_, reject)=>{
    router.handleRequest(request, (err)=>{
      if(err) return reject(err);
      reject(new Error("No route found"));
    });
  });
}
