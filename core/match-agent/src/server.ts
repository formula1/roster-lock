
import { IncomingMessage, Server } from "http";
import { WebSocketServer, WebSocket } from 'ws';
import { Duplex } from "stream";
import { WebSocketRouter, WSRequest } from "./utils/websocket-router";
import { HTTPRouter, HTTPError } from "./utils/http-router";

export class MatchAgentServer {
  private httpServer: Server;
  private wss: WebSocketServer;
  public wsRouter = new WebSocketRouter();
  public httpRouter = new HTTPRouter();
  constructor(){
    this.httpServer = new Server();
    this.wss = new WebSocketServer({ noServer: true });
    this.httpServer.on('upgrade', async (request, socket, head)=>{
      const context = await (async ()=>{
        try {
          if(!request.url) throw new Error("No URL");
          const url = new URL(request.url, "ws://localhost");
          const ws = await handleUpgrade(this.wss, request, socket, head);
          return { ws, req: request };
        }catch(e){
          console.log("Failed to upgrade connection", e);
          socket.destroy();
          throw e;
        }
      })()
      this.wsRouter.handleRequest(context, (err)=>{
        console.log("Failed to route request", err);
        context.ws.terminate();
      });
    });
    this.httpServer.on('request', (req, res)=>{
      this.httpRouter.handleRequest({ req, res }, (err: unknown)=>{
        if(res.writableEnded){
          console.warn("Router threw error and response ended")
          return;
        }
        if(res.headersSent){
          console.warn("Router threw error and headers already sent")
          res.destroy();
          return;
        }
        const error: HTTPError = (()=>{
          if(err instanceof HTTPError) return err;
          if(!err){
            return new HTTPError(404, "Not Found");
          } else if(typeof err === "string"){
            return new HTTPError(500, err);
          } else if(err instanceof Error){
            return new HTTPError(500, err.message);
          } else if(typeof err !== "object" || err === null || Array.isArray(err)) {
            return new HTTPError(500, "Unknown Error");
          }
          return new HTTPError(
            "statusCode" in err && typeof err.statusCode === "number" ? err.statusCode : 500,
            "message" in err && typeof err.message === "string" ? err.message : "Unknown Error"
          );
        })();

        res.writeHead(error.statusCode, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          error: error.message,
          context: error.context,
        }));
      });
    })
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
