import { DurableObjectState } from "@cloudflare/workers-types";
import { RoomType, WebSocketAttachment } from '../types';
import { makeBridgeRequest } from './bridge-compatability';
import { WebSocket } from "./utils";
import { TIMEOUT_CONTROLLER } from "../TimeoutController";


export async function sendPing(
  room: RoomType, machineId: string
){
  const ws = getMachine(room.state, machineId);
  if(!ws) return;
  await room.state.storage.put("ping-state-" + machineId, "sent");
  await makeBridgeRequest(
    room, ws, "ping", "ping"
  );
}

export async function recievePong(room: RoomType, machine: WebSocket, value: any){
  if(value !== "pong") throw new Error("Expecting pong after ping");
  const attachment = machine.deserializeAttachment() as WebSocketAttachment | null;
  if(!attachment) throw new Error("Invalid machine");
  const { machineId } = attachment;
  console.log(attachment.machineId, "pong");
  await room.state.storage.transaction(async (txc)=>{
    const state = await txc.get("ping-state-" + machineId);
    if(state !== "sent") throw new Error("Not expecting pong")
    await txc.delete("ping-state-" + machineId);
    return TIMEOUT_CONTROLLER.addTimeouts(txc, [
      {
        id: `${machineId}-ping-${Date.now()}`,
        offset: 1000,
        fn: { id: "ping", args: { machineId } }
      }
    ])
  })
}

function getMachine(durableObject: DurableObjectState, machineId: string){
  const sockets = durableObject.getWebSockets();
  for (const ws of sockets) {
    const attachment = (ws as any).deserializeAttachment() as WebSocketAttachment | null;
    if (!attachment) continue;
    if(attachment.machineId === machineId) return ws;
  }
}
