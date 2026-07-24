import { describe, it, expect, afterEach } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { PluginManager } from '../src/PluginHandler';

// These fixture plugins are written directly as plugins.json + node_modules
// entries (bypassing installPlugin's real npm/arborist install) so tests can
// exercise a "well behaved" plugin alongside a "throws on every call" one
// without needing real installable packages - plugin-management only ever
// reads plugins.json + require()s node_modules/<package>/<main> at runtime,
// so this is a faithful fixture of what's actually on disk after a real install.
async function writeFixturePlugin(
  pluginDir: string,
  packageName: string,
  pluginType: string,
  moduleSource: string,
){
  const pkgDir = join(pluginDir, 'node_modules', packageName);
  await mkdir(pkgDir, { recursive: true });
  await writeFile(join(pkgDir, 'package.json'), JSON.stringify({
    name: packageName,
    version: '1.0.0',
    main: 'index.js',
    'roster-lock': { pluginType, priority: 0 },
  }));
  await writeFile(join(pkgDir, 'index.js'), moduleSource);
}

async function writeManifest(pluginDir: string, entries: Array<{ package: string, type: string }>){
  await writeFile(join(pluginDir, 'plugins.json'), JSON.stringify({
    plugins: entries.map((e)=>({ package: e.package, version: '1.0.0', type: e.type, priority: 0 })),
  }));
}

const GOOD_PLUGIN_SOURCE = `
const fs = require("fs");
const path = require("path");
module.exports.default = {
  name: "good-plugin",
  publicInfo: { title: "Good Plugin", description: "Always behaves" },
  async sortPieces(arg) {
    fs.writeFileSync(path.join(arg.dataDir, "sortPieces-arg.json"), JSON.stringify(arg));
    return ["logic-b", "logic-a"];
  },
  async handleFullSelection(arg) {
    fs.writeFileSync(path.join(arg.dataDir, "handleFullSelection-arg.json"), JSON.stringify(arg));
  },
  async handleGameComplete(arg) {
    fs.writeFileSync(path.join(arg.dataDir, "handleGameComplete-arg.json"), JSON.stringify(arg));
  },
};
`;

const BROKEN_PLUGIN_SOURCE = `
module.exports.default = {
  name: "broken-plugin",
  publicInfo: { title: "Broken Plugin", description: "Always throws" },
  async sortPieces() { throw new Error("sortPieces boom"); },
  async handleFullSelection() { throw new Error("handleFullSelection boom"); },
  async handleGameComplete() { throw new Error("handleGameComplete boom"); },
};
`;

const DL_PROTOCOL_SOURCE = `
module.exports.default = {
  name: "not-a-selection-plugin",
  validateURL: () => true,
  download: async () => ({ finishPromise: Promise.resolve() }),
};
`;

describe('PieceSort', () => {
  const cleanups: Array<() => Promise<void> | void> = [];
  afterEach(async () => {
    while (cleanups.length) await cleanups.pop()!();
  });

  async function makePluginManager(){
    const pluginDir = await mkdtemp(join(tmpdir(), 'piece-selection-sort-test-'));
    cleanups.push(() => rm(pluginDir, { recursive: true, force: true }));
    const pluginManager = await PluginManager.create(pluginDir);
    return { pluginDir, pluginManager };
  }

  it('listAvailable returns installed piece-selection-sort plugins with their publicInfo', async () => {
    const { pluginDir, pluginManager } = await makePluginManager();
    await writeFixturePlugin(pluginDir, 'good-plugin', 'piece-selection-sort', GOOD_PLUGIN_SOURCE);
    await writeFixturePlugin(pluginDir, 'dl-plugin', 'dl-protocol', DL_PROTOCOL_SOURCE);
    await writeManifest(pluginDir, [
      { package: 'good-plugin', type: 'piece-selection-sort' },
      { package: 'dl-plugin', type: 'dl-protocol' },
    ]);

    const available = await pluginManager.pieceSort.listAvailable();
    expect(available).toEqual([
      { pluginName: 'good-plugin', publicInfo: { title: 'Good Plugin', description: 'Always behaves' } },
    ]);
  });

  it('sortPieces resolves the named plugin, passes it a dedicated dataDir, and returns its ranking', async () => {
    const { pluginDir, pluginManager } = await makePluginManager();
    await writeFixturePlugin(pluginDir, 'good-plugin', 'piece-selection-sort', GOOD_PLUGIN_SOURCE);
    await writeManifest(pluginDir, [{ package: 'good-plugin', type: 'piece-selection-sort' }]);

    const ranked = await pluginManager.pieceSort.sortPieces('good-plugin', {
      lockConfig: { engine: { name: 'test-engine' } } as any,
      pieceType: 'character',
    });
    expect(ranked).toEqual(['logic-b', 'logic-a']);

    const expectedDataDir = join(pluginDir, 'data', 'good-plugin');
    expect(existsSync(expectedDataDir)).toBe(true);
    const recordedArg = JSON.parse(await readFile(join(expectedDataDir, 'sortPieces-arg.json'), 'utf-8'));
    expect(recordedArg).toMatchObject({ pieceType: 'character', dataDir: expectedDataDir });
  });

  it('sortPieces throws for a plugin that is not installed', async () => {
    const { pluginManager } = await makePluginManager();
    await expect(pluginManager.pieceSort.sortPieces('missing-plugin', {
      lockConfig: {} as any, pieceType: 'character',
    })).rejects.toThrow('Plugin not installed: missing-plugin');
  });

  it('sortPieces throws for a plugin installed under a different type', async () => {
    const { pluginDir, pluginManager } = await makePluginManager();
    await writeFixturePlugin(pluginDir, 'dl-plugin', 'dl-protocol', DL_PROTOCOL_SOURCE);
    await writeManifest(pluginDir, [{ package: 'dl-plugin', type: 'dl-protocol' }]);

    await expect(pluginManager.pieceSort.sortPieces('dl-plugin', {
      lockConfig: {} as any, pieceType: 'character',
    })).rejects.toThrow('is a "dl-protocol" plugin, not "piece-selection-sort"');
  });

  it('handleFullSelection fans out to every installed plugin with isolated dataDirs, containing one plugin\'s failure', async () => {
    const { pluginDir, pluginManager } = await makePluginManager();
    await writeFixturePlugin(pluginDir, 'good-plugin', 'piece-selection-sort', GOOD_PLUGIN_SOURCE);
    await writeFixturePlugin(pluginDir, 'broken-plugin', 'piece-selection-sort', BROKEN_PLUGIN_SOURCE);
    await writeManifest(pluginDir, [
      { package: 'good-plugin', type: 'piece-selection-sort' },
      { package: 'broken-plugin', type: 'piece-selection-sort' },
    ]);

    const arg = {
      lockConfig: { engine: { name: 'test-engine' } } as any,
      localUsers: ['user-a'],
      userSelections: { 'user-a': { character: [{ id: 'ryu', required: {} }] } } as any,
    };
    await expect(pluginManager.pieceSort.handleFullSelection(arg)).resolves.toBeUndefined();

    const goodDataDir = join(pluginDir, 'data', 'good-plugin');
    const brokenDataDir = join(pluginDir, 'data', 'broken-plugin');
    expect(goodDataDir).not.toBe(brokenDataDir);
    expect(existsSync(join(goodDataDir, 'handleFullSelection-arg.json'))).toBe(true);
    const recorded = JSON.parse(await readFile(join(goodDataDir, 'handleFullSelection-arg.json'), 'utf-8'));
    expect(recorded).toMatchObject({ localUsers: ['user-a'], dataDir: goodDataDir });
  });

  it('handleGameComplete fans out to every installed plugin, tolerating a throwing one', async () => {
    const { pluginDir, pluginManager } = await makePluginManager();
    await writeFixturePlugin(pluginDir, 'good-plugin', 'piece-selection-sort', GOOD_PLUGIN_SOURCE);
    await writeFixturePlugin(pluginDir, 'broken-plugin', 'piece-selection-sort', BROKEN_PLUGIN_SOURCE);
    await writeManifest(pluginDir, [
      { package: 'good-plugin', type: 'piece-selection-sort' },
      { package: 'broken-plugin', type: 'piece-selection-sort' },
    ]);

    const arg = {
      lockConfig: { engine: { name: 'test-engine' } } as any,
      localUsers: ['user-a'],
      userSelections: { 'user-a': { character: [{ id: 'ryu', required: {} }] } } as any,
      winners: ['user-a'],
    };
    await expect(pluginManager.pieceSort.handleGameComplete(arg)).resolves.toBeUndefined();

    const goodDataDir = join(pluginDir, 'data', 'good-plugin');
    const recorded = JSON.parse(await readFile(join(goodDataDir, 'handleGameComplete-arg.json'), 'utf-8'));
    expect(recorded).toMatchObject({ winners: ['user-a'], dataDir: goodDataDir });
  });
});
