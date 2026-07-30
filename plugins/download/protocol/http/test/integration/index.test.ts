import { describe, it, expect, afterEach } from 'vitest';
import {
  FIXTURE_FILES,
  makeProcessHandlers,
  makeTmpDir,
  removeTmpDir,
  collectFiles,
} from '@roster-lock/dl-shared/test';

import HTTP_Handler from '../../src/index';

async function download(url: string, dest: string) {
  const result = await HTTP_Handler.download(url, dest, makeProcessHandlers());
  await result.finishPromise;
}

async function assertFixtureFiles(dir: string) {
  const got = await collectFiles(dir);
  for (const [rel, expected] of Object.entries(FIXTURE_FILES)) {
    expect(got[rel], `contents of ${rel}`).toBe(expected);
  }
}

describe('http protocol', () => {
  let tmpDir: string;
  afterEach(() => removeTmpDir(tmpDir));

  it('downloads and extracts archive.tar.gz', async () => {
    tmpDir = await makeTmpDir();
    await download('http://localhost:18080/archive.tar.gz', tmpDir);
    await assertFixtureFiles(tmpDir);
  });

  it('downloads and extracts archive.tar', async () => {
    tmpDir = await makeTmpDir();
    await download('http://localhost:18080/archive.tar', tmpDir);
    await assertFixtureFiles(tmpDir);
  });
});
