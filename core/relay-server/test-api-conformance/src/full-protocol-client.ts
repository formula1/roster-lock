import { MessageBridge, SIGNATURE_ASYMMETRIC, createShaFromJSON, AsymmetricSignatureKeyPair } from "@roster-lock/utils";

export type MachineDef = {
  machineId: string;
  displayName: string;
  playerCount: number;
  keys: AsymmetricSignatureKeyPair;
};

export async function generateMachineDef(machineId: string, displayName: string): Promise<MachineDef> {
  return { machineId, displayName, playerCount: 1, keys: await SIGNATURE_ASYMMETRIC.generateKeyPair() };
}

// A deliberately dumb "honest" protocol responder - it does none of a real
// match-agent client's actual selection/encryption/download work, just
// returns fixed, validly-shaped values at each step. Both relay
// implementations only ever relay these payloads between machines (see
// single-host's room/steps.ts and cloudflare's durable-objects/bridge/*),
// never inspect their contents, so this is enough to prove the relay drives
// the room protocol correctly without pulling in match-agent's real stack.
const AGREED_FINAL_SELECTION = { selection: "conformance-agreed-final-value" };

export function wireHonestMachine(bridge: MessageBridge, publicKey: string) {
  bridge.onRequest("ping", () => "pong");
  bridge.onRequest("user-selection", () => `commit-${publicKey}`);
  bridge.onRequest("all-selection-for-user-decryption", () => `reveal-${publicKey}`);
  bridge.onRequest("all-decryption-for-user-final", () => AGREED_FINAL_SELECTION);
  bridge.onRequest("user-download", () => "ok");
}

export function waitForBridgeEvent<T = unknown>(bridge: MessageBridge, path: string): Promise<T> {
  return new Promise((resolve) => bridge.onEvent(path, (data: T) => resolve(data)));
}

export async function registerMatchmaker(
  baseUrl: string, adminToken: string, name: string,
): Promise<AsymmetricSignatureKeyPair> {
  const keys = await SIGNATURE_ASYMMETRIC.generateKeyPair();
  const res = await fetch(`${baseUrl}/api/v1/matchmaker`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ name, publicKey: keys.publicVerificationKey }),
  });
  if (!res.ok) throw new Error(`Failed to register matchmaker: ${res.status} ${await res.text()}`);
  return keys;
}

export async function createRoom(
  baseUrl: string,
  matchmakerKeys: AsymmetricSignatureKeyPair,
  machines: Array<MachineDef>,
): Promise<string> {
  // room_stats bookkeeping on both implementations reads rosterConfig.engine
  // .name/.version unconditionally (see room.ts's room_stats INSERT) - an
  // empty rosterConfig throws there before a response is ever sent.
  const rosterConfig = { engine: { name: "conformance-engine", version: "1.0.0" }, rosters: {} };
  const rosterConfigHash = await createShaFromJSON(rosterConfig);
  const coordinatorId = false as const;
  const machinesBody = machines.map(({ machineId, displayName, playerCount, keys }) => ({
    machineId, displayName, playerCount, publicKey: keys.publicVerificationKey,
  }));

  const signature = await SIGNATURE_ASYMMETRIC.createSignature(matchmakerKeys.privateSigningKey, {
    service: "create-room",
    publicKey: matchmakerKeys.publicVerificationKey,
    rosterConfigHash,
    machines: machinesBody,
    coordinatorId,
  });

  const res = await fetch(`${baseUrl}/api/v1/room`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      rosterConfig, rosterConfigHash, machines: machinesBody, coordinatorId,
      publicKey: matchmakerKeys.publicVerificationKey, signature,
    }),
  });
  if (!res.ok) throw new Error(`Failed to create room: ${res.status} ${await res.text()}`);
  const { roomId } = await res.json() as { roomId: string };
  return roomId;
}

export async function connectMachineSocket(
  baseUrl: string, roomId: string, machine: MachineDef,
): Promise<{ ws: WebSocket; bridge: MessageBridge }> {
  const timestamp = Date.now();
  const signature = await SIGNATURE_ASYMMETRIC.createSignature(machine.keys.privateSigningKey, {
    service: "room-ws",
    roomId,
    publicKey: machine.keys.publicVerificationKey,
    timestamp,
  });

  const wsUrl = new URL(`${baseUrl}/api/v1/room/${roomId}`);
  wsUrl.protocol = wsUrl.protocol === "https:" ? "wss:" : "ws:";
  wsUrl.searchParams.set("room", roomId);
  wsUrl.searchParams.set("t", String(timestamp));
  wsUrl.searchParams.set("pk", machine.keys.publicVerificationKey);
  wsUrl.searchParams.set("sig", signature);

  // Passed as a string, not the URL object: @cloudflare/workers-types
  // narrows the ambient WebSocket constructor's param type to string-only,
  // and this module gets type-checked under that global augmentation too
  // when cloudflare's own tests import it.
  const ws = new WebSocket(wsUrl.toString());

  // Bridge, listener, and honest-machine handlers all wired *before*
  // awaiting "open": the relay starts the room (and can fire its first
  // "ping"/step request) the instant every machine's socket is open on its
  // end, which can race a caller that waits for all N of *our*
  // connectMachineSocket calls to resolve before wiring any handlers - one
  // socket opening first must already be ready to answer.
  const bridge = new MessageBridge((message) => ws.send(JSON.stringify(message)));
  ws.addEventListener("message", (event) => {
    void bridge.handleMessage(JSON.parse(event.data.toString()));
  });
  wireHonestMachine(bridge, machine.keys.publicVerificationKey);

  await new Promise<void>((resolve, reject) => {
    ws.addEventListener("open", () => resolve(), { once: true });
    ws.addEventListener("error", () => reject(new Error(`WebSocket connection to ${wsUrl} failed`)), { once: true });
  });

  return { ws, bridge };
}

export function waitForSocketClose(ws: WebSocket): Promise<{ code: number; reason: string }> {
  return new Promise((resolve) => {
    ws.addEventListener("close", (event) => resolve({ code: event.code, reason: event.reason }), { once: true });
  });
}
