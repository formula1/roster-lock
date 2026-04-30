import { createSimpleEmitter, JSON_Unknown, handleFetch, delay } from "@roster-lock/utils";
import { IRoom } from "./room";
import { WebSocket } from "ws";
import { once } from "events";

type RelayConfig = {
  url: string,
  roomId: string,
};

type UserConfig = {
  timestamp: number,
  publicKey: string,
  signature: string,
};


type User = {
  userId: string,
  publicKey: string,
  displayName: string,
};

type WebSocketRoomState = (
  | { state: "connecting" }
  | { state: "connected", websocket: WebSocket, users: Array<User> }
  | { state: "destroyed" }
)

export class WebsocketRoom implements IRoom {
  private state: WebSocketRoomState = { state: "connecting" };
  private relayURL: URL;
  private connectPromise: Promise<void>;
  constructor(
    private relayConfig: RelayConfig,
    userConfig: UserConfig,
  ){
    const url = new URL(relayConfig.url);
    url.searchParams.set("room", userConfig.signature);
    url.searchParams.set("t", userConfig.timestamp.toString());
    url.searchParams.set("pk", userConfig.publicKey);
    url.searchParams.set("sig", userConfig.signature);
    this.relayURL = url;
    this.connectPromise = this.setup();
  }

  get readyPromise(){
    return this.connectPromise;
  }

  private async setup(){
    const { relayURL: url } = this;
    const wsURL = new URL(url);
    wsURL.protocol = url.protocol === "https:" ? "wss:" : "ws";
    wsURL.pathname = "/" + this.relayConfig.roomId;
    const websocket = new WebSocket(wsURL.href);

    const abortController = new AbortController();
    const httpURL = new URL(url);
    httpURL.pathname = "/" + this.relayConfig.roomId + "/users";

    try {
      const [users] = await Promise.race([
        Promise.all([
          handleFetch<Array<User>>(fetch(httpURL.href, { signal: abortController.signal })),
          once(websocket, 'open'),
        ]),
        Promise.resolve().then(async ()=>{
          await delay(10_000);
          throw new Error("Timeout");
        })
      ]);
      this.state = { state: "connected", websocket, users };
    }catch(e){
      abortController.abort();
      websocket.close();
      this.state = { state: "destroyed" };
      throw e;
    }
  }

  get numberOfUsers(){
    if(this.state.state !== "connected") throw new Error("Not Connected");
    return this.state.users.length;
  }
  listen = createSimpleEmitter()
  async broadcast(event: string, data: JSON_Unknown){
    if(this.state.state !== "connected") throw new Error("Not Connected");
    await this.sendMessage({
      type: event,
      payload: data,
    });
  }
  disconnect = ()=>{
    if(this.state.state === "destroyed") return;
    if(this.state.state === "connecting"){
      this.state = { state: "destroyed" };
      return;
    }
    const { websocket } = this.state;
    websocket.close();
    this.state = { state: "destroyed" };
  }

  private sendMessage(message: any){
    return new Promise<void>((resolve, reject)=>{
      if(this.state.state !== "connected") return reject(new Error("Not Connected"));
      this.state.websocket.send(JSON.stringify(message), (error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }
}

