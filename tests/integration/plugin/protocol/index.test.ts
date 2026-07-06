import { describe, it, expect, afterEach } from 'vitest';
import {
  FIXTURE_FILES,
  makeProcessHandlers,
  makeTmpDir,
  removeTmpDir,
  collectFiles,
} from './_shared';

import HTTP_Handler    from '@roster-lock/dl-protocol-http';
import FTP_Handler     from '@roster-lock/dl-protocol-ftp';
import Git_Handler     from '@roster-lock/dl-protocol-git';
import Torrent_Handler from '@roster-lock/dl-protocol-torrent';
import IPFS_Handler    from '@roster-lock/dl-protocol-ipfs';
import S3_Handler      from '@roster-lock/dl-protocol-s3';

// ── helpers ──────────────────────────────────────────────────────────────────

async function download(
  handler: { download: (...a: any[]) => Promise<{ finishPromise: Promise<any> }> },
  url: string,
  dest: string,
) {
  const result = await handler.download(url, dest, makeProcessHandlers());
  await result.finishPromise;
}

async function assertFixtureFiles(dir: string) {
  const got = await collectFiles(dir);
  for (const [rel, expected] of Object.entries(FIXTURE_FILES)) {
    expect(got[rel], `contents of ${rel}`).toBe(expected);
  }
}

// ── archive.tar.gz ────────────────────────────────────────────────────────────

describe('single archive.tar.gz', () => {
  let tmpDir: string;
  afterEach(() => removeTmpDir(tmpDir));

  it('http: downloads and extracts archive.tar.gz', async () => {
    tmpDir = await makeTmpDir();
    await download(HTTP_Handler, 'http://localhost:18080/archive.tar.gz', tmpDir);
    await assertFixtureFiles(tmpDir);
  });

  it('ftp: downloads and extracts archive.tar.gz', async () => {
    tmpDir = await makeTmpDir();
    await download(FTP_Handler, 'ftp://localhost:12021/archive.tar.gz', tmpDir);
    await assertFixtureFiles(tmpDir);
  });

  it('torrent: downloads and extracts archive.tar.gz via magnet', async () => {
    tmpDir = await makeTmpDir();
    const magnetURI = await fetch('http://localhost:19000/magnet/file').then(r => r.text());
    await download(Torrent_Handler, magnetURI, tmpDir);
    await assertFixtureFiles(tmpDir);
  });

  it('ipfs: downloads and extracts archive.tar.gz via CID', async () => {
    tmpDir = await makeTmpDir();
    await download(IPFS_Handler, `ipfs://${process.env.IPFS_FILE_CID}`, tmpDir);
    await assertFixtureFiles(tmpDir);
  });

  it('s3: downloads and extracts archive.tar.gz', async () => {
    tmpDir = await makeTmpDir();
    await download(S3_Handler, `s3+http://localhost:19100/${process.env.S3_TEST_BUCKET}/archive.tar.gz`, tmpDir);
    await assertFixtureFiles(tmpDir);
  });
});

// ── archive.tar ───────────────────────────────────────────────────────────────

describe('single archive.tar', () => {
  let tmpDir: string;
  afterEach(() => removeTmpDir(tmpDir));

  it('http: downloads and extracts archive.tar', async () => {
    tmpDir = await makeTmpDir();
    await download(HTTP_Handler, 'http://localhost:18080/archive.tar', tmpDir);
    await assertFixtureFiles(tmpDir);
  });

  it('ftp: downloads and extracts archive.tar', async () => {
    tmpDir = await makeTmpDir();
    await download(FTP_Handler, 'ftp://localhost:12021/archive.tar', tmpDir);
    await assertFixtureFiles(tmpDir);
  });

  it('torrent: downloads and extracts archive.tar via magnet', async () => {
    tmpDir = await makeTmpDir();
    const magnetURI = await fetch('http://localhost:19000/magnet/file-tar').then(r => r.text());
    await download(Torrent_Handler, magnetURI, tmpDir);
    await assertFixtureFiles(tmpDir);
  });

  it('ipfs: downloads and extracts archive.tar via CID', async () => {
    tmpDir = await makeTmpDir();
    await download(IPFS_Handler, `ipfs://${process.env.IPFS_FILE_TAR_CID}`, tmpDir);
    await assertFixtureFiles(tmpDir);
  });

  it('s3: downloads and extracts archive.tar', async () => {
    tmpDir = await makeTmpDir();
    await download(S3_Handler, `s3+http://localhost:19100/${process.env.S3_TEST_BUCKET}/archive.tar`, tmpDir);
    await assertFixtureFiles(tmpDir);
  });
});

// ── directory ─────────────────────────────────────────────────────────────────

describe('directory', () => {
  let tmpDir: string;
  afterEach(() => removeTmpDir(tmpDir));

  it('ftp: downloads directory recursively', async () => {
    tmpDir = await makeTmpDir();
    await download(FTP_Handler, 'ftp://localhost:12021/files/', tmpDir);
    await assertFixtureFiles(tmpDir);
  });

  it('git: clones repository', async () => {
    tmpDir = await makeTmpDir();
    await download(Git_Handler, 'http://localhost:13000/repo.git', tmpDir);
    await assertFixtureFiles(tmpDir);
  });

  it('torrent: downloads multi-file torrent preserving paths', async () => {
    tmpDir = await makeTmpDir();
    const magnetURI = await fetch('http://localhost:19000/magnet/dir').then(r => r.text());
    await download(Torrent_Handler, magnetURI, tmpDir);
    await assertFixtureFiles(tmpDir);
  });

  it('ipfs: downloads directory recursively', async () => {
    tmpDir = await makeTmpDir();
    await download(IPFS_Handler, `ipfs://${process.env.IPFS_DIR_CID}`, tmpDir);
    await assertFixtureFiles(tmpDir);
  });
});
