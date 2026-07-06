import { Torrent, TorrentFile } from 'webtorrent';
import { saveStreamToFilesystem } from "@roster-lock/dl-shared";
import { ProcessHandlers } from "./types";


export function handleSingleFileTorrent(
  magnetUri: string,
  torrent: Torrent,
  file: TorrentFile,
  folderDestination: string,
  processHandlers: ProcessHandlers
){
  const { onProgress, abortSignal } = processHandlers;
  try {
    const processors = processHandlers.getProcessors!(file.name);
    const totalSize = file.length;

    return {
      finishPromise: saveStreamToFilesystem(
        file.createReadStream() as any,
        processors,
        folderDestination,
        {
          abortSignal,
          onProgress: onProgress
            ? (bytes) => onProgress(bytes, totalSize)
            : undefined,
        }
      ),
      metaData: {
        size: totalSize,
        magnetUri,
        torrentName: torrent.name,
        files: [{ name: file.name, size: file.length }],
      }
    };
  }catch(e){
    return null
  }
}