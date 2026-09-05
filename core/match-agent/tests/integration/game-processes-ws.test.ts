import { describe, it, expect, afterEach, vi } from "vitest";
import { once } from "node:events";
import { WebSocket } from "ws";
import { MessageBridge } from "@roster-lock/utils";
import { startTestServer, TestServer } from "./helpers/server";
import { createFixturePluginDir } from "./helpers/plugin-dir";
import { makeTempFolder, cleanupFolder } from "./helpers/piece";
import { makeValidLockConfig } from "./helpers/validLockConfig";

const HEADLESS = "@roster-lock/game-launcher-headless";

// Covers gameProcessesWs (game-launcher.ts) - the WS counterpart to
// listGameProcesses that pushes a fresh snapshot on connect and again on
// every process start/exit, so match-agent-client's Game page doesn't have
// to poll /game-launcher/processes.
describe("WS /v1/game-launcher/processes", () => {
  const cleanups: Array<() => Promise<void> | void> = [];
  afterEach(async () => {
    while (cleanups.length) await cleanups.pop()!();
  });

  async function setup(): Promise<TestServer> {
    const fixture = await createFixturePluginDir([HEADLESS]);
    cleanups.push(fixture.cleanup);
    const folder = await makeTempFolder();
    cleanups.push(() => cleanupFolder(folder));
    const server = await startTestServer(folder, undefined, fixture.pluginDir);
    cleanups.push(() => server.close());
    return server;
  }

  function auth(server: TestServer): HeadersInit {
    return { Authorization: `Bearer ${server.authCode}` };
  }

  type ProcessSummary = { handleId: string, pluginName: string, exited: false | { code: number } };

  // Unlike piece-ensure-ws.test.ts's connectReady, there's no separate
  // "ready" handshake to wait for here - gameProcessesWs never receives a
  // request, so its first "processes" push already is the readiness signal.
  // Registers one persistent listener so a test can inspect every push, not
  // just the first.
  async function connectAndCollect(server: TestServer) {
    const ws = new WebSocket(`${server.wsUrl}/v1/game-launcher/processes`, {
      headers: { Authorization: `Bearer ${server.authCode}` },
    });
    const bridge = new MessageBridge((message) => ws.send(JSON.stringify(message)));
    const updates: Array<Array<ProcessSummary>> = [];
    const firstUpdate = new Promise<Array<ProcessSummary>>((resolve) => {
      bridge.onEvent("processes", (snapshot) => {
        updates.push(snapshot);
        if (updates.length === 1) resolve(snapshot);
      });
    });
    ws.on("message", (data) => bridge.handleMessage(JSON.parse(data.toString())));

    await once(ws, "open");
    const initialSnapshot = await firstUpdate;
    return { ws, bridge, updates, initialSnapshot };
  }

  async function startHeadlessMatch(server: TestServer, winners: Array<string>, resultDelayMs: number) {
    await fetch(`${server.httpUrl}/v1/game-launcher/${encodeURIComponent(HEADLESS)}/settings`, {
      method: "PUT",
      headers: { ...auth(server), "Content-Type": "application/json" },
      body: JSON.stringify({ binaryLocation: "headless" }),
    });

    const res = await fetch(`${server.httpUrl}/v1/game-launcher/${encodeURIComponent(HEADLESS)}/start`, {
      method: "POST",
      headers: { ...auth(server), "Content-Type": "application/json" },
      body: JSON.stringify({
        connectionConfig: { type: "internal" },
        currentMachine: { machineId: "m1", publicKey: "pk-a", privateKey: "sk" },
        allMachines: [],
        selectionResult: {},
        rosterConfig: makeValidLockConfig(),
        gameConfig: { winners, resultDelayMs },
        relayRoomId: "room-1",
      }),
    });
    expect(res.status).toBe(200);
    const { handleId } = await res.json();
    return handleId as string;
  }

  it("sends an empty snapshot as soon as a client connects, with no process started", async () => {
    const server = await setup();
    const { ws, initialSnapshot } = await connectAndCollect(server);
    ws.close();
    expect(initialSnapshot).toEqual([]);
  });

  it("terminates the connection with no auth, without ever sending a snapshot", async () => {
    const server = await setup();
    const ws = new WebSocket(`${server.wsUrl}/v1/game-launcher/processes`);
    let receivedMessage = false;
    ws.on("message", () => { receivedMessage = true; });
    ws.on("error", () => {}); // abrupt terminate() can surface as ECONNRESET - not the point of this test

    await once(ws, "close");
    expect(receivedMessage).toBe(false);
  });

  it("pushes a snapshot when a process starts, and another once it exits", async () => {
    const server = await setup();
    const { ws, updates } = await connectAndCollect(server);
    try {
      const handleId = await startHeadlessMatch(server, [], 10);

      await vi.waitFor(() => {
        expect(updates).toContainEqual([{ handleId, pluginName: HEADLESS, exited: false }]);
      });

      await vi.waitFor(() => {
        expect(updates.at(-1)).toEqual([{ handleId, pluginName: HEADLESS, exited: { code: 0 } }]);
      });
    } finally {
      ws.close();
    }
  });
});
