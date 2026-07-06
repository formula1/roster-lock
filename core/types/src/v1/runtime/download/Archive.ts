

export type ArchiveFile = {
  path: string,
  contents: AsyncIterable<Uint8Array>
};

export type ArchiveHandler = {
  name: string;
  extensions: Array<string>,
  extractFiles: (input: AsyncIterable<Uint8Array>)=>AsyncIterable<ArchiveFile>;
};

