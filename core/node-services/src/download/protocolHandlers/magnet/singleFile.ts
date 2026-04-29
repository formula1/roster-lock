import { getProcessorsFromPathnameMimetypes } from "../../utils";
import { createSimpleEmitter } from "@roster-lock/utils";
import { Torrent, TorrentFile } from 'webtorrent';
import { saveStreamToFilesystem } from "../../utils";
import { PassThrough } from "stream";
import { ProcessHandlers } from "../../types";


export function handleSingleFileTorrent(
  magnetUri: string,
  torrent: Torrent,
  file: TorrentFile,
  folderDestination: string,
  { onProgress, abortSignal }: ProcessHandlers
){
  try {
    const { decompressors, archiveHandler } = getProcessorsFromPathnameMimetypes(file.name);
    const totalSize = file.length;

    const progressWatcher = new PassThrough();
    let downloaded = 0;
    progressWatcher.on('data', (chunk: Buffer) => {
      downloaded += chunk.length;
      onProgress?.(downloaded, totalSize);
    });

    return {
      finishPromise: saveStreamToFilesystem(
        file.createReadStream() as any,
        decompressors,
        archiveHandler,
        folderDestination,
        { abortSignal, progressWatcher }
      ),
      onProgress,
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