import { describe, it, expect } from "vitest";
import { join } from "node:path";
import { readFileSync } from "node:fs";
import { RosterLockV1Config } from "@roster-lock/types";
import { IKEMEN_ENGINE_PIECE_DEFINITIONS } from "@roster-lock/game-launcher-ikemen-go/engine-config";
import { assertGameLauncherAllowed, assertGameConfigValid, gameCoordinatorFor, IKEMEN_PLUGIN_NAME } from "../src/game-launchers";
import { Env } from "../src/types";

function makeEnv(overrides: Partial<Env> = {}): Env {
  return {
    ROOM_SESSION: {} as any,
    DB: {} as any,
    ...overrides,
  };
}

describe("assertGameLauncherAllowed", () => {
  it("rejects a plugin name other than ikemen-go", async () => {
    await expect(
      assertGameLauncherAllowed("some-other-plugin", { engine: { pieceDefinitions: IKEMEN_ENGINE_PIECE_DEFINITIONS } })
    ).rejects.toThrow(/not allowed/);
  });

  it("rejects when pieceDefinitions doesn't hash to ikemen-go's engineSha", async () => {
    const wrongPieceDefinitions = { character: { selectionStrategy: "personal", requires: [], pathVariables: [], assets: [] } };
    await expect(
      assertGameLauncherAllowed(IKEMEN_PLUGIN_NAME, { engine: { pieceDefinitions: wrongPieceDefinitions } })
    ).rejects.toThrow(/engineSha/);
  });

  it("accepts ikemen-go with matching pieceDefinitions", async () => {
    await expect(
      assertGameLauncherAllowed(IKEMEN_PLUGIN_NAME, { engine: { pieceDefinitions: IKEMEN_ENGINE_PIECE_DEFINITIONS } })
    ).resolves.toBeUndefined();
  });

  it("rejects a rosterConfig missing engine.pieceDefinitions", async () => {
    await expect(assertGameLauncherAllowed(IKEMEN_PLUGIN_NAME, {})).rejects.toThrow(/pieceDefinitions/);
  });
});

// Real fixtures, same ones plugins/game-launcher/ikemen-go's own tests use - proves this
// deep-imports the plugin's real validateGameConfig (not a re-implemented copy of its rules),
// the same function titled-room/client's Create.tsx calls locally via the bridge before submitting.
const MUGEN_ROSTER_LOCKS = join(__dirname, "../../../../mugen/roster-locks");
function loadLock(mode: string): RosterLockV1Config {
  return JSON.parse(readFileSync(join(MUGEN_ROSTER_LOCKS, `mugen-${mode}.roster-lock.json`), "utf-8"));
}

describe("assertGameConfigValid", () => {
  const validGameConfig = { teamMode: "single", roundTime: -1, rounds: 3 };

  it("rejects a teamMode/selection-config mismatch via the plugin's real validator", async () => {
    await expect(
      assertGameConfigValid(IKEMEN_PLUGIN_NAME, { ...validGameConfig, teamMode: "single" }, loadLock("tag"))
    ).rejects.toThrow(/"single" team mode expects exactly 1 character/);
  });

  it("accepts a compatible gameConfig/rosterConfig pairing", async () => {
    await expect(
      assertGameConfigValid(IKEMEN_PLUGIN_NAME, validGameConfig, loadLock("single"))
    ).resolves.toBeUndefined();
  });

  it("rejects an explicit \"simul\" override the same way the client-side check would", async () => {
    await expect(
      assertGameConfigValid(IKEMEN_PLUGIN_NAME, { ...validGameConfig, teamMode: "simul" }, loadLock("tag"))
    ).rejects.toThrow(/teamMode/);
  });

  it("passes through unchecked for a plugin name other than ikemen-go", async () => {
    await expect(
      assertGameConfigValid("some-other-plugin", { anything: "goes" }, loadLock("tag"))
    ).resolves.toBeUndefined();
  });
});

describe("gameCoordinatorFor", () => {
  it("returns false when no coordinator env vars are set", async () => {
    await expect(gameCoordinatorFor(makeEnv(), IKEMEN_PLUGIN_NAME)).resolves.toBe(false);
  });

  it("returns the configured coordinator when env vars are set", async () => {
    const env = makeEnv({ GAME_COORDINATOR_ID: "coordinator-1", IKEMEN_COORDINATOR_TCP_HOST: "127.0.0.1", IKEMEN_COORDINATOR_TCP_PORT: "9010" });
    await expect(gameCoordinatorFor(env, IKEMEN_PLUGIN_NAME)).resolves.toEqual({
      id: "coordinator-1", address: { host: "127.0.0.1", port: 9010 },
    });
  });

  it("throws when GAME_COORDINATOR_ID is set but host/port are missing", async () => {
    const env = makeEnv({ GAME_COORDINATOR_ID: "coordinator-1" });
    await expect(gameCoordinatorFor(env, IKEMEN_PLUGIN_NAME)).rejects.toThrow(/IKEMEN_COORDINATOR_TCP_HOST/);
  });

  it("throws for a plugin name other than ikemen-go", async () => {
    await expect(gameCoordinatorFor(makeEnv(), "some-other-plugin")).rejects.toThrow(/No game-launcher config/);
  });
});
