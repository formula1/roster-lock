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

describe('most-used-locally', () => {
  const cleanups: Array<() => Promise<void>> = [];
  afterEach(async () => {
    while (cleanups.length) await cleanups.pop()!();
  });

  async function makeDataDir(){
    const dataDir = await mkdtemp(join(tmpdir(), 'most-used-locally-test-'));
    cleanups.push(() => rm(dataDir, { recursive: true, force: true }));
    return dataDir;
  }

  it('declares itself as a piece-selection-sort plugin', () => {
    expect(plugin.name).toBe('most-used-locally');
    expect(plugin.publicInfo.title).toBeTruthy();
  });

  it('only counts local users\' picks, ranking the most-picked piece first', async () => {
    const dataDir = await makeDataDir();

    await plugin.handleFullSelection({
      lockConfig, dataDir,
      localUsers: ['local-user'],
      userSelections: {
        'local-user': { character: [{ id: 'ken', required: {} }] },
        'remote-user': { character: [{ id: 'ryu', required: {} }, { id: 'ryu', required: {} }] },
      },
    });
    await plugin.handleFullSelection({
      lockConfig, dataDir,
      localUsers: ['local-user'],
      userSelections: {
        'local-user': { character: [{ id: 'ken', required: {} }] },
      },
    });

    const ranked = await plugin.sortPieces({ lockConfig, pieceType: 'character', dataDir });
    expect(ranked).toEqual(['hash-ken']);
  });

  it('handleGameComplete is a no-op (usage is tracked at selection time)', async () => {
    const dataDir = await makeDataDir();
    await expect(plugin.handleGameComplete({
      lockConfig, dataDir, localUsers: [], userSelections: {}, winners: [],
    })).resolves.toBeUndefined();
    expect(await plugin.sortPieces({ lockConfig, pieceType: 'character', dataDir })).toEqual([]);
  });
});
