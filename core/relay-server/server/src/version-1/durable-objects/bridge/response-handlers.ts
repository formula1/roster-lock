import { DurableObjectState } from '@cloudflare/workers-types';
import { WebSocket } from "./utils";
import { storeValueInState, getPublicKey } from "./utils";
import { CONVO_STATE_KEY } from "./utils";
import { isDeepEqual } from "../../../utils/json";
import { makeBridgeEvent, makeBridgeRequest } from './bridge-compatability';


export async function handleSelection(doState: DurableObjectState, user: WebSocket, value: any){
  const selection = await storeValueInState(
    doState, user, "selection", value,
    "user-selection",
    "all-selection-for-user-decryption",
  );

  if(!selection) return;

  await Promise.all(doState.getWebSockets().map((user)=>{
    return makeBridgeRequest(doState, user, "all-selection-for-user-decryption", selection);
  }));
}

export async function handleReveal(doState: DurableObjectState, user: WebSocket, value: any){
  const reveal = await storeValueInState(
    doState, user, "reveal", value,
    "all-selection-for-user-decryption",
    "all-decryption-for-user-final",
  );

  if(!reveal) return;

  await Promise.all(doState.getWebSockets().map((user)=>{
    return makeBridgeRequest(doState, user, "all-decryption-for-user-final", reveal);
  }));
}

const FINAL_STATE = "all-decryption-for-user-final";
export async function handleFinal(doState: DurableObjectState, user: WebSocket, value: any){
  const allUserLength = doState.getWebSockets().length;
  const publicKey = getPublicKey(user);
  const allFinal = await doState.storage.transaction(async (txn) => {
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

  await Promise.all(doState.getWebSockets().map((user)=>{
    return makeBridgeEvent(doState, user, "user-download", {});
  }));
}

export async function handleDownload(doState: DurableObjectState, user: WebSocket, value: any){
  if(value !== "ok") throw new Error("Invalid Download Value");
  const download = await storeValueInState(
    doState, user, "download", "ok",
    "user-download",
    "all-download",
  );

  if(!download) return;

  await Promise.all(doState.getWebSockets().map((user)=>{
    return makeBridgeEvent(doState, user, "all-download", {});
  }));
}
