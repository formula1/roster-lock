import { HTTPRouter } from "../../utils/http-router";
import { WebSocketRouter } from "../../utils/websocket-router";

import { wsHandler } from "./room-handler-bridge/ws-handler";
import { httpHandler } from "./room-handler-bridge/http-handler";

import { getFilesOfAsset, getPieceFileContents } from "./file-routes";
import { ensurePieceDownloaded, ensurePieceDownloadedWs, listDownloadedPiecesDirect } from "./select";
import { listAvailableSortPlugins, sortListPlugin, gameComplete } from "./piece-sort";
import {
  listAvailableGameRunners, getGameRunnerSettings, setGameRunnerSettings, getGameRunnerVersion,
  validateGameRunnerBinaryLocation, updateGameRunnerBinary, startGameRunner, getGameProcessStatus,
  installGameRunnerPlugin, listGameProcesses, stopGameProcess,
} from "./game-runner";
import { IFolderDB, V1Env, MatchAgentSelfInfo, ProcessHandleEntry } from "./globals";
import { PluginManager } from "@roster-lock/plugin-runtime";

export const createV1Routers = (fileDB: IFolderDB, pluginRuntime: PluginManager, matchAgent: MatchAgentSelfInfo)=>{
  const processHandles = new Map<string, ProcessHandleEntry>();
  const env: V1Env = { fileDB, pluginRuntime, matchAgent, processHandles };
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
  httpRouter.get("/game-runner/available", listAvailableGameRunners.bind(env));
  httpRouter.post("/game-runner/:pluginName/install", installGameRunnerPlugin.bind(env));
  httpRouter.get("/game-runner/:pluginName/settings", getGameRunnerSettings.bind(env));
  httpRouter.put("/game-runner/:pluginName/settings", setGameRunnerSettings.bind(env));
  httpRouter.get("/game-runner/:pluginName/version", getGameRunnerVersion.bind(env));
  httpRouter.get("/game-runner/:pluginName/validate", validateGameRunnerBinaryLocation.bind(env));
  httpRouter.post("/game-runner/:pluginName/update", updateGameRunnerBinary.bind(env));
  httpRouter.post("/game-runner/:pluginName/start", startGameRunner.bind(env));
  httpRouter.get("/game-runner/:pluginName/process/:handleId", getGameProcessStatus.bind(env));
  httpRouter.post("/game-runner/:pluginName/process/:handleId/stop", stopGameProcess.bind(env));
  // Plugin-agnostic, unlike the routes above - lists every process this
  // match-agent has started across every plugin (see pages/Game in
  // match-agent-client), not just one plugin's.
  httpRouter.get("/game-runner/processes", listGameProcesses.bind(env));


  wsRouter.mount("/sync-dl", wsHandler.bind(env));
  wsRouter.mount("/piece/ensure", ensurePieceDownloadedWs.bind(env));

  return { httpRouter, wsRouter };
}

