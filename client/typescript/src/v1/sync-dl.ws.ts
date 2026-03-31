
import {
  RosterLockV1SyncDLRequestUserToClient,
  RosterLockV1SyncDLRequestClientToAgent,
  RosterLockV1SyncDLResult,
  RosterLockDownloadUpdate,
} from "@roster-lock/types";
import WebSocket from "isomorphic-ws";
import { MessageBridge } from "../utils/MessageBridge";
import { signMessage } from "../utils/crypto";

import { ROSTERLOCK_MATCH_AGENT_URL } from "../constants/match-agent";
const syncDLURL = new URL("/v1/sync-dl", ROSTERLOCK_MATCH_AGENT_URL);
syncDLURL.protocol = ROSTERLOCK_MATCH_AGENT_URL.protocol === "https:" ? "wss:" : "ws";

type ProgressListeners = Partial<{
  onState: (state: string)=>void,
  onDownloadProgress: (update: RosterLockDownloadUpdate)=>void,
}>

export async function syncDownloadOverWebSocket(
  {
    version,
    folder,
    relay,
    user,
    rosterConfig,
    userSelection: selection,
  }: RosterLockV1SyncDLRequestUserToClient,
  progressListeners: ProgressListeners = {}
): Promise<RosterLockV1SyncDLResult>{
  if(version !== 1) throw new Error(`Unsupported Version ${version}`);
  const timestamp = Date.now();
  const signature = await signMessage(user.keys.privateKey, {
    service: 'room-ws',
    roomId: relay.roomId,
    publicKey: user.keys.publicKey,
    timestamp: timestamp,
  });

  const ws = new WebSocket(syncDLURL.href);
  const bridge = new MessageBridge((message)=>ws.send(JSON.stringify(message)));
  ws.on("message", (message)=>{
    bridge.handleMessage(JSON.parse(message.toString()));
  });

  bridge.onEvent("room-state", (state)=>{
    progressListeners.onState?.(state);
  });
  bridge.onEvent("download-progress", (update)=>{
    progressListeners.onDownloadProgress?.(update);
  });

  try {
    await waitForBridgeEvent(bridge, "ready", 10_000);

    return await bridge.sendRequest(
      "connect-to-relay", {
        folder: folder,
        relay: relay,
        user: { timestamp, publicKey: user.keys.publicKey, signature },
        rosterConfig,
        userSelection: selection,
      } satisfies RosterLockV1SyncDLRequestClientToAgent
    ) as RosterLockV1SyncDLResult;

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
