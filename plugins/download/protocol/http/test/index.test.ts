import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'events';
import HTTP_Handler from '../src/index';
import { saveStreamToFilesystem } from '@roster-lock/dl-shared';
import { request as httpsRequest } from 'node:https';

vi.mock('@roster-lock/dl-shared', () => ({
  saveStreamToFilesystem: vi.fn(),
}));
vi.mock('node:https', () => ({ request: vi.fn() }));
vi.mock('node:http', () => ({
  request: vi.fn(),
  IncomingMessage: class {},
  ClientRequest: class {},
}));

function makeReq() {
  return Object.assign(new EventEmitter(), { end: vi.fn(), path: '/', method: 'GET' });
}

function makeRes(statusCode = 200, headers: Record<string, string> = {}) {
  return Object.assign(new EventEmitter(), { statusCode, headers });
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
});

describe('validateURL', () => {
  it('accepts https URLs', () => {
    expect(HTTP_Handler.validateURL('https://example.com/file.tar.gz')).toBe(true);
  });

  it('accepts http://localhost', () => {
    expect(HTTP_Handler.validateURL('http://localhost/file.tar.gz')).toBe(true);
  });

  it('rejects http on non-localhost', () => {
    expect(() => HTTP_Handler.validateURL('http://example.com/file.tar.gz')).toThrow();
  });

  it('rejects non-http protocols', () => {
    expect(() => HTTP_Handler.validateURL('ftp://example.com/file.tar.gz')).toThrow();
  });

  it('rejects invalid URL', () => {
    expect(() => HTTP_Handler.validateURL('not-a-url')).toThrow();
  });
});

describe('download', () => {
  it('resolves with metaData and calls saveStreamToFilesystem', async () => {
    const req = makeReq();
    const res = makeRes(200, { 'content-length': '500' });
    httpsRequest.mockReturnValue(req);

    const downloadPromise = HTTP_Handler.download(
      'https://example.com/file.tar.gz', '/dest', makeProcessHandlers() as any
    );
    setImmediate(() => req.emit('response', res));

    const result = await downloadPromise;
    expect(result.metaData).toMatchObject({ url: 'https://example.com/file.tar.gz' });
    expect(saveStreamToFilesystem).toHaveBeenCalledWith(res, expect.any(Object), '/dest', expect.any(Object));
  });

  it('follows a redirect', async () => {
    const req1 = makeReq();
    const res1 = makeRes(301, { location: 'https://cdn.example.com/file.tar.gz' });
    const req2 = makeReq();
    const res2 = makeRes(200, {});
    httpsRequest.mockReturnValueOnce(req1).mockReturnValueOnce(req2);

    const downloadPromise = HTTP_Handler.download(
      'https://example.com/file.tar.gz', '/dest', makeProcessHandlers() as any
    );
    setImmediate(() => { req1.emit('response', res1); setImmediate(() => req2.emit('response', res2)); });

    await downloadPromise;
    expect(httpsRequest).toHaveBeenCalledTimes(2);
  });

  it('throws after too many redirects', async () => {
    const reqs = Array.from({ length: 12 }, makeReq);
    let i = 0;
    httpsRequest.mockImplementation(() => reqs[i++]);

    const downloadPromise = HTTP_Handler.download(
      'https://example.com/file.tar.gz', '/dest', makeProcessHandlers() as any
    );
    const emitNext = () => {
      if (i > 0 && i <= reqs.length) {
        setImmediate(() => {
          reqs[i - 1].emit('response', makeRes(301, { location: 'https://example.com/file.tar.gz' }));
          emitNext();
        });
      }
    };
    emitNext();

    await expect(downloadPromise).rejects.toThrow('Too Many Redirects');
  });

  it('throws on non-200 status code', async () => {
    const req = makeReq();
    httpsRequest.mockReturnValue(req);

    const downloadPromise = HTTP_Handler.download(
      'https://example.com/file.tar.gz', '/dest', makeProcessHandlers() as any
    );
    setImmediate(() => req.emit('response', makeRes(404)));

    await expect(downloadPromise).rejects.toThrow();
  });

  it('rejects immediately when aborted', async () => {
    const ac = new AbortController();
    ac.abort();
    await expect(
      HTTP_Handler.download('https://example.com/file.tar.gz', '/dest', {
        abortSignal: ac.signal, getProcessors: vi.fn(),
      } as any)
    ).rejects.toThrow('Download Aborted');
  });

  it('passes progress with content-length to saveStreamToFilesystem', async () => {
    const req = makeReq();
    const res = makeRes(200, { 'content-length': '1000' });
    httpsRequest.mockReturnValue(req);

    const onProgress = vi.fn();
    const downloadPromise = HTTP_Handler.download(
      'https://example.com/file.tar.gz', '/dest', makeProcessHandlers({ onProgress }) as any
    );
    setImmediate(() => req.emit('response', res));
    await downloadPromise;

    const opts = saveStreamToFilesystem.mock.calls[0][3];
    expect(opts?.onProgress).toBeDefined();
    opts.onProgress(400);
    expect(onProgress).toHaveBeenCalledWith(400, 1000);
  });
});
