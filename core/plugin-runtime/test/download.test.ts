import { describe, it, expect, afterEach } from 'vitest';
import { createServer, Server } from 'node:http';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AddressInfo } from 'node:net';

import { downloadToFolder } from '../src/download';
import { createFixturePluginDir } from './helpers/plugin-dir';
import { makeTarGz } from './helpers/make-tar-gz';

// One of each plugin kind, exercised through the real plugin-management +
// download orchestration code - not mocked at the module level, since
// plugin-management loads plugins via a real `require()` that a vi.mock
// on node:https/http can't intercept.
const DOWNLOAD_PLUGINS = [
  '@roster-lock/dl-protocol-http',
  '@roster-lock/dl-compression-gzip',
  '@roster-lock/dl-archive-tar',
];

describe('downloadToFolder', () => {
  const cleanups: Array<() => Promise<void> | void> = [];

  afterEach(async () => {
    while (cleanups.length) await cleanups.pop()!();
  });

  it('downloads over http and extracts a gzip+tar archive to disk', async () => {
    const archive = makeTarGz([
      { path: 'hello.txt', content: 'Hello, World!\n' },
      { path: 'subdir/data.txt', content: 'Integration test data\n' },
    ]);

    const server = await startServer(archive);
    cleanups.push(() => new Promise((resolve) => server.close(() => resolve())));

    const fixture = await createFixturePluginDir(DOWNLOAD_PLUGINS);
    cleanups.push(fixture.cleanup);

    const destinationFolder = await mkdtemp(join(tmpdir(), 'plugin-runtime-dest-'));
    cleanups.push(() => rm(destinationFolder, { recursive: true, force: true }));

    const port = (server.address() as AddressInfo).port;
    const { finishPromise, metaData } = await downloadToFolder(fixture.pluginDir, {
      url: `http://localhost:${port}/archive.tar.gz`,
      destinationFolder,
      processHandlers: { abortSignal: new AbortController().signal },
    });
    await finishPromise;

    expect(metaData).toMatchObject({ url: `http://localhost:${port}/archive.tar.gz` });
    await expect(readFile(join(destinationFolder, 'hello.txt'), 'utf-8'))
      .resolves.toBe('Hello, World!\n');
    await expect(readFile(join(destinationFolder, 'subdir/data.txt'), 'utf-8'))
      .resolves.toBe('Integration test data\n');
  });

  it('throws when no installed protocol plugin can handle the url', async () => {
    const fixture = await createFixturePluginDir(DOWNLOAD_PLUGINS);
    cleanups.push(fixture.cleanup);

    await expect(downloadToFolder(fixture.pluginDir, {
      url: 'ftp://example.com/archive.tar.gz',
      destinationFolder: tmpdir(),
      processHandlers: { abortSignal: new AbortController().signal },
    })).rejects.toThrow('No protocol to handle url');
  });

  it('throws when no installed archive plugin matches the file extension', async () => {
    const fixture = await createFixturePluginDir(DOWNLOAD_PLUGINS);
    cleanups.push(fixture.cleanup);

    await expect(downloadToFolder(fixture.pluginDir, {
      url: 'http://localhost:1/archive.zip',
      destinationFolder: tmpdir(),
      processHandlers: { abortSignal: new AbortController().signal },
    })).rejects.toThrow(/No archive handler found for extension \.zip/);
  });
});

function startServer(body: Buffer): Promise<Server> {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      res.writeHead(200, { 'content-length': String(body.length) });
      res.end(body);
    });
    server.listen(0, 'localhost', () => resolve(server));
  });
}
