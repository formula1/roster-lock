


import { ArchiveHandler, ArchiveWritable } from "./types";
export const zip: ArchiveHandler = {
  name: "zip",
  mimeType: ['application/zip', 'application/x-zip-compressed'],
  signature: [
    { offset: 0, bytes: [0x50, 0x4b, 0x03, 0x04] },
    { offset: 0, bytes: [0x50, 0x4b, 0x05, 0x06] }, // empty zip
    { offset: 0, bytes: [0x50, 0x4b, 0x07, 0x08] }, // spanned zip
  ],
  extractFiles: function () {
    return new ZipArchiveWritable();
  }
}

import { Parse, Entry } from "unzipper";
import { PassThrough, Readable, Writable } from 'node:stream';
import { createSimpleEmitter } from '@roster-lock/utils';

class ZipArchiveWritable extends Writable implements ArchiveWritable {
  public onFile = createSimpleEmitter<[path: string, contents: Readable]>();
  private parser = Parse();

  constructor() {
    super();
    
    this.parser.on('entry', (entry: Entry) => {
      if (entry.type !== 'File') return entry.autodrain();

      const contentStream = new PassThrough();
      entry.pipe(contentStream);
      this.onFile.emit(entry.path, contentStream);
    });
  }

  _write(chunk: Buffer, encoding: BufferEncoding, callback: (error?: null | Error) => void) {
    this.parser.write(chunk, encoding, callback);
  }

  _final(callback: (error?: Error) => void) {
    this.parser.end(callback);
  }
}
