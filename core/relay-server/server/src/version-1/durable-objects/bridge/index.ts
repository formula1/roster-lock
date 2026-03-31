import { DurableObjectState } from "@cloudflare/workers-types";
import { WebSocket, CONVO_STATE_KEY } from "./utils";

import { handleSelection, handleReveal, handleFinal, handleDownload } from "./response-handlers";
const RESPONSE_HANDLERS: Record<string, (room: RoomType, user: WebSocket, value: any)=>Promise<any>> = {
  "user-selection": handleSelection,
  "all-selection-for-user-decryption": handleReveal,
  "all-decryption-for-user-final": handleFinal,
  "user-download": handleDownload,
}

import { handleDownloadProgress } from "./event-handlers";
import { handleBridgeMessage, makeBridgeRequest } from "./bridge-compatability";
import { RoomType } from "../types";
const EVENT_HANDLERS: Record<string, (room: RoomType, user: WebSocket, value: any)=>Promise<any>> = {
  "download-progress": handleDownloadProgress,
}

const REQUEST_HANDLERS: Record<string, (room: RoomType, user: WebSocket, value: any)=>Promise<void>> = {}

const handlers = {
  response: RESPONSE_HANDLERS,
  event: EVENT_HANDLERS,
  request: REQUEST_HANDLERS,
}

export function handleMessage(room: RoomType, user: WebSocket, messageRaw: string){
  return handleBridgeMessage(room, handlers, user, messageRaw);
}

export async function startRoom(room: RoomType){
  await room.state.storage.transaction(async (txn) => {
    const currentState = await txn.get<string>(CONVO_STATE_KEY);
    if(currentState) throw new Error(`Expected No State but got ${currentState}`);
    await txn.put(CONVO_STATE_KEY, "user-selection");
  });
  for(const user of room.state.getWebSockets()){
    makeBridgeRequest(room, user, "user-selection", {});
  }
}

export async function isRoomFinished(doState: DurableObjectState){
  const state = await doState.storage.get<string>(CONVO_STATE_KEY);
  return state === "all-download";
}
