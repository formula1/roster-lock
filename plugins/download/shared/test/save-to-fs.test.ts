import { describe, expect, it } from 'vitest';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { saveStreamToFilesystem } from '../src/save-to-fs';

describe('saveStreamToFilesystem', () => {
  it('normalizes leading ./ archive paths and ignores root entries', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'rl-save-to-fs-'));
    try {
      await saveStreamToFilesystem(
        Readable.from([Buffer.from('hello')]),
        {
          decompressors: [],
          archiveHandler: {
            name: 'tar',
            extensions: ['.tar'],
            extractFiles: async function* () {
              yield { path: './kfm.def', contents: (async function* () { yield Buffer.from('hello'); })() };
              yield { path: './', contents: (async function* () { yield Buffer.from('ignored'); })() };
            },
          },
        } as any,
        dir,
      );

      await expect(readFile(join(dir, 'kfm.def'), 'utf8')).resolves.toBe('hello');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
