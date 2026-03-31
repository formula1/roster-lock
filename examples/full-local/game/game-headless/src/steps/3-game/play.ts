import { PeerRoom } from "./types";

export async function playGame(room: PeerRoom){
  const points: Record<string, number> = {};
  for(let i = 0; i < 10; i++){
    room.broadcastAction({ type: "test", value: i });
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}


