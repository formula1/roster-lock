#!/usr/bin/env node

export * from "./handle-room/version-1";

import { DEFAULT_MATCH_CONIFG } from "./config";
import { getDefaultAuthCode, saveAuthCode, authMiddleware, validateAuthCode } from "./authentication";
import { MatchAgentServer } from "./server";
import { program } from "commander";
import { wsHandler, httpHandler } from "./handle-room/version-1";

program
  .name("rosterlock-match-agent")
  .description("Runs the match-agent server")
  .option("-p, --port <port>", "port to listen on", "8080")
  .option("-ac, --auth-code <string>", "Authentication code required for access")
  .action(async (options: { port: string, authCode?: string }) => {
    const port = Number(options.port);
    if (!Number.isInteger(port) || port < 0 || port > 65535) {
      throw new Error(`Invalid port: ${options.port}`);
    }

    const authCode = options.authCode || await getDefaultAuthCode(DEFAULT_MATCH_CONIFG);
    await saveAuthCode(DEFAULT_MATCH_CONIFG, authCode)

    const server = new MatchAgentServer();
    server.wsRouter.mount("/v1/sync-dl", authMiddleware(authCode), wsHandler);
    server.httpRouter.post("/v1/sync-dl", authMiddleware(authCode), httpHandler);
    server.httpRouter.get("/", ({ res })=>{
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ "hello": "world" }));
    });
    server.httpRouter.post("/validate-authcode", validateAuthCode(authCode))

    server.listen(port, () => {
      console.log(`match-agent listening on port ${port}`);
    });
  });

program.parse();
