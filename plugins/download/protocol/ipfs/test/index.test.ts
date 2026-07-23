import { describe, it, expect, vi, beforeEach } from 'vitest';
import IPFS_Handler from '../src/index';
import { createIpfsClient } from '../src/download/client';
import { saveStreamToFilesystem, storeFile } from '@roster-lock/dl-shared';

vi.mock('cids', () => ({
  isCID: vi.fn().mockImplementation((cid: string) =>
    /^(Qm[1-9A-HJ-NP-Za-km-z]{44}|bafy[a-z2-7]+)$/.test(cid)
  ),
}));

vi.mock('@roster-lock/dl-shared', () => ({
  saveStreamToFilesystem: vi.fn().mockResolvedValue(undefined),
  storeFile: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../src/download/client', () => ({
  createIpfsClient: vi.fn(),
}));

const VALID_CID = 'QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG';

async function* singleChunkStream(): AsyncIterable<Uint8Array> {
  yield new Uint8Array([1, 2, 3]);
}

function makeIpfsClient(statType: 'file' | 'directory' = 'file') {
  return {
    id: vi.fn().mockResolvedValue({ id: 'local-node' }),
    files: {
      stat: vi.fn().mockResolvedValue({ type: statType, size: 1024, hash: VALID_CID }),
    },
    cat: vi.fn().mockReturnValue(singleChunkStream()),
    ls: vi.fn().mockReturnValue((async function* () {
      yield { type: 'file', name: 'readme.txt', path: 'readme.txt', size: 100, cid: 'QmA' };
    })()),
  };
}

function makeProcessHandlers(extra: Record<string, unknown> = {}) {
  return {
    abortSignal: new AbortController().signal,
    ...extra,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  saveStreamToFilesystem.mockResolvedValue(undefined);
  storeFile.mockResolvedValue(undefined);
});

describe('validateURL', () => {
  it('accepts ipfs:// URLs with a valid CIDv0', () => {
    expect(IPFS_Handler.validateURL(`ipfs://${VALID_CID}`)).toBe(true);
  });

  it('rejects non-ipfs protocols', () => {
    expect(() => IPFS_Handler.validateURL(`https://${VALID_CID}`)).toThrow('Protocol must be ipfs:');
  });

  it('rejects ipfs:// URL with no CID', () => {
    expect(() => IPFS_Handler.validateURL('ipfs://')).toThrow('IPFS URL must include a CID');
  });

  it('rejects ipfs:// URL with invalid CID', () => {
    expect(() => IPFS_Handler.validateURL('ipfs://not-a-valid-cid')).toThrow('Invalid IPFS CID');
  });
});

describe('download', () => {
  it('downloads a single file (raw fallback when no getProcessors)', async () => {
    const client = makeIpfsClient('file');
    createIpfsClient.mockReturnValue(client);

    const result = await IPFS_Handler.download(`ipfs://${VALID_CID}/archive.zip`, '/dest', makeProcessHandlers() as any);
    await result.finishPromise;

    expect(result.metaData).toMatchObject({ cid: VALID_CID, type: 'file' });
    expect(storeFile).toHaveBeenCalledWith('/dest', 'archive.zip', expect.any(Object), expect.any(Object));
  });

  it('throws when a file CID has no filename path segment', async () => {
    const client = makeIpfsClient('file');
    createIpfsClient.mockReturnValue(client);

    await expect(
      IPFS_Handler.download(`ipfs://${VALID_CID}`, '/dest', makeProcessHandlers() as any)
    ).rejects.toThrow('must include a filename');
  });

  it('downloads a directory and saves each file', async () => {
    const client = makeIpfsClient('directory');
    createIpfsClient.mockReturnValue(client);

    const result = await IPFS_Handler.download(`ipfs://${VALID_CID}`, '/dest', makeProcessHandlers() as any);
    await result.finishPromise;

    expect(result.metaData).toMatchObject({ cid: VALID_CID, type: 'directory' });
    expect(storeFile).toHaveBeenCalledWith('/dest', 'readme.txt', expect.any(Object), expect.any(Object));
  });

  it('throws when IPFS daemon is not running', async () => {
    const client = makeIpfsClient('file');
    client.id.mockRejectedValue(new Error('Connection refused'));
    createIpfsClient.mockReturnValue(client);

    await expect(
      IPFS_Handler.download(`ipfs://${VALID_CID}`, '/dest', makeProcessHandlers() as any)
    ).rejects.toThrow('IPFS daemon not running');
  });

  it('rejects immediately when already aborted', async () => {
    createIpfsClient.mockReturnValue(makeIpfsClient('file'));
    const ac = new AbortController();
    ac.abort();

    await expect(
      IPFS_Handler.download(`ipfs://${VALID_CID}`, '/dest', { abortSignal: ac.signal } as any)
    ).rejects.toThrow();
  });
});
