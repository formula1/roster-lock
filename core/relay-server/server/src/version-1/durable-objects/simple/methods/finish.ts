import { RoomType } from "../../types";
import { RoomConfig } from "../../../types";
import { ROOM_EVENT } from "../constants";
import { successWebhook } from "../../webhook";

export async function handleFinishMessage(
  { state, env, broadcast  }: RoomType, userId: string
) {
  const config = await state.storage.get<RoomConfig>('config');
  if(!config) throw new Error("Room not found");
  const isFinished = await state.storage.transaction(async (txn) => {
    const finishedUsers = await txn.get<string[]>('finishedUsers') || [];
    if(finishedUsers.includes(userId)) throw new Error("Duplicate Hello");

    finishedUsers.push(userId);
    await txn.put('finishedUsers', finishedUsers);
    const config = await txn.get<any>('config');
    return finishedUsers.length === config.users.length;
  });
  if(!isFinished) return;
  await state.storage.put('isFinished', true);
  await successWebhook(env, config);

  broadcast({
    userId: "",
    type: ROOM_EVENT.initGoodbye,
    payload: null,
  });
}
