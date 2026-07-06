import { Client as FTPClient, FileInfo as FTPFileInfo } from 'basic-ftp';
import { PassThrough } from 'node:stream';
import { storeFile } from "@roster-lock/dl-shared";
import { join as pathJoin } from "node:path";
import { FTPError } from "./util";
import { ProcessHandlers } from './types';

export async function handleDirectory(
  client: FTPClient,
  urlObj: URL,
  folderDestination: string,
  { onProgress, abortSignal }: ProcessHandlers,
) {
  const remotePath = urlObj.pathname;
  const filePromises: Promise<void>[] = [];
  const fileList: Array<{ name: string; size?: number }> = [];

  // Walk directory recursively
  for await (const { relativePath, fileInfo } of walkFtpDirectory(client, remotePath, '')) {
    if (abortSignal?.aborted) {
      throw new FTPError(urlObj.href, 'Download aborted');
    }

    fileList.push({ name: relativePath, size: fileInfo.size });

    const downloadStream = new PassThrough();
    const remoteFilePath = pathJoin(remotePath, relativePath).replace(/\\/g, '/');
    const downloadPromise = client.downloadTo(downloadStream, remoteFilePath);

    const savePromise = storeFile(
      folderDestination,
      relativePath,
      downloadStream,
      { abortSignal }
    );

    filePromises.push(
      Promise.all([downloadPromise, savePromise]).then(() => {})
    );
  }

  await Promise.all(filePromises);
}


async function* walkFtpDirectory(
  client: FTPClient,
  remotePath: string,
  relativePath: string,
): AsyncIterable<{ relativePath: string; fileInfo: FTPFileInfo }> {
  const fullPath = relativePath 
    ? pathJoin(remotePath, relativePath).replace(/\\/g, '/')
    : remotePath;

  const entries = await client.list(fullPath);

  for (const entry of entries) {
    const entryRelativePath = relativePath 
      ? pathJoin(relativePath, entry.name)
      : entry.name;

    if (entry.isDirectory) {
      // Recurse into subdirectory
      yield* walkFtpDirectory(client, remotePath, entryRelativePath);
    } else if (entry.isFile) {
      // Process file
      yield { relativePath: entryRelativePath, fileInfo: entry };
    }
  }
}
