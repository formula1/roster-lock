import { ProtocolHandler } from "@roster-lock/types";

type DLArgs = Parameters<ProtocolHandler["download"]>;

import { request as httpRequest, IncomingMessage, ClientRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { once } from "node:events";
import { saveStreamToFilesystem } from "@roster-lock/dl-shared";

export const runDownloadInit: ProtocolHandler["download"] = function(
  url, folderDestination, processHandlers,
){
  return runDownload(url, folderDestination, processHandlers)
}

async function runDownload(
  url: DLArgs[0], folderDestination: DLArgs[1], processHandlers: DLArgs[2],
  redirects = 0, maxRedirects = 10
){
  if(redirects > maxRedirects) throw new Error("Too Many Redirects");
  if(processHandlers.abortSignal.aborted) throw new Error("Download Aborted");
  let urlObj = new URL(url);
  const request = urlObj.protocol === 'https:' ? httpsRequest : httpRequest;
  const processor = processHandlers.getProcessors!(urlObj.pathname);

  const req = request(url);
  req.end();

  const [res] = await once(req, 'response') as [IncomingMessage];

  if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400) {
    const location = res.headers.location;
    if (!location) {
      throw new HTTPError(
        req, res, 'Redirect without location header'
      );
    }
    urlObj = new URL(location, urlObj);
    return runDownload(urlObj.href, folderDestination, processHandlers, redirects + 1, maxRedirects);
  } else if (res.statusCode && res.statusCode !== 200) {
    throw new HTTPError(req, res, `Invalid Status Code`);
  }

  const contentLength = (()=>{
    if(!res.headers['content-length']) return undefined;
    const contentLength = Number.parseInt(res.headers['content-length']);
    if(Number.isNaN(contentLength)) return undefined;
    return contentLength;
  })();


  return {
    finishPromise: saveStreamToFilesystem(
      res,
      processor,
      folderDestination,
      {
        abortSignal: processHandlers.abortSignal,
        onProgress: processHandlers.onProgress
          ? (bytes) => processHandlers.onProgress!(bytes, contentLength)
          : undefined,
      }
    ),
    metaData: {
      url: urlObj.href,
      headers: res.headers,
    }
  };
}

export class HTTPError extends Error {
  public url: string;
  public method: string;
  public statusCode: undefined | number;
  constructor(
    public req: ClientRequest,
    public response: IncomingMessage,
    reason: string = "Failed To Fetch"
  ) {
    super(reason);
    this.url = req.path;
    this.method = req.method;
    this.statusCode = response.statusCode;
  }
}

