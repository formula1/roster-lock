import { describe, it, expect, afterEach } from "vitest";
import { startTestServer, TestServer, errorBody } from "./helpers/server";
import { makeTempFolder, cleanupFolder } from "./helpers/piece";
import { createFixturePluginDir } from "./helpers/plugin-dir";

const PLUGIN_NAME = "@roster-lock/game-launcher-ikemen-go";

describe("POST /v1/game-launcher/:pluginName/start", () => {
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

  async function configureBinaryLocation(server: TestServer) {
    await fetch(`${server.httpUrl}/v1/game-launcher/${encodeURIComponent(PLUGIN_NAME)}/settings`, {
      method: "PUT",
      headers: { ...auth(server), "Content-Type": "application/json" },
      body: JSON.stringify({ binaryLocation: "/opt/ikemen/Ikemen_GO" }),
    });
  }

  it("400s when the plugin has no binaryLocation configured yet", async () => {
    const server = await setup();
    const res = await fetch(`${server.httpUrl}/v1/game-launcher/${encodeURIComponent(PLUGIN_NAME)}/start`, {
      method: "POST",
      headers: { ...auth(server), "Content-Type": "application/json" },
    });
    expect(res.status).toBe(400);
    expect((await errorBody(res)).error).toMatch(/binaryLocation/);
  });

  it("400s on a connectionConfig the type doesn't allow (e.g. an unknown type)", async () => {
    const server = await setup();
    await configureBinaryLocation(server);

    const res = await fetch(`${server.httpUrl}/v1/game-launcher/${encodeURIComponent(PLUGIN_NAME)}/start`, {
      method: "POST",
      headers: { ...auth(server), "Content-Type": "application/json" },
      body: JSON.stringify({
        connectionConfig: { type: "carrier-pigeon" },
        currentMachine: { machineId: "m1", publicKey: "pk", privateKey: "sk" },
        allMachines: [],
        selectionResult: {},
        rosterConfig: {},
        gameConfig: {},
        relayRoomId: "room-1",
      }),
    });
    expect(res.status).toBe(400);
    expect((await errorBody(res)).error).toBe("Bad Form");
  });

  it("400s when required top-level fields are missing", async () => {
    const server = await setup();
    await configureBinaryLocation(server);

    const res = await fetch(`${server.httpUrl}/v1/game-launcher/${encodeURIComponent(PLUGIN_NAME)}/start`, {
      method: "POST",
      headers: { ...auth(server), "Content-Type": "application/json" },
      body: JSON.stringify({
        connectionConfig: { type: "direct-tcp", party: "host", port: 7000 },
      }),
    });
    expect(res.status).toBe(400);
    expect((await errorBody(res)).error).toBe("Bad Form");
  });
});
