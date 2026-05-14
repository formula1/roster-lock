import { Readable } from 'node:stream';

interface StatResult {
  type: 'file' | 'directory';
  size: number;
  hash: string;
}

interface LsEntry {
  type: 'file' | 'dir';
  name: string;
  path: string;
  size: number;
  cid: string;
}

export class IpfsHttpClient {
  private base: string;

  constructor(url: string) {
    this.base = url.replace(/\/$/, '');
  }

  async id(): Promise<{ id: string }> {
    const res = await fetch(`${this.base}/api/v0/id`, { method: 'POST' });
    if (!res.ok) throw new Error(`IPFS id failed: ${res.status}`);
    const data = await res.json() as { ID: string };
    return { id: data.ID };
  }

  files = {
    stat: async (path: string): Promise<StatResult> => {
      const res = await fetch(
        `${this.base}/api/v0/files/stat?arg=${encodeURIComponent(path)}`,
        { method: 'POST' }
      );
      if (!res.ok) throw new Error(`IPFS stat failed: ${res.status}`);
      const data = await res.json() as { Type: string; Size: number; Hash: string };
      return {
        type: data.Type === 'file' ? 'file' : 'directory',
        size: data.Size,
        hash: data.Hash,
      };
    }
  };

  async *cat(cid: string, options?: { signal?: AbortSignal }): AsyncIterable<Uint8Array> {
    const res = await fetch(
      `${this.base}/api/v0/cat?arg=${encodeURIComponent(cid)}`,
      { method: 'POST', signal: options?.signal }
    );
    if (!res.ok) throw new Error(`IPFS cat failed: ${res.status}`);
    if (!res.body) throw new Error('IPFS cat: no response body');

    const reader = res.body.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        yield value;
      }
    } finally {
      reader.releaseLock();
    }
  }

  async *ls(cid: string, options?: { signal?: AbortSignal }): AsyncIterable<LsEntry> {
    const res = await fetch(
      `${this.base}/api/v0/ls?arg=${encodeURIComponent(cid)}`,
      { method: 'POST', signal: options?.signal }
    );
    if (!res.ok) throw new Error(`IPFS ls failed: ${res.status}`);
    const data = await res.json() as {
      Objects: Array<{
        Hash: string;
        Links: Array<{ Hash: string; Name: string; Size: number; Type: number }>;
      }>;
    };

    for (const obj of data.Objects) {
      for (const link of obj.Links) {
        yield {
          type: link.Type === 1 ? 'dir' : 'file',
          name: link.Name,
          path: link.Name,
          size: link.Size,
          cid: link.Hash,
        };
      }
    }
  }
}

export function createIpfsClient(options: { url: string; timeout?: number }): IpfsHttpClient {
  return new IpfsHttpClient(options.url);
}
