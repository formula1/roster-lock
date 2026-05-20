import { Parser } from 'tar';
import { Readable } from 'node:stream';
import type { ArchiveHandler, ArchiveFile } from '@roster-lock/types';

const tar: ArchiveHandler = {
  name: "tar",
  extensions: ['.tar'],
  extractFiles(input: AsyncIterable<Uint8Array>): AsyncIterable<ArchiveFile> {
    return (async function* () {
      const parser = new Parser();
      Readable.from(input).pipe(parser);

      const pending: ArchiveFile[] = [];
      let done = false;
      let error: Error | null = null;
      let notify: (() => void) | null = null;

      function signal() { notify?.(); notify = null; }

      parser.on('entry', (entry: any) => {
        if (entry.type !== 'File') { entry.autodrain(); return; }
        pending.push({ path: entry.path, contents: entry as AsyncIterable<Uint8Array> });
        signal();
      });
      parser.on('finish', () => { done = true; signal(); });
      parser.on('error', (err: Error) => { error = err; signal(); });

      while (true) {
        if (pending.length > 0) { yield pending.shift()!; continue; }
        if (done || error) break;
        await new Promise<void>(r => {
          if (pending.length > 0 || done || error !== null) r();
          else notify = r;
        });
      }

      if (error) throw error;
    })();
  }
};

export default tar;
