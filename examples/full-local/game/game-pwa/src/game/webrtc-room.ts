import { SIGNATURE, MessageBridge, promiseWithResolvers, ISimpleEventEmitter, createSimpleEmitter } from "@roster-lock/utils";
import { CurrentUser, MatchInfo, RoomUser } from "../context/GameSessionContext";

// Browser port of game-headless/src/steps/3-game/datachannel-room.ts. Same
// signaling protocol/state machine (host/ice/get-offer/offer-for-answer/
// finish-answer over a MessageBridge on a signaling WebSocket) - only the
// transport primitives change, since node-datachannel and `ws` are Node-only:
// native RTCPeerConnection/RTCDataChannel/WebSocket instead. The other big
// difference is negotiation itself - node-datachannel auto-negotiates and
// hands back a local description via a callback as soon as a data channel is
// created; browsers require an explicit createOffer/createAnswer +
// setLocalDescription instead, so those calls are driven directly in the
// bridge request handlers below rather than through a callback.

export type WebRTCPeer = {
  conn: RTCPeerConnection;
  datachannel: RTCDataChannel;
  bridge: MessageBridge;
};

export interface PeerRoom {
  users: Array<string>;
  onAction: ISimpleEventEmitter<[userId: string, body: any]>;
  broadcastAction(body: any): void;
  close(): void;
}

type PrivateKey = Parameters<typeof SIGNATURE.ASYMMETRIC.createSignature>[0];

const ICE_SERVERS: Array<RTCIceServer> = [{ urls: "stun:stun.l.google.com:19302" }];
const DATA_CHANNEL_NAME = "Match Lock PWA";
const DATA_CHANNEL_ID = 0;

export async function prepareWebRTCRoom(
  relayRoomConfig: MatchInfo,
  fullUsers: Array<RoomUser>,
  user: CurrentUser,
  gameCoordinatorUrl: string,
): Promise<PeerRoom> {
  const users = fullUsers.map((u) => u.publicKey);
  const timestamp = Date.now();
  const signature = await SIGNATURE.ASYMMETRIC.createSignature(user.keys.privateKey as PrivateKey, {
    service: "webrtc",
    roomId: relayRoomConfig.roomId,
    publicKey: user.keys.publicKey,
    timestamp,
  });

  // WebRTC peer signaling is handled by the game coordinator (game-headless's
  // GAME_SERVER, .../signaling), not the relay room relayRoomConfig.url points
  // at - the relay room is only used for the sync-dl step.
  const wsURL = new URL(gameCoordinatorUrl);
  wsURL.protocol = wsURL.protocol === "https:" ? "wss:" : "ws:";
  wsURL.pathname = "/signaling";
  wsURL.searchParams.set("room", relayRoomConfig.roomId);
  wsURL.searchParams.set("t", timestamp.toString());
  wsURL.searchParams.set("pk", user.keys.publicKey);
  wsURL.searchParams.set("sig", signature);

  const ws = new WebSocket(wsURL);
  const bridge = new MessageBridge((message) => ws.send(JSON.stringify(message)));
  ws.addEventListener("message", (event) => {
    bridge.handleMessage(JSON.parse(event.data));
  });

  // If the socket closes/errors before negotiation finishes, any peer
  // connections setupWebRTCPeers has already half-negotiated would otherwise
  // be abandoned rather than closed. Give it an abort signal so it can tear
  // those down instead of leaking them.
  const abortController = new AbortController();

  // setupWebRTCPeers registers the bridge.onEvent/onRequest listeners that
  // must see every real signaling message - including the very first one,
  // since the coordinator can send "host"/"get-offer" the instant both users
  // connect. It must be wired up synchronously, right alongside the message
  // handler above, with nothing awaited in between - any delay here creates a
  // window where a fast-arriving message finds no listener and is silently
  // dropped, permanently stalling the negotiation with no error.
  const negotiation = setupWebRTCPeers(bridge, users, user.keys.publicKey, abortController.signal);

  const closedEarly = new Promise<never>((_, reject) => {
    ws.addEventListener("close", (event) => {
      abortController.abort();
      reject(new Error(`WebSocket closed before negotiation finished: code=${event.code} reason=${event.reason}`));
    });
    ws.addEventListener("error", () => {
      abortController.abort();
      reject(new Error("WebSocket error during signaling"));
    });
  });

  const { isHost, peers } = await Promise.race([negotiation, closedEarly]);
  if (isHost) {
    return new HostPeerRoom(user.keys.publicKey, users, peers, ws);
  } else {
    return new ClientPeerRoom(user.keys.publicKey, users, peers, ws);
  }
}

type ConnectedPeer = {
  conn: RTCPeerConnection;
  datachannel: RTCDataChannel;
};

type WebRTCResult = {
  isHost: boolean;
  peers: Record<string, ConnectedPeer>;
};

// The server sends a "host" event only to the selected host, and drives
// offer/answer requests asynchronously over the bridge - peers aren't known
// synchronously, so this must wait for the signaling to actually resolve a
// role and its full peer set before HostPeerRoom/ClientPeerRoom is built.
function setupWebRTCPeers(
  bridge: MessageBridge, allowedUsers: Array<string>, self: string, signal: AbortSignal
): Promise<WebRTCResult> {
  const { promise, resolve, reject } = promiseWithResolvers<WebRTCResult>();
  let isHost = false;
  let resolved = false;
  const expectedOtherUsers = allowedUsers.filter(u => u !== self).length;
  const connections: Record<string, ConnectedPeer> = {};

  const bufferedIce: Record<string, Array<{ candidate: string, mid: string | null }>> = {};
  // A peer connection object exists as soon as an offer/answer is exchanged,
  // well before the underlying data channel has actually finished its
  // ICE/DTLS handshake - resolving on connection-object count alone would let
  // callers start sending before the channel could accept messages. Only
  // count peers whose channel is open.
  const openedUsers = new Set<string>();

  // Tracked only so an aborted negotiation can close half-built connections
  // that never made it into `connections`.
  const pendingPeers: Record<string, RTCPeerConnection> = {};

  const unsubs: Array<() => void> = [];
  function cleanupListeners(){
    for(const unsub of unsubs) unsub();
  }

  function maybeResolve(){
    if(resolved) return;
    // Host needs a peer for every other user; a client only ever gets one
    // (the host), created as soon as the server's "get-offer" request lands.
    const needed = isHost ? expectedOtherUsers : 1;
    if(openedUsers.size < needed) return;
    resolved = true;
    cleanupListeners();
    resolve({ isHost, peers: connections });
  }

  function abortPeers(){
    if(resolved) return;
    resolved = true;
    cleanupListeners();
    for(const pc of Object.values(pendingPeers)) pc.close();
    for(const conn of Object.values(connections)){
      conn.datachannel.close();
      conn.conn.close();
    }
    reject(new Error("WebRTC negotiation aborted"));
  }
  if(signal.aborted){
    abortPeers();
  } else {
    signal.addEventListener("abort", abortPeers, { once: true });
  }

  unsubs.push(bridge.onEvent("host", () => {
    isHost = true;
    maybeResolve();
  }));

  unsubs.push(bridge.onEvent("ice", (message: { user: string, ice: { candidate: string, mid: string | null } }) => {
    const peer = connections[message.user];
    if (!peer || !peer.conn.remoteDescription) {
      bufferedIce[message.user] = bufferedIce[message.user] || [];
      bufferedIce[message.user].push(message.ice);
      return;
    }
    peer.conn.addIceCandidate({ candidate: message.ice.candidate, sdpMid: message.ice.mid });
  }));

  unsubs.push(bridge.onRequest("get-offer", async (message: { user: string }) => {
    const pc = createPeerConnection(message.user);
    // Data channel has to exist before createOffer() for it to show up in
    // the offer's SDP.
    attachDataChannel(message.user, pc);
    await pc.setLocalDescription(await pc.createOffer());
    return pc.localDescription!.sdp;
  }));

  unsubs.push(bridge.onRequest("offer-for-answer", async (message: { user: string, offer: string }) => {
    const pc = createPeerConnection(message.user);
    await pc.setRemoteDescription({ type: "offer", sdp: message.offer });
    attachDataChannel(message.user, pc);
    flushIce(message.user);
    await pc.setLocalDescription(await pc.createAnswer());
    return pc.localDescription!.sdp;
  }));

  unsubs.push(bridge.onRequest("finish-answer", async (message: { user: string, answer: string }) => {
    const peer = connections[message.user];
    if (!peer) throw new Error("Connection doesn't exist");
    await peer.conn.setRemoteDescription({ type: "answer", sdp: message.answer });
    flushIce(message.user);
    return true;
  }));

  return promise;

  function createPeerConnection(user: string) {
    if (user in connections || user in pendingPeers) throw new Error("Connection already exists");
    if (!allowedUsers.includes(user)) throw new Error("User not allowed");

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pc.addEventListener("icecandidate", (event) => {
      if (event.candidate) {
        bridge.sendEvent("ice", {
          ice: { candidate: event.candidate.candidate, mid: event.candidate.sdpMid },
          user,
        });
      }
    });

    pendingPeers[user] = pc;
    return pc;
  }

  // Registers the connection synchronously (before any negotiation awaits),
  // so a fast-arriving "ice" event for this user during offer/answer
  // creation still finds a peer to buffer against.
  function attachDataChannel(user: string, pc: RTCPeerConnection): RTCDataChannel {
    delete pendingPeers[user];

    const dc = pc.createDataChannel(DATA_CHANNEL_NAME, {
      negotiated: true,
      id: DATA_CHANNEL_ID,
    });

    dc.addEventListener("open", () => {
      bridge.sendEvent("connect-" + user, true);
      openedUsers.add(user);
      maybeResolve();
    });

    connections[user] = { conn: pc, datachannel: dc };
    return dc;
  }

  function flushIce(user: string) {
    const peer = connections[user];
    if (!peer) return;
    for (const ice of bufferedIce[user] || []) {
      peer.conn.addIceCandidate({ candidate: ice.candidate, sdpMid: ice.mid });
    }
    bufferedIce[user] = [];
  }
}

class ClientPeerRoom implements PeerRoom {
  public hostPeer: WebRTCPeer;
  constructor(
    public self: string,
    public users: Array<string>,
    peers: Record<string, ConnectedPeer>,
    private ws: WebSocket,
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
  close(){
    closePeer(this.hostPeer);
    closeSignalingSocket(this.ws);
  }
}

class HostPeerRoom implements PeerRoom {
  public clientPeers: Record<string, WebRTCPeer>;
  constructor(
    public self: string,
    public users: Array<string>,
    peers: Record<string, ConnectedPeer>,
    private ws: WebSocket,
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
  close(){
    for(const peer of Object.values(this.clientPeers)){
      closePeer(peer);
    }
    closeSignalingSocket(this.ws);
  }
}

function closePeer(peer: Omit<WebRTCPeer, "bridge">){
  peer.datachannel.close();
  peer.conn.close();
}

function closeSignalingSocket(ws: WebSocket){
  if(ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING){
    ws.close();
  }
}

class WebRTCBridge extends MessageBridge {
  constructor(private peer: Omit<WebRTCPeer, "bridge">){
    super((message)=>(peer.datachannel.send(JSON.stringify(message))));
    peer.datachannel.addEventListener("message", (event) => {
      try {
        const payload = JSON.parse(event.data);
        this.handleMessage(payload);
      } catch (e) {
        console.error("Failed to parse WebRTC message", e);
      }
    })
  }
}
