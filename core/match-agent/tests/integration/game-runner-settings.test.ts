import { describe, it, expect, afterEach } from "vitest";
import { startTestServer, TestServer, errorBody } from "./helpers/server";
import { makeTempFolder, cleanupFolder } from "./helpers/piece";
import { createFixturePluginDir } from "./helpers/plugin-dir";

const PLUGIN_NAME = "@roster-lock/game-runner-ikemen-go";

describe("game-runner local settings/version/update routes", () => {
  const cleanups: Array<() => Promise<void> | void> = [];
  afterEach(async () => {
    while (cleanups.length) await cleanups.pop()!();
  });

  async function setup(): Promise<TestServer> {
    const fixture = await createFixturePluginDir([PLUGIN_NAME]);
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

  it("GET settings returns {} before anything has been saved", async () => {
    const server = await setup();
    const res = await fetch(`${server.httpUrl}/v1/game-runner/${encodeURIComponent(PLUGIN_NAME)}/settings`, { headers: auth(server) });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({});
  });

  it("PUT settings round-trips through GET", async () => {
    const server = await setup();
    const putRes = await fetch(`${server.httpUrl}/v1/game-runner/${encodeURIComponent(PLUGIN_NAME)}/settings`, {
      method: "PUT",
      headers: { ...auth(server), "Content-Type": "application/json" },
      body: JSON.stringify({ binaryLocation: "/opt/ikemen/Ikemen_GO" }),
    });
    expect(putRes.status).toBe(200);

    const getRes = await fetch(`${server.httpUrl}/v1/game-runner/${encodeURIComponent(PLUGIN_NAME)}/settings`, { headers: auth(server) });
    expect(await getRes.json()).toEqual({ binaryLocation: "/opt/ikemen/Ikemen_GO" });
  });

  it("PUT settings rejects unknown fields", async () => {
    const server = await setup();
    const res = await fetch(`${server.httpUrl}/v1/game-runner/${encodeURIComponent(PLUGIN_NAME)}/settings`, {
      method: "PUT",
      headers: { ...auth(server), "Content-Type": "application/json" },
      body: JSON.stringify({ binaryLocation: "/x", extra: true }),
    });
    expect(res.status).toBe(400);
  });

  it("GET version 400s when no binaryLocation has been configured", async () => {
    const server = await setup();
    const res = await fetch(`${server.httpUrl}/v1/game-runner/${encodeURIComponent(PLUGIN_NAME)}/version`, { headers: auth(server) });
    expect(res.status).toBe(400);
    expect((await errorBody(res)).error).toMatch(/binaryLocation/);
  });

  it("POST update 400s when the plugin has no updateBinary (ikemen-go doesn't declare one)", async () => {
    const server = await setup();
    await fetch(`${server.httpUrl}/v1/game-runner/${encodeURIComponent(PLUGIN_NAME)}/settings`, {
      method: "PUT",
      headers: { ...auth(server), "Content-Type": "application/json" },
      body: JSON.stringify({ binaryLocation: "/opt/ikemen/Ikemen_GO" }),
    });

    const res = await fetch(`${server.httpUrl}/v1/game-runner/${encodeURIComponent(PLUGIN_NAME)}/update`, {
      method: "POST",
      headers: auth(server),
    });
    expect(res.status).toBe(400);
    expect((await errorBody(res)).error).toMatch(/in-app updates/);
  });

  it("GET process/:handleId 404s for an unknown handle", async () => {
    const server = await setup();
    const res = await fetch(`${server.httpUrl}/v1/game-runner/${encodeURIComponent(PLUGIN_NAME)}/process/not-a-real-handle`, {
      headers: auth(server),
    });
    expect(res.status).toBe(404);
  });

  it("POST install 400s with the underlying error for a package that can't be installed", async () => {
    const server = await setup();
    const res = await fetch(`${server.httpUrl}/v1/game-runner/${encodeURIComponent("not-a-real-package")}/install`, {
      method: "POST",
      headers: auth(server),
    });
    expect(res.status).toBe(400);
    expect((await errorBody(res)).error).toBeTruthy();
  });
});
