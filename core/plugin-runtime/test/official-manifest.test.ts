import { describe, it, expect, afterEach } from 'vitest';
import { createServer, Server } from 'node:http';
import { AddressInfo } from 'node:net';

import { diffAgainstOfficial, fetchOfficialManifest } from '../src/plugin-management/official-manifest';
import { PluginEntry } from '../src/plugin-management';

const HTTP_PLUGIN = '@roster-lock/dl-protocol-http';

function installedEntry(overrides: Partial<PluginEntry> = {}): PluginEntry {
  return { package: HTTP_PLUGIN, version: '1.0.0', type: 'dl-protocol', priority: 0, ...overrides };
}

describe('diffAgainstOfficial', () => {
  it('reports a package missing entirely when nothing is installed', () => {
    const diff = diffAgainstOfficial([], { plugins: { [HTTP_PLUGIN]: { version: '1.0.0' } } });
    expect(diff.missing).toEqual([{ package: HTTP_PLUGIN, version: '1.0.0' }]);
    expect(diff.outdated).toEqual([]);
    expect(diff.upToDate).toEqual([]);
    expect(diff.unlisted).toEqual([]);
  });

  it('reports a package outdated when the installed version is behind the official one', () => {
    const installed = [installedEntry({ version: '1.0.0' })];
    const diff = diffAgainstOfficial(installed, { plugins: { [HTTP_PLUGIN]: { version: '1.2.0' } } });
    expect(diff.outdated).toEqual([
      { package: HTTP_PLUGIN, installedVersion: '1.0.0', officialVersion: '1.2.0' },
    ]);
    expect(diff.missing).toEqual([]);
  });

  it('reports a package up to date when versions match exactly', () => {
    const installed = [installedEntry({ version: '1.0.0' })];
    const diff = diffAgainstOfficial(installed, { plugins: { [HTTP_PLUGIN]: { version: '1.0.0' } } });
    expect(diff.upToDate).toEqual([HTTP_PLUGIN]);
    expect(diff.missing).toEqual([]);
    expect(diff.outdated).toEqual([]);
  });

  it('treats an installed version newer than official as up to date, not outdated', () => {
    const installed = [installedEntry({ version: '2.0.0' })];
    const diff = diffAgainstOfficial(installed, { plugins: { [HTTP_PLUGIN]: { version: '1.0.0' } } });
    expect(diff.upToDate).toEqual([HTTP_PLUGIN]);
    expect(diff.outdated).toEqual([]);
  });

  it('reports a priority mismatch when versions match but priority differs', () => {
    const installed = [installedEntry({ version: '1.0.0', priority: 0 })];
    const diff = diffAgainstOfficial(installed, {
      plugins: { [HTTP_PLUGIN]: { version: '1.0.0', priority: 5 } },
    });
    expect(diff.priorityMismatch).toEqual([
      { package: HTTP_PLUGIN, installedPriority: 0, officialPriority: 5 },
    ]);
    expect(diff.upToDate).toEqual([]);
  });

  it('does not check priority when the official manifest omits it', () => {
    const installed = [installedEntry({ version: '1.0.0', priority: 3 })];
    const diff = diffAgainstOfficial(installed, { plugins: { [HTTP_PLUGIN]: { version: '1.0.0' } } });
    expect(diff.priorityMismatch).toEqual([]);
    expect(diff.upToDate).toEqual([HTTP_PLUGIN]);
  });

  it('reports a version bump as outdated rather than a priority mismatch, even if priority also differs', () => {
    const installed = [installedEntry({ version: '1.0.0', priority: 0 })];
    const diff = diffAgainstOfficial(installed, {
      plugins: { [HTTP_PLUGIN]: { version: '1.2.0', priority: 5 } },
    });
    expect(diff.outdated).toEqual([
      { package: HTTP_PLUGIN, installedVersion: '1.0.0', officialVersion: '1.2.0' },
    ]);
    expect(diff.priorityMismatch).toEqual([]);
  });

  it('lists an installed package not on the official list as unlisted, not a problem', () => {
    const installed = [installedEntry({ package: '@roster-lock/some-local-test-plugin' })];
    const diff = diffAgainstOfficial(installed, { plugins: {} });
    expect(diff.unlisted).toEqual(['@roster-lock/some-local-test-plugin']);
    expect(diff.missing).toEqual([]);
    expect(diff.outdated).toEqual([]);
  });
});

describe('fetchOfficialManifest', () => {
  const cleanups: Array<() => Promise<void> | void> = [];
  afterEach(async () => {
    while (cleanups.length) await cleanups.pop()!();
  });

  async function startServer(status: number, body: unknown): Promise<{ url: string, server: Server }> {
    const server = createServer((_req, res) => {
      res.writeHead(status, { 'content-type': 'application/json' });
      res.end(JSON.stringify(body));
    });
    server.listen(0, 'localhost');
    await new Promise((resolve) => server.on('listening', resolve));
    const { port } = server.address() as AddressInfo;
    return { url: `http://localhost:${port}`, server };
  }

  it('parses a valid manifest response', async () => {
    const { url, server } = await startServer(200, { plugins: { [HTTP_PLUGIN]: { version: '1.0.0' } } });
    cleanups.push(() => new Promise((resolve) => server.close(() => resolve(undefined))));

    const manifest = await fetchOfficialManifest(url);
    expect(manifest).toEqual({ plugins: { [HTTP_PLUGIN]: { version: '1.0.0' } } });
  });

  it('rejects with a clear error on a non-2xx response', async () => {
    const { url, server } = await startServer(404, { error: 'not found' });
    cleanups.push(() => new Promise((resolve) => server.close(() => resolve(undefined))));

    await expect(fetchOfficialManifest(url)).rejects.toThrow(/404/);
  });

  it('rejects with a clear error when the response body is the wrong shape', async () => {
    const { url, server } = await startServer(200, { notAManifest: true });
    cleanups.push(() => new Promise((resolve) => server.close(() => resolve(undefined))));

    await expect(fetchOfficialManifest(url)).rejects.toThrow(/expected shape/);
  });
});
