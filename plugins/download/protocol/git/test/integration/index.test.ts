import { describe, it, expect, afterEach } from 'vitest';
import {
  FIXTURE_FILES,
  makeProcessHandlers,
  makeTmpDir,
  removeTmpDir,
  collectFiles,
} from '@roster-lock/dl-shared/test';

import Git_Handler from '../../src/index';

async function download(url: string, dest: string) {
  const result = await Git_Handler.download(url, dest, makeProcessHandlers());
  await result.finishPromise;
}

async function assertFixtureFiles(dir: string) {
  const got = await collectFiles(dir);
  for (const [rel, expected] of Object.entries(FIXTURE_FILES)) {
    expect(got[rel], `contents of ${rel}`).toBe(expected);
  }
}

describe('git protocol', () => {
  let tmpDir: string;
  afterEach(() => removeTmpDir(tmpDir));

  it('clones repository', async () => {
    tmpDir = await makeTmpDir();
    await download('http://localhost:13000/repo.git', tmpDir);
    await assertFixtureFiles(tmpDir);
  });
});
