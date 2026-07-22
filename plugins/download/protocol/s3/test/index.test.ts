import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Readable } from 'node:stream';
import { saveStreamToFilesystem } from '@roster-lock/dl-shared';

const sendMock = vi.fn();
const s3ClientMock = vi.fn();

vi.mock('@roster-lock/dl-shared', () => ({
  saveStreamToFilesystem: vi.fn(),
}));
vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: vi.fn().mockImplementation(function (config) {
    s3ClientMock(config);
    return { send: sendMock };
  }),
  GetObjectCommand: vi.fn().mockImplementation(function (input) { return { input }; }),
}));

import S3_Handler from '../src/index';

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
});

describe('validateURL', () => {
  it('accepts s3:// URLs with an endpoint host, bucket, and key', () => {
    expect(S3_Handler.validateURL('s3://s3.amazonaws.com/my-bucket/path/to/object.tar.gz')).toBe(true);
  });

  it('accepts s3+http:// for localhost endpoints', () => {
    expect(S3_Handler.validateURL('s3+http://localhost:9000/my-bucket/object.tar.gz')).toBe(true);
  });

  it('rejects s3+http:// for non-localhost endpoints', () => {
    expect(() => S3_Handler.validateURL('s3+http://example.com/my-bucket/object.tar.gz'))
      .toThrow('s3+http: is only allowed for localhost/127.0.0.1 endpoints');
  });

  it('rejects other protocols', () => {
    expect(() => S3_Handler.validateURL('https://example.com/file.tar.gz')).toThrow('Protocol must be s3:');
  });

  it('rejects a missing bucket', () => {
    expect(() => S3_Handler.validateURL('s3://s3.amazonaws.com/')).toThrow('Missing bucket name');
  });

  it('rejects a missing key', () => {
    expect(() => S3_Handler.validateURL('s3://s3.amazonaws.com/my-bucket')).toThrow('Missing object key');
  });

  it('rejects an invalid URL', () => {
    expect(() => S3_Handler.validateURL('not-a-url')).toThrow();
  });
});

describe('download', () => {
  it('resolves with metaData and calls saveStreamToFilesystem', async () => {
    const body = Readable.from([Buffer.from('hello')]);
    sendMock.mockResolvedValue({ Body: body, ContentLength: 500, ETag: '"abc"' });

    const result = await S3_Handler.download(
      's3://s3.amazonaws.com/my-bucket/path/object.tar.gz', '/dest', makeProcessHandlers() as any
    );

    expect(result.metaData).toMatchObject({
      bucket: 'my-bucket', key: 'path/object.tar.gz', endpoint: 'https://s3.amazonaws.com', etag: '"abc"',
    });
    expect(saveStreamToFilesystem).toHaveBeenCalledWith(body, expect.any(Object), '/dest', expect.any(Object));
  });

  it('derives the client endpoint from the URL, using path-style addressing', async () => {
    const body = Readable.from([Buffer.from('hello')]);
    sendMock.mockResolvedValue({ Body: body, ContentLength: 5 });

    await S3_Handler.download('s3+http://localhost:9000/my-bucket/object.tar.gz', '/dest', makeProcessHandlers() as any);

    expect(s3ClientMock).toHaveBeenCalledWith(
      expect.objectContaining({ endpoint: 'http://localhost:9000', forcePathStyle: true })
    );
  });

  it('throws on an empty response body', async () => {
    sendMock.mockResolvedValue({ Body: undefined });

    await expect(
      S3_Handler.download('s3://s3.amazonaws.com/my-bucket/object.tar.gz', '/dest', makeProcessHandlers() as any)
    ).rejects.toThrow('Empty response body');
  });

  it('rejects immediately when aborted', async () => {
    const ac = new AbortController();
    ac.abort();
    await expect(
      S3_Handler.download('s3://s3.amazonaws.com/my-bucket/object.tar.gz', '/dest', {
        abortSignal: ac.signal, getProcessors: vi.fn(),
      } as any)
    ).rejects.toThrow('Download Aborted');
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('passes progress with content-length to saveStreamToFilesystem', async () => {
    const body = Readable.from([Buffer.from('hello')]);
    sendMock.mockResolvedValue({ Body: body, ContentLength: 1000 });

    const onProgress = vi.fn();
    await S3_Handler.download(
      's3://s3.amazonaws.com/my-bucket/object.tar.gz', '/dest', makeProcessHandlers({ onProgress }) as any
    );

    const opts = (saveStreamToFilesystem as any).mock.calls[0][3];
    expect(opts?.onProgress).toBeDefined();
    opts.onProgress(400);
    expect(onProgress).toHaveBeenCalledWith(400, 1000);
  });
});
