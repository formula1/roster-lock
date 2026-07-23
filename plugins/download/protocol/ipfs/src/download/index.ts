import { ProtocolHandler } from "@roster-lock/types";
import { createIpfsClient } from "./client";
import { IPFSError } from "./utils";
import { handleSingleFile } from "./handleSingleFile";
import { handleDirectory } from "./handleDirectory";

export const download: ProtocolHandler["download"] = async function(
  url, folderDestination, processHandlers,
){
  if (processHandlers.abortSignal?.aborted) {
    throw new IPFSError(url, 'Download aborted');
  }

  // ipfs://<CID> or ipfs://<CID>/path/to/file.ext — a bare file CID (from an
  // un-wrapped `ipfs add`) has no filename anywhere in its DAG, so a file
  // reference must carry its name as a path segment, the same way gateway
  // URLs do (https://ipfs.io/ipfs/<dirCID>/file.ext).
  const raw = url.startsWith('ipfs://') ? url.slice(7) : url;
  const [cid, ...pathParts] = raw.split('/').filter(Boolean);
  const subPath = pathParts.join('/');
  const ipfsPath = subPath ? `${cid}/${subPath}` : cid;

  const ipfs = createIpfsClient({
    url: 'http://127.0.0.1:5001',
    timeout: 5000,
  });

  try {
    await ipfs.id();
  } catch (error) {
    throw new IPFSError(url, 'IPFS daemon not running. Start with: ipfs daemon');
  }

  try {
    const stat = await ipfs.files.stat(`/ipfs/${ipfsPath}`);

    if (stat.type === 'file') {
      if (!subPath) {
        throw new Error('IPFS file URLs must include a filename, e.g. ipfs://CID/archive.tar.gz');
      }
      const fileName = pathParts[pathParts.length - 1];
      return handleSingleFile(ipfs, ipfsPath, cid, fileName, folderDestination, processHandlers);
    } else {
      return handleDirectory(ipfs, ipfsPath, folderDestination, processHandlers);
    }
  } catch (error) {
    throw new IPFSError(url, error);
  }
}
