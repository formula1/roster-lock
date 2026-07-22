#!/usr/bin/env node

export * from "./handle-room/version-1";

import { resolve as pathResolve } from "node:path";
import { mkdir } from "node:fs/promises";
import { DEFAULT_MATCH_CONIFG, DEFAULT_PIECE_DIR } from "./config";
import { getDefaultAuthCode, saveAuthCode, authMiddleware, validateAuthCode } from "./authentication";
import { MatchAgentServer } from "./server";
import { program } from "commander";
import { createV1Routers } from "./handle-room/version-1";
import { getSQLite3FolderDB } from "./handle-room/version-1/globals/FolderDB";
import { DEFAULT_PLUGIN_DIR, PluginManager } from "@roster-lock/plugin-runtime";

program
  .name("rosterlock-match-agent")
  .description("Runs the match-agent server")
  .option("--port <port>", "port to listen on", "58732")
  .option("--auth-code <string>", "Authentication code required for access")
  .option(
    "--piece-folder <path>",
    "folder to store downloaded pieces in (e.g. a mounted USB drive)",
    DEFAULT_PIECE_DIR
  )
  .option(
    "--plugin-folder <path>",
    "folder to load plugins from (e.g. a mounted USB drive)",
    DEFAULT_PLUGIN_DIR
  )
  .action(async (options: { port: string, authCode?: string, pieceFolder: string, pluginFolder: string }) => {
    const port = Number(options.port);
    if (!Number.isInteger(port) || port < 0 || port > 65535) {
      throw new Error(`Invalid port: ${options.port}`);
    }

    const authCode = options.authCode || await getDefaultAuthCode(DEFAULT_MATCH_CONIFG);
    await saveAuthCode(DEFAULT_MATCH_CONIFG, authCode)

    const piecesFolder = pathResolve(options.pieceFolder);
    await mkdir(piecesFolder, { recursive: true });
    const pluginFolder = pathResolve(options.pluginFolder);
    await mkdir(pluginFolder, { recursive: true });

    startServer(port, authCode, pluginFolder, piecesFolder);

  });

if (require.main === module) {
  program.parse();
}

export async function startServer(port: number, authCode: string, pluginFolder: string, piecesFolder: string){
  const pluginRuntime = await PluginManager.create(pluginFolder);
  const fileDB = getSQLite3FolderDB(piecesFolder, pluginRuntime);

  const server = new MatchAgentServer();
  server.httpRouter.get("/", ({ res })=>{
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ "hello": "world" }));
  });
  server.httpRouter.post("/validate-authcode", validateAuthCode(authCode))

  const { httpRouter: v1HttpRouter, wsRouter: v1WsRouter } = createV1Routers(fileDB, pluginRuntime);
  server.httpRouter.use("/v1", authMiddleware(authCode), v1HttpRouter);
  server.wsRouter.use("/v1", authMiddleware(authCode), v1WsRouter);

  server.listen(port, () => {
    console.log(`match-agent listening on port ${port}`);
  });
}
