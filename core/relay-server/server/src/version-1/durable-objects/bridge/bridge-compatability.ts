import { MessageBridgeMessageCaster } from "./message-schema";
import { getPublicKey, WaitingRequest, WebSocket } from "./utils";
import { RoomType } from "../types";

type Handlers = {
  // Only a response handler can ever finish the room (only "download"'s does,
  // by returning true once every user's in) - the return value is threaded
  // all the way back to Room.webSocketMessage so *that specific call* decides
  // whether to complete the room, instead of every call independently
  // re-querying "is it finished yet" (see handleBridgeMessage below for why
  // that independent-query version was a real race).
  response: Record<string, (room: RoomType, user: WebSocket, value: any)=>Promise<boolean | void>>,
  event: Record<string, (room: RoomType, user: WebSocket, value: any)=>Promise<void>>,
  request: Record<string, (room: RoomType, user: WebSocket, value: any)=>Promise<any>>,
};

export async function handleBridgeMessage(
  room: RoomType, handlers: Handlers, user: WebSocket, messageRaw: string
): Promise<boolean> {
  const message = JSON.parse(messageRaw);
  const publicKey = getPublicKey(user);
  const parsed = MessageBridgeMessageCaster.safeParse(message);
  if(!parsed.success) throw new Error("Invalid message");
  if(message.messageType === "event"){
    const handler = handlers.event[message.path];
    if(!handler) throw new Error("Invalid event path");
    await handler(room, user, message.value);
    return false;
  }

  if(message.messageType === "request"){
    const handler = handlers.request[message.path];
    if(!handler) throw new Error("Invalid request path");
    try {
      const response = await handler(room, user, message.value);
      user.send(JSON.stringify({
        id: message.id,
        messageType: "response",
        valueType: "result",
        value: response,
      }));
    }catch(e){
      user.send(JSON.stringify({
        id: message.id,
        messageType: "response",
        valueType: "error",
        value: (e as Error).message,
      }));
    }
    return false;
  }

  if(message.messageType === "response"){
    const { id, valueType, value } = message;
    if(valueType === "error") throw new Error(value);
    const request = await room.state.storage.transaction(async (txn) => {
      const request = await txn.get<WaitingRequest>(`ws-request-${id}`);
      if(!request) throw new Error("Invalid request id");
      if(request.publicKey !== publicKey) throw new Error("Invalid user");
      await txn.delete(`ws-request-${id}`);
      return request;
    });
    const handler = handlers.response[request.path];
    if(!handler) throw new Error("Invalid request path");
    const finished = await handler(room, user, value);
    return !!finished;
  }

  throw new Error("Invalid message type");
}

export async function makeBridgeRequest(room: RoomType, user: WebSocket, path: string, value: any){
  const publicKey = getPublicKey(user);
  const id = [Date.now().toString(32), Math.random().toString(32).substring(2)].join("-");
  await room.state.storage.put(`ws-request-${id}`, { path, publicKey } satisfies WaitingRequest);
  user.send(JSON.stringify({
    id,
    path,
    messageType: "request",
    value
  }));
}

export async function makeBridgeEvent(room: RoomType, user: WebSocket, path: string, value: any){
  user.send(JSON.stringify({
    messageType: "event",
    path,
    value
  }));
}
