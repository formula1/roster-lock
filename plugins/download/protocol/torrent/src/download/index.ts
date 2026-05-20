import { ProtocolHandler } from "@roster-lock/types";
import WebTorrent from 'webtorrent';

import { handleSingleFileTorrent } from "./singleFile";
import { handleMultipleFileTorrent } from "./multiFile";

type DownloadResult = Awaited<ReturnType<ProtocolHandler["download"]>>;

export const runTorrentDownload: ProtocolHandler["download"] = async function(
  magnetUri, folderDestination, { onProgress, abortSignal }
) {
 if (abortSignal?.aborted) {
    throw new TorrentError(magnetUri, 'Download aborted');
  }

  const client = new WebTorrent();

  const { resolve, reject, promise } = Promise.withResolvers<DownloadResult>();

  // Setup abort handler
  const abortHandler = () => {
    client.destroy();
    reject(new TorrentError(magnetUri, 'Download aborted'));
  };
  
  abortSignal.addEventListener('abort', abortHandler);

  
  client.add(magnetUri, { destroyStoreOnDestroy: true }, (torrent) => {
    // Handle errors
    torrent.on('error', (err) => {
      client.destroy();
      reject(new TorrentError(magnetUri, err));
    });

    if(torrent.files.length === 0){
      client.destroy();
      reject(new TorrentError(magnetUri, 'No files in torrent'));
      return;
    }

    if(torrent.files.length === 1){
      const singleFile = handleSingleFileTorrent(
        magnetUri, torrent,
        torrent.files[0],
        folderDestination,
        { onProgress, abortSignal }
      );
      if(singleFile){
        singleFile.finishPromise.finally(() => {
          client.destroy();
          abortSignal.removeEventListener('abort', abortHandler);
        });
        resolve(singleFile);
        return;
      }
    }


    const multiFile = handleMultipleFileTorrent(
      magnetUri,
      torrent,
      folderDestination,
      { onProgress, abortSignal }
    );
    multiFile.finishPromise.finally(() => {
      client.destroy();
      abortSignal.removeEventListener('abort', abortHandler);
    });
    
    resolve(multiFile);
  });
  
  // Handle client-level errors
  client.on('error', (err) => {
    abortSignal.removeEventListener('abort', abortHandler);
    client.destroy();
    reject(new TorrentError(magnetUri, err));
  });

  return promise;
}


export class TorrentError extends Error {
  constructor(
    public magnetUri: string,
    public originalError: any
  ) {
    super(`Torrent error: ${originalError.message || originalError}`);
    this.name = 'TorrentError';
  }
}
