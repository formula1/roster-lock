

import { MessageBridge } from "../../../utils/MessageBridge";
import { WebSocketHandlerCallback } from "../../../utils/websocket-router";
import { castRoomRequest, exchangeAndDownloadSelections } from "./exchange-and-download-selections";

export const wsHandler: WebSocketHandlerCallback = async (
  gameWebSocket, params, next
)=>{
  try {
    const gameBridge = new MessageBridge((message)=>gameWebSocket.send(JSON.stringify(message)));
    gameWebSocket.on("message", (message)=>{
      gameBridge.handleMessage(JSON.parse(message.toString()));
    });
    gameBridge.onRequest("connect-to-relay", async (roomInfo)=>{
      const { roomRequest, rosterConfig } = castRoomRequest(roomInfo);
      return await exchangeAndDownloadSelections(roomRequest, rosterConfig, {
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

