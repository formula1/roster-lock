import { WebSocket } from "./utils";
import { storeValueInState, getPublicKey } from "./utils";
import { CONVO_STATE_KEY } from "./utils";
import { isDeepEqual } from "../../../utils/json";
import { makeBridgeEvent, makeBridgeRequest } from "./bridge-compatability";
import { RoomType } from "../types";
import { successWebhook } from "../webhook";
import { RoomConfig } from "../../types";


export async function handleSelection(room: RoomType, user: WebSocket, value: any){
  const selection = await storeValueInState(
    room.state, user, "selection", value,
    "user-selection",
    "all-selection-for-user-decryption",
  );

  if(!selection) return;

  await Promise.all(room.state.getWebSockets().map((user)=>{
    return makeBridgeRequest(room, user, "all-selection-for-user-decryption", selection);
  }));
}

export async function handleReveal(room: RoomType, user: WebSocket, value: any){
  const reveal = await storeValueInState(
    room.state, user, "reveal", value,
    "all-selection-for-user-decryption",
    "all-decryption-for-user-final",
  );

  if(!reveal) return;

  await Promise.all(room.state.getWebSockets().map((user)=>{
    return makeBridgeRequest(room, user, "all-decryption-for-user-final", reveal);
  }));
}

const FINAL_STATE = "all-decryption-for-user-final";
export async function handleFinal(room: RoomType, user: WebSocket, value: any){
  const allUserLength = room.state.getWebSockets().length;
  const publicKey = getPublicKey(user);
  const allFinal = await room.state.storage.transaction(async (txn) => {
    const currentState = await txn.get<string>(CONVO_STATE_KEY);
    if(currentState !== FINAL_STATE) throw new Error(`Expected State ${FINAL_STATE} but got ${currentState}`);
    const finalSelection = await txn.get<{ value: any, users: Array<string> }>("finalSelection") || { value, users: [] };
    if(finalSelection.users.includes(publicKey)){
      // if first user, the users array will be empty
      throw new Error("Duplicate Final");
    } else if(!isDeepEqual(finalSelection.value, value)){
      // if first user, the final selection will always be equal to the value
      throw new Error("Final Selection Mismatch");
    } else {
      finalSelection.users.push(publicKey);
      await txn.put("finalSelection", finalSelection);
    }
    if(finalSelection.users.length < allUserLength){
      return false;
    }
    await txn.put(CONVO_STATE_KEY, "user-download");
    return true;

  });

  if(!allFinal) return;

  await Promise.all(room.state.getWebSockets().map((user)=>{
    return makeBridgeEvent(room, user, "user-download", {});
  }));
}

export async function handleDownload(room: RoomType, user: WebSocket, value: any){
  if(value !== "ok") throw new Error("Invalid Download Value");
  const download = await storeValueInState(
    room.state, user, "download", "ok",
    "user-download",
    "all-download",
  );

  if(!download) return;

  const config = await room.state.storage.get<RoomConfig>("config");
  if (!config) return;
  await successWebhook(room.env, config);

  await Promise.all(room.state.getWebSockets().map((user)=>{
    return makeBridgeEvent(room, user, "all-download", {});
  }));
}
