import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  makeTestRoom, startTestRoom, wireHonestResponder, waitForBridgeEvent,
} from "./helpers/room";
import { stubWebhookFetch } from "./helpers/env";
import { sendPing } from "../src/version-1/durable-objects/bridge/ping-pong";

// These use vitest's fake timers (rather than real waits) so we can jump
// straight past the 1s ping interval / total-timeout deadline instead of the
// test actually taking that long. Only `setTimeout`/`Date` are virtualized -
// promise/microtask resolution (used by everything else in these tests, e.g.
// waitForBridgeEvent) runs on the real microtask queue regardless.
let fetchCalls: ReturnType<typeof stubWebhookFetch>;
beforeEach(() => {
  fetchCalls = stubWebhookFetch();
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("ping/pong keepalive", () => {
  it("sendPing marks ping-state sent and delivers a ping request", async () => {
    const testRoom = await makeTestRoom(2, { userTimeoutLength: 10_000 });
    const [userA] = testRoom.users;
    userA.bridge.onRequest("ping", () => "pong");

    await sendPing({ state: testRoom.state as any, env: testRoom.env }, userA.machineId);

    expect(await testRoom.state.storage.get(`ping-state-${userA.machineId}`)).toBe("sent");
    const sentPing = userA.socket.sentRaw.find(raw => JSON.parse(raw).path === "ping");
    expect(sentPing).toBeDefined();
  });

  it("a pong response clears ping-state and schedules the next ping ~1s later", async () => {
    const testRoom = await makeTestRoom(2, { userTimeoutLength: 10_000 });
    const [userA] = testRoom.users;
    userA.bridge.onRequest("ping", () => "pong");

    await sendPing({ state: testRoom.state as any, env: testRoom.env }, userA.machineId);
    // The "pong" response travels back through the same real
    // room.webSocketMessage path as everything else (userA.bridge's
    // sendMessage callback, wired in makeTestRoom).
    await vi.waitFor(async () => {
      expect(await testRoom.state.storage.get(`ping-state-${userA.machineId}`)).toBeUndefined();
    });

    const alarm = testRoom.state.storage.getAlarm();
    expect(alarm).not.toBeNull();
    expect(alarm!).toBeGreaterThan(Date.now());
    expect(alarm!).toBeLessThanOrEqual(Date.now() + 1000);
  });

  it("keeps pinging automatically every ~1s as long as the user keeps ponging", async () => {
    const testRoom = await makeTestRoom(2, { userTimeoutLength: 10_000 });
    const [userA] = testRoom.users;
    let pingCount = 0;
    userA.bridge.onRequest("ping", () => { pingCount++; return "pong"; });

    await sendPing({ state: testRoom.state as any, env: testRoom.env }, userA.machineId);
    await vi.waitFor(() => expect(pingCount).toBe(1));

    await vi.advanceTimersByTimeAsync(1000);
    await vi.waitFor(() => expect(pingCount).toBe(2));

    await vi.advanceTimersByTimeAsync(1000);
    await vi.waitFor(() => expect(pingCount).toBe(3));
  });

  it("fails the room if a pong arrives with no outstanding ping to answer", async () => {
    const testRoom = await makeTestRoom(2, { userTimeoutLength: 10_000 });
    const [userA, userB] = testRoom.users;
    userA.bridge.onRequest("ping", () => "pong");
    const errorB = waitForBridgeEvent<string>(userB, "error");

    await sendPing({ state: testRoom.state as any, env: testRoom.env }, userA.machineId);
    // Simulate the ping-state having desynced (e.g. a duplicate/replayed
    // pong after the first one already cleared it) by clearing it out from
    // under a *real*, still-outstanding ping request.
    await testRoom.state.storage.delete(`ping-state-${userA.machineId}`);
    await vi.advanceTimersByTimeAsync(0);

    await expect(errorB).resolves.toBe("Not expecting pong");
  });
});

describe("total timeout", () => {
  it("fails the room once the absolute deadline elapses, even while users stay active", async () => {
    const testRoom = await makeTestRoom(2, { userTimeoutLength: 10_000, totalTimeoutLength: 500 });
    const [userA, userB] = testRoom.users;

    // Answer "user-selection" honestly (proving continued activity refreshes
    // each user's *own* timeout), but never answer the next step - so the
    // room only ever ends via the absolute cap, not by actually finishing or
    // by either user going quiet.
    const neverRespond = () => new Promise(() => {});
    userA.bridge.onRequest("user-selection", () => `commit-${userA.publicKey}`);
    userA.bridge.onRequest("all-selection-for-user-decryption", neverRespond);
    userB.bridge.onRequest("user-selection", () => `commit-${userB.publicKey}`);
    userB.bridge.onRequest("all-selection-for-user-decryption", neverRespond);

    const errorA = waitForBridgeEvent<string>(userA, "error");
    const errorB = waitForBridgeEvent<string>(userB, "error");

    await startTestRoom(testRoom);
    await vi.advanceTimersByTimeAsync(500);

    await expect(errorA).resolves.toBe("Total timed out");
    await expect(errorB).resolves.toBe("Total timed out");
    expect(await testRoom.state.storage.get("config")).toBeUndefined();
  });

  it("does not fire early just because a user's own timeout was refreshed", async () => {
    const testRoom = await makeTestRoom(2, { userTimeoutLength: 10_000, totalTimeoutLength: 500 });
    const [userA, userB] = testRoom.users;
    wireHonestResponder(userA);
    wireHonestResponder(userB);

    const errorA = waitForBridgeEvent<string>(userA, "error");
    const errorB = waitForBridgeEvent<string>(userB, "error");
    const allDownloadA = waitForBridgeEvent(userA, "all-download");
    const allDownloadB = waitForBridgeEvent(userB, "all-download");

    await startTestRoom(testRoom);
    await Promise.all([allDownloadA, allDownloadB]);
    await Promise.all([userA.socket.waitForClose(), userB.socket.waitForClose()]);

    // The room finished well within the 500ms total budget - advancing past
    // it now must not resurrect a finished (storage already wiped) room.
    await vi.advanceTimersByTimeAsync(500);
    await Promise.race([Promise.all([errorA, errorB]), vi.advanceTimersByTimeAsync(0)]);

    expect(await testRoom.state.storage.get("config")).toBeUndefined();
    expect(fetchCalls).toHaveLength(1);
    expect(fetchCalls[0].url).toBe("http://webhook.invalid/success");
  });
});
