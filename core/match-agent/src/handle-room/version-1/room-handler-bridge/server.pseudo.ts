import { MessageBridge } from "../../../utils/MessageBridge";
import { isDeepStrictEqual } from "node:util";

type UserPublicKey = string;

export async function runRooms(users: Array<{ bridge: MessageBridge, publicKey: UserPublicKey }>){
  const pingAbortController = new AbortController();

  try {
    await Promise.race([
      runRoom(users),
      Promise.race(users.map(user=>keepPing(user.bridge, pingAbortController.signal))),
      Promise.race(users.map(user=>waitForError(user.bridge))),
    ])
  }catch(e){
    for(const user of users){
      user.bridge.sendEvent("error", (e as Error).message);
    }
    throw e;
  }finally{
    pingAbortController.abort();
  }
}

async function waitForError(user: MessageBridge){
  return new Promise((resolve, reject)=>{
    user.onEvent("error", (error)=>{
      reject(new Error(error.toString()));
    });
  });
}


async function keepPing(user: MessageBridge, abortSignal: AbortSignal){
  while(!abortSignal.aborted){
    const result = await user.sendRequest("ping", {});
    if(result !== "pong") throw new Error("Invalid Response");
    await delay(1000);
  }
}

function delay(ms: number){
  return new Promise(resolve=>setTimeout(resolve, ms));
}

const UNSET_FINAL = Symbol("unset-final");
const INVALID_FINAL = Symbol("invalid-final");
async function runRoom(users: Array<{ bridge: MessageBridge, publicKey: UserPublicKey }>){
  const userCommits: Record<UserPublicKey, any> = {};
  await Promise.all(users.map(async (user)=>{
    const commit = await user.bridge.sendRequest("user-selection", {});
    userCommits[user.publicKey] = commit;
  }));
  const userReveals: Record<UserPublicKey, any> = {};
  await Promise.all(users.map(async (user)=>{
    const reveal = await user.bridge.sendRequest("all-selection-for-user-decryption", userCommits);
    userReveals[user.publicKey] = reveal;
  }));
  let userFinals: typeof UNSET_FINAL | typeof INVALID_FINAL | Record<string, any>  = UNSET_FINAL;
  await Promise.all(users.map(async (user)=>{
    const final = await user.bridge.sendRequest("all-decryption-for-user-final", userReveals);
    if(userFinals === INVALID_FINAL) return;
    if(userFinals === UNSET_FINAL){
      userFinals = final;
      return;
    }
    if(!isDeepStrictEqual(userFinals, final)){
      userFinals = INVALID_FINAL;
      throw new Error("Final Selection Mismatch");
    }
  }));
  for(const user of users){
    user.bridge.onEvent("download-progress", (data)=>{
      for(const otherUser of users){
        otherUser.bridge.sendEvent("download-progress", { ...data, user: user.publicKey });
      }
    })
  }
  await Promise.all(users.map(async (user)=>{
    await user.bridge.sendRequest("user-download", {});
  }));
  for(const user of users){
    user.bridge.sendEvent("all-download", {});
  }
}
