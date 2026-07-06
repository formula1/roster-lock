
export type Decompressor = {
  name: string;
  extensions: Array<string>,
  decompress: (input: AsyncIterable<Uint8Array>) => AsyncIterable<Uint8Array>;
};
