import { DurableObjectState } from "@cloudflare/workers-types";
import { RoomType, WebSocketAttachment } from '../types';
import { makeBridgeRequest } from './bridge-compatability';
import { WebSocket } from "./utils";
import { TIMEOUT_CONTROLLER } from "../TimeoutController";


export async function sendPing(
  room: RoomType, userId: string
){
  const ws = getUser(room.state, userId);
  if(!ws) return;
  await room.state.storage.put("ping-state-" + userId, "sent");
  await makeBridgeRequest(
    room, ws, "ping", "ping"
  );
}

export async function recievePong(room: RoomType, user: WebSocket, value: any){
  if(value !== "pong") throw new Error("Expecting pong after ping");
  const attachment = user.deserializeAttachment() as WebSocketAttachment | null;
  if(!attachment) throw new Error("Invalid user");
  const { userId } = attachment;
  console.log(attachment.userId, "pong");
  await room.state.storage.transaction(async (txc)=>{
    const state = await txc.get("ping-state-" + userId);
    if(state !== "sent") throw new Error("Not expecting pong")
    await txc.delete("ping-state-" + userId);
    return TIMEOUT_CONTROLLER.addTimeouts(txc, [
      {
        id: `${userId}-ping-${Date.now()}`,
        offset: 1000,
        fn: { id: "ping", args: { userId } }
      }
    ])
  })
}

function getUser(durableObject: DurableObjectState, userId: string){
  const sockets = durableObject.getWebSockets();
  for (const ws of sockets) {
    const attachment = (ws as any).deserializeAttachment() as WebSocketAttachment | null;
    if (!attachment) continue;
    if(attachment.userId === userId) return ws;
  }
}
