import { describe, it, expect, afterEach } from 'vitest';
import {
  FIXTURE_FILES,
  makeProcessHandlers,
  makeTmpDir,
  removeTmpDir,
  collectFiles,
} from '@roster-lock/dl-shared/test';

import Torrent_Handler from '../../src/index';

async function download(
  handler: { download: (...a: any[]) => Promise<{ finishPromise: Promise<any> }> },
  url: string,
  dest: string,
  extra?: Record<string, unknown>,
) {
  const result = await handler.download(url, dest, makeProcessHandlers(), extra);
  await result.finishPromise;
}

async function assertFixtureFiles(dir: string) {
  const got = await collectFiles(dir);
  for (const [rel, expected] of Object.entries(FIXTURE_FILES)) {
    expect(got[rel], `contents of ${rel}`).toBe(expected);
  }
}

// This suite runs without internet access, so the torrent leecher must skip
// DHT/tracker peer discovery (both dial out to public bootstrap hosts) and
// rely solely on the seeder's x.pe address baked into each magnet URI.
const TORRENT_NO_DISCOVERY = { dht: false, tracker: false, lsd: false };

describe('torrent protocol', () => {
  let tmpDir: string;
  afterEach(() => removeTmpDir(tmpDir));

  it('downloads and extracts archive.tar.gz via magnet', async () => {
    tmpDir = await makeTmpDir();
    const magnetURI = await fetch('http://localhost:19000/magnet/file').then(r => r.text());
    await download(Torrent_Handler, magnetURI, tmpDir, TORRENT_NO_DISCOVERY);
    await assertFixtureFiles(tmpDir);
  });

  it('downloads and extracts archive.tar via magnet', async () => {
    tmpDir = await makeTmpDir();
    const magnetURI = await fetch('http://localhost:19000/magnet/file-tar').then(r => r.text());
    await download(Torrent_Handler, magnetURI, tmpDir, TORRENT_NO_DISCOVERY);
    await assertFixtureFiles(tmpDir);
  });

  it('downloads multi-file torrent preserving paths', async () => {
    tmpDir = await makeTmpDir();
    const magnetURI = await fetch('http://localhost:19000/magnet/dir').then(r => r.text());
    await download(Torrent_Handler, magnetURI, tmpDir, TORRENT_NO_DISCOVERY);
    await assertFixtureFiles(tmpDir);
  });
});
