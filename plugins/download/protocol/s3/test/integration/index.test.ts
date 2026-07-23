import { describe, it, expect, afterEach } from 'vitest';
import {
  FIXTURE_FILES,
  makeProcessHandlers,
  makeTmpDir,
  removeTmpDir,
  collectFiles,
} from '@roster-lock/dl-shared/test';

import S3_Handler from '../../src/index';

async function download(url: string, dest: string) {
  const result = await S3_Handler.download(url, dest, makeProcessHandlers());
  await result.finishPromise;
}

async function assertFixtureFiles(dir: string) {
  const got = await collectFiles(dir);
  for (const [rel, expected] of Object.entries(FIXTURE_FILES)) {
    expect(got[rel], `contents of ${rel}`).toBe(expected);
  }
}

describe('s3 protocol', () => {
  let tmpDir: string;
  afterEach(() => removeTmpDir(tmpDir));

  it('downloads and extracts archive.tar.gz', async () => {
    tmpDir = await makeTmpDir();
    await download(`s3+http://localhost:19100/${process.env.S3_TEST_BUCKET}/archive.tar.gz`, tmpDir);
    await assertFixtureFiles(tmpDir);
  });

  it('downloads and extracts archive.tar', async () => {
    tmpDir = await makeTmpDir();
    await download(`s3+http://localhost:19100/${process.env.S3_TEST_BUCKET}/archive.tar`, tmpDir);
    await assertFixtureFiles(tmpDir);
  });
});
