#!/usr/bin/env node

export * from "./handle-room/version-1";

import { resolve as pathResolve } from "node:path";
import { mkdir } from "node:fs/promises";
import { DEFAULT_MATCH_CONIFG, DEFAULT_MATCH_FOLDER } from "./config";
import { getDefaultAuthCode, saveAuthCode, authMiddleware, validateAuthCode } from "./authentication";
import { MatchAgentServer } from "./server";
import { program } from "commander";
import { createV1Routers } from "./handle-room/version-1";
import { getSQLite3FolderDB, IFolderDB } from "./handle-room/version-1/globals/FolderDB";

program
  .name("rosterlock-match-agent")
  .description("Runs the match-agent server")
  .option("-p, --port <port>", "port to listen on", "58732")
  .option("-a, --auth-code <string>", "Authentication code required for access")
  .option(
    "-f, --folder <path>",
    "folder to store downloaded pieces and plugins in (e.g. a mounted USB drive)",
    DEFAULT_MATCH_FOLDER
  )
  .action(async (options: { port: string, authCode?: string, folder: string }) => {
    const port = Number(options.port);
    if (!Number.isInteger(port) || port < 0 || port > 65535) {
      throw new Error(`Invalid port: ${options.port}`);
    }

    const authCode = options.authCode || await getDefaultAuthCode(DEFAULT_MATCH_CONIFG);
    await saveAuthCode(DEFAULT_MATCH_CONIFG, authCode)

    const folder = pathResolve(options.folder);
    await mkdir(folder, { recursive: true });
    const fileDB = getSQLite3FolderDB(folder);

    startServer(port, authCode, fileDB);

  });

if (require.main === module) {
  program.parse();
}

export function startServer(port: number, authCode: string, fileDB: IFolderDB){
  const server = new MatchAgentServer();
  server.httpRouter.get("/", ({ res })=>{
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ "hello": "world" }));
  });
  server.httpRouter.post("/validate-authcode", validateAuthCode(authCode))

  const { httpRouter: v1HttpRouter, wsRouter: v1WsRouter } = createV1Routers(fileDB);
  server.httpRouter.use("/v1", authMiddleware(authCode), v1HttpRouter);
  server.wsRouter.use("/v1", authMiddleware(authCode), v1WsRouter);

  server.listen(port, () => {
    console.log(`match-agent listening on port ${port}`);
  });
}
