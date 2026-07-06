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

  const cid = url.startsWith('ipfs://') ? url.slice(7) : url;

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
    const stat = await ipfs.files.stat(`/ipfs/${cid}`);

    if (stat.type === 'file') {
      return handleSingleFile(ipfs, cid, folderDestination, processHandlers);
    } else {
      return handleDirectory(ipfs, cid, folderDestination, processHandlers);
    }
  } catch (error) {
    throw new IPFSError(url, error);
  }
}
