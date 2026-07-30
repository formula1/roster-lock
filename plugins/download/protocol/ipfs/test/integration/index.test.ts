import { describe, it, expect, afterEach } from 'vitest';
import {
  FIXTURE_FILES,
  makeProcessHandlers,
  makeTmpDir,
  removeTmpDir,
  collectFiles,
} from '@roster-lock/dl-shared/test';

import IPFS_Handler from '../../src/index';

async function download(url: string, dest: string) {
  const result = await IPFS_Handler.download(url, dest, makeProcessHandlers());
  await result.finishPromise;
}

async function assertFixtureFiles(dir: string) {
  const got = await collectFiles(dir);
  for (const [rel, expected] of Object.entries(FIXTURE_FILES)) {
    expect(got[rel], `contents of ${rel}`).toBe(expected);
  }
}

describe('ipfs protocol', () => {
  let tmpDir: string;
  afterEach(() => removeTmpDir(tmpDir));

  it('downloads and extracts archive.tar.gz via CID', async () => {
    tmpDir = await makeTmpDir();
    await download(`ipfs://${process.env.IPFS_FILE_CID}/archive.tar.gz`, tmpDir);
    await assertFixtureFiles(tmpDir);
  });

  it('downloads and extracts archive.tar via CID', async () => {
    tmpDir = await makeTmpDir();
    await download(`ipfs://${process.env.IPFS_FILE_TAR_CID}/archive.tar`, tmpDir);
    await assertFixtureFiles(tmpDir);
  });

  it('downloads directory recursively', async () => {
    tmpDir = await makeTmpDir();
    await download(`ipfs://${process.env.IPFS_DIR_CID}`, tmpDir);
    await assertFixtureFiles(tmpDir);
  });
});
