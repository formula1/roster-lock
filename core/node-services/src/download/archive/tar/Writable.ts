import { Parser } from 'tar';
import { ArchiveWritable } from "../types";
import { createSimpleEmitter } from '@roster-lock/shared';
import { Writable, PassThrough, Readable } from 'stream';

export class TarArchiveWritable extends Writable implements ArchiveWritable {
  public onFile = createSimpleEmitter<[path: string, contents: Readable]>();
  private parser: Parser;

  constructor() {
    super();

    this.parser = new Parser({
      onentry: (entry) => {
        if (entry.type !== 'File') return;
        // Create a PassThrough so we can capture the stream
        const contentStream = new PassThrough();
        entry.pipe(contentStream);
        
        this.onFile.emit(entry.path, contentStream);
      }
    });
  }

  _write(chunk: string, encoding: BufferEncoding, callback: (error?: null | Error) => void) {
    this.parser.write(chunk, encoding, callback);
  }

  _final(callback: (error?: Error) => void) {
    this.parser.end(callback);
  }
}
