import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  makeTestRoom, startTestRoom, wireHonestResponder, waitForBridgeEvent, sendRaw, StepName,
} from "./helpers/room";
import { stubWebhookFetch } from "./helpers/env";

// These drive the real relay-server Durable Object protocol logic (Room.ts +
// durable-objects/bridge/*) against fake storage/websockets/env (see
// helpers/), the same way match-agent's own protocol.test.ts drives
// bindStepsToBridge against a fake relay - here it's the relay's real code
// under test instead of a fake standing in for it.

let fetchCalls: ReturnType<typeof stubWebhookFetch>;
beforeEach(() => { fetchCalls = stubWebhookFetch(); });
afterEach(() => { vi.unstubAllGlobals(); });

describe("full protocol success", () => {
  it("both users converge on all-download and the room is marked completed", async () => {
    const testRoom = await makeTestRoom(2);
    const [userA, userB] = testRoom.users;
    wireHonestResponder(userA);
    wireHonestResponder(userB);

    const errorA = waitForBridgeEvent(userA, "error");
    const errorB = waitForBridgeEvent(userB, "error");
    const allDownloadA = waitForBridgeEvent(userA, "all-download");
    const allDownloadB = waitForBridgeEvent(userB, "all-download");

    await startTestRoom(testRoom);
    await Promise.all([allDownloadA, allDownloadB]);
    // completeRoom (DB update, closing sockets) runs *after* the message that
    // earned it returns control, and nothing awaits that in-flight
    // webSocketMessage call directly - socket close is the concrete signal.
    await Promise.all([userA.socket.waitForClose(), userB.socket.waitForClose()]);
    // Sockets close *before* cleanupRoom's own deleteAll()/deleteAlarm() calls -
    // give those a tick to land before checking the wipe.
    await new Promise((r) => setTimeout(r, 0));

    // A finished room's storage is wiped entirely (cost - see cleanupRoom),
    // not just flagged closed, so "config" gone is the signal - and it really
    // is deleteAll(), not a delete of just the one key used as the guard.
    expect(await testRoom.state.storage.get("config")).toBeUndefined();
    expect(await testRoom.state.storage.get("timeouts")).toBeUndefined();
    expect(testRoom.state.storage.getAlarm()).toBeNull();

    // Neither user should ever see a bridge-level "error" event on the happy path.
    await Promise.race([Promise.all([errorA, errorB]), new Promise((r) => setTimeout(r, 20))]);
    expect(userA.socket.closed?.reason).toBe("completed");
    expect(userB.socket.closed?.reason).toBe("completed");

    expect(fetchCalls).toHaveLength(1);
    expect(fetchCalls[0].url).toBe("http://webhook.invalid/success");
  });
});

describe("one client fails at each step", () => {
  const steps: Array<StepName> = [
    "user-selection",
    "all-selection-for-user-decryption",
    "all-decryption-for-user-final",
    "user-download",
  ];

  it.each(steps)("failing user-A's response at %s fails the room and tells user-B why", async (step) => {
    const testRoom = await makeTestRoom(2);
    const [userA, userB] = testRoom.users;
    const failure = `boom at ${step}`;

    wireHonestResponder(userA, { [step]: () => { throw new Error(failure); } });
    wireHonestResponder(userB);

    const errorB = waitForBridgeEvent<string>(userB, "error");

    await startTestRoom(testRoom);

    await expect(errorB).resolves.toBe(failure);
    await Promise.all([userA.socket.waitForClose(), userB.socket.waitForClose()]);
    await new Promise((r) => setTimeout(r, 0));

    expect(await testRoom.state.storage.get("config")).toBeUndefined();
    expect(userA.socket.closed?.reason).toBe(failure);
    expect(userB.socket.closed?.reason).toBe(failure);
    // failWebhook is a no-op here since the fake coordinator has no
    // failure_webhook_url - only the DB stats update should have run.
    expect(fetchCalls).toHaveLength(0);
  });
});

describe("everyone fails at the same step", () => {
  it("both users' responses erroring at the same step still only fails the room once", async () => {
    const testRoom = await makeTestRoom(2);
    const [userA, userB] = testRoom.users;

    wireHonestResponder(userA, { "user-selection": () => { throw new Error("A is broken"); } });
    wireHonestResponder(userB, { "user-selection": () => { throw new Error("B is broken"); } });

    const errorA = waitForBridgeEvent<string>(userA, "error");
    const errorB = waitForBridgeEvent<string>(userB, "error");

    await startTestRoom(testRoom);

    const [reasonA, reasonB] = await Promise.all([errorA, errorB]);
    // Whichever failure lands first in the DO's serialized event queue wins -
    // both users must be told the *same* reason, whichever it was.
    expect(reasonA).toBe(reasonB);
    expect(["A is broken", "B is broken"]).toContain(reasonA);

    await Promise.all([userA.socket.waitForClose(), userB.socket.waitForClose()]);
    // cleanupRoom closes sockets *before* its own deleteAll()/deleteAlarm() and
    // failRoom's DB/webhook calls - give those a tick to land before checking.
    await new Promise((r) => setTimeout(r, 0));

    expect(await testRoom.state.storage.get("config")).toBeUndefined();
    // The claim-on-"config" guard in cleanupRoom must make the second failure
    // a no-op - only one room_stats row update should have gone through.
    const statUpdates = testRoom.statements.filter(s => s.sql.includes("UPDATE room_stats"));
    expect(statUpdates).toHaveLength(1);
  });
});

describe("messages the relay doesn't know how to handle", () => {
  it("an unknown event path fails the room", async () => {
    const testRoom = await makeTestRoom(2);
    const [userA, userB] = testRoom.users;
    wireHonestResponder(userA);
    wireHonestResponder(userB);
    const errorB = waitForBridgeEvent<string>(userB, "error");

    await startTestRoom(testRoom);
    await sendRaw(testRoom, userA, { messageType: "event", path: "not-a-real-event", value: {} });

    await expect(errorB).resolves.toBe("Invalid event path");
  });

  it("an unknown request path fails the room", async () => {
    const testRoom = await makeTestRoom(2);
    const [userA, userB] = testRoom.users;
    wireHonestResponder(userA);
    wireHonestResponder(userB);
    const errorB = waitForBridgeEvent<string>(userB, "error");

    await startTestRoom(testRoom);
    await sendRaw(testRoom, userA, { messageType: "request", id: "req-1", path: "not-a-real-request", value: {} });

    await expect(errorB).resolves.toBe("Invalid request path");
  });

  it("a schema-invalid message fails the room", async () => {
    const testRoom = await makeTestRoom(2);
    const [userA, userB] = testRoom.users;
    wireHonestResponder(userA);
    wireHonestResponder(userB);
    const errorB = waitForBridgeEvent<string>(userB, "error");

    await startTestRoom(testRoom);
    await sendRaw(testRoom, userA, { messageType: "not-a-real-type", garbage: true });

    await expect(errorB).resolves.toBe("Invalid message");
  });
});

describe("out-of-order / stale messages", () => {
  it("a response for a request id that was never issued fails the room", async () => {
    const testRoom = await makeTestRoom(2);
    const [userA, userB] = testRoom.users;
    wireHonestResponder(userA);
    wireHonestResponder(userB);

    const errorB = waitForBridgeEvent<string>(userB, "error");
    await startTestRoom(testRoom);

    // No "ws-request-<id>" entry was ever stored under this id - simulates a
    // client sending a response the relay never actually asked for.
    await sendRaw(testRoom, userA, {
      id: "totally-made-up-id",
      messageType: "response",
      valueType: "result",
      value: "whatever",
    });

    await expect(errorB).resolves.toBe("Invalid request id");
  });

  it("replaying an already-consumed response fails the room", async () => {
    const testRoom = await makeTestRoom(2);
    const [userA, userB] = testRoom.users;

    // Both users answer "user-selection" honestly, but neither ever answers
    // the *next* step - the protocol legitimately stalls right after
    // "user-selection" completes, giving a stable window to replay a
    // stale message without racing the rest of the protocol to completion.
    const neverRespond = () => new Promise(() => {});
    userA.bridge.onRequest("user-selection", () => `commit-${userA.publicKey}`);
    userA.bridge.onRequest("all-selection-for-user-decryption", neverRespond);
    userB.bridge.onRequest("user-selection", () => `commit-${userB.publicKey}`);
    userB.bridge.onRequest("all-selection-for-user-decryption", neverRespond);

    const errorB = waitForBridgeEvent<string>(userB, "error");
    await startTestRoom(testRoom);

    // Let the first, legitimate "user-selection" response finish processing -
    // its request id is deleted from storage the moment it's consumed (see
    // bridge-compatability.ts's "response" branch).
    await new Promise((r) => setTimeout(r, 10));
    const rawResponse = userA.sentToRoom.find(raw => JSON.parse(raw).messageType === "response");
    expect(rawResponse).toBeDefined();

    // Replay that exact same response - simulating a duplicated/out-of-order
    // network delivery of a message that's already been consumed.
    await sendRaw(testRoom, userA, JSON.parse(rawResponse!));

    await expect(errorB).resolves.toBe("Invalid request id");
  });
});
