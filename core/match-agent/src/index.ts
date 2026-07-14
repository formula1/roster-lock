#!/usr/bin/env node

export * from "./handle-room/version-1";

import { DEFAULT_MATCH_CONIFG } from "./config";
import { getDefaultAuthCode, saveAuthCode, authMiddleware, validateAuthCode } from "./authentication";
import { MatchAgentServer } from "./server";
import { program } from "commander";
import { createV1Routers } from "./handle-room/version-1";

program
  .name("rosterlock-match-agent")
  .description("Runs the match-agent server")
  .option("-p, --port <port>", "port to listen on", "8080")
  .option("-a, --auth-code <string>", "Authentication code required for access")
  .action(async (options: { port: string, authCode?: string }) => {
    const port = Number(options.port);
    if (!Number.isInteger(port) || port < 0 || port > 65535) {
      throw new Error(`Invalid port: ${options.port}`);
    }

    const authCode = options.authCode || await getDefaultAuthCode(DEFAULT_MATCH_CONIFG);
    await saveAuthCode(DEFAULT_MATCH_CONIFG, authCode)

    startServer(port, authCode);

  });

if (require.main === module) {
  program.parse();
}

export function startServer(port: number, authCode: string){
  const server = new MatchAgentServer();
  server.httpRouter.get("/", ({ res })=>{
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ "hello": "world" }));
  });
  server.httpRouter.post("/validate-authcode", validateAuthCode(authCode))

  const { httpRouter: v1HttpRouter, wsRouter: v1WsRouter } = createV1Routers();
  server.httpRouter.use("/v1", authMiddleware(authCode), v1HttpRouter);
  server.wsRouter.use("/v1", authMiddleware(authCode), v1WsRouter);

  server.listen(port, () => {
    console.log(`match-agent listening on port ${port}`);
  });
}
