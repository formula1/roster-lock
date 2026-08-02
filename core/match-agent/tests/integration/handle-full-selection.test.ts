import { describe, it, expect, afterEach, vi } from "vitest";
import { PluginManager } from "@roster-lock/plugin-runtime";
import { bindStepsToBridge } from "../../src/handle-room/version-1/room-handler-bridge/steps";
import { wireBridgePair } from "./helpers/bridge";
import { driveRoomProtocol } from "./helpers/room";
import { FakeFolderDB } from "./helpers/fakeFolderDB";
import { makeLockConfig, makeHeroSelection, makeHeroSelectionWithMediaOverride } from "./helpers/lockConfig";
import { createFixturePluginDir } from "./helpers/plugin-dir";

const MOST_USED_LOCALLY = "@roster-lock/piece-selection-sort-most-used-locally";

describe("bindStepsToBridge: handleFullSelection hook", () => {
  const cleanups: Array<() => Promise<void> | void> = [];
  afterEach(async () => {
    while (cleanups.length) await cleanups.pop()!();
  });

  it("fires handleFullSelection against every installed piece-selection-sort plugin once the room agrees on a final selection", async () => {
    const fixture = await createFixturePluginDir([MOST_USED_LOCALLY]);
    cleanups.push(fixture.cleanup);
    const pluginRuntime = await PluginManager.create(fixture.pluginDir);

    const lockConfig = makeLockConfig();
    const machines = [{ publicKey: "pk-a", playerCount: 1 }, { publicKey: "pk-b", playerCount: 1 }];

    const pairA = wireBridgePair();
    const pairB = wireBridgePair();

    const resultAPromise = bindStepsToBridge({
      bridge: pairA.agentSide,
      fileDB: new FakeFolderDB(),
      pluginRuntime,
      machines,
      ownMachinePublicKey: "pk-a",
      ownSelections: { 0: makeHeroSelection() },
      lockConfig,
      gameControlledSelections: {},
    });
    const resultBPromise = bindStepsToBridge({
      bridge: pairB.agentSide,
      fileDB: new FakeFolderDB(),
      pluginRuntime,
      machines,
      ownMachinePublicKey: "pk-b",
      ownSelections: { 0: makeHeroSelection() },
      lockConfig,
      gameControlledSelections: {},
    });

    await driveRoomProtocol([
      { bridge: pairA.roomSide, publicKey: "pk-a" },
      { bridge: pairB.roomSide, publicKey: "pk-b" },
    ]);

    await Promise.all([resultAPromise, resultBPromise]);

    // The hook fires off a promise.then() on the room's overall promise, so
    // it isn't awaited by bindStepsToBridge itself - both agents finishing
    // above only proves the room succeeded, not that the hook has already
    // run. Poll instead of asserting immediately.
    // Both agents picked "hero-1" (logic hash "1.0.0" per makeLockConfig) -
    // proves the hook actually ran with real decrypted userSelections, not
    // just that the room protocol completed.
    await vi.waitFor(async () => {
      const ranked = await pluginRuntime.pieceSort.sortPieces(MOST_USED_LOCALLY, {
        lockConfig, pieceType: "character",
      });
      expect(ranked).toEqual(["1.0.0"]);
    });
  });

  it("does not fail the room when a piece-selection-sort plugin's handleFullSelection throws", async () => {
    const fixture = await createFixturePluginDir([]);
    cleanups.push(fixture.cleanup);
    const pluginDir = fixture.pluginDir;

    const { mkdir, writeFile } = await import("node:fs/promises");
    const { join } = await import("node:path");
    const pkgDir = join(pluginDir, "node_modules", "broken-plugin");
    await mkdir(pkgDir, { recursive: true });
    await writeFile(join(pkgDir, "package.json"), JSON.stringify({
      name: "broken-plugin", version: "1.0.0", main: "index.js",
      "roster-lock": { pluginType: "piece-selection-sort", priority: 0 },
    }));
    await writeFile(join(pkgDir, "index.js"), `
      module.exports.default = {
        name: "broken-plugin",
        publicInfo: { title: "Broken", description: "Always throws" },
        async sortPieces() { throw new Error("boom"); },
        async handleFullSelection() { throw new Error("boom"); },
        async handleGameComplete() { throw new Error("boom"); },
      };
    `);
    await writeFile(join(pluginDir, "plugins.json"), JSON.stringify({
      plugins: [{ package: "broken-plugin", version: "1.0.0", type: "piece-selection-sort", priority: 0 }],
    }));

    const pluginRuntime = await PluginManager.create(pluginDir);
    const lockConfig = makeLockConfig();
    const machines = [{ publicKey: "pk-a", playerCount: 1 }, { publicKey: "pk-b", playerCount: 1 }];

    const pairA = wireBridgePair();
    const pairB = wireBridgePair();

    const resultAPromise = bindStepsToBridge({
      bridge: pairA.agentSide,
      fileDB: new FakeFolderDB(),
      pluginRuntime,
      machines,
      ownMachinePublicKey: "pk-a",
      ownSelections: { 0: makeHeroSelection() },
      lockConfig,
      gameControlledSelections: {},
    });
    const resultBPromise = bindStepsToBridge({
      bridge: pairB.agentSide,
      fileDB: new FakeFolderDB(),
      pluginRuntime,
      machines,
      ownMachinePublicKey: "pk-b",
      ownSelections: { 0: makeHeroSelection() },
      lockConfig,
      gameControlledSelections: {},
    });

    await driveRoomProtocol([
      { bridge: pairA.roomSide, publicKey: "pk-a" },
      { bridge: pairB.roomSide, publicKey: "pk-b" },
    ]);

    const [resultA] = await Promise.all([resultAPromise, resultBPromise]);
    expect(resultA.finalSelection.character).toBeTruthy();

    // The hook (and its failure) happen off promise.then(), after the room
    // above already resolved - wait for it to actually settle before this
    // test ends, or its dataDir mkdir can still be in flight when afterEach's
    // fixture.cleanup() starts deleting the same directory tree (ENOTEMPTY).
    const { existsSync } = await import("node:fs");
    await vi.waitFor(() => {
      expect(existsSync(join(pluginDir, "data", "broken-plugin"))).toBe(true);
    });
  });

  it("downloads a selected mediaOverride alongside its piece once the room agrees on a final selection", async () => {
    const fixture = await createFixturePluginDir([]);
    cleanups.push(fixture.cleanup);
    const pluginRuntime = await PluginManager.create(fixture.pluginDir);

    const lockConfig = makeLockConfig();
    const machines = [{ publicKey: "pk-a", playerCount: 1 }, { publicKey: "pk-b", playerCount: 1 }];

    const pairA = wireBridgePair();
    const pairB = wireBridgePair();
    const fileDBA = new FakeFolderDB();
    const fileDBB = new FakeFolderDB();

    const resultAPromise = bindStepsToBridge({
      bridge: pairA.agentSide,
      fileDB: fileDBA,
      pluginRuntime,
      machines,
      ownMachinePublicKey: "pk-a",
      ownSelections: { 0: makeHeroSelectionWithMediaOverride() },
      lockConfig,
      gameControlledSelections: {},
    });
    const resultBPromise = bindStepsToBridge({
      bridge: pairB.agentSide,
      fileDB: fileDBB,
      pluginRuntime,
      machines,
      ownMachinePublicKey: "pk-b",
      ownSelections: { 0: makeHeroSelectionWithMediaOverride() },
      lockConfig,
      gameControlledSelections: {},
    });

    await driveRoomProtocol([
      { bridge: pairA.roomSide, publicKey: "pk-a" },
      { bridge: pairB.roomSide, publicKey: "pk-b" },
    ]);

    await Promise.all([resultAPromise, resultBPromise]);

    // Every peer downloads the same agreed-upon selection - both sides
    // should have fetched the override, not just the client that chose it.
    for(const fileDB of [fileDBA, fileDBB]){
      expect(fileDB.mediaOverrideCalls).toEqual([
        { pieceType: "character", logicHash: "1.0.0", overrideHash: "override-1.0.0" },
      ]);
    }
  });
});
