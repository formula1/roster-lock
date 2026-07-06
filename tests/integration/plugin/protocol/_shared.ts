import { readdir, readFile } from 'node:fs/promises';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Processors } from '@roster-lock/types';
import tar from '@roster-lock/dl-archive-tar';
import gzip from '@roster-lock/dl-compression-gzip';

export { FIXTURE_FILES } from './constants';

export function getProcessors(pathname: string): Processors {
  const decompressors = [];
  let remaining = pathname;

  if (remaining.endsWith('.gz')) {
    decompressors.push(gzip);
    remaining = remaining.slice(0, -3);
  }

  if (!remaining.endsWith('.tar')) {
    throw new Error(`No archive handler for ${pathname}`);
  }

  return { decompressors, archiveHandler: tar };
}

export function makeProcessHandlers(overrides: Partial<{ onProgress: (n: number, t?: number) => void }> = {}) {
  return {
    abortSignal: new AbortController().signal,
    getProcessors,
    ...overrides,
  };
}

export async function makeTmpDir(): Promise<string> {
  return mkdtemp(path.join(tmpdir(), 'rl-integration-'));
}

export async function removeTmpDir(dir: string): Promise<void> {
  await rm(dir, { recursive: true, force: true });
}

export async function collectFiles(dir: string): Promise<Record<string, string>> {
  const result: Record<string, string> = {};

  async function walk(current: string, rel: string) {
    const entries = await readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      const relPath = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        await walk(fullPath, relPath);
      } else {
        result[relPath] = await readFile(fullPath, 'utf8');
      }
    }
  }

  await walk(dir, '');
  return result;
}
