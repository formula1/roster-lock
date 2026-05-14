// services/src/download/ipfs.ts
import { DownloadResult } from "../types";
import { PassThrough, Readable } from 'node:stream';
import { storeFile } from "../../utils";
import { IPFSError } from "./utils";
import { IpfsHttpClient } from "./client.js";
import { ProcessHandlers } from "../../types";

export async function handleDirectory(
  ipfs: IpfsHttpClient,
  cid: string,
  folderDestination: string,
  { onProgress, abortSignal }: ProcessHandlers
): Promise<DownloadResult> {
  let totalDownloaded = 0;
  
  const filePromises: Promise<void>[] = [];
  const fileList: Array<{ name: string; size?: number }> = [];

  // Walk directory tree
  for await (const entry of ipfs.ls(cid, { signal: abortSignal })) {
    if (abortSignal?.aborted) {
      throw new IPFSError(cid, 'Download aborted');
    }

    if (entry.type === 'file') {
      fileList.push({ name: entry.name, size: entry.size });
      
      const progressWatcher = new PassThrough();
      progressWatcher.on('data', (chunk: Buffer) => {
        totalDownloaded += chunk.length;
        onProgress?.(totalDownloaded, undefined);
      });

      // Stream directly - no buffering!
      const ipfsStream = ipfs.cat(entry.cid, { signal: abortSignal });
      const stream = Readable.from(ipfsStream);
      
      const promise = storeFile(
        folderDestination,
        entry.path || entry.name,
        stream,
        { abortSignal, progressWatcher }
      );
      
      filePromises.push(promise);
    }
  }

  const finishPromise = Promise.all(filePromises).then(() => {});

  return {
    finishPromise,
    metaData: {
      url: `ipfs://${cid}`,
      cid,
      type: 'directory',
      files: fileList,
    }
  };
}
