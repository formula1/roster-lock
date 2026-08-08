import { describe, it, expect, afterEach } from "vitest";
import { startTestServer, TestServer } from "./helpers/server";
import { makeTempFolder, cleanupFolder } from "./helpers/piece";
import { createFixturePluginDir } from "./helpers/plugin-dir";

describe("GET /v1/game-runner/available", () => {
  const cleanups: Array<() => Promise<void> | void> = [];
  afterEach(async () => {
    while (cleanups.length) await cleanups.pop()!();
  });

  function get(server: TestServer) {
    return fetch(`${server.httpUrl}/v1/game-runner/available`, {
      headers: { Authorization: `Bearer ${server.authCode}` },
    });
  }

  it("returns [] when no game-runner plugins are installed", async () => {
    const folder = await makeTempFolder();
    cleanups.push(() => cleanupFolder(folder));
    const server = await startTestServer(folder);
    cleanups.push(() => server.close());

    const res = await get(server);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it("lists an installed game-runner plugin with its connection/schema/engineSha metadata", async () => {
    // "private": true on ikemen-go's package.json means it can't be resolved
    // via npm - installPlugin takes a local folder path directly instead
    // (arborist installs it same as `npm install <path>`), which is how this
    // fixture, and every dl-*/piece-selection-sort-* fixture before it, gets
    // installed for tests without publishing anything.
    const fixture = await createFixturePluginDir(["@roster-lock/game-runner-ikemen-go"]);
    cleanups.push(fixture.cleanup);

    const folder = await makeTempFolder();
    cleanups.push(() => cleanupFolder(folder));
    const server = await startTestServer(folder, undefined, fixture.pluginDir);
    cleanups.push(() => server.close());

    const res = await get(server);
    expect(res.status).toBe(200);
    const body = await res.json() as Array<Record<string, unknown>>;
    expect(body).toHaveLength(1);

    const [runner] = body;
    expect(runner.pluginName).toBe("@roster-lock/game-runner-ikemen-go");
    expect(runner.publicInfo).toMatchObject({ title: expect.any(String), description: expect.any(String) });
    expect(runner.supportedConnectionModes).toEqual(["direct-tcp"]);
    expect(runner.supportedRoomVersions).toBeUndefined();
    // A real sha256 hex digest, not a placeholder - proves engineSha survived
    // the plugin's own module boundary (install -> import -> JSON response),
    // not just that the field exists.
    expect(runner.engineSha).toMatch(/^[0-9a-f]{64}$/);
    expect(runner.gameConfigSchema).toMatchObject({ type: "object" });
    expect(runner.localConfigSchema).toEqual({});
  });

  it("ignores plugins of other types", async () => {
    const fixture = await createFixturePluginDir([
      "@roster-lock/piece-selection-sort-most-used-locally",
      "@roster-lock/dl-protocol-http",
    ]);
    cleanups.push(fixture.cleanup);

    const folder = await makeTempFolder();
    cleanups.push(() => cleanupFolder(folder));
    const server = await startTestServer(folder, undefined, fixture.pluginDir);
    cleanups.push(() => server.close());

    const res = await get(server);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });
});
