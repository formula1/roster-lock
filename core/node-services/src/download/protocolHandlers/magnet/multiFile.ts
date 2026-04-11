import { storeFile } from "../../utils";
import { Torrent } from 'webtorrent';
import { PassThrough } from 'node:stream';
import { ProcessHandlers } from "../../types";


export function handleMultipleFileTorrent(
  magnetUri: string,
  torrent: Torrent,
  destinationFolder: string,
  { onProgress, abortSignal }: ProcessHandlers
){

  let totalSize = 0;
  for(const file of torrent.files) totalSize += file.length;
  
  let downloaded = 0;
  const promises: Array<Promise<any>> = [];
  for(const file of torrent.files){
    const progressWatcher = new PassThrough();
    progressWatcher.on('data', (chunk: Buffer) => {
      downloaded += chunk.length;
      onProgress?.(downloaded, totalSize);
    });
    const filePromise = storeFile(
      destinationFolder,
      file.name,
      file.createReadStream() as any,
      { abortSignal, progressWatcher }
    )
    promises.push(filePromise);
  }

  const pipelinePromise = Promise.all(promises);

  return {
    finishPromise: pipelinePromise,
    metaData: {
      size: totalSize,
      magnetUri,
      torrentName: torrent.name,
      files: torrent.files.map(file => ({ name: file.name, size: file.length })),
    }
  };
}
