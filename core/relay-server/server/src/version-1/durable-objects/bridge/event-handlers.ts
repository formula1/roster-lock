import { WebSocket } from "./utils";
import { makeBridgeEvent } from "./bridge-compatability";
import { RoomType } from "../types";

export async function handleDownloadProgress(room: RoomType, machine: WebSocket, value: any){
  // Best-effort broadcast: a peer may have already disconnected (e.g. the
  // room just completed on their side), in which case send() throws. A
  // stale progress event shouldn't be able to fail the whole room.
  await Promise.all(room.state.getWebSockets().map(async (machine)=>{
    try {
      await makeBridgeEvent(room, machine, "download-progress", value);
    } catch(e){
      console.error("Failed to send download-progress to a socket", e);
    }
  }));
}
