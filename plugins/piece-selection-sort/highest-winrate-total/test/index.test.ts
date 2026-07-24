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

describe('highest-winrate-total', () => {
  const cleanups: Array<() => Promise<void>> = [];
  afterEach(async () => {
    while (cleanups.length) await cleanups.pop()!();
  });

  async function makeDataDir(){
    const dataDir = await mkdtemp(join(tmpdir(), 'highest-winrate-total-test-'));
    cleanups.push(() => rm(dataDir, { recursive: true, force: true }));
    return dataDir;
  }

  async function playMatch(dataDir: string, picks: Record<string, string>, winners: Array<string>){
    const arg = {
      lockConfig, dataDir,
      localUsers: ['local-user'],
      userSelections: Object.fromEntries(
        Object.entries(picks).map(([userId, pieceId])=>[userId, { character: [{ id: pieceId, required: {} }] }])
      ),
    };
    await plugin.handleFullSelection(arg);
    await plugin.handleGameComplete({ ...arg, winners });
  }

  it('credits a win to a remote user\'s pick, unlike the -locally variant', async () => {
    const dataDir = await makeDataDir();
    await playMatch(dataDir, { 'local-user': 'ken', 'remote-user': 'ryu' }, ['remote-user']);
    await playMatch(dataDir, { 'local-user': 'ken', 'remote-user': 'ryu' }, ['remote-user']);
    await playMatch(dataDir, { 'local-user': 'ken', 'remote-user': 'ryu' }, ['local-user']);

    const ranked = await plugin.sortPieces({ lockConfig, pieceType: 'character', dataDir });
    // ryu: 2/3, ken: 1/3
    expect(ranked).toEqual(['hash-ryu', 'hash-ken']);
  });
});
