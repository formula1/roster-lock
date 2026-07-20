import { HTTPRouter } from "../../utils/http-router";
import { WebSocketRouter } from "../../utils/websocket-router";

import { wsHandler } from "./room-handler-bridge/ws-handler";
import { httpHandler } from "./room-handler-bridge/http-handler";

import { getFilesOfAsset, getPieceFileContents } from "./file-routes";
import { ensurePieceDownloaded, listDownloadedPiecesDirect } from "./select";
import { IFolderDB, V1Env } from "./globals";

export const createV1Routers = (fileDB: IFolderDB)=>{
  const env: V1Env = { fileDB };
  const httpRouter = new HTTPRouter();
  const wsRouter = new WebSocketRouter()

  httpRouter.post("/sync-dl", httpHandler.bind(env));
  httpRouter.put("/piece", ensurePieceDownloaded.bind(env))
  httpRouter.post("/piece/asset-files", getFilesOfAsset.bind(env));
  httpRouter.post("/piece/file-contents", getPieceFileContents.bind(env));
  httpRouter.query("/piece/list-downloaded/direct", listDownloadedPiecesDirect.bind(env));


  wsRouter.mount("/sync-dl", wsHandler.bind(env));

  return { httpRouter, wsRouter };
}

