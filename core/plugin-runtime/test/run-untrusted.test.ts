import { describe, it, expect, afterEach } from 'vitest';
import type { RosterLockV1Config, ScriptStarter } from '@roster-lock/types';

import { runUntrustedScript } from '../src/run-untrusted';
import { createFixturePluginDir } from './helpers/plugin-dir';

// One of each plugin kind, exercised through the real plugin-management +
// run-untrusted orchestration code (extension routing, module resolution,
// globals wiring) rather than calling a single plugin's runner directly.
const UNTRUSTED_PLUGINS = [
  '@roster-lock/untrusted-ts',
  '@roster-lock/untrusted-config-json',
];

function makeConfig(
  scriptDictionary: RosterLockV1Config['selection']['scriptDictionary']
): RosterLockV1Config {
  return {
    configIdentity: { namespace: 'roster-lock', purpose: 'lock', version: 1 },
    author: 'test',
    title: 'Test Config',
    version: '1.0.0',
    engine: {
      name: 'test-engine',
      version: '1.0.0',
      pieceDefinitions: {
        character: { selectionStrategy: 'personal', requires: [], pathVariables: [], assets: [] },
      },
    },
    rosters: {},
    selection: { piece: {}, globalValidation: [], scriptDictionary },
  };
}

const basicPurpose = {
  type: 'piece-user-validation' as const,
  pieceType: 'character',
  userId: 'user1',
  input: [],
};

describe('runUntrustedScript', () => {
  const cleanups: Array<() => Promise<void> | void> = [];

  afterEach(async () => {
    while (cleanups.length) await cleanups.pop()!();
  });

  it('runs a ts entry script that dynamically imports a real json config plugin module', async () => {
    const fixture = await createFixturePluginDir(UNTRUSTED_PLUGINS);
    cleanups.push(fixture.cleanup);

    const scriptStarter: ScriptStarter = {
      config: makeConfig({
        '/main.ts': {
          content: `
            async function main() {
              const data = await import("./data.json");
              return data.default.value;
            }
          `,
        },
        '/data.json': { content: `{ "value": 42 }` },
      }),
      randomSeeds: [],
      purpose: basicPurpose,
      entryScript: { src: '/main.ts', method: 'main' },
    };

    const result = await runUntrustedScript(fixture.pluginDir, scriptStarter);
    expect(result).toBe(42);
  });

  it('throws when the entry script is missing from the script dictionary', async () => {
    const fixture = await createFixturePluginDir(UNTRUSTED_PLUGINS);
    cleanups.push(fixture.cleanup);

    const scriptStarter: ScriptStarter = {
      config: makeConfig({}),
      randomSeeds: [],
      purpose: basicPurpose,
      entryScript: { src: '/missing.ts', method: 'main' },
    };

    await expect(runUntrustedScript(fixture.pluginDir, scriptStarter))
      .rejects.toThrow('Missing entry script');
  });

  it('throws when no installed untrusted-script plugin handles the entry extension', async () => {
    // Only the json config plugin is installed - no plugin can run a ".ts" entry script.
    const fixture = await createFixturePluginDir([
      '@roster-lock/untrusted-config-json',
    ]);
    cleanups.push(fixture.cleanup);

    const scriptStarter: ScriptStarter = {
      config: makeConfig({ '/main.ts': { content: 'async function main() { return 1; }' } }),
      randomSeeds: [],
      purpose: basicPurpose,
      entryScript: { src: '/main.ts', method: 'main' },
    };

    await expect(runUntrustedScript(fixture.pluginDir, scriptStarter))
      .rejects.toThrow('Cannot run script of type');
  });
});
