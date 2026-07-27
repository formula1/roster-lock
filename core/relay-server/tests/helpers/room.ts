import { MessageBridge } from "@roster-lock/utils";
import { Room } from "../../server/src/version-1/durable-objects/Room";
import { startRoom as startBridgeRoom, CONVO_STATE_KEY } from "../../server/src/version-1/durable-objects/bridge";
import { TIMEOUT_CONTROLLER, TimeoutInput } from "../../server/src/version-1/durable-objects/TimeoutController";
import { RoomConfig } from "../../server/src/version-1/types";
import { FakeDurableObjectState, FakeWebSocket } from "./fakes";
import { makeFakeEnv, FakeCoordinatorRow } from "./env";

export type TestUser = {
  machineId: string;
  publicKey: string;
  bridge: MessageBridge;
  socket: FakeWebSocket;
  // Raw wire messages this user's bridge sent *to* the room (i.e. what
  // room.webSocketMessage was called with on their behalf) - distinct from
  // socket.sentRaw, which captures the room's outgoing messages *to* them.
  sentToRoom: Array<string>;
};

export type TestRoom = Awaited<ReturnType<typeof makeTestRoom>>;

// Builds a real `Room` DO instance wired to fake storage/websockets/env, with
// one MessageBridge per user standing in for match-agent's roomBridge (see
// exchange-and-download-selections.ts) - each user's bridge sends "over the
// wire" straight into room.webSocketMessage, and whatever the room sends back
// is routed back into that user's own bridge.handleMessage. This is the relay
// side of the same "wire two MessageBridges together" pattern match-agent's
// own tests use (tests/integration/helpers/bridge.ts's wireBridgePair) -
// except here the DO's real bridge/index.ts + response-handlers.ts logic is
// what's under test, not a fake standing in for it.
export type TestRoomOptions = {
  coordinatorOverrides?: Partial<FakeCoordinatorRow>;
  // Room's real defaults are 5s user / 5min total - way too slow to wait out
  // in a test. Room's constructor takes these as an optional third param
  // real Cloudflare instantiation never supplies, so tests can use fast ones
  // instead. totalTimeoutLength defaults comfortably above every other
  // timing in these tests so it never fires by accident - override it low in
  // a test that specifically wants to exercise the total-timeout path.
  userTimeoutLength?: number;
  totalTimeoutLength?: number;
};

export async function makeTestRoom(userCount = 2, options: TestRoomOptions = {}){
  const { coordinatorOverrides = {}, userTimeoutLength = 50, totalTimeoutLength = 10_000 } = options;
  const { env, coordinator, statements } = await makeFakeEnv(coordinatorOverrides);
  const state = new FakeDurableObjectState();
  const room = new Room(state as any, env, { user: userTimeoutLength, total: totalTimeoutLength });
  // Mirrors Cloudflare actually invoking the DO's alarm() method when the
  // scheduled time elapses - without this, setAlarm would just be recorded
  // and nothing would ever fire it.
  state.storage.onAlarm(() => { void (room as any).alarm(); });

  const machineIds = Array.from({ length: userCount }, (_, i) => ({
    machineId: `user-${i + 1}`,
    publicKey: `pk-${i + 1}`,
    playerCount: 1,
  }));

  const config: RoomConfig = {
    matchmakerId: "matchmaker-1",
    coordinatorId: "coordinator-1",
    roomId: "room-1",
    rosterConfigHash: "hash-1",
    machines: machineIds.map(u => ({ ...u, displayName: u.machineId })),
  };

  await state.storage.put("config", config);
  // Mirrors Room's real POST '/' handler: startRoom only ever transitions out
  // of this exact placeholder state (see bridge/index.ts), so it has to be
  // seeded here too, not left absent (which now means "already finished").
  await state.storage.put(CONVO_STATE_KEY, "wait-for-connections");
  // Mirrors what Room's (private) startTimeouts does on room creation - seeds
  // the total-timeout plus one machine-timeout per machine via the real
  // TimeoutController, so refreshTimeout/alarm() have real entries to work
  // with instead of a hand-rolled storage shape that'd drift from Room.ts's.
  await state.storage.transaction(async (txc) => {
    const timeouts: Array<TimeoutInput> = [
      { id: "total-timeout", offset: totalTimeoutLength, fn: { id: "total-timeout", args: {} } },
      ...machineIds.map(({ machineId }) => ({
        id: "machine-timeout-" + machineId,
        offset: userTimeoutLength,
        fn: { id: "machine-timeout", args: { machineId } },
      })),
    ];
    await TIMEOUT_CONTROLLER.addTimeouts(txc, timeouts);
  });

  const users: Array<TestUser> = machineIds.map(({ machineId, publicKey }) => {
    const socket = new FakeWebSocket({ machineId, publicKey, connectedAt: new Date().toISOString() });
    const sentToRoom: Array<string> = [];
    const bridge = new MessageBridge((message) => {
      const raw = JSON.stringify(message);
      sentToRoom.push(raw);
      void room.webSocketMessage(socket as any, raw);
    });
    socket.onSend((data) => {
      void bridge.handleMessage(JSON.parse(data));
    });
    state.addSocket(socket);
    return { machineId, publicKey, bridge, socket, sentToRoom };
  });

  return { room, state, env, config, coordinator, statements, users };
}

// Mirrors the `/room-ws` handler's "last socket to connect kicks off the
// protocol" behavior, without needing a real WebSocketPair (Workers-only
// global, unavailable under plain Node).
export async function startTestRoom(testRoom: TestRoom){
  await startBridgeRoom({ state: testRoom.state as any, env: testRoom.env });
}

const AGREED_FINAL_SELECTION = { selection: "agreed-final-value" };

export type StepName = (
  | "user-selection"
  | "all-selection-for-user-decryption"
  | "all-decryption-for-user-final"
  | "user-download"
);

export type StepOverrides = Partial<Record<StepName, (data: any) => any>>;

// Registers the "honest agent" responses for the full sync-dl protocol (see
// room-handler-bridge/steps.ts on the match-agent side, which this mirrors in
// miniature) - every step just returns a fixed, valid value unless overridden,
// which is how individual-step-failure tests inject a throw at a given step.
export function wireHonestResponder(user: TestUser, overrides: StepOverrides = {}){
  user.bridge.onRequest("user-selection",
    overrides["user-selection"] ?? (() => `commit-${user.publicKey}`));
  user.bridge.onRequest("all-selection-for-user-decryption",
    overrides["all-selection-for-user-decryption"] ?? (() => `reveal-${user.publicKey}`));
  user.bridge.onRequest("all-decryption-for-user-final",
    overrides["all-decryption-for-user-final"] ?? (() => AGREED_FINAL_SELECTION));
  user.bridge.onRequest("user-download",
    overrides["user-download"] ?? (() => "ok"));
}

export function waitForBridgeEvent<T = any>(user: TestUser, path: string): Promise<T> {
  return new Promise((resolve) => {
    user.bridge.onEvent(path, (data: T) => resolve(data));
  });
}

// Delivers a hand-crafted raw message as if it came straight from this
// user's client, bypassing their (well-behaved) MessageBridge entirely - for
// exercising malformed/unknown/out-of-order input a real MessageBridge would
// never construct on its own.
export async function sendRaw(testRoom: TestRoom, user: TestUser, message: any){
  return testRoom.room.webSocketMessage(user.socket as any, JSON.stringify(message));
}
