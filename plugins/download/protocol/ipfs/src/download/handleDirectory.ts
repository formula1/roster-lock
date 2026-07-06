import { DownloadResult, ProcessHandlers } from "./types";
import { storeFile } from "@roster-lock/dl-shared";
import { IPFSError } from "./utils";
import { IpfsHttpClient } from "./client";

async function* walkDirectory(
  ipfs: IpfsHttpClient,
  cid: string,
  relPath: string,
  abortSignal?: AbortSignal,
): AsyncIterable<{ path: string; cid: string; size?: number; name: string }> {
  for await (const entry of ipfs.ls(cid, { signal: abortSignal })) {
    const entryPath = relPath ? `${relPath}/${entry.name}` : entry.name;
    if (entry.type === 'dir') {
      yield* walkDirectory(ipfs, entry.cid, entryPath, abortSignal);
    } else {
      yield { path: entryPath, cid: entry.cid, size: entry.size, name: entry.name };
    }
  }
}

export async function handleDirectory(
  ipfs: IpfsHttpClient,
  cid: string,
  folderDestination: string,
  { onProgress, abortSignal }: ProcessHandlers
): Promise<DownloadResult> {
  const filePromises: Promise<void>[] = [];
  const fileList: Array<{ name: string; size?: number }> = [];

  for await (const file of walkDirectory(ipfs, cid, '', abortSignal)) {
    if (abortSignal?.aborted) {
      throw new IPFSError(cid, 'Download aborted');
    }

    fileList.push({ name: file.path, size: file.size });
    const stream = ipfs.cat(file.cid, { signal: abortSignal });
    filePromises.push(storeFile(folderDestination, file.path, stream, { abortSignal }));
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
