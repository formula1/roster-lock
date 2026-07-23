import { Parser } from 'tar';
import type { ArchiveHandler, ArchiveFile } from '@roster-lock/types';

const tar: ArchiveHandler = {
  name: "tar",
  extensions: ['.tar'],
  extractFiles(input: AsyncIterable<Uint8Array>): AsyncIterable<ArchiveFile> {
    return (async function* () {
      // tar@7's Parser is a plain EventEmitter (not a real Writable stream —
      // it has no `.destroy()`), so it must be driven via write()/end() directly
      // rather than through Readable.pipe(), which assumes stream semantics.
      const parser = new Parser();
      (async () => {
        try {
          for await (const chunk of input) {
            // tar's Parser silently drops writes that aren't real Buffer
            // instances (a plain Uint8Array — e.g. from webtorrent's piece
            // stream — writes without error but never emits 'entry').
            parser.write(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk.buffer, chunk.byteOffset, chunk.byteLength));
          }
          parser.end();
        } catch (err) {
          parser.emit('error', err);
        }
      })();

      const pending: ArchiveFile[] = [];
      let done = false;
      let error: Error | null = null;
      let notify: (() => void) | null = null;

      function signal() { notify?.(); notify = null; }

      parser.on('entry', (entry: any) => {
        if (entry.type !== 'File') { entry.resume(); return; }
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
