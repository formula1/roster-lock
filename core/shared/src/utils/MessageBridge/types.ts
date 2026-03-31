


export type EventMessage = {
  messageType: "event",
  path: string,
  value: any,
};

export type RequestMessage = {
  id: string,
  messageType: "request",
  path: string,
  value: any,
};

export type ResponseMessage = {
  id: string,
  messageType: "response",
  valueType: "result" | "error",
  value: any,
};

export type MessageBridgeMessage = (
  | EventMessage
  | RequestMessage
  | ResponseMessage
);

export function castMessage(message: any): MessageBridgeMessage{
  if(typeof message !== "object"){
    throw new Error("expecting a complex type");
  }
  if(Array.isArray(message)){
    throw new Error("expecting a complex type");
  }
  if(message === null){
    throw new Error("expecting a complex type");
  }

  if(typeof message.messageType !== "string"){
    throw new Error("expecting a message type");
  }

  if(message.messageType === "event"){
    if(typeof message.path !== "string"){
      throw new Error("expecting a path");
    }
    if(typeof message.value === "undefined"){
      throw new Error("expecting a value");
    }
    return { messageType: "event", path: message.path, value: message.value };
  }

  if(message.messageType === "request"){
    if(typeof message.id !== "string"){
      throw new Error("expecting an id");
    }
    if(typeof message.path !== "string"){
      throw new Error("expecting a path");
    }
    if(typeof message.value === "undefined"){
      throw new Error("expecting a value");
    }
    return { id: message.id, messageType: "request", path: message.path, value: message.value };
  }

  if(message.messageType === "response"){
    if(typeof message.id !== "string"){
      throw new Error("expecting an id");
    }
    if(typeof message.valueType !== "string"){
      throw new Error("expecting a value type");
    }
    if(message.valueType !== "result" && message.valueType !== "error"){
      throw new Error("invalid value type");
    }
    if(typeof message.value === "undefined"){
      throw new Error("expecting a value");
    }
    return { id: message.id, messageType: "response", valueType: message.valueType, value: message.value };
  }
  throw new Error("invalid message type");
}
