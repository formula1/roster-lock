import { WebSocket } from "ws";
import { MessageBridge, waitForBridgeEvent } from "./utils/MessageBridge"
import { HTTPError } from "./utils/errors";
import { z, ZodType } from "zod";

import { RoomConfig } from "./types";

type TimeoutID = ReturnType<typeof setTimeout>

const WAIT_TIMEOUT =  10 * 1000; 
const ROOMS = new Map<string, WebRTCRoom>();
export class WebRTCRoom {
  public users: Record<string, { publicKey: string, ws: WebSocket, bridge: MessageBridge, heartbeat: 0 | TimeoutID }> = {};
  private state: 'waiting' | 'connecting' | "failed" | 'finished' = 'waiting';
  public createTimestamp: number
  constructor(public config: RoomConfig, private singleHost = true){
    if(ROOMS.has(config.roomId)){
      throw new HTTPError(400, `Room ${config.roomId} already exists`);
    }
    this.createTimestamp = Date.now()
    ROOMS.set(config.roomId, this);
  }

  static createRoom(config: RoomConfig){
    return new WebRTCRoom(config);
  }

  static getRoom(roomId: string){
    return ROOMS.get(roomId);
  }

  public addUser(userPublicKey: string, ws: WebSocket){
    if(userPublicKey in this.users){
      throw new Error("Duplicate websocket");
    }
    const bridge = new MessageBridge((message)=>(ws.send(JSON.stringify(message))));
    ws.on("message", (message)=>{
      this.heartBeat(userPublicKey);
      // The `ws` library always delivers frames (text or binary) as a Buffer/ArrayBuffer,
      // never a JS string - `typeof message === "string"` is never true here.
      bridge.handleMessage(JSON.parse(message.toString()));
    })
    this.users[userPublicKey] = {
      publicKey: userPublicKey,
      ws,
      bridge,
      heartbeat: 0
    };

    this.heartBeat(userPublicKey)

    ws.on("close", ()=>{
      if(this.state === "finished") return;
      this.removeRoom("failed", "user disconnected early")
    })

    if(Object.keys(this.users).length < this.config.users.length) return;

    this.startConnection();

  }

  private async startConnection(){
    try {
      await singleHostConect(this.users)
      this.removeRoom("finished", "success");

    }catch(e){
      // Rejections here aren't always Error instances (e.g. a request's error
      // response is relayed as a raw string) - keep the real reason instead
      // of silently collapsing it to "undefined".
      const reason = typeof e === "string" ? e : e instanceof Error ? e.message : "Unknown Error";
      this.removeRoom("failed", reason)
    }
  }

  public heartBeat(userId: string){
    if(this.state === "failed") throw new Error("Already failed")
    if(this.state === "finished") throw new Error("Already finished");
    const user = this.users[userId];
    if(!user) throw new Error("Missing User")
    clearTimeout(user.heartbeat);
    user.heartbeat = setTimeout(()=>(this.removeRoom("failed", "failed heartbeat")), WAIT_TIMEOUT)
  }

  public removeRoom(newState: "failed" | "finished", reason: string){
    if(this.state === "failed") throw new Error("Already failed")
    if(this.state === "finished") throw new Error("Already finished");
    this.state = newState;
    ROOMS.delete(this.config.roomId)
    for(const { ws, bridge, heartbeat } of Object.values(this.users)){
      clearTimeout(heartbeat);
      ws.close();
    }
  }
}

const IceMessageSchema: ZodType<{ ice: { candidate: string, mid: string }, user: string }> = z.object({
  ice: z.object({ candidate: z.string(), mid: z.string() }), user: z.string()
})

const CONNECT_TIMEOUT = 10 * 1000;
async function singleHostConect(users: WebRTCRoom["users"]){
  const host = await selectHost(users)
  for(const user of Object.values(users)){
    addIceListener(user)
  }

  await Promise.all(Object.values(users).map(async (other)=>{
    if(host.publicKey === other.publicKey) return;
    const hostConnected = waitForBridgeEvent(host.bridge, "connect-" + other.publicKey, CONNECT_TIMEOUT);
    const userConnected = waitForBridgeEvent(other.bridge, "connect-" + host.publicKey, CONNECT_TIMEOUT);
    const offer = await other.bridge.sendRequest("get-offer", { user: host.publicKey });
    const accept = await host.bridge.sendRequest("offer-for-answer", { user: other.publicKey, offer });
    await other.bridge.sendRequest("finish-answer", { user: host.publicKey, accept });

    await Promise.all([hostConnected, userConnected])
  }))

  async function selectHost(users: WebRTCRoom["users"]){
    const values = Object.values(users);
    const index = Math.floor(Math.random() * values.length)
    const user = values[index];
    if(!user) throw new Error("Failed to find random user");
    return user;
  }

  function addIceListener(user: WebRTCRoom["users"][string]){
    user.bridge.onEvent("ice", (message)=>{
      const casted = IceMessageSchema.safeParse(message);
      if(!casted.success){
        throw new Error("Invalid Ice Message");
      }
      const ice = casted.data;
      const target = users[ice.user];
      if(!target){
        throw new Error("Invalid User");
      }
      if(target.publicKey === user.publicKey){
        throw new Error("Can't send to self")
      }
      if(user.publicKey !== host.publicKey){
        if(target.publicKey !== host.publicKey){
          throw new Error("Non Host users can only send ice messages to host")
        }
      }
      target.bridge.sendEvent("ice", { user: user.publicKey, ice: ice.ice})
    })
  }
}

