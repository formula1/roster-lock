
import { ProcessHandlers } from "./types";

export type ProtocolHandler = {
  name: string,
  validateURL: (url: string)=>boolean
  download: (
    url: string,
    folderDestination: string,
    processHandlers: ProcessHandlers
  ) => Promise<{
    finishPromise: Promise<any>,
    metaData?: any
  }>;
};
