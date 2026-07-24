import { HTTPRouter } from "../../utils/http-router";
import { WebSocketRouter } from "../../utils/websocket-router";

import { wsHandler } from "./room-handler-bridge/ws-handler";
import { httpHandler } from "./room-handler-bridge/http-handler";

import { getFilesOfAsset, getPieceFileContents } from "./file-routes";
import { ensurePieceDownloaded, ensurePieceDownloadedWs, listDownloadedPiecesDirect } from "./select";
import { listAvailableSortPlugins, sortListPlugin, gameComplete } from "./piece-sort";
import { IFolderDB, V1Env } from "./globals";
import { PluginManager } from "@roster-lock/plugin-runtime";

export const createV1Routers = (fileDB: IFolderDB, pluginRuntime: PluginManager)=>{
  const env: V1Env = { fileDB, pluginRuntime };
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


  wsRouter.mount("/sync-dl", wsHandler.bind(env));
  wsRouter.mount("/piece/ensure", ensurePieceDownloadedWs.bind(env));

  return { httpRouter, wsRouter };
}

