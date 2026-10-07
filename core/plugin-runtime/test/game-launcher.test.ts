import { describe, it, expect, afterEach } from "vitest";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { PluginManager } from "../src/PluginHandler";

// Same hand-rolled-fixture approach as piece-selection-sort.test.ts (see its
// own comment on why: plugin-management only ever reads plugins.json +
// require()s node_modules/<package>/<main> at runtime, so this is a
// faithful fixture of a real install without needing one).
async function writeFixturePlugin(pluginDir: string, packageName: string, moduleSource: string){
  const pkgDir = join(pluginDir, "node_modules", packageName);
  await mkdir(pkgDir, { recursive: true });
  await writeFile(join(pkgDir, "package.json"), JSON.stringify({
    name: packageName, version: "1.0.0", main: "index.js",
    "roster-lock": { pluginType: "game-launcher", priority: 0 },
  }));
  await writeFile(join(pkgDir, "index.js"), moduleSource);
  await writeFile(join(pluginDir, "plugins.json"), JSON.stringify({
    plugins: [{ package: packageName, version: "1.0.0", type: "game-launcher", priority: 0 }],
  }));
}

// getBinary always downloads "v1" (one tag) into dataDir - good enough to
// exercise listBinaries/removeBinary without needing a real second
// version; ikemen-go's own side-by-side behaviour is covered in that
// plugin's own test suite. getLocalVersion only succeeds for a folder that
// actually has the marker getBinary writes, so listBinaries' "version:
// null for an unreadable folder" path has something real to exercise.
const FAKE_PLUGIN_SOURCE = `
const fs = require("fs");
const path = require("path");
module.exports.default = {
  name: "fake-launcher",
  publicInfo: { title: "Fake Launcher", description: "For GameLauncher's own binary-tracking tests" },
  supportedConnectionModes: ["internal"],
  supportedPlatforms: [{ platform: "linux", arch: "x64" }],
  engineSha: "test-sha",
  gameConfigSchema: {},
  localConfigSchema: {},
  async getLocalVersion(binaryLocation) {
    const markerPath = path.join(binaryLocation, "engine-linux");
    if (!fs.existsSync(markerPath)) throw new Error("not a real install");
    return { title: "v1", id: "abc" };
  },
  getSupportedVersion: async () => ({ title: "v1", id: "abc" }),
  async getBinary(dataDir, target) {
    const binaryLocation = path.join(dataDir, "v1");
    fs.mkdirSync(binaryLocation, { recursive: true });
    fs.writeFileSync(path.join(binaryLocation, "engine-" + target.platform), "fake binary");
    return { binaryLocation };
  },
  validateBinaryLocation: async () => ({ valid: true }),
  async startGame() {
    return {
      exited: false,
      onExit: () => {},
      onCrash: () => {},
      stop: async () => {},
    };
  },
};
`;

const TARGET = { platform: "linux" as const, arch: "x64" as const };

describe("GameLauncher binary management (getBinary/listBinaries/removeBinary)", () => {
  const cleanups: Array<() => Promise<void> | void> = [];
  afterEach(async () => {
    while (cleanups.length) await cleanups.pop()!();
  });

  async function setup(){
    const pluginDir = await mkdtemp(join(tmpdir(), "game-launcher-binaries-test-"));
    cleanups.push(() => rm(pluginDir, { recursive: true, force: true }));
    await writeFixturePlugin(pluginDir, "fake-launcher", FAKE_PLUGIN_SOURCE);
    const pluginManager = await PluginManager.create(pluginDir);
    return { pluginDir, gameLauncher: pluginManager.gameLauncher };
  }

  it("getBinary downloads into dataDir and persists the active binaryLocation", async () => {
    const { pluginDir, gameLauncher } = await setup();
    const { binaryLocation } = await gameLauncher.getBinary("fake-launcher", TARGET);

    expect(binaryLocation).toBe(join(pluginDir, "data", "fake-launcher", "binaries", "v1"));
    expect(existsSync(join(binaryLocation, "engine-linux"))).toBe(true);

    const settings = await gameLauncher.getLocalSettings("fake-launcher");
    // Stored relative to pluginDir - see GameLauncher.relativizeBinaryLocation.
    expect(settings.binaryLocation).toBe(join("data", "fake-launcher", "binaries", "v1"));
  });

  it("listBinaries reports each downloaded folder's version (read fresh via getLocalVersion) and which is active", async () => {
    const { gameLauncher } = await setup();
    const { binaryLocation } = await gameLauncher.getBinary("fake-launcher", TARGET);

    const [listed] = await gameLauncher.listBinaries("fake-launcher", TARGET);
    expect(listed).toEqual({ binaryLocation, version: { title: "v1", id: "abc" }, active: true });
  });

  it("listBinaries reports null version for a folder getLocalVersion can't read, without dropping it", async () => {
    const { pluginDir, gameLauncher } = await setup();
    const brokenLocation = join(pluginDir, "data", "fake-launcher", "binaries", "broken");
    await mkdir(brokenLocation, { recursive: true });

    const [listed] = await gameLauncher.listBinaries("fake-launcher", TARGET);
    expect(listed).toEqual({ binaryLocation: brokenLocation, version: null, active: false });
  });

  it("listBinaries returns an empty array for a plugin that's never downloaded anything", async () => {
    const { gameLauncher } = await setup();
    expect(await gameLauncher.listBinaries("fake-launcher", TARGET)).toEqual([]);
  });

  it("removeBinary deletes the folder and clears the active setting if it was the one removed", async () => {
    const { gameLauncher } = await setup();
    const { binaryLocation } = await gameLauncher.getBinary("fake-launcher", TARGET);

    await gameLauncher.removeBinary("fake-launcher", binaryLocation);

    expect(existsSync(binaryLocation)).toBe(false);
    expect(await gameLauncher.listBinaries("fake-launcher", TARGET)).toEqual([]);
    expect((await gameLauncher.getLocalSettings("fake-launcher")).binaryLocation).toBeUndefined();
  });

  it("removeBinary throws rather than deleting anything outside this plugin's own dataDir", async () => {
    const { pluginDir, gameLauncher } = await setup();
    const outside = join(pluginDir, "not-managed");
    await mkdir(outside, { recursive: true });
    await writeFile(join(outside, "keep-me"), "still here");

    await expect(gameLauncher.removeBinary("fake-launcher", outside)).rejects.toThrow(/not a binary/);
    expect(existsSync(join(outside, "keep-me"))).toBe(true);
  });

  // Public so a caller like match-agent can key its own bookkeeping (e.g.
  // recording binary usage) off the same absolute path listBinaries
  // reports, rather than whatever raw (possibly relative) form happens to
  // be stored - see start.ts's startGameLauncher for why this matters.
  it("resolveBinaryLocation joins a relative path against pluginDir, and passes an absolute one through unchanged", async () => {
    const { pluginDir, gameLauncher } = await setup();
    expect(gameLauncher.resolveBinaryLocation(join("data", "fake-launcher", "binaries", "v1")))
      .toBe(join(pluginDir, "data", "fake-launcher", "binaries", "v1"));
    expect(gameLauncher.resolveBinaryLocation("/opt/ikemen/Ikemen_GO")).toBe("/opt/ikemen/Ikemen_GO");
  });
});
