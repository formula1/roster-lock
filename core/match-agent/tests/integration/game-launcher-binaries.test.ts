import { describe, it, expect, afterEach, vi } from "vitest";
import { crc32 } from "node:zlib";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { startTestServer, TestServer, errorBody } from "./helpers/server";
import { makeTempFolder, cleanupFolder } from "./helpers/piece";
import { createFixturePluginDir } from "./helpers/plugin-dir";
import { makeValidLockConfig } from "./helpers/validLockConfig";

// Duplicated from game-launcher-settings.test.ts (see that file's own
// comment on buildStoredZip for why) - this test is about match-agent's
// list/remove routes and SQL usage-tracking, not about zip format details.
function buildStoredZip(path: string, contents: string): Buffer {
  const nameBuf = Buffer.from(path, "utf8");
  const dataBuf = Buffer.from(contents, "utf8");
  const crc = crc32(dataBuf);

  const localHeader = Buffer.alloc(30);
  localHeader.writeUInt32LE(0x04034b50, 0);
  localHeader.writeUInt16LE(20, 4);
  localHeader.writeUInt32LE(crc, 14);
  localHeader.writeUInt32LE(dataBuf.length, 18);
  localHeader.writeUInt32LE(dataBuf.length, 22);
  localHeader.writeUInt16LE(nameBuf.length, 26);
  const localSection = Buffer.concat([localHeader, nameBuf, dataBuf]);

  const centralHeader = Buffer.alloc(46);
  centralHeader.writeUInt32LE(0x02014b50, 0);
  centralHeader.writeUInt16LE(20, 4);
  centralHeader.writeUInt16LE(20, 6);
  centralHeader.writeUInt32LE(crc, 16);
  centralHeader.writeUInt32LE(dataBuf.length, 20);
  centralHeader.writeUInt32LE(dataBuf.length, 24);
  centralHeader.writeUInt16LE(nameBuf.length, 28);
  centralHeader.writeUInt32LE(0, 42);
  const centralSection = Buffer.concat([centralHeader, nameBuf]);

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(1, 8);
  eocd.writeUInt16LE(1, 10);
  eocd.writeUInt32LE(centralSection.length, 12);
  eocd.writeUInt32LE(localSection.length, 16);

  return Buffer.concat([localSection, centralSection, eocd]);
}

const PLUGIN_NAME = "@roster-lock/game-launcher-ikemen-go";

const IKEMEN_EXECUTABLE_NAME = (
  process.platform === "win32" ? "Ikemen_GO.exe" : process.platform === "darwin" ? "Ikemen_GO_MacOS" : "Ikemen_GO_Linux"
);

describe("game-launcher binaries list/remove routes", () => {
  const cleanups: Array<() => Promise<void> | void> = [];
  afterEach(async () => {
    while (cleanups.length) await cleanups.pop()!();
  });

  async function setup(): Promise<{ server: TestServer, pluginDir: string }> {
    const fixture = await createFixturePluginDir([PLUGIN_NAME]);
    cleanups.push(fixture.cleanup);
    const folder = await makeTempFolder();
    cleanups.push(() => cleanupFolder(folder));
    const server = await startTestServer(folder, undefined, fixture.pluginDir);
    cleanups.push(() => server.close());
    return { server, pluginDir: fixture.pluginDir };
  }

  function auth(server: TestServer): HeadersInit {
    return { Authorization: `Bearer ${server.authCode}` };
  }

  // Stubs fetch for the plugin's own GitHub/download calls, falling through
  // to the real fetch for everything else (including this test's own calls
  // to the match-agent server) - see game-launcher-settings.test.ts's
  // identically-shaped stub for why both are necessary.
  function stubDownload(zipBuffer: Buffer): () => void {
    const realFetch = globalThis.fetch;
    vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
      if (url === "https://api.github.com/repos/ikemen-engine/Ikemen-GO/releases/latest") {
        return {
          ok: true, status: 200,
          json: async () => ({
            tag_name: "v1.0.0",
            assets: [{ name: "Ikemen_GO-v1.0.0-linux.zip", browser_download_url: "https://example.test/linux.zip" }],
          }),
        } as Response;
      }
      if (url === "https://example.test/linux.zip") {
        const { Readable } = await import("node:stream");
        return { ok: true, status: 200, body: Readable.toWeb(Readable.from(zipBuffer)) } as unknown as Response;
      }
      return realFetch(url, init);
    });
    return () => vi.unstubAllGlobals();
  }

  it("GET binaries returns [] before anything has been downloaded", async () => {
    const { server } = await setup();
    const res = await fetch(
      `${server.httpUrl}/v1/game-launcher/${encodeURIComponent(PLUGIN_NAME)}/binaries?platform=linux&arch=x64`,
      { headers: auth(server) }
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  // version comes back null here, not a real {title,id} - the fake zip's
  // "binary" is just a text file, and ikemen-go's getLocalVersion correctly
  // refuses to call that a real Ikemen GO build (see readLocalVersion in
  // plugins/game-launcher/ikemen-go/src/version.ts). Still listed, with
  // downloadedAt/active populated from match-agent's own SQL tracking -
  // exactly the "folder exists but doesn't look like a real install"
  // scenario listBinaries is designed to surface rather than hide.
  it("GET binaries reports what update downloaded, with downloadedAt and active true", async () => {
    const { server } = await setup();
    const unstub = stubDownload(buildStoredZip(IKEMEN_EXECUTABLE_NAME, "fake engine binary"));
    try {
      const updateRes = await fetch(
        `${server.httpUrl}/v1/game-launcher/${encodeURIComponent(PLUGIN_NAME)}/update?platform=linux&arch=x64`,
        { method: "POST", headers: auth(server) }
      );
      expect(updateRes.status).toBe(200);

      const res = await fetch(
        `${server.httpUrl}/v1/game-launcher/${encodeURIComponent(PLUGIN_NAME)}/binaries?platform=linux&arch=x64`,
        { headers: auth(server) }
      );
      expect(res.status).toBe(200);
      const binaries = await res.json();
      expect(binaries).toHaveLength(1);
      expect(binaries[0].active).toBe(true);
      expect(binaries[0].version).toBeNull();
      expect(typeof binaries[0].downloadedAt).toBe("number");
      expect(binaries[0].lastUsedAt).toBeNull();
    } finally {
      unstub();
    }
  });

  it("DELETE binaries removes the folder, its usage row, and clears the active setting", async () => {
    const { server } = await setup();
    const unstub = stubDownload(buildStoredZip(IKEMEN_EXECUTABLE_NAME, "fake engine binary"));
    try {
      const updateRes = await fetch(
        `${server.httpUrl}/v1/game-launcher/${encodeURIComponent(PLUGIN_NAME)}/update?platform=linux&arch=x64`,
        { method: "POST", headers: auth(server) }
      );
      expect(updateRes.status).toBe(200);
    } finally {
      unstub();
    }

    const listBefore = await fetch(
      `${server.httpUrl}/v1/game-launcher/${encodeURIComponent(PLUGIN_NAME)}/binaries?platform=linux&arch=x64`,
      { headers: auth(server) }
    );
    const [{ binaryLocation: absoluteLocation }] = await listBefore.json();

    const deleteRes = await fetch(
      `${server.httpUrl}/v1/game-launcher/${encodeURIComponent(PLUGIN_NAME)}/binaries?binaryLocation=${encodeURIComponent(absoluteLocation)}`,
      { method: "DELETE", headers: auth(server) }
    );
    expect(deleteRes.status).toBe(200);

    const listAfter = await fetch(
      `${server.httpUrl}/v1/game-launcher/${encodeURIComponent(PLUGIN_NAME)}/binaries?platform=linux&arch=x64`,
      { headers: auth(server) }
    );
    expect(await listAfter.json()).toEqual([]);

    const settingsRes = await fetch(
      `${server.httpUrl}/v1/game-launcher/${encodeURIComponent(PLUGIN_NAME)}/settings`, { headers: auth(server) }
    );
    expect((await settingsRes.json()).binaryLocation).toBeUndefined();
  });

  it("DELETE binaries 400s for a path outside the plugin's own dataDir", async () => {
    const { server } = await setup();
    const res = await fetch(
      `${server.httpUrl}/v1/game-launcher/${encodeURIComponent(PLUGIN_NAME)}/binaries?binaryLocation=${encodeURIComponent("/etc/passwd")}`,
      { method: "DELETE", headers: auth(server) }
    );
    expect(res.status).toBe(400);
    expect((await errorBody(res)).error).toBeTruthy();
  });

  it("DELETE binaries 400s when binaryLocation query param is missing", async () => {
    const { server } = await setup();
    const res = await fetch(
      `${server.httpUrl}/v1/game-launcher/${encodeURIComponent(PLUGIN_NAME)}/binaries`,
      { method: "DELETE", headers: auth(server) }
    );
    expect(res.status).toBe(400);
  });

  // Regression for a bug introduced alongside this feature: startGameLauncher
  // (start.ts) reads binaryLocation straight off stored settings, which
  // getBinary always persists *relative* to pluginDir (see
  // relativizeBinaryLocation's own docs - exactly what a downloaded binary's
  // settings looks like, unlike a hand-typed absolute path). listBinaries
  // and getBinaryUsageFor both key off the *resolved absolute* path, so
  // recording usage against the raw stored (relative) value would silently
  // never match - lastUsedAt would stay null forever for the one case this
  // bookkeeping exists for. Uses the headless fixture (manually seeding a
  // folder under its own dataDir to stand in for what getBinary would have
  // produced) rather than the real ikemen-go plugin, since this is about
  // match-agent's own path bookkeeping, not actually spawning a process -
  // see game-launcher-game-complete.test.ts's identical reasoning for
  // picking headless over a real engine.
  it("POST start records lastUsedAt against the same absolute path GET binaries reports", async () => {
    const HEADLESS = "@roster-lock/game-launcher-headless";
    const fixture = await createFixturePluginDir([HEADLESS]);
    cleanups.push(fixture.cleanup);
    const folder = await makeTempFolder();
    cleanups.push(() => cleanupFolder(folder));
    const server = await startTestServer(folder, undefined, fixture.pluginDir);
    cleanups.push(() => server.close());

    // Mirrors binariesDataDir's own layout (core/plugin-runtime/src/
    // GameLauncher.ts) - <pluginDir>/data/<pluginName>/binaries/<tag> - without
    // ever calling getBinary itself (headless doesn't implement one).
    const relativeBinaryLocation = join("data", HEADLESS, "binaries", "v1");
    await mkdir(join(fixture.pluginDir, relativeBinaryLocation), { recursive: true });

    await fetch(`${server.httpUrl}/v1/game-launcher/${encodeURIComponent(HEADLESS)}/settings`, {
      method: "PUT",
      headers: { ...auth(server), "Content-Type": "application/json" },
      // Stored relative, exactly like getBinary would have persisted it -
      // the whole point is that this is NOT already an absolute path.
      body: JSON.stringify({ binaryLocation: relativeBinaryLocation }),
    });

    const startRes = await fetch(`${server.httpUrl}/v1/game-launcher/${encodeURIComponent(HEADLESS)}/start`, {
      method: "POST",
      headers: { ...auth(server), "Content-Type": "application/json" },
      body: JSON.stringify({
        connectionConfig: { type: "internal" },
        currentMachine: { machineId: "m1", publicKey: "pk", privateKey: "sk" },
        allMachines: [],
        selectionResult: {},
        rosterConfig: makeValidLockConfig(),
        gameConfig: { winners: [], resultDelayMs: 0 },
        relayRoomId: "room-binaries-regression",
      }),
    });
    expect(startRes.status).toBe(200);

    // recordBinaryUsed is fire-and-forget (see start.ts's own comment on
    // why) - give its promise a tick to land before asserting.
    await vi.waitFor(async () => {
      const res = await fetch(
        `${server.httpUrl}/v1/game-launcher/${encodeURIComponent(HEADLESS)}/binaries?platform=linux&arch=x64`,
        { headers: auth(server) }
      );
      const binaries = await res.json();
      expect(binaries).toHaveLength(1);
      expect(binaries[0].active).toBe(true);
      expect(typeof binaries[0].lastUsedAt).toBe("number");
    });
  });
});
