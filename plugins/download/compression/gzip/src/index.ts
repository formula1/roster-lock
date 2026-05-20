import { createGunzip } from 'node:zlib';
import { Readable } from 'node:stream';
import type { Decompressor } from '@roster-lock/types';

const gzip: Decompressor = {
  name: "gzip",
  extensions: ['.gz'],
  async *decompress(input: AsyncIterable<Uint8Array>): AsyncIterable<Uint8Array> {
    const gunzip = createGunzip();
    Readable.from(input).pipe(gunzip);
    for await (const chunk of gunzip) {
      yield chunk as Uint8Array;
    }
  }
};

export default gzip;
