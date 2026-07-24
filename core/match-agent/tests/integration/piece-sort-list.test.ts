import { describe, it, expect, afterEach } from "vitest";
import { startTestServer, TestServer, errorBody } from "./helpers/server";
import { makeTempFolder, cleanupFolder } from "./helpers/piece";
import { createFixturePluginDir } from "./helpers/plugin-dir";
import { makeValidLockConfig } from "./helpers/validLockConfig";

describe("GET /v1/piece/sort-list/available", () => {
  const cleanups: Array<() => Promise<void> | void> = [];
  afterEach(async () => {
    while (cleanups.length) await cleanups.pop()!();
  });

  function get(server: TestServer) {
    return fetch(`${server.httpUrl}/v1/piece/sort-list/available`, {
      headers: { Authorization: `Bearer ${server.authCode}` },
    });
  }

  it("returns [] when no piece-selection-sort plugins are installed", async () => {
    const folder = await makeTempFolder();
    cleanups.push(() => cleanupFolder(folder));
    const server = await startTestServer(folder);
    cleanups.push(() => server.close());

    const res = await get(server);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it("lists installed piece-selection-sort plugins with their publicInfo, ignoring other plugin types", async () => {
    const fixture = await createFixturePluginDir([
      "@roster-lock/piece-selection-sort-most-used-locally",
      "@roster-lock/piece-selection-sort-highest-winrate-locally",
      "@roster-lock/dl-protocol-http",
    ]);
    cleanups.push(fixture.cleanup);

    const folder = await makeTempFolder();
    cleanups.push(() => cleanupFolder(folder));
    const server = await startTestServer(folder, undefined, fixture.pluginDir);
    cleanups.push(() => server.close());

    const res = await get(server);
    expect(res.status).toBe(200);
    const body = await res.json() as Array<{ pluginName: string, publicInfo: unknown }>;
    expect(body.map((p) => p.pluginName).sort()).toEqual([
      "@roster-lock/piece-selection-sort-highest-winrate-locally",
      "@roster-lock/piece-selection-sort-most-used-locally",
    ]);
    for (const entry of body) {
      expect(entry.publicInfo).toMatchObject({ title: expect.any(String), description: expect.any(String) });
    }
  });
});

describe("POST /v1/piece/sort-list/plugin/:pluginName", () => {
  const cleanups: Array<() => Promise<void> | void> = [];
  afterEach(async () => {
    while (cleanups.length) await cleanups.pop()!();
  });

  function post(server: TestServer, pluginName: string, body: unknown) {
    return fetch(`${server.httpUrl}/v1/piece/sort-list/plugin/${encodeURIComponent(pluginName)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${server.authCode}` },
      body: JSON.stringify(body),
    });
  }

  async function makeServer() {
    const fixture = await createFixturePluginDir(["@roster-lock/piece-selection-sort-most-used-locally"]);
    cleanups.push(fixture.cleanup);
    const folder = await makeTempFolder();
    cleanups.push(() => cleanupFolder(folder));
    const server = await startTestServer(folder, undefined, fixture.pluginDir);
    cleanups.push(() => server.close());
    return server;
  }

  it("400s on a malformed body", async () => {
    const server = await makeServer();
    const res = await post(server, "@roster-lock/piece-selection-sort-most-used-locally", {});
    expect(res.status).toBe(400);
    expect((await errorBody(res)).error).toBe("Bad Form");
  });

  it("400s when lockConfig fails schema validation", async () => {
    const server = await makeServer();
    const res = await post(server, "@roster-lock/piece-selection-sort-most-used-locally", {
      lockConfig: { not: "a valid config" }, pieceType: "character", logicIds: ["1.0.0"],
    });
    expect(res.status).toBe(400);
    expect((await errorBody(res)).error).toBe("Invalid lockConfig");
  });

  it("500s for a plugin that isn't installed", async () => {
    const server = await makeServer();
    const res = await post(server, "@roster-lock/not-installed", {
      lockConfig: makeValidLockConfig(), pieceType: "character", logicIds: ["1.0.0"],
    });
    expect(res.status).toBe(500);
    expect((await errorBody(res)).error).toMatch(/Plugin not installed/);
  });

  it("passes the caller's logicIds through unchanged when the plugin has no ranking for them yet", async () => {
    const server = await makeServer();
    const res = await post(server, "@roster-lock/piece-selection-sort-most-used-locally", {
      lockConfig: makeValidLockConfig(), pieceType: "character", logicIds: ["1.0.0", "2.0.0"],
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(["1.0.0", "2.0.0"]);
  });
});
