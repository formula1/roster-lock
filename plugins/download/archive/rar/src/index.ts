import { createExtractorFromData } from 'node-unrar-js';
import type { ArchiveHandler, ArchiveFile } from '@roster-lock/types';

const rar: ArchiveHandler = {
  name: "rar",
  extensions: ['.rar'],
  async *extractFiles(input: AsyncIterable<Uint8Array>): AsyncIterable<ArchiveFile> {
    const chunks: Uint8Array[] = [];
    for await (const chunk of input) chunks.push(chunk);

    const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);
    const buffer = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) { buffer.set(chunk, offset); offset += chunk.length; }

    const extractor = await createExtractorFromData({ data: buffer.buffer as ArrayBuffer });
    const extracted = extractor.extract({});

    for (const file of extracted.files) {
      if (file.fileHeader.flags.directory) continue;
      const contents = file.extraction!;
      yield {
        path: file.fileHeader.name,
        contents: (async function* () { yield contents; })()
      };
    }
  }
};

export default rar;
