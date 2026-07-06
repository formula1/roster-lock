import { storeFile } from "@roster-lock/dl-shared";
import { Torrent } from 'webtorrent';
import { ProcessHandlers } from "./types";


export function handleMultipleFileTorrent(
  magnetUri: string,
  torrent: Torrent,
  destinationFolder: string,
  { onProgress, abortSignal }: ProcessHandlers
){

  let totalSize = 0;
  for(const file of torrent.files) totalSize += file.length;

  // file.path includes the torrent name as a leading directory (e.g. "fixtures/sample.txt").
  // Strip it so files land directly in destinationFolder.
  const namePrefix = torrent.name ? `${torrent.name}/` : '';

  let downloaded = 0;
  const promises: Array<Promise<any>> = [];
  for(const file of torrent.files){
    const filePath = namePrefix && file.path.startsWith(namePrefix)
      ? file.path.slice(namePrefix.length)
      : file.path;
    const filePromise = storeFile(
      destinationFolder,
      filePath,
      file.createReadStream() as any,
      { abortSignal }
    );
    if (onProgress) {
      filePromise.then(() => {
        downloaded += file.length;
        onProgress(downloaded, totalSize);
      });
    }
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
