import { IpfsHttpClient } from "./client";
import { DownloadResult, ProcessHandlers } from "./types";
import { storeFile, saveStreamToFilesystem } from "@roster-lock/dl-shared";
import { IPFSError } from "./utils";

export async function handleSingleFile(
  ipfs: IpfsHttpClient,
  ipfsPath: string,
  cid: string,
  fileName: string,
  folderDestination: string,
  processHandlers: ProcessHandlers
): Promise<DownloadResult> {
  const { onProgress, abortSignal } = processHandlers;
  if (abortSignal?.aborted) {
    throw new IPFSError(ipfsPath, 'Download aborted');
  }

  try {
    const processors = processHandlers.getProcessors!(fileName);
    const ipfsStream = ipfs.cat(ipfsPath, { signal: abortSignal });

    const finishPromise = saveStreamToFilesystem(
      ipfsStream,
      processors,
      folderDestination,
      { abortSignal, onProgress: onProgress ? (bytes) => onProgress(bytes) : undefined }
    );

    return {
      finishPromise,
      metaData: {
        url: `ipfs://${ipfsPath}`,
        cid,
        type: 'file',
      }
    };
  } catch (e) {
    // Not a recognized archive format, just save raw
    return handleRawFile(ipfs, ipfsPath, cid, fileName, folderDestination, processHandlers);
  }
}


async function handleRawFile(
  ipfs: IpfsHttpClient,
  ipfsPath: string,
  cid: string,
  fileName: string,
  folderDestination: string,
  { onProgress, abortSignal }: ProcessHandlers,
): Promise<DownloadResult> {
  const ipfsIterable = ipfs.cat(ipfsPath, { signal: abortSignal });

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
    finishPromise: storeFile(folderDestination, fileName, stream, { abortSignal }),
    metaData: {
      url: `ipfs://${ipfsPath}`,
      cid,
      type: 'file',
    }
  };
}
