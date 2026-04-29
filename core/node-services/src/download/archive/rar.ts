


import { ArchiveHandler, ArchiveWritable } from "./types";
import { createExtractorFromData } from "node-unrar-js";
export const rar: ArchiveHandler = {
  name: "rar",
  mimeType: ["application/vnd.rar", "application/x-rar-compressed"],
  signature: [],
  extractFiles: function () {
    return new RarArchiveWritable();
  }
}

import { PassThrough, Readable, Writable } from 'node:stream';
import { createSimpleEmitter } from '@roster-lock/utils';

class RarArchiveWritable extends Writable implements ArchiveWritable {
  public onFile = createSimpleEmitter<[path: string, contents: Readable]>();
  private chunks: Array<Buffer> = [];

  _write(chunk: Buffer, encoding: BufferEncoding, callback: (error?: null | Error) => void) {
    this.chunks.push(chunk);
    callback();
  }

  async _final(callback: (error?: Error) => void) {
    try {
      const extractor = await createExtractorFromData({
        data: Buffer.concat(this.chunks).buffer
      });
      const extracted = extractor.extract({});
      
      for (const file of extracted.files) {
        if (file.fileHeader.flags.directory) continue;
        const contentStream = new PassThrough();
        contentStream.end(Buffer.from(file.extraction!));
        this.onFile.emit(file.fileHeader.name, contentStream);
      }
      callback();

    }catch(e){
      callback(e as any);
    }
  }
}
