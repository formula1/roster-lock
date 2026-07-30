import { describe, it, expect, afterEach } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { startTestServer, TestServer, errorBody } from "./helpers/server";
import { makeTempFolder, cleanupFolder } from "./helpers/piece";
import { createFixturePluginDir } from "./helpers/plugin-dir";
import { makeValidLockConfig, makeValidHeroSelection } from "./helpers/validLockConfig";

describe("POST /v1/game-complete", () => {
  const cleanups: Array<() => Promise<void> | void> = [];
  afterEach(async () => {
    while (cleanups.length) await cleanups.pop()!();
  });

  function post(server: TestServer, body: unknown) {
    return fetch(`${server.httpUrl}/v1/game-complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${server.authCode}` },
      body: JSON.stringify(body),
    });
  }

  async function makeServer(packageNames: Array<string> = []) {
    const fixture = await createFixturePluginDir(packageNames);
    cleanups.push(fixture.cleanup);
    const folder = await makeTempFolder();
    cleanups.push(() => cleanupFolder(folder));
    const server = await startTestServer(folder, undefined, fixture.pluginDir);
    cleanups.push(() => server.close());
    return { server, pluginDir: fixture.pluginDir };
  }

  it("400s on a malformed body", async () => {
    const { server } = await makeServer();
    const res = await post(server, {});
    expect(res.status).toBe(400);
    expect((await errorBody(res)).error).toBe("Bad Form");
  });

  it("400s when lockConfig fails schema validation", async () => {
    const { server } = await makeServer();
    const res = await post(server, {
      lockConfig: { not: "a valid config" }, localUsers: [], userSelections: {}, winners: [],
    });
    expect(res.status).toBe(400);
    expect((await errorBody(res)).error).toBe("Invalid lockConfig");
  });

  it("acks with no installed plugins to fan out to", async () => {
    const { server } = await makeServer();
    const res = await post(server, {
      lockConfig: makeValidLockConfig(), localUsers: [], userSelections: {}, winners: [],
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("fans out to every installed piece-selection-sort plugin, giving each its own dataDir", async () => {
    const { server, pluginDir } = await makeServer(["@roster-lock/piece-selection-sort-highest-winrate-locally"]);

    const res = await post(server, {
      lockConfig: makeValidLockConfig(),
      localUsers: ["pk-a"],
      userSelections: { "pk-a": makeValidHeroSelection() },
      winners: ["pk-a"],
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });

    expect(existsSync(join(pluginDir, "data", "@roster-lock/piece-selection-sort-highest-winrate-locally"))).toBe(true);
  });
});
