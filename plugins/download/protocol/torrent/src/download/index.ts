import { ProtocolHandler, ProcessHandlers } from "@roster-lock/types";
import type WebTorrentCtor from 'webtorrent';

import { handleSingleFileTorrent } from "./singleFile";
import { handleMultipleFileTorrent } from "./multiFile";
import { findTorrentPort } from "./findTorrentPort";

type DownloadResult = Awaited<ReturnType<ProtocolHandler["download"]>>;

export type TorrentDiscoveryOptions = {
  dht?: boolean;
  tracker?: boolean;
  lsd?: boolean;
};

// findTorrentPort probes for a port that's free on both TCP and UDP before
// the client ever binds, so this should succeed on the first attempt. The
// retry only exists for the residual gap between that probe and the real
// bind, where something else could in principle grab the port first.
const MAX_PORT_BIND_ATTEMPTS = 3;

function isAddressInUseError(err: unknown): boolean {
  const e = err as { code?: string; message?: string } | undefined;
  return e?.code === 'EADDRINUSE' || /address already in use/i.test(e?.message ?? String(err));
}

export async function runTorrentDownload(
  magnetUri: string,
  folderDestination: string,
  processHandlers: ProcessHandlers,
  extra: TorrentDiscoveryOptions = {}
): Promise<DownloadResult> {
  const { abortSignal } = processHandlers;
  if (abortSignal?.aborted) {
    throw new TorrentError(magnetUri, 'Download aborted');
  }

  const { default: WebTorrent } = await import('webtorrent');

  for (let attempt = 1; ; attempt++) {
    try {
      const torrentPort = await findTorrentPort();
      return await attemptDownload(WebTorrent, magnetUri, folderDestination, processHandlers, extra, torrentPort);
    } catch (err) {
      const cause = err instanceof TorrentError ? err.originalError : err;
      if (attempt >= MAX_PORT_BIND_ATTEMPTS || !isAddressInUseError(cause)) throw err;
    }
  }
}

function attemptDownload(
  WebTorrent: typeof WebTorrentCtor,
  magnetUri: string,
  folderDestination: string,
  processHandlers: ProcessHandlers,
  extra: TorrentDiscoveryOptions,
  torrentPort: number
): Promise<DownloadResult> {
  const { abortSignal } = processHandlers;

  // @types/webtorrent's Options interface is missing torrentPort even though
  // the runtime supports it (webtorrent/index.js: `opts.torrentPort || 0`).
  const options: ConstructorParameters<typeof WebTorrentCtor>[0] & { torrentPort: number } = {
    dht: extra.dht ?? true,
    tracker: extra.tracker ?? true,
    lsd: extra.lsd ?? true,
    torrentPort,
  };
  const client = new WebTorrent(options);

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
