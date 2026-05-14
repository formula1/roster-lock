// services/src/download/ipfs.ts
import { IpfsHttpClient } from "./client.js";
import { DownloadResult } from "../types";
import { getProcessorsFromPathnameMimetypes, storeFile } from "../../utils";
import { PassThrough, Readable } from 'node:stream';
import { saveStreamToFilesystem } from "../../utils";

import { IPFSError } from "./utils";
import { ProcessHandlers } from "../../types";

export async function handleSingleFile(
  ipfs: IpfsHttpClient,
  cid: string,
  folderDestination: string,
  { onProgress, abortSignal }: ProcessHandlers
): Promise<DownloadResult> {
  if (abortSignal?.aborted) {
    throw new IPFSError(cid, 'Download aborted');
  }

  // Assume it's an archive (we don't know the filename from IPFS)
  const fileName = `${cid}.tar.gz`; // Default assumption
  
  try {
    const { decompressors, archiveHandler } = getProcessorsFromPathnameMimetypes(fileName);
    
    const progressWatcher = new PassThrough();
    let downloaded = 0;
    
    progressWatcher.on('data', (chunk: Buffer) => {
      downloaded += chunk.length;
      onProgress?.(downloaded, undefined);
    });

    // Stream directly from IPFS - no buffering!
    const ipfsStream = ipfs.cat(cid, { signal: abortSignal });
    const stream = Readable.from(ipfsStream);

    const finishPromise = saveStreamToFilesystem(
      stream,
      decompressors,
      archiveHandler,
      folderDestination,
      { abortSignal, progressWatcher }
    );

    return {
      finishPromise,
      metaData: {
        url: `ipfs://${cid}`,
        cid,
        type: 'file',
      }
    };
  } catch (e) {
    // Not an archive, just save as-is
    return handleRawFile(ipfs, cid, folderDestination, { onProgress, abortSignal });
  }
}


async function handleRawFile(
  ipfs: IpfsHttpClient,
  cid: string,
  folderDestination: string,
  { onProgress, abortSignal }: ProcessHandlers
): Promise<DownloadResult> {
  const progressWatcher = new PassThrough();
  let downloaded = 0;
  
  progressWatcher.on('data', (chunk: Buffer) => {
    downloaded += chunk.length;
    onProgress?.(downloaded, undefined);
  });

  // Stream directly - no buffering
  const ipfsStream = ipfs.cat(cid, { signal: abortSignal });
  const stream = Readable.from(ipfsStream);
  const fileName = cid; // Use CID as filename

  const finishPromise = storeFile(
    folderDestination,
    fileName,
    stream,
    { abortSignal, progressWatcher }
  );

  return {
    finishPromise,
    metaData: {
      url: `ipfs://${cid}`,
      cid,
      type: 'file',
    }
  };
}