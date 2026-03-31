import { stringify } from "node:querystring";
import { signMessage } from "../utils/crypto";
import { MessageBridge } from "../utils/MessageBridge";
import { createSimpleEmitter, ISimpleEventEmitter } from "../utils/SimpleEvent";
import { RelayRoomConfig, GameResult, CurrentUser } from "./types";
import { WebSocket } from "ws";

const GAME_SERVER = (()=>{
  const url = new URL(process.env.GAME_SERVER || "");
  if(url.protocol !== "ws:" && url.protocol !== "wss:"){
    throw new Error("Expecting websocket url")
  }
  return url;
})();

async function startGame(
  relayRoomConfig: RelayRoomConfig,
  gameResult: GameResult,
  user: CurrentUser
){
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


}

import { RTCPeerConnection, RTCIceCandidate } from "@roamhq/wrtc";
const DATA_CHANNEL_NAME = "Headless Game Example";
const DATA_CHANNEL_ID = 0
function setupWebRTCPeer(bridge: MessageBridge, allowedUsers: Array<string>){
  let isHost = false;
  const connections: Record<string, {
    conn: RTCPeerConnection,
    datachannel: RTCDataChannel,
  }> = {};
  const bufferedIce: Record<string, Array<RTCIceCandidate>> = {};

  bridge.onEvent("host", (message)=>{
    isHost = true;
  })

  bridge.onEvent("ice", (message)=>{
    const peer = connections[message.user];
    if(!peer || !peer.conn.remoteDescription){
      bufferedIce[message.user] = bufferedIce[message.user] || [];
      bufferedIce[message.user].push(new RTCIceCandidate(message.ice));
      return;
    }
    peer.conn.addIceCandidate(new RTCIceCandidate(message.ice));
  })

  bridge.onRequest("get-offer", async (message: { user: string })=>{
    const peer = createPeer(message.user);
    const offer = await peer.conn.createOffer();
    await peer.conn.setLocalDescription(offer);
    return offer;
  });

  bridge.onRequest("offer-for-answer", async (message: { user: string, offer: RTCSessionDescriptionInit })=>{
    const peer = createPeer(message.user);
    await peer.conn.setRemoteDescription(message.offer);
    const answer = await peer.conn.createAnswer();
    await peer.conn.setLocalDescription(answer);
    flushIce(message.user);
    return answer;
  });

  bridge.onRequest("finish-answer", async (message: { user: string, answer: RTCSessionDescriptionInit })=>{
    const peer = connections[message.user];
    if(!peer) throw new Error("Connection doesn't exist");
    await peer.conn.setRemoteDescription(message.answer);
    flushIce(message.user);
    return true;
  });


  function createPeer(user: string){
    if(user in connections){
      throw new Error("Connection already exists");
    }
    if(!allowedUsers.includes(user)){
      throw new Error("User not allowed");
    }
    const peer = new RTCPeerConnection();
    const channel = peer.createDataChannel(DATA_CHANNEL_NAME, { negotiated: true, id: DATA_CHANNEL_ID });
    channel.addEventListener("open", ()=>{
      bridge.sendEvent("connect-" + user, true);
    });
    connections[user] = { conn: peer, datachannel: channel };
    peer.addEventListener("icecandidate", (event)=>{
      if(event.candidate){
        bridge.sendEvent("ice", { ice: event.candidate, user });
      }
    })

    return connections[user];
  }

  function flushIce(user: string){
    const peer = connections[user];
    if(!peer) throw new Error("Connection doesn't exist");
    for(const ice of bufferedIce[user] || []){
      peer.conn.addIceCandidate(ice);
    }
    bufferedIce[user] = [];
  }
}


type WebRTCPeer = {
  conn: RTCPeerConnection,
  datachannel: RTCDataChannel,
  bridge: MessageBridge,
}

interface PeerRoom {
  onAction: ISimpleEventEmitter<[userId: string, body: any]>
  broadcastAction(body: any): void
}

class ClientPeerRoom implements PeerRoom {
  public hostPeer: WebRTCPeer;
  constructor(
    public self: string,
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
    super((message)=>(peer.datachannel.send(JSON.stringify(message))));
    peer.datachannel.addEventListener("message", (message)=>{
      this.handleMessage(JSON.parse(message.data));
    })
  }
}
