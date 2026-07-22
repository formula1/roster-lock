import { ProtocolHandler, ProcessHandlers } from "@roster-lock/types";
import type WebTorrent from 'webtorrent';

import { handleSingleFileTorrent } from "./singleFile";
import { handleMultipleFileTorrent } from "./multiFile";

type DownloadResult = Awaited<ReturnType<ProtocolHandler["download"]>>;

export type TorrentDiscoveryOptions = {
  dht?: boolean;
  tracker?: boolean;
  lsd?: boolean;
};

export async function runTorrentDownload(
  magnetUri: string,
  folderDestination: string,
  processHandlers: ProcessHandlers,
  extra: TorrentDiscoveryOptions = {}
): Promise<DownloadResult> {
  const { onProgress, abortSignal } = processHandlers;
 if (abortSignal?.aborted) {
    throw new TorrentError(magnetUri, 'Download aborted');
  }

  const { default: WebTorrent } = await import('webtorrent');
  const client = new WebTorrent({
    dht: extra.dht ?? true,
    tracker: extra.tracker ?? true,
    lsd: extra.lsd ?? true,
  });

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
        processHandlers
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
      processHandlers
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
