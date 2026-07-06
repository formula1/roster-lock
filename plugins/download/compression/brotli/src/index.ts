import { createBrotliDecompress } from 'node:zlib';
import { Readable } from 'node:stream';
import type { Decompressor } from '@roster-lock/types';

const brotli: Decompressor = {
  name: "brotli",
  extensions: ['.br'],
  async *decompress(input: AsyncIterable<Uint8Array>): AsyncIterable<Uint8Array> {
    const decompress = createBrotliDecompress();
    Readable.from(input).pipe(decompress);
    for await (const chunk of decompress) {
      yield chunk as Uint8Array;
    }
  }
};

export default brotli;
