import { describe, it, expect, afterEach, vi } from "vitest";
import { startTestServer, TestServer } from "./helpers/server";
import { createFixturePluginDir } from "./helpers/plugin-dir";
import { makeTempFolder, cleanupFolder } from "./helpers/piece";
import { makeLockConfig, makeHeroSelection } from "./helpers/lockConfig";
import { makeValidLockConfig } from "./helpers/validLockConfig";

const HEADLESS = "@roster-lock/game-launcher-headless";
const HIGHEST_WINRATE_LOCALLY = "@roster-lock/piece-selection-sort-highest-winrate-locally";

// Exercises the one thing no other test does end-to-end: a real
// GameLauncherPlugin calling the gameEnded() callback match-agent hands it
// (see game-launcher.ts's startGameLauncher), and match-agent turning that
// into a real pieceSort.handleGameComplete call using the
// {lockConfig, localUsers, userSelections} a room's selection flow would
// have stashed in env.gameCompletionContext (see steps.ts's onGameComplete).
// Uses the headless plugin instead of a real engine so this runs in CI with
// no binary/display, and seeds gameCompletionContext directly instead of
// driving a real room negotiation (which needs an actual relay server -
// see helpers/relayHarness.ts for that heavier, separate concern).
describe("game-launcher gameEnded -> piece-selection-sort handleGameComplete", () => {
  const cleanups: Array<() => Promise<void> | void> = [];
  afterEach(async () => {
    while (cleanups.length) await cleanups.pop()!();
  });

  async function setup(): Promise<TestServer> {
    const fixture = await createFixturePluginDir([HEADLESS, HIGHEST_WINRATE_LOCALLY]);
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

  async function startHeadlessMatch(server: TestServer, relayRoomId: string, winners: Array<string>) {
    await fetch(`${server.httpUrl}/v1/game-launcher/${encodeURIComponent(HEADLESS)}/settings`, {
      method: "PUT",
      headers: { ...auth(server), "Content-Type": "application/json" },
      body: JSON.stringify({ binaryLocation: "headless" }),
    });

    return fetch(`${server.httpUrl}/v1/game-launcher/${encodeURIComponent(HEADLESS)}/start`, {
      method: "POST",
      headers: { ...auth(server), "Content-Type": "application/json" },
      body: JSON.stringify({
        connectionConfig: { type: "internal" },
        currentMachine: { machineId: "m1", publicKey: "pk-a", privateKey: "sk" },
        allMachines: [],
        selectionResult: {},
        // Just needs to pass castLockConfig's AJV schema (unlike
        // makeLockConfig(), used below for the actual winrate bookkeeping) -
        // the headless plugin never reads rosterConfig's contents at all.
        rosterConfig: makeValidLockConfig(),
        gameConfig: { winners, resultDelayMs: 0 },
        relayRoomId,
      }),
    });
  }

  it("calls handleGameComplete once the headless plugin reports a winner", async () => {
    const server = await setup();
    const lockConfig = makeLockConfig();
    const localUsers = ["pk-a:0"];
    const userSelections = { "pk-a:0": makeHeroSelection() };
    // topRanked excludes anything with zero recorded games (see
    // WinRateStore.ts) - a real room's selection flow would already have
    // called handleFullSelection (steps.ts) before the game even started;
    // this test isn't exercising that flow (handle-full-selection.test.ts
    // already does), so it seeds the same call directly.
    await server.env.pluginRuntime.pieceSort.handleFullSelection({ lockConfig, localUsers, userSelections });
    server.env.gameCompletionContext.set("room-1", { lockConfig, localUsers, userSelections });

    const res = await startHeadlessMatch(server, "room-1", ["pk-a:0"]);
    expect(res.status).toBe(200);

    // gameEnded fires off the headless plugin's own timer, after the /start
    // response above already returned - poll rather than asserting immediately.
    await vi.waitFor(async () => {
      const ranked = await server.env.pluginRuntime.pieceSort.sortPieces(HIGHEST_WINRATE_LOCALLY, {
        lockConfig, pieceType: "character",
      });
      expect(ranked).toEqual(["1.0.0"]);
    });

    // The context is single-use - a second game "ending" for the same room
    // should not find leftover state.
    expect(server.env.gameCompletionContext.has("room-1")).toBe(false);
  });

  it("doesn't fail the request or record anything when no room negotiated this relayRoomId", async () => {
    const server = await setup();

    const res = await startHeadlessMatch(server, "unknown-room", ["pk-a:0"]);
    expect(res.status).toBe(200);

    // gameEnded still fires (headless always reports its configured
    // winners) - match-agent should log and drop it, not throw, since the
    // response above already succeeded before gameEnded ever runs.
    await new Promise((resolve) => setTimeout(resolve, 50));
    const ranked = await server.env.pluginRuntime.pieceSort.sortPieces(HIGHEST_WINRATE_LOCALLY, {
      lockConfig: makeLockConfig(), pieceType: "character",
    });
    expect(ranked).toEqual([]);
  });
});
