import { signMessage } from "../../utils/crypto";
import { MessageBridge } from "../../utils/MessageBridge";
import { ISimpleEventEmitter } from "../../utils/SimpleEvent";
import { createSimpleEmitter } from "../../utils/SimpleEvent";
import { RelayRoomConfig, CurrentUser, Users } from "../types";
import { WebSocket } from "ws";

import { PeerConnection, DataChannel } from "node-datachannel";
// Note: node-datachannel handles its own internal types, no .d.ts needed!

export type WebRTCPeer = {
  conn: PeerConnection,
  datachannel: DataChannel,
  bridge: MessageBridge,
}

export interface PeerRoom {
  users: Array<string>
  onAction: ISimpleEventEmitter<[userId: string, body: any]>
  broadcastAction(body: any): void
}

const GAME_SERVER = (()=>{
  const url = new URL(process.env.GAME_SERVER || "");
  if(url.protocol !== "ws:" && url.protocol !== "wss:"){
    throw new Error("Expecting websocket url")
  }
  return url;
})();

export async function prepareWebRTCRoom(
  relayRoomConfig: RelayRoomConfig,
  fullUsers: Users,
  user: CurrentUser
){
  const users = fullUsers.map(u => u.publicKey);
  const timestamp = Date.now();
  const signature = await signMessage(user.keys.privateKey, {
    service: "webrtc",
    roomId: relayRoomConfig.roomId,
    publicKey: user.keys.publicKey,
    timestamp: timestamp,
  })

  const wsURL = new URL(GAME_SERVER);
  wsURL.searchParams.set("room", relayRoomConfig.roomId)
  wsURL.searchParams.set("t", timestamp.toString());
  wsURL.searchParams.set("pk", user.keys.publicKey)
  wsURL.searchParams.set("sig", signature)

  const ws = new WebSocket(wsURL);
  const bridge = new MessageBridge((message)=>(ws.send(JSON.stringify(message))))
  ws.on("message", (data)=>{
    if(typeof data === "string"){
      bridge.handleMessage(JSON.parse(data))
    }
  })

  const { isHost, peers } = await setupWebRTCPeers(bridge, users);
  if(isHost){
    return new HostPeerRoom(user.keys.publicKey, users, peers);
  } else {
    return new ClientPeerRoom(user.keys.publicKey, users, peers);
  }
}


const DATA_CHANNEL_NAME = "Headless Game Example";
const DATA_CHANNEL_ID = 0;

function setupWebRTCPeers(bridge: MessageBridge, allowedUsers: Array<string>) {
  let isHost = false;
  const connections: Record<string, {
    conn: PeerConnection,
    datachannel: DataChannel,
    getLocalDescription: ()=>Promise<string>,
    hasRemoteDescription: ()=>boolean,
  }> = {};

  // node-datachannel uses strings for candidates, not complex objects
  const bufferedIce: Record<string, Array<{ candidate: string, mid: string }>> = {};

  bridge.onEvent("host", () => {
    isHost = true;
  });

  bridge.onEvent("ice", (message) => {
    const peer = connections[message.user];
    if (!peer || !peer.hasRemoteDescription()) {
      bufferedIce[message.user] = bufferedIce[message.user] || [];
      bufferedIce[message.user].push(message.ice);
      return;
    }
    peer.conn.addRemoteCandidate(message.ice.candidate, message.ice.mid);
  });

  bridge.onRequest("get-offer", async (message: { user: string }) => {
    const peer = createPeer(message.user);
    // In node-datachannel, this returns the string directly
    return peer.getLocalDescription();
  });

  bridge.onRequest("offer-for-answer", async (message: { user: string, offer: string }) => {
    const peer = createPeer(message.user);
    peer.conn.setRemoteDescription(message.offer, "offer");
    flushIce(message.user);
    return peer.getLocalDescription();
  });

  bridge.onRequest("finish-answer", async (message: { user: string, answer: string }) => {
    const peer = connections[message.user];
    if (!peer) throw new Error("Connection doesn't exist");
    peer.conn.setRemoteDescription(message.answer, "answer");
    flushIce(message.user);
    return true;
  });

  function createPeer(user: string) {
    if (user in connections) throw new Error("Connection already exists");
    if (!allowedUsers.includes(user)) throw new Error("User not allowed");

    // Configuration is standard
    const pc = new PeerConnection(user, {
      iceServers: ["stun:stun.l.google.com:19302"] 
    });

    // Create the data channel
    const dc = pc.createDataChannel(DATA_CHANNEL_NAME, { 
      negotiated: true, 
      id: DATA_CHANNEL_ID 
    });

    dc.onOpen(() => {
      bridge.sendEvent("connect-" + user, true);
    });

    pc.onLocalCandidate((candidate, mid) => {
      bridge.sendEvent("ice", { ice: { candidate, mid }, user });
    });

    let localDescription: string | null = null;
    const listeners: Array<(localDescription: string)=>any> = [];
    pc.onLocalDescription((description) => {
      localDescription = description;
      while(listeners.length > 0){
        const listener = listeners.pop();
        if(listener) listener(description);
      }
    });

    connections[user] = {
      conn: pc,
      datachannel: dc,
      getLocalDescription: async () => {
        if (localDescription) return localDescription;
        return new Promise((resolve) => {
          listeners.push(resolve);
        });
      },
      hasRemoteDescription: () => {
        try {
          return pc.remoteDescription() !== null;
        }catch(e){
          return false;
        }
      }
    };
    return connections[user];
  }

  function flushIce(user: string) {
    const peer = connections[user];
    if (!peer) return;
    for (const ice of bufferedIce[user] || []) {
      peer.conn.addRemoteCandidate(ice.candidate, ice.mid);
    }
    bufferedIce[user] = [];
  }

  return { isHost, peers: connections };
}

class ClientPeerRoom implements PeerRoom {
  public hostPeer: WebRTCPeer;
  constructor(
    public self: string,
    public users: Array<string>,
    peers: Record<string, Omit<WebRTCPeer, "bridge">>
  ){
    const hostPeer = Object.values(peers)[0];
    if(!hostPeer) throw new Error("Host not found");
    this.hostPeer = { ...hostPeer, bridge: new WebRTCBridge(hostPeer) };
    this.hostPeer.bridge.onEvent("action", (message: { userId: string, body: any })=>{
      this.onAction.emit(message.userId, message.body);
    })
  }

  onAction = createSimpleEmitter<[userId: string, body: any]>()
  broadcastAction(body: any){
    this.hostPeer.bridge.sendEvent("action", body);
  }
}

class HostPeerRoom implements PeerRoom {
  public clientPeers: Record<string, WebRTCPeer>;
  constructor(
    public self: string,
    public users: Array<string>,
    peers: Record<string, Omit<WebRTCPeer, "bridge">>
  ){
    this.clientPeers = {};
    for(const [userId, peer] of Object.entries(peers)){
      if(userId === self) continue;
      const bridge = new WebRTCBridge(peer); 
      this.clientPeers[userId] = { ...peer, bridge };
      bridge.onEvent("action", (body: any)=>{
        this.broadcastExternalMessage({ userId, body });
      })
    }
  }
  onAction = createSimpleEmitter<[userId: string, body: any]>()
  broadcastAction(body: any){
    this.broadcastExternalMessage({ userId: this.self, body });
  }
  private broadcastExternalMessage(message: { userId: string, body: any }){
    this.onAction.emit(message.userId, message.body);
    for(const peer of Object.values(this.clientPeers)){
      peer.bridge.sendEvent("action", message);
    }
  }
}

class WebRTCBridge extends MessageBridge {
  constructor(private peer: Omit<WebRTCPeer, "bridge">){
    super((message)=>(peer.datachannel.sendMessage(JSON.stringify(message))));
    peer.datachannel.onMessage((message)=>{
      try {
        const payload = JSON.parse(message.toString());
        this.handleMessage(payload);
      } catch (e) {
        console.error("Failed to parse WebRTC message", e);
      }
    })
  }
}
