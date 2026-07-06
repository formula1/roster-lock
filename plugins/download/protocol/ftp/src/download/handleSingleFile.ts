import { Client as FTPClient} from 'basic-ftp';
import { PassThrough } from 'node:stream';
import { saveStreamToFilesystem } from "@roster-lock/dl-shared";
import { ProcessHandlers } from "./types";


export async function handleSingleFile(
  client: FTPClient,
  urlObj: URL,
  folderDestination: string,
  processHandlers: ProcessHandlers
) {
  const { onProgress, abortSignal } = processHandlers;
  const processors = processHandlers.getProcessors(urlObj.pathname);

  let contentLength: number | undefined;
  try {
    const size = await client.size(urlObj.pathname);
    contentLength = size > 0 ? size : undefined;
  } catch {
    contentLength = undefined;
  }

  const downloadStream = new PassThrough();
  const downloadPromise = client.downloadTo(downloadStream, urlObj.pathname);

  const finishPromise = Promise.all([
    downloadPromise,
    saveStreamToFilesystem(
      downloadStream,
      processors,
      folderDestination,
      {
        abortSignal,
        onProgress: onProgress
          ? (bytes) => onProgress(bytes, contentLength)
          : undefined,
      }
    )
  ]);

  return {
    finishPromise,
    metaData: {
      url: urlObj.href,
      size: contentLength,
    }
  };
}


