import { DurableObjectState } from '@cloudflare/workers-types';
import { WebSocketAttachment } from "../types";

export type UserPublicKey = string;
export type WebSocket = ReturnType<DurableObjectState["getWebSockets"]>[0];
export type WaitingRequest = {
  path: string,
  publicKey: UserPublicKey,
}

export const CONVO_STATE_KEY = "convo-state";

export async function storeValueInState(
  doState: DurableObjectState, user: WebSocket, key: string, value: any,
  expectedState: string, newState: string,
){
  const allUserLength = doState.getWebSockets().length;
  const publicKey = getPublicKey(user);
  return await doState.storage.transaction(async (txn) => {
    const currentState = await txn.get<string>(CONVO_STATE_KEY);
    if(currentState !== expectedState) throw new Error(`Expected State ${expectedState} but got ${currentState}`);
    const userValues = await txn.get<Record<UserPublicKey, any>>(key) || {};
    if(userValues[publicKey]) throw new Error(`Duplicate Value for Key ${key}`);
    userValues[publicKey] = value;
    await txn.put(key, userValues);

    if(Object.keys(userValues).length < allUserLength){
      return false;
    }
    await txn.put(CONVO_STATE_KEY, newState);
    return userValues;
  });
}

export function getPublicKey(user: WebSocket){
  const attachment = user.deserializeAttachment() as WebSocketAttachment | null;
  if(!attachment) throw new Error("Invalid user");
  return attachment.publicKey;
}


