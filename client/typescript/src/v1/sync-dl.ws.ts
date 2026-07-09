
import {
  RosterLockV1SyncDLRequestUserToClient,
  RosterLockV1SyncDLRequestClientToAgent,
  RosterLockV1SyncDLResult,
  RosterLockDownloadUpdate,
} from "@roster-lock/types";
import WebSocket from "isomorphic-ws";
import { MessageBridge, SIGNATURE } from "@roster-lock/utils";

type PrivateKey = Parameters<typeof SIGNATURE.ASYMMETRIC.createSignature>[0];

import { ROSTERLOCK_MATCH_AGENT_URL } from "../constants/match-agent";

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
  progressListeners: ProgressListeners = {},
  matchAgentUrl: string | URL = ROSTERLOCK_MATCH_AGENT_URL,
): Promise<RosterLockV1SyncDLResult>{
  if(version !== 1) throw new Error(`Unsupported Version ${version}`);
  const syncDLURL = new URL("/v1/sync-dl", matchAgentUrl);
  if(!["http:", "https:"].includes(syncDLURL.protocol)){
    throw new Error("Expecting The match agent url to be http or https");
  }
  syncDLURL.protocol = syncDLURL.protocol === "https:" ? "wss:" : "ws";
  const timestamp = Date.now();
  const signature = await SIGNATURE.ASYMMETRIC.createSignature(
    user.keys.privateKey as PrivateKey,
    {
      service: 'room-ws',
      roomId: relay.roomId,
      publicKey: user.keys.publicKey,
      timestamp: timestamp,
    }
  );

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
