
// services/src/download/ftp.ts
import { ProtocolHandler } from "@roster-lock/types";
import { Client as FTPClient} from 'basic-ftp';
import { checkIfDirectory, FTPError } from "./util";
import { handleSingleFile } from "./handleSingleFile";
import { handleDirectory } from "./handleDirectory";

export const runFtpDownload: ProtocolHandler["download"] = async function(
  url, folderDestination, processHandlers
){
  const { abortSignal } = processHandlers;
  if (abortSignal?.aborted) {
    throw new FTPError(url, 'Download aborted');
  }

  const urlObj = new URL(url);
  const client = new FTPClient(30000);

  // Setup abort handler
  const abortHandler = () => {
    client.close();
  };
  abortSignal?.addEventListener('abort', abortHandler);

  try {
    // Determine if FTPS
    const secure = urlObj.protocol === 'ftps:';
    
    // Connect to FTP server
    await client.access({
      host: urlObj.hostname,
      port: urlObj.port ? parseInt(urlObj.port) : (secure ? 990 : 21),
      user: urlObj.username || 'anonymous',
      password: urlObj.password || 'anonymous@',
      secure: secure,
      secureOptions: secure ? {
        rejectUnauthorized: false, // Accept self-signed certs
      } : undefined
    });

    if (abortSignal?.aborted) {
      client.close();
      abortSignal.removeEventListener('abort', abortHandler);
      throw new FTPError(url, 'Download aborted');
    }

    const result = await (async ()=>{
      if(await checkIfDirectory(client, urlObj.pathname)){
        return {
          finishPromise: handleDirectory(client, urlObj, folderDestination, processHandlers),
          metaData: {
            url: urlObj.href,
            type: 'directory',
          }
        }
      } else {
        return handleSingleFile(client, urlObj, folderDestination, processHandlers)
      }
    })()

    result.finishPromise.then(() => {}).finally(() => {
      client.close();
      abortSignal?.removeEventListener('abort', abortHandler);
    })
    return result;

  } catch (error) {
    client.close();
    abortSignal?.removeEventListener('abort', abortHandler);
    throw new FTPError(url, error);
  }
}
