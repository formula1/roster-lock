import { describe, it, expect, afterEach, vi } from "vitest";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { join, isAbsolute } from "node:path";
import { crc32 } from "node:zlib";
import { startTestServer, TestServer, errorBody } from "./helpers/server";
import { makeTempFolder, cleanupFolder } from "./helpers/piece";
import { createFixturePluginDir } from "./helpers/plugin-dir";

// A hand-built "stored" (uncompressed) zip, one file - see
// plugins/game-launcher/ikemen-go/test/getBinary.test.ts's own copy of
// this for why (no zip-writing dependency exists in this repo, and the
// stored method needs nothing beyond a correct CRC32). Duplicated rather
// than shared across packages for the same reason IKEMEN_EXECUTABLE_NAME
// above is: this test is about match-agent's own plumbing calling the
// real plugin, not about the plugin's internals.
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

// Mirrors plugins/game-launcher/ikemen-go/src/binaryLocation.ts's own mapping -
// duplicated here rather than imported since this test is about match-agent
// resolving binaryLocation before the plugin ever sees it, not about the
// plugin's own resolution logic.
const IKEMEN_EXECUTABLE_NAME = (
  process.platform === "win32" ? "Ikemen_GO.exe" : process.platform === "darwin" ? "Ikemen_GO_MacOS" : "Ikemen_GO_Linux"
);

describe("game-launcher local settings/version/update routes", () => {
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

  it("GET settings returns {} before anything has been saved", async () => {
    const { server } = await setup();
    const res = await fetch(`${server.httpUrl}/v1/game-launcher/${encodeURIComponent(PLUGIN_NAME)}/settings`, { headers: auth(server) });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({});
  });

  it("PUT settings round-trips through GET", async () => {
    const { server } = await setup();
    const putRes = await fetch(`${server.httpUrl}/v1/game-launcher/${encodeURIComponent(PLUGIN_NAME)}/settings`, {
      method: "PUT",
      headers: { ...auth(server), "Content-Type": "application/json" },
      body: JSON.stringify({ binaryLocation: "/opt/ikemen/Ikemen_GO" }),
    });
    expect(putRes.status).toBe(200);

    const getRes = await fetch(`${server.httpUrl}/v1/game-launcher/${encodeURIComponent(PLUGIN_NAME)}/settings`, { headers: auth(server) });
    expect(await getRes.json()).toEqual({ binaryLocation: "/opt/ikemen/Ikemen_GO" });
  });

  it("PUT settings rejects unknown fields", async () => {
    const { server } = await setup();
    const res = await fetch(`${server.httpUrl}/v1/game-launcher/${encodeURIComponent(PLUGIN_NAME)}/settings`, {
      method: "PUT",
      headers: { ...auth(server), "Content-Type": "application/json" },
      body: JSON.stringify({ binaryLocation: "/x", extra: true }),
    });
    expect(res.status).toBe(400);
  });

  it("GET version 400s when no binaryLocation has been configured", async () => {
    const { server } = await setup();
    const res = await fetch(`${server.httpUrl}/v1/game-launcher/${encodeURIComponent(PLUGIN_NAME)}/version`, { headers: auth(server) });
    expect(res.status).toBe(400);
    expect((await errorBody(res)).error).toMatch(/binaryLocation/);
  });

  it("resolves a relative binaryLocation against pluginDir (docs/v2/binary-location.md)", async () => {
    const { server, pluginDir } = await setup();

    // "engine" here plays the role of wherever a USB-hosted setup would keep
    // its binaries relative to --plugin-folder - pluginDir moves with the
    // USB, so a relative binaryLocation should too, rather than needing to
    // be an absolute path that goes stale once the USB remounts elsewhere.
    const engineDir = join(pluginDir, "engine");
    await mkdir(engineDir, { recursive: true });
    await writeFile(join(engineDir, IKEMEN_EXECUTABLE_NAME), "not a real binary, just needs to exist", {
      mode: 0o755,
    });

    await fetch(`${server.httpUrl}/v1/game-launcher/${encodeURIComponent(PLUGIN_NAME)}/settings`, {
      method: "PUT",
      headers: { ...auth(server), "Content-Type": "application/json" },
      body: JSON.stringify({ binaryLocation: "engine" }),
    });

    const res = await fetch(`${server.httpUrl}/v1/game-launcher/${encodeURIComponent(PLUGIN_NAME)}/validate`, {
      headers: auth(server),
    });
    expect(res.status).toBe(200);
    // If "engine" had been treated literally (e.g. resolved against the
    // process's own cwd instead of pluginDir) this would come back invalid,
    // since nothing exists at a literal relative "engine" from wherever
    // vitest happens to run.
    expect(await res.json()).toEqual({ valid: true });
  });

  // ikemen-go itself now declares getBinary (downloads+extracts the
  // official release zip - see plugins/game-launcher/ikemen-go/src/
  // getBinary.ts, unit-tested there against a mocked fetch; the test below
  // this one exercises the same plugin through the real route instead),
  // so this needs a plugin that genuinely still has no download hook -
  // game-launcher-headless, in its own fixture dir rather than the
  // describe block's shared ikemen-go one.
  it("POST update 400s when the plugin has no getBinary", async () => {
    const headlessPluginName = "@roster-lock/game-launcher-headless";
    const fixture = await createFixturePluginDir([headlessPluginName]);
    cleanups.push(fixture.cleanup);
    const folder = await makeTempFolder();
    cleanups.push(() => cleanupFolder(folder));
    const server = await startTestServer(folder, undefined, fixture.pluginDir);
    cleanups.push(() => server.close());

    await fetch(`${server.httpUrl}/v1/game-launcher/${encodeURIComponent(headlessPluginName)}/settings`, {
      method: "PUT",
      headers: { ...auth(server), "Content-Type": "application/json" },
      body: JSON.stringify({ binaryLocation: "/opt/headless" }),
    });

    const res = await fetch(`${server.httpUrl}/v1/game-launcher/${encodeURIComponent(headlessPluginName)}/update`, {
      method: "POST",
      headers: auth(server),
    });
    expect(res.status).toBe(400);
    expect((await errorBody(res)).error).toMatch(/in-app updates/);
  });

  // The real ikemen-go plugin's getBinary, through match-agent's actual
  // route - not just the mocked-fetch unit test in the plugin's own
  // package. Proves the two layers actually agree: dataDir gets passed
  // correctly, the returned binaryLocation gets persisted (and comes back
  // relative, same portability reasoning as every other binaryLocation -
  // see docs/v2/binary-location.md), and no binaryLocation has to exist
  // beforehand (unlike every other route in this file - see
  // updateGameLauncherBinary's own comment on why).
  it("POST update downloads the real plugin's binary with no prior binaryLocation, and persists the result", async () => {
    const { server, pluginDir } = await setup();

    const zipBuffer = buildStoredZip(IKEMEN_EXECUTABLE_NAME, "fake engine binary");
    // stubGlobal replaces fetch for this test's own calls to the match-agent
    // server too, not just the plugin's GitHub/download calls - anything
    // that isn't one of those two has to fall through to the real fetch.
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

    try {
      const res = await fetch(`${server.httpUrl}/v1/game-launcher/${encodeURIComponent(PLUGIN_NAME)}/update?platform=linux&arch=x64`, {
        method: "POST",
        headers: auth(server),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.ok).toBe(true);
      expect(typeof body.binaryLocation).toBe("string");

      const settingsRes = await fetch(
        `${server.httpUrl}/v1/game-launcher/${encodeURIComponent(PLUGIN_NAME)}/settings`, { headers: auth(server) }
      );
      const settings = await settingsRes.json();
      // Lands under pluginDir (data/<plugin>/binaries/<tag>) - portable, so
      // stored relative rather than as the absolute path getBinary returned.
      expect(isAbsolute(settings.binaryLocation)).toBe(false);

      const binaryPath = join(pluginDir, settings.binaryLocation, IKEMEN_EXECUTABLE_NAME);
      expect(await readFile(binaryPath, "utf8")).toBe("fake engine binary");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("GET process/:handleId 404s for an unknown handle", async () => {
    const { server } = await setup();
    const res = await fetch(`${server.httpUrl}/v1/game-launcher/${encodeURIComponent(PLUGIN_NAME)}/process/not-a-real-handle`, {
      headers: auth(server),
    });
    expect(res.status).toBe(404);
  });

  it("POST install 400s with the underlying error for a package that can't be installed", async () => {
    const { server } = await setup();
    const res = await fetch(`${server.httpUrl}/v1/game-launcher/${encodeURIComponent("not-a-real-package")}/install`, {
      method: "POST",
      headers: auth(server),
    });
    expect(res.status).toBe(400);
    expect((await errorBody(res)).error).toBeTruthy();
  });
});
