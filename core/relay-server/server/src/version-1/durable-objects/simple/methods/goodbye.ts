

import { RoomActions, RoomType } from "../../types";
import { RelayMessage } from "../types";
import { USER_EVENT } from "../constants";

export async function handleGoodbyeMessage(
  { state }: RoomType, { broadcast, completeRoom }: RoomActions, userId: string, data: RelayMessage, 
) {
  await state.storage.put('isGoodbye', true);
  broadcast({
    userId: userId,
    type: USER_EVENT.goodbye,
    payload: null,
  });
  await state.storage.transaction(async (txn) => {
    const leavingUsers = await txn.get<string[]>('leavingUsers') || [];
    if(leavingUsers.includes(userId)) throw new Error("Duplicate Hello");

    leavingUsers.push(userId);
    await txn.put('leavingUsers', leavingUsers);
  });
  const leavingUsers = await state.storage.get<string[]>('leavingUsers') || [];
  const config = await state.storage.get<any>('config');
  if(leavingUsers.length === config.users.length){
    await completeRoom();
  }
}
