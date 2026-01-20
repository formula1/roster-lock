import { DurableObjectState } from "@cloudflare/workers-types";
import { RoomType } from "../../types";
import { RelayMessage } from "../types";
import { ROOM_EVENT, USER_EVENT } from "../constants";

export async function handleHelloMessage(
  { state, broadcast }: RoomType, userId: string, data: RelayMessage, 
) {
  if(data.type !== USER_EVENT.hello) throw new Error('Message Should Be Hello');
  await state.storage.transaction(async (txn) => {
    const readyUsers = await txn.get<string[]>('readyUsers') || [];
    if(readyUsers.includes(userId)) throw new Error("Duplicate Hello");

    readyUsers.push(userId);
    await txn.put('readyUsers', readyUsers);
    const config = await txn.get<any>('config');
    if(readyUsers.length === config.users.length){
      await txn.put('isReady', true);
    }
  });
  const ready = await state.storage.get<boolean>('isReady');
  if(!ready) return;
  broadcast({
    userId: "",
    type: ROOM_EVENT.startRoom,
    payload: null,
  });
}