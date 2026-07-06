import { Processors } from '@roster-lock/types';
import { mkdir } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { join, dirname } from 'node:path';

export type SaveOptions = {
  abortSignal?: AbortSignal;
  onProgress?: (bytes: number, total?: number) => void;
};

export async function saveStreamToFilesystem(
  src: Readable | AsyncIterable<Uint8Array>,
  processors: Processors,
  destinationFolder: string,
  { abortSignal, onProgress }: SaveOptions = {}
): Promise<void> {
  let stream: AsyncIterable<Uint8Array> = src as AsyncIterable<Uint8Array>;

  if (onProgress) {
    let total = 0;
    stream = (async function* () {
      for await (const chunk of src as AsyncIterable<Uint8Array>) {
        total += chunk.length;
        onProgress(total);
        yield chunk;
      }
    })();
  }

  for (const decompressor of processors.decompressors) {
    stream = decompressor.decompress(stream);
  }

  const filePromises: Promise<void>[] = [];
  for await (const file of processors.archiveHandler.extractFiles(stream)) {
    filePromises.push(storeFile(destinationFolder, file.path, file.contents, { abortSignal }));
  }
  await Promise.all(filePromises);
}

export async function storeFile(
  destinationFolder: string,
  filePath: string,
  contents: Readable | AsyncIterable<Uint8Array>,
  { abortSignal }: Pick<SaveOptions, 'abortSignal'> = {}
): Promise<void> {
  const fullPath = join(destinationFolder, filePath);
  await mkdir(dirname(fullPath), { recursive: true });
  await pipeline(
    Readable.from(contents as AsyncIterable<Uint8Array>),
    createWriteStream(fullPath),
    { signal: abortSignal }
  );
}
