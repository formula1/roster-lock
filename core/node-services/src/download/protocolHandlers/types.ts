
import { ProcessHandlers } from "../types";

export type DownloadResult = {
  finishPromise: Promise<any>,
  metaData?: any
};

export type ProtocolHandler = {
  protocols: Array<string>;
  download: (
    url: string,
    folderDestination: string,
    processHandlers: ProcessHandlers
  ) => Promise<DownloadResult>;
};
