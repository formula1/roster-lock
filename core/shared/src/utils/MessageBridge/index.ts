import { uniqueId } from "../string";

import {
  MessageBridgeMessage,
  castMessage,
} from "./types";

export { MessageBridgeMessage } from "./types";

export class MessageBridge {
  private eventHandler: {
    listeners: Record<string, Array<(message: MessageBridgeMessage) => any>>,
  } = { listeners: {} };
  private requestHandler: {
    listeners: Record<string, (message: MessageBridgeMessage) => any>,
    pending: Record<string, {
      resolve: (value: any) => void,
      reject: (reason: any) => void,
    }>,
  } = { listeners: {}, pending: {} };

  private sendMessage: (message: MessageBridgeMessage) => void;
  protected debug: boolean;

  constructor(sendMessage: (message: MessageBridgeMessage) => void, debug: boolean = false){
    this.sendMessage = sendMessage;
    this.debug = debug;
  }

  async handleMessage(messageRaw: any): Promise<void>{
    const message = castMessage(messageRaw);
    switch(message.messageType){
      case "event": {
        try {
          const handlers = this.eventHandler.listeners[message.path];
          if(!handlers) throw new Error(`no event listener at ${message.path}`);
          for(const handler of handlers) {
            await handler(message.value);
          }
        }catch(e) {
          this.debug && console.error("error handling message", e);
        }
        return;
      }
      case "request": {
        try {
          const handler = this.requestHandler.listeners[message.path];
          if(!handler) throw new Error(`no request listener at ${message.path}`);
          const result = await handler(message.value);
          this.sendMessage({
            id: message.id,
            messageType: "response",
            valueType: "result",
            value: result
          });
        }catch(e) {
          this.sendMessage({
            id: message.id,
            messageType: "response",
            valueType: "error",
            value: typeof e === "string" ? e : e instanceof Error ? e.message : "Unknown Error"
          });
        }
        return;
      }
      case "response": {
        try {
          const pending = this.requestHandler.pending[message.id];
          if(!pending) throw new Error(`no pending request for ${message.id}`);
          delete this.requestHandler.pending[message.id];
          if(message.valueType === "error"){
            pending.reject(message.value);
          } else {
            pending.resolve(message.value);
          }
        }catch(e) {
          this.debug && console.error("error handling message", e);
        }
        return;
      }
    }
  }

  request(path: string, body: any): Promise<any>{
    return new Promise((resolve, reject)=>{
      const id = uniqueId();
      this.requestHandler.pending[id] = { resolve, reject };
      this.sendMessage({
        id,
        path,
        messageType: "request",
        value: body
      });
    });
  }

  respond(path: string, handler: (data: any) => any): void{
    if(path in this.requestHandler.listeners){
      throw new Error(`Duplicate Path: ${path}`);
    }
    this.requestHandler.listeners[path] = handler;
  }

  emit(path: string, body: any): void{
    this.sendMessage({
      path,
      messageType: "event",
      value: body
    });
  }

  listen(path: string, handler: (data: any) => void | Promise<void>): void{
    const listeners = this.eventHandler.listeners[path] || [];
    listeners.push(handler);
    this.eventHandler.listeners[path] = listeners;
    if(path in this.eventHandler.listeners){
      this.eventHandler.listeners[path].push(handler);
    }
  }
}
