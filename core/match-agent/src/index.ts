
export * from "./handle-room/version-1";

import { MatchAgentServer } from "./server";

const server = new MatchAgentServer();

import { wsHandler, httpHandler } from "./handle-room/version-1";
server.wsRouter.mount("/v1/sync-dl", wsHandler);
server.httpRouter.post("/v1/sync-dl", httpHandler);

server.listen(8080);
