import { describe, it, expect, vi, beforeEach } from 'vitest';
import FTP_Handler from '../src/index';
import { Client as FTPClient } from 'basic-ftp';
import { saveStreamToFilesystem, storeFile } from '@roster-lock/dl-shared';

vi.mock('@roster-lock/dl-shared', () => ({
  saveStreamToFilesystem: vi.fn().mockResolvedValue(undefined),
  storeFile: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('basic-ftp', () => ({
  Client: vi.fn(),
}));

function makeMockClient(listResponses: any[][]) {
  let listCallIndex = 0;
  return {
    access: vi.fn().mockResolvedValue(undefined),
    list: vi.fn().mockImplementation(() => {
      const response = listResponses[listCallIndex++];
      return Promise.resolve(response ?? []);
    }),
    size: vi.fn().mockResolvedValue(2048),
    downloadTo: vi.fn().mockResolvedValue(undefined),
    close: vi.fn(),
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

beforeEach(() => {
  vi.clearAllMocks();
  saveStreamToFilesystem.mockResolvedValue(undefined);
  storeFile.mockResolvedValue(undefined);
});

describe('validateURL', () => {
  it('accepts ftps URLs with a path', () => {
    expect(FTP_Handler.validateURL('ftps://ftp.example.com/archive.tar.gz')).toBe(true);
  });

  it('accepts ftp://localhost URLs', () => {
    expect(FTP_Handler.validateURL('ftp://localhost/archive.tar.gz')).toBe(true);
  });

  it('rejects ftp (non-secure) on non-localhost', () => {
    expect(() => FTP_Handler.validateURL('ftp://ftp.example.com/archive.tar.gz')).toThrow('Protocol must be ftps:');
  });

  it('rejects ftps URL with no path', () => {
    expect(() => FTP_Handler.validateURL('ftps://ftp.example.com')).toThrow('FTPS URL must include a file path');
  });

  it('rejects ftps URL with only root path', () => {
    expect(() => FTP_Handler.validateURL('ftps://ftp.example.com/')).toThrow('FTPS URL must include a file path');
  });
});

describe('download', () => {
  it('routes to single-file handler when path is a file', async () => {
    const client = makeMockClient([]);
    client.list.mockRejectedValueOnce(new Error('Not a directory'));
    FTPClient.mockImplementation(() => client);

    const result = await FTP_Handler.download(
      'ftps://ftp.example.com/archive.tar.gz', '/dest', makeProcessHandlers() as any
    );
    await result.finishPromise;

    expect(saveStreamToFilesystem).toHaveBeenCalledWith(
      expect.any(Object), expect.any(Object), '/dest', expect.any(Object)
    );
    expect(result.metaData).toMatchObject({ url: expect.stringContaining('archive.tar.gz') });
  });

  it('routes to directory handler when path is a directory', async () => {
    const client = makeMockClient([
      [],
      [{ name: 'readme.txt', isFile: true, isDirectory: false, size: 512 }],
    ]);
    FTPClient.mockImplementation(() => client);

    const result = await FTP_Handler.download(
      'ftps://ftp.example.com/files/', '/dest', makeProcessHandlers() as any
    );
    await result.finishPromise;

    expect(result.metaData).toMatchObject({ type: 'directory' });
    expect(storeFile).toHaveBeenCalledWith('/dest', 'readme.txt', expect.any(Object), expect.any(Object));
  });

  it('closes the client after download completes', async () => {
    const client = makeMockClient([]);
    client.list.mockRejectedValueOnce(new Error('Not a directory'));
    FTPClient.mockImplementation(() => client);

    const result = await FTP_Handler.download(
      'ftps://ftp.example.com/file.tar.gz', '/dest', makeProcessHandlers() as any
    );
    await result.finishPromise;

    expect(client.close).toHaveBeenCalled();
  });

  it('rejects immediately when already aborted', async () => {
    FTPClient.mockImplementation(() => makeMockClient([]));
    const ac = new AbortController();
    ac.abort();

    await expect(
      FTP_Handler.download('ftps://ftp.example.com/file.tar.gz', '/dest', {
        abortSignal: ac.signal, getProcessors: vi.fn(),
      } as any)
    ).rejects.toThrow();
  });
});
