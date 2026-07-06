import { createSimpleEmitter } from "../SimpleEvent"
import { uniqueId } from "../string";
import { MessageBridgeMessage } from "./types";

export class SimpleStream {
  constructor(
    public sendData: (data: unknown)=>void,
    public sendEnd: ()=>void,
  ){}
  onData = createSimpleEmitter<[unknown]>()
  onEnd = createSimpleEmitter()
}



export class StreamHandler {
  listeners: Record<string, (message: SimpleStream) => any> = {};
  pending: Record<string, {
    resolve: (value: any) => void,
    reject: (reason: any) => void,
  }> = {};
  active: Record<string, SimpleStream> = {}

  constructor(
    private sendMessage: (message: MessageBridgeMessage)=>void,
    private debug: boolean,
  ){}

  handleMessage(message: MessageBridgeMessage){
    switch(message.messageType){
      case "stream-attempt": {
        try {
          if(this.active[message.id])
            throw new Error("Duplicate Stream Id")
          const handler = this.listeners[message.path];
          if(!handler)
            throw new Error(`no request listener at ${message.path}`);

          const stream = this.createStream(message.id);
          this.active[message.id] = stream;
          this.sendMessage({
            id: message.id,
            messageType: "stream-response",
            value: "start"
          });
          Promise.resolve().then(async ()=>{
            try { await handler(stream); } catch(e){
              this.debug && console.warn("stream error handling suppressed", e);
            }
          })
        }catch(e) {
          this.sendMessage({
            id: message.id,
            messageType: "stream-response",
            value: "error"
          });
        }
        return true;
      }
      case "stream-response": {
        const pending = this.pending[message.id];
        if(!pending)
          throw new Error(`no pending stream for ${message.id}`);
        if(this.active[message.id])
          throw new Error("Duplicate Stream Id")
        delete this.pending[message.id];
        if(message.value === "error"){
          pending.reject("Failed to establish stream");
          return true;
        }
        const stream = this.createStream(message.id);
        this.active[message.id] = stream;
        pending.resolve(stream);
        return true;
      }
      case "stream-data": {
        const active = this.active[message.id];
        if(!active) throw new Error(`no active stream for ${message.id}`);
        active.onData.emit(message.value);
        return true;
      }
      case "stream-end": {
        const active = this.active[message.id];
        if(!active) throw new Error(`no active stream for ${message.id}`);
        delete this.active[message.id]
        active.onEnd.emit();
        return true;
      }
    }
    return false;

  }
  private createStream(streamId: string){
    const stream = new SimpleStream(
      (data)=>{
        if(!(streamId in this.active)){
          throw new Error("Stream isn't active")
        }
        this.sendMessage({
          id: streamId,
          messageType: "stream-data",
          value: data
        })
      },
      ()=>{
        if(!(streamId in this.active)){
          throw new Error("Stream isn't active")
        }
        delete this.active[streamId];
        this.sendMessage({
          id: streamId,
          messageType: "stream-end"
        });
        stream.onEnd.emit();
      }
    );
    return stream;
  }

  sendStream(path: string): Promise<SimpleStream>{
    return new Promise((resolve, reject)=>{
      const id = uniqueId();
      this.pending[id] = { resolve, reject };
      this.sendMessage({
        id,
        path,
        messageType: "stream-attempt",
      });
    });
  }
  onStream(path: string, handler: (stream: SimpleStream)=>any){
    if(path in this.listeners){
      throw new Error(`Duplicate Path: ${path}`);
    }
    this.listeners[path] = handler;
  }
}

