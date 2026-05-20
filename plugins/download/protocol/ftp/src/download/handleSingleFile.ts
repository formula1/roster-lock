// services/src/download/ftp.ts
import { getProcessorsFromPathnameMimetypes } from "../../utils";
import { Client as FTPClient} from 'basic-ftp';
import { PassThrough } from 'node:stream';
import { saveStreamToFilesystem } from "../../utils";
import { ProcessHandlers } from "./types";


export async function handleSingleFile(
  client: FTPClient,
  urlObj: URL,
  folderDestination: string,
  { onProgress, abortSignal }: ProcessHandlers
) {
  const { decompressors, archiveHandler } = getProcessorsFromPathnameMimetypes(urlObj.pathname);
  const progressWatcher = new PassThrough();
  let downloaded = 0;
  // Get file size for progress tracking
  let contentLength: number | undefined;
  try {
    const size = await client.size(urlObj.pathname);
    contentLength = size > 0 ? size : undefined;
  } catch {
    // SIZE command not supported by all FTP servers
    contentLength = undefined;
  }


  progressWatcher.on('data', (chunk: Buffer) => {
    downloaded += chunk.length;
    onProgress?.(downloaded, contentLength);
  });

  // Create stream for download
  const downloadStream = new PassThrough();

  // Start download in background
  const downloadPromise = client.downloadTo(downloadStream, urlObj.pathname);

  // Save to filesystem
  const finishPromise = Promise.all([
    downloadPromise,
    saveStreamToFilesystem(
      downloadStream,
      decompressors,
      archiveHandler,
      folderDestination,
      { abortSignal, progressWatcher }
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


