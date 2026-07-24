import { describe, it, expect, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { openWinRateStore } from '../src/WinRateStore';

describe('WinRateStore', () => {
  const cleanups: Array<() => Promise<void>> = [];
  afterEach(async () => {
    while (cleanups.length) await cleanups.pop()!();
  });

  async function makeStore(){
    const dataDir = await mkdtemp(join(tmpdir(), 'winrate-store-test-'));
    cleanups.push(() => rm(dataDir, { recursive: true, force: true }));
    return openWinRateStore(dataDir);
  }

  it('ranks by winrate, descending, breaking ties on games played', async () => {
    const store = await makeStore();

    // logic-a: 1/1 = 100%
    store.recordGame('engine', 'character', 'logic-a');
    store.recordWin('engine', 'character', 'logic-a');

    // logic-b: 3/4 = 75%
    for (let i = 0; i < 4; i++) store.recordGame('engine', 'character', 'logic-b');
    for (let i = 0; i < 3; i++) store.recordWin('engine', 'character', 'logic-b');

    // logic-c: 1/2 = 50%
    store.recordGame('engine', 'character', 'logic-c');
    store.recordGame('engine', 'character', 'logic-c');
    store.recordWin('engine', 'character', 'logic-c');

    expect(store.topRanked('engine', 'character')).toEqual(['logic-a', 'logic-b', 'logic-c']);
    store.close();
  });

  it('excludes pieces with zero recorded games', async () => {
    const store = await makeStore();
    store.recordGame('engine', 'character', 'logic-a');
    store.recordWin('engine', 'character', 'logic-a');

    expect(store.topRanked('engine', 'character')).toEqual(['logic-a']);
    store.close();
  });

  it('breaks a tied winrate by games played', async () => {
    const store = await makeStore();
    // Both 100% winrate, but logic-b has played more.
    store.recordGame('engine', 'character', 'logic-a');
    store.recordWin('engine', 'character', 'logic-a');
    for (let i = 0; i < 3; i++) {
      store.recordGame('engine', 'character', 'logic-b');
      store.recordWin('engine', 'character', 'logic-b');
    }

    expect(store.topRanked('engine', 'character')).toEqual(['logic-b', 'logic-a']);
    store.close();
  });
});
