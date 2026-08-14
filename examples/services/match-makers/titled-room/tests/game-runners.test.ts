import { describe, it, expect } from "vitest";
import { createShaFromJSON } from "@roster-lock/utils";
import { assertGameRunnerAllowed, gameCoordinatorFor } from "../src/game-runners";
import { Env } from "../src/types";
import { FakeAdminD1 } from "./helpers/fakeAdminD1";

const PIECE_DEFINITIONS = { character: { selectionStrategy: "personal", requires: [], pathVariables: [], assets: [] } };
const PLUGIN_NAME = "@roster-lock/game-runner-ikemen-go";

function makeEnv(db: FakeAdminD1): Env {
  return {
    ROOM_SESSION: {} as any,
    DB: db as any,
    JWT_SECRET: "test-secret" as any,
  };
}

function seedConfig(db: FakeAdminD1, pluginName: string, engineSha: string, coordinator: Record<string, unknown> = {}) {
  db.gameRunnerConfigs.set(pluginName, {
    plugin_name: pluginName,
    engine_sha: engineSha,
    coordinator_id: null,
    coordinator_host: null,
    coordinator_port: null,
    ...coordinator,
  });
}

describe("assertGameRunnerAllowed", () => {
  it("rejects when no config row exists (fail closed)", async () => {
    const env = makeEnv(new FakeAdminD1());
    await expect(
      assertGameRunnerAllowed(env, PLUGIN_NAME, { engine: { pieceDefinitions: PIECE_DEFINITIONS } })
    ).rejects.toThrow(/not allowed/);
  });

  it("rejects a plugin not present in the config table", async () => {
    const db = new FakeAdminD1();
    seedConfig(db, "some-other-plugin", "x");
    await expect(
      assertGameRunnerAllowed(makeEnv(db), PLUGIN_NAME, { engine: { pieceDefinitions: PIECE_DEFINITIONS } })
    ).rejects.toThrow(/not allowed/);
  });

  it("rejects when pieceDefinitions doesn't hash to the configured engineSha", async () => {
    const db = new FakeAdminD1();
    seedConfig(db, PLUGIN_NAME, "not-the-real-hash");
    await expect(
      assertGameRunnerAllowed(makeEnv(db), PLUGIN_NAME, { engine: { pieceDefinitions: PIECE_DEFINITIONS } })
    ).rejects.toThrow(/engineSha/);
  });

  it("accepts a plugin/rosterConfig pair whose pieceDefinitions hash matches", async () => {
    const engineSha = await createShaFromJSON(PIECE_DEFINITIONS);
    const db = new FakeAdminD1();
    seedConfig(db, PLUGIN_NAME, engineSha);

    await expect(
      assertGameRunnerAllowed(makeEnv(db), PLUGIN_NAME, { engine: { pieceDefinitions: PIECE_DEFINITIONS } })
    ).resolves.toBeUndefined();
  });

  it("rejects a rosterConfig missing engine.pieceDefinitions", async () => {
    const db = new FakeAdminD1();
    seedConfig(db, PLUGIN_NAME, "x");
    await expect(assertGameRunnerAllowed(makeEnv(db), PLUGIN_NAME, {})).rejects.toThrow(/pieceDefinitions/);
  });
});

describe("gameCoordinatorFor", () => {
  it("throws when no config row exists (missing entry is a misconfiguration)", async () => {
    const env = makeEnv(new FakeAdminD1());
    await expect(gameCoordinatorFor(env, PLUGIN_NAME)).rejects.toThrow(/No game-runner config/);
  });

  it("throws for a plugin not present in the config table", async () => {
    const db = new FakeAdminD1();
    seedConfig(db, "some-other-plugin", "x", { coordinator_id: "coordinator-1", coordinator_host: "127.0.0.1", coordinator_port: 9010 });
    await expect(gameCoordinatorFor(makeEnv(db), PLUGIN_NAME)).rejects.toThrow(/No game-runner config/);
  });

  it("returns the configured coordinator for a listed plugin", async () => {
    const db = new FakeAdminD1();
    seedConfig(db, PLUGIN_NAME, "x", { coordinator_id: "coordinator-1", coordinator_host: "127.0.0.1", coordinator_port: 9010 });
    await expect(gameCoordinatorFor(makeEnv(db), PLUGIN_NAME)).resolves.toEqual({
      id: "coordinator-1", address: { host: "127.0.0.1", port: 9010 },
    });
  });

  it("returns false when a plugin explicitly opts out of a coordinator", async () => {
    const db = new FakeAdminD1();
    seedConfig(db, PLUGIN_NAME, "x");
    await expect(gameCoordinatorFor(makeEnv(db), PLUGIN_NAME)).resolves.toBe(false);
  });
});
