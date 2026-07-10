
import {
  MessageBridgeMessage,
  castMessage,
} from "./types";

export type { MessageBridgeMessage } from "./types";
import { EventHandler } from "./event";
import { RequestHandler } from "./request";
import { SimpleStream, StreamHandler } from "./stream";

export class MessageBridge {
  private eventHandler: EventHandler
  private requestHandler: RequestHandler;
  private streamHandler: StreamHandler

  constructor(
    private sendMessage: (message: MessageBridgeMessage) => void,
    protected debug: boolean = false
  ){
    this.eventHandler = new EventHandler(sendMessage, debug);
    this.requestHandler = new RequestHandler(sendMessage, debug);
    this.streamHandler = new StreamHandler(sendMessage, debug);
  }

  async handleMessage(messageRaw: any): Promise<void>{
    const message = castMessage(messageRaw);
    if(this.eventHandler.handleMessage(message)) return;
    if(this.requestHandler.handleMessage(message)) return;
    if(this.streamHandler.handleMessage(message)) return;
  }

  sendStream(path: string): Promise<SimpleStream>{
    return this.streamHandler.sendStream(path)
  }

  onStream(path: string, handler: (stream: SimpleStream)=>any){
    return this.streamHandler.onStream(path, handler)
  }

  sendRequest(path: string, body: any): Promise<any>{
    return this.requestHandler.sendRequest(path, body);
  }

  onRequest(path: string, handler: (data: any) => any){
    return this.requestHandler.onRequest(path, handler);
  }

  sendEvent(path: string, body: any){
    return this.eventHandler.sendEvent(path, body);
  }

  onEvent(path: string, handler: (data: any) => any){
    return this.eventHandler.onEvent(path, handler);
  }
}
