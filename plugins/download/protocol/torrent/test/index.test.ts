import { describe, it, expect, vi, beforeEach } from 'vitest';
import Tor_Handler from '../src/index';
import WebTorrent from 'webtorrent';
import { saveStreamToFilesystem, storeFile } from '@roster-lock/dl-shared';

vi.mock('@roster-lock/dl-shared', () => ({
  saveStreamToFilesystem: vi.fn().mockResolvedValue(undefined),
  storeFile: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('webtorrent', () => ({ default: vi.fn() }));

const VALID_HEX_MAGNET  = 'magnet:?xt=urn:btih:' + 'a1b2c3d4e5'.repeat(4);
const VALID_B32_MAGNET  = 'magnet:?xt=urn:btih:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA2';
const VALID_BTMH_MAGNET = 'magnet:?xt=urn:btmh:1220' + 'f'.repeat(64);

function makeTorrentFile(name: string, size = 1024) {
  return {
    name,
    path: name,
    length: size,
    createReadStream: vi.fn().mockReturnValue({ pipe: vi.fn(), on: vi.fn() }),
  };
}

function makeProcessHandlers(extra: Record<string, unknown> = {}) {
  return {
    abortSignal: new AbortController().signal,
    getProcessors: vi.fn().mockReturnValue({
      decompressors: [],
      archiveHandler: { name: 'tar', extensions: ['.tar'], extractFiles: vi.fn() },
    }),
    ...extra,
  };
}

function makeWebTorrentClient(files: ReturnType<typeof makeTorrentFile>[], torrentName = 'test') {
  const torrent = { files, name: torrentName, on: vi.fn() };
  return {
    add: vi.fn().mockImplementation((_uri: string, _opts: any, cb: (t: any) => void) => cb(torrent)),
    destroy: vi.fn(),
    on: vi.fn(),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  saveStreamToFilesystem.mockResolvedValue(undefined);
  storeFile.mockResolvedValue(undefined);
});

describe('validateURL', () => {
  it('accepts magnet with 40-char hex btih hash', () => {
    expect(Tor_Handler.validateURL(VALID_HEX_MAGNET)).toBe(true);
  });

  it('accepts magnet with 32-char base32 btih hash', () => {
    expect(Tor_Handler.validateURL(VALID_B32_MAGNET)).toBe(true);
  });

  it('accepts magnet with btmh hash (1220 prefix + 64 hex)', () => {
    expect(Tor_Handler.validateURL(VALID_BTMH_MAGNET)).toBe(true);
  });

  it('rejects non-magnet protocols', () => {
    expect(() => Tor_Handler.validateURL('https://example.com/file.torrent')).toThrow('Protocol must be magnet:');
  });

  it('rejects magnet without xt parameter', () => {
    expect(() => Tor_Handler.validateURL('magnet:?dn=somename')).toThrow('must include xt');
  });

  it('rejects btih hash with wrong length', () => {
    expect(() => Tor_Handler.validateURL('magnet:?xt=urn:btih:abc123')).toThrow('Invalid BitTorrent urn:btih hash format');
  });

  it('rejects btmh hash without 1220 prefix', () => {
    expect(() => Tor_Handler.validateURL('magnet:?xt=urn:btmh:' + 'a'.repeat(68))).toThrow('Invalid BitTorrent urn:btmh hash format');
  });

  it('rejects unknown xt namespace', () => {
    expect(() => Tor_Handler.validateURL('magnet:?xt=urn:unknown:abc')).toThrow('xt parameter must be in format');
  });
});

describe('download', () => {
  it('handles a single-file torrent', async () => {
    const file = makeTorrentFile('archive.tar.gz', 4096);
    WebTorrent.mockImplementation(function () { return makeWebTorrentClient([file]); });

    const result = await Tor_Handler.download(VALID_HEX_MAGNET, '/dest', makeProcessHandlers() as any);
    await result.finishPromise;

    expect(saveStreamToFilesystem).toHaveBeenCalledWith(
      expect.any(Object), expect.any(Object), '/dest', expect.any(Object)
    );
    expect(result.metaData).toMatchObject({ magnetUri: VALID_HEX_MAGNET });
  });

  it('handles a multi-file torrent by saving each file individually', async () => {
    const files = [makeTorrentFile('track1.mp3', 5_000_000), makeTorrentFile('track2.mp3', 6_000_000)];
    const handlers = makeProcessHandlers({
      getProcessors: vi.fn().mockImplementation(() => { throw new Error('Not an archive'); }),
    });
    WebTorrent.mockImplementation(function () { return makeWebTorrentClient(files); });

    const result = await Tor_Handler.download(VALID_HEX_MAGNET, '/dest', handlers as any);
    await result.finishPromise;

    expect(storeFile).toHaveBeenCalledTimes(2);
    expect(result.metaData).toMatchObject({ torrentName: 'test' });
  });

  it('falls back to multi-file handler when single-file getProcessors throws', async () => {
    const file = makeTorrentFile('video.mkv', 1_000_000_000);
    const handlers = makeProcessHandlers({
      getProcessors: vi.fn().mockImplementation(() => { throw new Error('No handler for .mkv'); }),
    });
    WebTorrent.mockImplementation(function () { return makeWebTorrentClient([file]); });

    const result = await Tor_Handler.download(VALID_HEX_MAGNET, '/dest', handlers as any);
    await result.finishPromise;

    expect(storeFile).toHaveBeenCalledWith('/dest', 'video.mkv', expect.any(Object), expect.any(Object));
  });

  it('rejects when torrent has no files', async () => {
    WebTorrent.mockImplementation(function () { return makeWebTorrentClient([]); });

    await expect(
      Tor_Handler.download(VALID_HEX_MAGNET, '/dest', makeProcessHandlers() as any)
    ).rejects.toThrow('No files in torrent');
  });

  it('rejects immediately when already aborted', async () => {
    const ac = new AbortController();
    ac.abort();
    WebTorrent.mockImplementation(function () { return makeWebTorrentClient([]); });

    await expect(
      Tor_Handler.download(VALID_HEX_MAGNET, '/dest', {
        abortSignal: ac.signal, getProcessors: vi.fn(),
      } as any)
    ).rejects.toThrow('Download aborted');
  });
});
