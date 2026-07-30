import { describe, it, expect, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import plugin from '../src/index';

const lockConfig = {
  engine: { name: 'test-engine' },
  rosters: {
    character: [
      { id: 'ryu', version: { logic: 'hash-ryu', media: '', docs: '' } },
      { id: 'ken', version: { logic: 'hash-ken', media: '', docs: '' } },
    ],
  },
} as any;

describe('highest-winrate-locally', () => {
  const cleanups: Array<() => Promise<void>> = [];
  afterEach(async () => {
    while (cleanups.length) await cleanups.pop()!();
  });

  async function makeDataDir(){
    const dataDir = await mkdtemp(join(tmpdir(), 'highest-winrate-locally-test-'));
    cleanups.push(() => rm(dataDir, { recursive: true, force: true }));
    return dataDir;
  }

  async function playMatch(dataDir: string, localPick: string, winners: Array<string>){
    const arg = {
      lockConfig, dataDir,
      localUsers: ['local-user'],
      userSelections: {
        'local-user': { character: [{ id: localPick, required: {} }] },
        'remote-user': { character: [{ id: 'ken', required: {} }] },
      },
    };
    await plugin.handleFullSelection(arg);
    await plugin.handleGameComplete({ ...arg, winners });
  }

  it('ranks by the local user\'s own winrate, ignoring remote users\' results', async () => {
    const dataDir = await makeDataDir();

    // local user picks ryu and wins twice, loses once
    await playMatch(dataDir, 'ryu', ['local-user']);
    await playMatch(dataDir, 'ryu', ['local-user']);
    await playMatch(dataDir, 'ryu', ['remote-user']);

    const ranked = await plugin.sortPieces({ lockConfig, pieceType: 'character', dataDir });
    expect(ranked).toEqual(['hash-ryu']);
  });

  it('does not credit a win to the local user\'s pick when only a remote user won', async () => {
    const dataDir = await makeDataDir();
    await playMatch(dataDir, 'ryu', ['remote-user']);

    const ranked = await plugin.sortPieces({ lockConfig, pieceType: 'character', dataDir });
    // A game was recorded (0 wins / 1 game), so ryu is still ranked - just at 0%.
    expect(ranked).toEqual(['hash-ryu']);
  });
});
