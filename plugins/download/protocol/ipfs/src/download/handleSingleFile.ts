import { IpfsHttpClient } from "./client";
import { DownloadResult, ProcessHandlers } from "./types";
import { storeFile, saveStreamToFilesystem } from "@roster-lock/dl-shared";
import { IPFSError } from "./utils";

export async function handleSingleFile(
  ipfs: IpfsHttpClient,
  cid: string,
  folderDestination: string,
  processHandlers: ProcessHandlers
): Promise<DownloadResult> {
  const { onProgress, abortSignal } = processHandlers;
  if (abortSignal?.aborted) {
    throw new IPFSError(cid, 'Download aborted');
  }

  // Assume it's an archive (we don't know the filename from IPFS)
  const fileName = `${cid}.tar.gz`;

  try {
    const processors = processHandlers.getProcessors!(fileName);
    const ipfsStream = ipfs.cat(cid, { signal: abortSignal });

    const finishPromise = saveStreamToFilesystem(
      ipfsStream,
      processors,
      folderDestination,
      { abortSignal, onProgress: onProgress ? (bytes) => onProgress(bytes) : undefined }
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
    // Not an archive, just save raw
    return handleRawFile(ipfs, cid, folderDestination, processHandlers);
  }
}


async function handleRawFile(
  ipfs: IpfsHttpClient,
  cid: string,
  folderDestination: string,
  { onProgress, abortSignal }: ProcessHandlers,
): Promise<DownloadResult> {
  const ipfsIterable = ipfs.cat(cid, { signal: abortSignal });

  let stream: AsyncIterable<Uint8Array> = ipfsIterable;
  if (onProgress) {
    let downloaded = 0;
    stream = (async function* () {
      for await (const chunk of ipfsIterable) {
        downloaded += chunk.length;
        onProgress(downloaded, undefined);
        yield chunk;
      }
    })();
  }

  return {
    finishPromise: storeFile(folderDestination, cid, stream, { abortSignal }),
    metaData: {
      url: `ipfs://${cid}`,
      cid,
      type: 'file',
    }
  };
}
