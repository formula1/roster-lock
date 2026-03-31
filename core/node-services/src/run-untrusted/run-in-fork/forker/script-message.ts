import { JSON_Unknown } from "@match-lock/shared";

type ScriptReadyMessage = { type: "ready" };
type ScriptErrorMessage = { type: "error", data: { message: string, uncaught?: boolean } };
type ScriptResultMessage = { type: "result", data: JSON_Unknown };

type ScriptMessage = ( 
  | ScriptReadyMessage
  | ScriptErrorMessage
  | ScriptResultMessage
);

export function castMessage(data: unknown): ScriptMessage{
  if(typeof data !== "object"){
    throw new Error("expecting a complex type");
  }
  if(Array.isArray(data)){
    throw new Error("expecting a complex type");
  }
  if(data === null){
    throw new Error("expecting a complex type");
  }
  if(!("type" in data) || typeof data.type !== "string"){
    throw new Error("expecting a message type");
  }

  if(data.type === "ready"){
    return data as ScriptReadyMessage;
  }
  if(data.type === "error"){
    if(!("data" in data) || typeof data.data !== "object" || Array.isArray(data.data) || data.data === null){
      throw new Error("expecting a data object");
    }
    if(!("message" in data.data) || typeof data.data.message !== "string"){
      throw new Error("expecting a message string");
    }
    return data as ScriptErrorMessage;
  }
  if(data.type === "result"){
    return data as ScriptResultMessage;
  }
  throw new Error("unknown message type");
}

