
import { RosterLockV1Config, UserInput } from "@match-lock/shared";
import { CurrentUser, RelayRoomConfig } from "./types";
import { WebSocket } from "ws";
import { MessageBridge } from "../utils/MessageBridge";
import { signMessage } from "../utils/crypto";
import { GameResult } from "./types";



export async function relayAndDownload(
  user: CurrentUser,
  rosterConfig: RosterLockV1Config,
  selection: UserInput["userSelection"],
  relayRoomConfig: RelayRoomConfig,
  pieceFolder: string
){
  const timestamp = Date.now();
  const signature = await signMessage(user.keys.privateKey, {
    service: 'room-ws',
    roomId: relayRoomConfig.roomId,
    publicKey: user.keys.publicKey,
    timestamp: timestamp,
  });

  const ws = new WebSocket("ws://localhost:8080/v1/websocket");
  const bridge = new MessageBridge((message)=>ws.send(JSON.stringify(message)));
  ws.on("message", (message)=>{
    bridge.handleMessage(JSON.parse(message.toString()));
  });

  try {
    await waitForBridgeEvent(bridge, "ready", 10_000);

    const roomInfo: GameResult = await bridge.sendRequest("connect-to-relay", {
      folder: pieceFolder,
      relay: relayRoomConfig,
      user: { timestamp, publicKey: user.keys.publicKey, signature },
      rosterConfig,
      userSelection: selection,
    });

    return roomInfo;
  }finally{ 
    ws.close();
  }
}


function waitForBridgeEvent<T>(bridge: MessageBridge, event: string, timeout: number){
  const { promise, resolve, reject } = Promise.withResolvers<T>();

  const to = setTimeout(()=>{
    reject(new Error("Timeout"));
  }, timeout);

  bridge.onEvent(event, (data)=>{
    resolve(data as T);
  });

  promise.finally(()=>{
    clearTimeout(to);
  });

  return promise;
}
