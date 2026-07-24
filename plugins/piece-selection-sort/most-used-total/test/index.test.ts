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

describe('most-used-total', () => {
  const cleanups: Array<() => Promise<void>> = [];
  afterEach(async () => {
    while (cleanups.length) await cleanups.pop()!();
  });

  async function makeDataDir(){
    const dataDir = await mkdtemp(join(tmpdir(), 'most-used-total-test-'));
    cleanups.push(() => rm(dataDir, { recursive: true, force: true }));
    return dataDir;
  }

  it('counts every player in the match, not just localUsers', async () => {
    const dataDir = await makeDataDir();

    await plugin.handleFullSelection({
      lockConfig, dataDir,
      localUsers: ['local-user'],
      userSelections: {
        'local-user': { character: [{ id: 'ken', required: {} }] },
        'remote-user': { character: [{ id: 'ryu', required: {} }] },
      },
    });
    await plugin.handleFullSelection({
      lockConfig, dataDir,
      localUsers: ['local-user'],
      userSelections: {
        'remote-user-2': { character: [{ id: 'ryu', required: {} }] },
      },
    });

    // ryu was picked by two different remote users across the two matches -
    // most-used-locally would have ignored both, but "total" counts them.
    const ranked = await plugin.sortPieces({ lockConfig, pieceType: 'character', dataDir });
    expect(ranked).toEqual(['hash-ryu', 'hash-ken']);
  });
});
