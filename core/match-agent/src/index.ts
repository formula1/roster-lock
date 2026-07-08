#!/usr/bin/env node

export * from "./handle-room/version-1";

import { MatchAgentServer } from "./server";
import { program } from "commander";
import { wsHandler, httpHandler } from "./handle-room/version-1";

program
  .name("rosterlock-match-agent")
  .description("Runs the match-agent server")
  .option("-p, --port <port>", "port to listen on", "8080")
  .action((options: { port: string }) => {
    const port = Number(options.port);
    if (!Number.isInteger(port) || port < 0 || port > 65535) {
      throw new Error(`Invalid port: ${options.port}`);
    }

    const server = new MatchAgentServer();
    server.wsRouter.mount("/v1/sync-dl", wsHandler);
    server.httpRouter.post("/v1/sync-dl", httpHandler);
    server.httpRouter.get("/", ({ res })=>{
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ "hello": "world" }));
    });

    server.listen(port, () => {
      console.log(`match-agent listening on port ${port}`);
    });
  });

program.parse();
