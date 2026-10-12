import { WebSocket } from "./utils";
import { storeValueInState, getPublicKey } from "./utils";
import { CONVO_STATE_KEY } from "./utils";
import { compareJSON } from "@roster-lock/utils";
import { makeBridgeEvent, makeBridgeRequest } from "./bridge-compatability";
import { RoomType } from "../types";
import { successWebhook } from "../webhook";
import { RoomConfig } from "../../types";


export async function handleSelection(room: RoomType, machine: WebSocket, value: any){
  const selection = await storeValueInState(
    room.state, machine, "selection", value,
    "user-selection",
    "all-selection-for-user-decryption",
  );

  if(!selection) return;

  await Promise.all(room.state.getWebSockets().map((machine)=>{
    return makeBridgeRequest(room, machine, "all-selection-for-user-decryption", selection);
  }));
}

export async function handleReveal(room: RoomType, machine: WebSocket, value: any){
  const reveal = await storeValueInState(
    room.state, machine, "reveal", value,
    "all-selection-for-user-decryption",
    "all-decryption-for-user-final",
  );

  if(!reveal) return;

  await Promise.all(room.state.getWebSockets().map((machine)=>{
    return makeBridgeRequest(room, machine, "all-decryption-for-user-final", reveal);
  }));
}

const FINAL_STATE = "all-decryption-for-user-final";
export async function handleFinal(room: RoomType, machine: WebSocket, value: any){
  const allMachineLength = room.state.getWebSockets().length;
  const publicKey = getPublicKey(machine);
  const allFinal = await room.state.storage.transaction(async (txn) => {
    const currentState = await txn.get<string>(CONVO_STATE_KEY);
    if(currentState !== FINAL_STATE) throw new Error(`Expected State ${FINAL_STATE} but got ${currentState}`);
    const finalSelection = await txn.get<{ value: any, machines: Array<string> }>("finalSelection") || { value, machines: [] };
    if(finalSelection.machines.includes(publicKey)){
      // if first machine, the machines array will be empty
      throw new Error("Duplicate Final");
    } else if(!compareJSON(finalSelection.value, value)){
      // if first machine, the final selection will always be equal to the value
      throw new Error("Final Selection Mismatch");
    } else {
      finalSelection.machines.push(publicKey);
      await txn.put("finalSelection", finalSelection);
    }
    if(finalSelection.machines.length < allMachineLength){
      return false;
    }
    await txn.put(CONVO_STATE_KEY, "user-download");
    return true;

  });

  if(!allFinal) return;

  // "user-download" is a request/response step like the others (match-agent
  // registers it via bridge.onRequest and returns "ok", which pairs with
  // RESPONSE_HANDLERS["user-download"] = handleDownload below) - not a
  // fire-and-forget event, which match-agent has no listener for.
  await Promise.all(room.state.getWebSockets().map((machine)=>{
    return makeBridgeRequest(room, machine, "user-download", {});
  }));
}

export async function handleDownload(room: RoomType, machine: WebSocket, value: any){
  if(value !== "ok") throw new Error("Invalid Download Value");
  const download = await storeValueInState(
    room.state, machine, "download", "ok",
    "user-download",
    "all-download",
  );

  if(!download) return false;

  const config = await room.state.storage.get<RoomConfig>("config");
  if (!config) return false;
  await successWebhook(room.env, config);

  await Promise.all(room.state.getWebSockets().map((machine)=>{
    return makeBridgeEvent(room, machine, "all-download", {});
  }));
  // Signals to Room.webSocketMessage that *this specific call* is the one
  // that just finished the room (see bridge-compatability.ts) - only after
  // the broadcast above has actually gone out, so completeRoom can't close
  // every socket before the machines it's for have been told.
  return true;
}
