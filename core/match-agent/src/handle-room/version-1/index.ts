import { EventEmitter } from "node:events";
import { HTTPRouter } from "../../utils/http-router";
import { WebSocketRouter } from "../../utils/websocket-router";

import { wsHandler } from "./room-handler-bridge/ws-handler";
import { httpHandler } from "./room-handler-bridge/http-handler";

import { getFilesOfAsset, getPieceFileContents } from "./file-routes";
import { ensurePieceDownloaded, ensurePieceDownloadedWs, listDownloadedPiecesDirect } from "./select";
import { listAvailableSortPlugins, sortListPlugin, gameComplete } from "./piece-sort";
import { createGameLauncherRouter } from "./game-launcher/router";
import { gameProcessesWs } from "./game-launcher/process";
import { IFolderDB, V1Env, MatchAgentSelfInfo, ProcessHandleEntry, GameCompletionContext } from "./globals";
import { PluginManager } from "@roster-lock/plugin-runtime";

export const createV1Routers = (fileDB: IFolderDB, pluginRuntime: PluginManager, matchAgent: MatchAgentSelfInfo)=>{
  const processHandles = new Map<string, ProcessHandleEntry>();
  const gameCompletionContext = new Map<string, GameCompletionContext>();
  const processEvents = new EventEmitter();
  const env: V1Env = { fileDB, pluginRuntime, matchAgent, processHandles, gameCompletionContext, processEvents };
  const httpRouter = new HTTPRouter();
  const wsRouter = new WebSocketRouter()

  httpRouter.post("/sync-dl", httpHandler.bind(env));
  httpRouter.put("/piece", ensurePieceDownloaded.bind(env))
  httpRouter.post("/piece/asset-files", getFilesOfAsset.bind(env));
  httpRouter.post("/piece/file-contents", getPieceFileContents.bind(env));
  httpRouter.query("/piece/list-downloaded/direct", listDownloadedPiecesDirect.bind(env));
  httpRouter.get("/piece/sort-list/available", listAvailableSortPlugins.bind(env));
  httpRouter.post("/piece/sort-list/plugin/:pluginName", sortListPlugin.bind(env));
  httpRouter.post("/game-complete", gameComplete.bind(env));
  httpRouter.use("/game-launcher", createGameLauncherRouter(env));

  wsRouter.mount("/sync-dl", wsHandler.bind(env));
  wsRouter.mount("/piece/ensure", ensurePieceDownloadedWs.bind(env));
  // WS counterpart to /game-launcher/processes above - pushes the same
  // listGameProcesses snapshot on every connect and again whenever it
  // changes, so a client (e.g. match-agent-client's Game page) doesn't have
  // to poll the HTTP route for status.
  wsRouter.mount("/game-launcher/processes", gameProcessesWs.bind(env));

  // env is returned alongside the routers (not just used to bind them) so a
  // caller - e.g. a test - can seed/inspect in-memory state like
  // gameCompletionContext directly, without needing a real relay server to
  // drive the room negotiation that would otherwise populate it.
  return { httpRouter, wsRouter, env };
}

