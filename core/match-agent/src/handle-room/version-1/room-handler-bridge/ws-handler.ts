

import { MessageBridge } from "@roster-lock/utils";
import { WebSocketHandlerCallback } from "../../../utils/websocket-router";
import { castRoomRequest, exchangeAndDownloadSelections } from "./exchange-and-download-selections";
import { V1Env } from "../globals/types";

export const wsHandler: WebSocketHandlerCallback = async function(
  this: V1Env, { ws: gameWebSocket }, params, next
){
  const { fileDB } = this;
  try {
    const gameBridge = new MessageBridge((message)=>gameWebSocket.send(JSON.stringify(message)));
    gameWebSocket.on("message", (message)=>{
      gameBridge.handleMessage(JSON.parse(message.toString()));
    });
    gameBridge.onRequest("connect-to-relay", async (roomInfo)=>{
      const roomRequest = castRoomRequest(roomInfo);
      return await exchangeAndDownloadSelections(fileDB, roomRequest, {
        onState: (state)=>{gameBridge.sendEvent("room-state", state)},
        onDownloadProgress: (event)=>{gameBridge.sendEvent("download-progress", event)},
      });
    });
    gameBridge.sendEvent("ready", {});
  }catch(e){
    gameWebSocket.terminate();
    next(e)
  }
}

