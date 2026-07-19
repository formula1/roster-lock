import { HTTPRouter } from "../../utils/http-router";
import { WebSocketRouter } from "../../utils/websocket-router";

import { wsHandler } from "./room-handler-bridge/ws-handler";
import { httpHandler } from "./room-handler-bridge/http-handler";

import { getFilesOfAsset, getPieceFileContents } from "./file-routes";
import { ensurePieceDownloaded, listDownloadedPiecesDirect } from "./select";

export const createV1Routers = ()=>{
  const httpRouter = new HTTPRouter();
  const wsRouter = new WebSocketRouter()

  httpRouter.post("/sync-dl", httpHandler);
  httpRouter.put("/piece", ensurePieceDownloaded)
  httpRouter.post("/piece/asset-files", getFilesOfAsset);
  httpRouter.post("/piece/file-contents", getPieceFileContents);
  httpRouter.query("/piece/list-downloaded/direct", listDownloadedPiecesDirect);


  wsRouter.mount("/sync-dl", wsHandler);

  return { httpRouter, wsRouter };
}

