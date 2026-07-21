import { DurableObjectState } from "@cloudflare/workers-types";
import { WebSocket, CONVO_STATE_KEY } from "./utils";
export { CONVO_STATE_KEY } from "./utils";

import { recievePong } from "./ping-pong";
import { handleSelection, handleReveal, handleFinal, handleDownload } from "./response-handlers";
const RESPONSE_HANDLERS: Record<string, (room: RoomType, user: WebSocket, value: any)=>Promise<any>> = {
  "user-selection": handleSelection,
  "all-selection-for-user-decryption": handleReveal,
  "all-decryption-for-user-final": handleFinal,
  "user-download": handleDownload,
  "ping": recievePong,
};

import { handleDownloadProgress } from "./event-handlers";
import { handleBridgeMessage, makeBridgeEvent, makeBridgeRequest } from "./bridge-compatability";
import { RoomType } from "../types";
const EVENT_HANDLERS: Record<string, (room: RoomType, user: WebSocket, value: any)=>Promise<any>> = {
  "download-progress": handleDownloadProgress,
};

const REQUEST_HANDLERS: Record<string, (room: RoomType, user: WebSocket, value: any)=>Promise<void>> = {};

const handlers = {
  response: RESPONSE_HANDLERS,
  event: EVENT_HANDLERS,
  request: REQUEST_HANDLERS,
};

// Returns whether *this specific message* was the one that just finished the
// room - callers must use this instead of independently re-querying
// isRoomFinished, or a differently-timed message (e.g. from the other user)
// can observe "finished" and complete/close the room before the response
// handler that actually earned that state has broadcast anything to anyone.
export function handleMessage(room: RoomType, user: WebSocket, messageRaw: string): Promise<boolean> {
  return handleBridgeMessage(room, handlers, user, messageRaw);
}

export async function startRoom(room: RoomType){
  await room.state.storage.transaction(async (txn) => {
    const currentState = await txn.get<string>(CONVO_STATE_KEY);
    if(currentState !== "wait-for-connections"){
      throw new Error(`Expected wait-for-connections but got ${currentState}`);
    }
    await txn.put(CONVO_STATE_KEY, "user-selection");
  });
  for(const user of room.state.getWebSockets()){
    makeBridgeRequest(room, user, "user-selection", {});
  }
}

export async function isRoomFinished(doState: DurableObjectState){
  const state = await doState.storage.get<string>(CONVO_STATE_KEY);
  // undefined means cleanupRoom's deleteAll() already wiped this room's
  // storage entirely (see Room.ts) - that's only reachable after the room
  // actually finished, since "created but not yet started" is its own
  // explicit "wait-for-connections" state, not an absent key.
  return state === "all-download" || state === undefined;
}

// Match-agent's bindStepsToBridge (see room-handler-bridge/steps.ts) only ever
// learns a room failed via a bridge-level "error" event on its onEvent("error")
// handler - a raw websocket close (even with a close reason) isn't visible to
// that protocol layer at all. Without this, a failed room silently hangs on
// every other connected agent until their own 30s heartbeat times out instead
// of surfacing the real failure reason.
export async function broadcastError(room: RoomType, reason: string){
  await Promise.all(room.state.getWebSockets().map(async (user)=>{
    try {
      await makeBridgeEvent(room, user, "error", reason);
    }catch(e){
      // Best-effort, same as handleDownloadProgress: a peer may already be
      // disconnected, in which case send() throws - shouldn't stop the other
      // sockets from being told.
      console.error("Failed to send error event to a socket", e);
    }
  }));
}
