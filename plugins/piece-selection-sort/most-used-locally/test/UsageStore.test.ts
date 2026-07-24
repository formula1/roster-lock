import { describe, it, expect, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { openUsageStore } from '../src/UsageStore';

describe('UsageStore', () => {
  const cleanups: Array<() => Promise<void>> = [];
  afterEach(async () => {
    while (cleanups.length) await cleanups.pop()!();
  });

  async function makeStore(){
    const dataDir = await mkdtemp(join(tmpdir(), 'usage-store-test-'));
    cleanups.push(() => rm(dataDir, { recursive: true, force: true }));
    return openUsageStore(dataDir);
  }

  it('ranks by times used, descending', async () => {
    const store = await makeStore();
    store.increment('engine', 'character', 'logic-a');
    store.increment('engine', 'character', 'logic-b');
    store.increment('engine', 'character', 'logic-b');
    store.increment('engine', 'character', 'logic-b');
    store.increment('engine', 'character', 'logic-c');
    store.increment('engine', 'character', 'logic-c');

    expect(store.topRanked('engine', 'character')).toEqual(['logic-b', 'logic-c', 'logic-a']);
    store.close();
  });

  it('scopes usage by engine and pieceType', async () => {
    const store = await makeStore();
    store.increment('engine-a', 'character', 'logic-a');
    store.increment('engine-b', 'character', 'logic-a');
    store.increment('engine-a', 'character', 'logic-a');
    store.increment('engine-a', 'stage', 'logic-a');

    expect(store.topRanked('engine-a', 'character')).toEqual(['logic-a']);
    expect(store.topRanked('engine-b', 'character')).toEqual(['logic-a']);
    expect(store.topRanked('engine-a', 'stage')).toEqual(['logic-a']);
    expect(store.topRanked('engine-a', 'unknown-type')).toEqual([]);
    store.close();
  });

  it('persists across separate opens of the same dataDir', async () => {
    const dataDir = await mkdtemp(join(tmpdir(), 'usage-store-test-'));
    cleanups.push(() => rm(dataDir, { recursive: true, force: true }));

    const first = openUsageStore(dataDir);
    first.increment('engine', 'character', 'logic-a');
    first.close();

    const second = openUsageStore(dataDir);
    expect(second.topRanked('engine', 'character')).toEqual(['logic-a']);
    second.close();
  });
});
