import { IncomingMessage } from "http";
import { WebSocket } from "ws";
import { WebRTCRoom } from "../WRTCRoom";
import { validateAuthFromSearch } from "../auth";

export async function handleWebSocket(ws: WebSocket, req: IncomingMessage){
  try {
    const url = new URL(req.url!, `http://localhost:80`);
    const roomId = url.searchParams.get("room");
    if(!roomId) throw new Error("Missing room Id")
    const room = WebRTCRoom.getRoom(roomId)
    if(!room) throw new Error("Nonexistant Room");
    const user = await validateAuthFromSearch(url.searchParams, room.config, "webrtc")
    if(!user) throw new Error("Invalid User");
    room.addUser(user.publicKey, ws);
  }catch(e){
    ws.close(1000, (e as Error).message);
  }  
}
