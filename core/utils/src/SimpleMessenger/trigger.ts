import { JSON_Unknown } from "../JSON";

import { SimpleMessenger } from "./types"


type TriggerMessage = {
  type: "trigger",
  path: string,
  data: unknown
}

function castTrigger(message: unknown): message is TriggerMessage {
  if(typeof message !== "object") return false
  if(Array.isArray(message) || message === null) return false;
  if(!("type" in message) || message.type !== "trigger") return false;
  if(!("path" in message) || typeof message.path !== "string") return false;
  if(!("data" in message)) return false;
  return true;
}

export function handleTrigger(
  messager: SimpleMessenger, path: string, handler: (data: undefined | JSON_Unknown)=>any
){
  messager.onMessage(async (message)=>{
    if(!castTrigger(message)){
      return console.log("Ignoring Message, Invalid Trigger Message", message);
    }
    const { path: messagePath, data } = message;
    if(messagePath !== path){
      return console.warn("Ignoring Message, different path");
    };
    handler(data as undefined | JSON_Unknown);
 })
}

export function makeTrigger(
  messager: SimpleMessenger, path: string, data: undefined | JSON_Unknown
){
  return messager.sendMessage({
    type: "trigger",
    path,
    ...(data ? { data } : {})
  });
}
