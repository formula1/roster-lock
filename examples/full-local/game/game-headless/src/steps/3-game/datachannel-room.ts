import { SIGNATURE, MessageBridge, promiseWithResolvers } from "@roster-lock/utils";
import { ISimpleEventEmitter, createSimpleEmitter } from "@roster-lock/utils";
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

type PrivateKey = Parameters<typeof SIGNATURE.ASYMMETRIC.createSignature>[0];

export async function prepareWebRTCRoom(
  relayRoomConfig: RelayRoomConfig,
  fullUsers: Users,
  user: CurrentUser
){
  const users = fullUsers.map(u => u.publicKey);
  const timestamp = Date.now();
  const signature = await SIGNATURE.ASYMMETRIC.createSignature(user.keys.privateKey as PrivateKey, {
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
    bridge.handleMessage(JSON.parse(data.toString()));
  });

  // setupWebRTCPeers registers the bridge.onEvent/onRequest listeners that
  // must see every real signaling message - including the very first one,
  // since the coordinator can send "host"/"get-offer" the instant both users
  // connect. It must be wired up synchronously, right alongside the message
  // handler above, with nothing awaited in between - any delay here (e.g. a
  // grace period to "confirm" the connection first) creates a window where
  // a fast-arriving message finds no listener and is silently dropped,
  // permanently stalling the negotiation with no error.
  const negotiation = setupWebRTCPeers(bridge, users, user.keys.publicKey);

  // If this attempt landed before the room existed on the coordinator (the
  // room-complete webhook hadn't arrived yet - or the connection just dies
  // for any other reason before negotiation finishes), the socket closes
  // with no real signaling ever happening. Race that against the actual
  // negotiation instead of hanging forever on a dead socket.
  const closedEarly = new Promise<never>((_, reject) => {
    ws.on("close", (code, reason) => {
      reject(new Error(`WebSocket closed before negotiation finished: code=${code} reason=${reason}`));
    });
    ws.on("error", (e) => reject(e));
  });

  const { isHost, peers } = await Promise.race([negotiation, closedEarly]);
  if(isHost){
    return new HostPeerRoom(user.keys.publicKey, users, peers);
  } else {
    return new ClientPeerRoom(user.keys.publicKey, users, peers);
  }
}


const DATA_CHANNEL_NAME = "Headless Game Example";
const DATA_CHANNEL_ID = 0;

type WebRTCResult = {
  isHost: boolean,
  peers: Record<string, {
    conn: PeerConnection,
    datachannel: DataChannel,
    getLocalDescription: ()=>Promise<string>,
    hasRemoteDescription: ()=>boolean,
  }>
};

// The server sends a "host" event only to the selected host, and drives
// offer/answer requests asynchronously over the bridge - peers aren't known
// synchronously, so this must wait for the signaling to actually resolve a
// role and its full peer set before HostPeerRoom/ClientPeerRoom is built.
function setupWebRTCPeers(
  bridge: MessageBridge, allowedUsers: Array<string>, self: string
): Promise<WebRTCResult> {
  const { promise, resolve } = promiseWithResolvers<WebRTCResult>();
  let isHost = false;
  let resolved = false;
  const expectedOtherUsers = allowedUsers.filter(u => u !== self).length;
  const connections: Record<string, {
    conn: PeerConnection,
    datachannel: DataChannel,
    getLocalDescription: ()=>Promise<string>,
    hasRemoteDescription: ()=>boolean,
  }> = {};

  // node-datachannel uses strings for candidates, not complex objects
  const bufferedIce: Record<string, Array<{ candidate: string, mid: string }>> = {};
  // A peer connection object exists as soon as an offer/answer is exchanged,
  // well before the underlying data channel has actually finished its
  // ICE/DTLS handshake - resolving on connection-object count alone let
  // callers start sending (e.g. Game.create's commit-reveal) before the
  // channel could accept messages. Only count peers whose channel is open.
  const openedUsers = new Set<string>();

  function maybeResolve(){
    if(resolved) return;
    // Host needs a peer for every other user; a client only ever gets one
    // (the host), created as soon as the server's "get-offer" request lands.
    const needed = isHost ? expectedOtherUsers : 1;
    if(openedUsers.size < needed) return;
    resolved = true;
    resolve({ isHost, peers: connections });
  }

  bridge.onEvent("host", () => {
    isHost = true;
    maybeResolve();
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
    const pc = createPeerConnection(message.user);
    // No remote description yet, so creating the data channel here is what
    // triggers auto-negotiation to generate our local *offer*.
    const peer = attachDataChannel(message.user, pc);
    // In node-datachannel, this returns the string directly
    return peer.getLocalDescription();
  });

  bridge.onRequest("offer-for-answer", async (message: { user: string, offer: string }) => {
    const pc = createPeerConnection(message.user);
    // Must set the remote offer *before* creating the data channel: node-datachannel
    // auto-negotiates as soon as a channel is added, and does so as a fresh offer
    // unless a pending remote offer already exists - creating the channel first (as
    // both sides used to) makes both peers generate their own offer ("glare"),
    // which showed up as an ICE role conflict and a DTLS handshake that never
    // completed. Setting the remote description first makes this side correctly
    // generate an *answer* instead.
    pc.setRemoteDescription(message.offer, "offer");
    const peer = attachDataChannel(message.user, pc);
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

  const pendingPeers: Record<string, {
    pc: PeerConnection,
    getLocalDescription: ()=>Promise<string>,
    hasRemoteDescription: ()=>boolean,
  }> = {};

  return promise;

  function createPeerConnection(user: string) {
    if (user in connections || user in pendingPeers) throw new Error("Connection already exists");
    if (!allowedUsers.includes(user)) throw new Error("User not allowed");

    // Configuration is standard
    const pc = new PeerConnection(user, {
      iceServers: ["stun:stun.l.google.com:19302"],
      bindAddress: "0.0.0.0",
    });
    // node-datachannel synchronously negotiates and fires the local
    // description as soon as createDataChannel() is called (auto-negotiation),
    // with no replay for listeners registered afterward - so onLocalDescription
    // must be wired up before createDataChannel(), not after.
    let localDescription: string | null = null;
    const listeners: Array<(localDescription: string)=>any> = [];
    pc.onLocalDescription((description) => {
      localDescription = description;
      while(listeners.length > 0){
        const listener = listeners.pop();
        if(listener) listener(description);
      }
    });

    pc.onLocalCandidate((candidate, mid) => {
      bridge.sendEvent("ice", { ice: { candidate, mid }, user });
    });

    const peer = {
      pc,
      getLocalDescription: async (): Promise<string> => {
        if (localDescription) return localDescription;
        return new Promise<string>((resolve) => {
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
    pendingPeers[user] = peer;
    return pc;
  }

  // Creating the data channel is what triggers node-datachannel's
  // auto-negotiation - callers must set a remote offer first (if answering)
  // before calling this, or it'll generate a competing offer instead of an answer.
  function attachDataChannel(user: string, pc: PeerConnection) {
    const pending = pendingPeers[user];
    delete pendingPeers[user];

    const dc = pc.createDataChannel(DATA_CHANNEL_NAME, {
      negotiated: true,
      id: DATA_CHANNEL_ID
    });

    dc.onOpen(() => {
      bridge.sendEvent("connect-" + user, true);
      openedUsers.add(user);
      maybeResolve();
    });

    connections[user] = {
      conn: pc,
      datachannel: dc,
      getLocalDescription: pending.getLocalDescription,
      hasRemoteDescription: pending.hasRemoteDescription,
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
