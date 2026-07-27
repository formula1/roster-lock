import { DurableObjectState } from "@cloudflare/workers-types";
import { WebSocketAttachment } from "../types";

export type MachinePublicKey = string;
export type WebSocket = ReturnType<DurableObjectState["getWebSockets"]>[0];
export type WaitingRequest = {
  path: string,
  publicKey: MachinePublicKey,
};

export const CONVO_STATE_KEY = "convo-state";

export async function storeValueInState(
  doState: DurableObjectState, machine: WebSocket, key: string, value: any,
  expectedState: string, newState: string,
){
  const allMachineLength = doState.getWebSockets().length;
  const publicKey = getPublicKey(machine);
  return await doState.storage.transaction(async (txn) => {
    const currentState = await txn.get<string>(CONVO_STATE_KEY);
    if(currentState !== expectedState) throw new Error(`Expected State ${expectedState} but got ${currentState}`);
    const machineValues = await txn.get<Record<MachinePublicKey, any>>(key) || {};
    if(publicKey in machineValues) throw new Error(`Duplicate Value for Key ${key}`);
    machineValues[publicKey] = value;
    await txn.put(key, machineValues);

    if(Object.keys(machineValues).length < allMachineLength){
      return false;
    }
    await txn.put(CONVO_STATE_KEY, newState);
    return machineValues;
  });
}

export function getPublicKey(machine: WebSocket){
  const attachment = machine.deserializeAttachment() as WebSocketAttachment | null;
  if(!attachment) throw new Error("Invalid machine");
  return attachment.publicKey;
}


