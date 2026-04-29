import { JSON_Unknown } from "../JSON";
import { uniqueId } from "../string";

import { SimpleMessenger } from "./types"

type RequestMessage = {
  type: "request",
  path: string,
  id: string,
  data: unknown
}

function castRequest(message: unknown): message is RequestMessage {
  if(typeof message !== "object") return false
  if(Array.isArray(message) || message === null) return false;
  if(!("type" in message) || message.type !== "request") return false;
  if(!("path" in message) || typeof message.path !== "string") return false;
  if(!("id" in message) || typeof message.id !== "string") return false;
  if(!("data" in message)) return false;
  return true;
}

export function handleRequest(
  messager: SimpleMessenger, path: string, handler: (data: undefined | JSON_Unknown)=>Promise<JSON_Unknown>
){
  messager.onMessage(async (message)=>{
    if(!castRequest(message)){
      return console.log("Ignoring Message, Invalid Request Message", message);
    }
    const { path: messagePath, id: messageId, data } = message;
    if(messagePath !== path){
      return console.warn("Ignoring Message, different path");
    };
    try {
      const result = await handler(data as undefined | JSON_Unknown);
      messager.sendMessage({
        type: "response",
        path, id: messageId,
        responseType: "result", data: result
      });
    }catch(e: unknown){
      if(!(e instanceof Error)){
        e = new Error("Unkown Error");
      }
      messager.sendMessage({
        type: "response",
        path, id: messageId,
        responseType: "error",
        data: { message: (e as Error).message }
      });
    }
  })
}

type ResponseMessage = {
  type: "response",
  path: string,
  id: string,
  responseType: "result" | "error",
  data: unknown
}

function castResponse(message: unknown): message is ResponseMessage {
  if(typeof message !== "object") return false
  if(Array.isArray(message) || message === null) return false;
  if(!("type" in message) || message.type !== "response") return false;
  if(!("path" in message) || typeof message.path !== "string") return false;
  if(!("id" in message) || typeof message.id !== "string") return false;
  if(
    !("responseType" in message) ||
    typeof message.responseType !== "string" ||
    ["result", "error"].includes(message.responseType)
  ) return false;
  if(!("data" in message)) return false;
  return true;
}

export function makeRequest(
  messager: SimpleMessenger, path: string, data: undefined | JSON_Unknown
): Promise<JSON_Unknown>{
  const originalId = uniqueId();
  const { resolve, reject, promise } = Promise.withResolvers<JSON_Unknown>();
  const off = messager.onMessage(async (message)=>{
    try {
      if(!castResponse(message)){
        return console.log("Ignoring Message, Invalid Response Message", message);
      }
      const { path: messagePath, id: messageId, responseType, data: dataUncasted } = message;
      if(messagePath !== path){
        return console.warn("Ignoring Message, different path");
      };
      if(originalId !== messageId){
        return console.warn("Ignoring Message, different ids");
      }
      const data = dataUncasted as JSON_Unknown;
      if(responseType === "error"){
        throw new ResponseError("Response Failed", data);
      }
      off();
      resolve(data);
    }catch(e){
      off();
      reject(e);
    }
  });
  messager.sendMessage({ type: "request", path, id: originalId, ...(data ? { data } : {}) });
  return promise;
}


class ResponseError extends Error {
  constructor(message: string, public data: JSON_Unknown){
    super(message);
  }
}