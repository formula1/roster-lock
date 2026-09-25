
import { IncomingMessage, Server } from "http";
import { Duplex } from "stream";
import { WebSocketServer, WebSocket } from 'ws';
import { HTTPRouter, HTTPError } from "./utils/http-router";
import { WebSocketRouter } from "./utils/websocket-router";
import { createV1Routers } from "./router";
import { getPort, getClientDistDir } from "./globals";
import { serveClientAsset } from "./static-client";
import { migrateModels } from "./models";

const debug = !!process.env.DEBUG;
const clientDistDir = getClientDistDir();
const httpRouter = new HTTPRouter();
const wsRouter = new WebSocketRouter();

const v1 = createV1Routers();
httpRouter.use("/api/v1", v1.httpRouter);
wsRouter.use("/api/v1", v1.wsRouter);

const httpServer = new Server();
const wss = new WebSocketServer({ noServer: true });
httpServer.on('upgrade', async (request, socket, head)=>{
  const context = await (async ()=>{
    try {
      if(!request.url) throw new Error("No URL");
      const url = new URL(request.url, "ws://localhost");
      const ws = await handleWSUpgrade(wss, request, socket, head);
      return { ws, req: request };
    }catch(e){
      console.log("Failed to upgrade connection", e);
      socket.destroy();
      throw e;
    }
  })()
  wsRouter.handleRequest(context, (err)=>{
    debug && console.log("WS Error:", err);
    context.ws.terminate();
  });
});
httpServer.on('request', (req, res)=>{
  httpRouter.handleRequest({ req, res }, async (err: unknown)=>{
    // No API route matched - fall through to the built admin client (same
    // catch-all shape as relay-server's Cloudflare build serving
    // CLIENT_ASSETS for any unmatched path) before treating it as a 404.
    if(!err && (req.method === "GET" || req.method === "HEAD")){
      const served = await serveClientAsset(req, res, clientDistDir).catch((e)=>{
        debug && console.log("Static client error:", req.method, req.url, e);
        return false;
      });
      if(served) return;
    }

    debug && console.log("HTTP Error:", req.method, req.url, err);
    if(res.writableEnded){
      debug && console.warn("Router threw error and response ended")
      return;
    }
    if(res.headersSent){
      debug && console.warn("Router threw error and headers already sent")
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


function handleWSUpgrade(wss: WebSocketServer, request: IncomingMessage, socket: Duplex, head: Buffer){
  return new Promise<WebSocket>((resolve, reject)=>{
    wss.handleUpgrade(request, socket, head, function done(ws) {
      resolve(ws);
    });
  });
}

const port = getPort();
// Waits for MODELS_VERSION=postgres's schema migrations before accepting
// connections, so no request can race a table that doesn't exist yet
// (no-op for the in-memory version).
migrateModels().then(() => {
  httpServer.listen(port, () => {
    console.log(`relay-server-hosted listening on :${port}`);
  });
}).catch((e) => {
  console.error("Failed to run model migrations", e);
  process.exit(1);
});
