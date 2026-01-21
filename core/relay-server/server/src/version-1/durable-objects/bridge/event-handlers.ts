import { WebSocket } from "./utils";
import { makeBridgeEvent } from "./bridge-compatability";
import { RoomType } from "../types";

export async function handleDownloadProgress(room: RoomType, user: WebSocket, value: any){
  await Promise.all(room.state.getWebSockets().map((user)=>{
    return makeBridgeEvent(room, user, "download-progress", value);
  }));
}
