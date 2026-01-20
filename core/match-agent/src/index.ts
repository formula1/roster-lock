
export * from "./handle-room/version-1";

import { MatchAgentServer } from "./server";

const server = new MatchAgentServer();

import { bindMessageBridgeToWebsocket, bindRawStateToWebsocket } from "./handle-room/version-1";
server.use("/v1/websocket", async (ws, params, next)=>{
  bindMessageBridgeToWebsocket(ws);
});

server.listen(8080);
