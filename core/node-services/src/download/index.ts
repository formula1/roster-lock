
export * from "./protocolHandlers";
export * from "./utils";
export * from "./archive";
export * from "./compression";

import { getDownloadableSourceProtocol } from "@roster-lock/shared";
import { getSourceHandlerFromProtocol } from "./protocolHandlers";
import { ProcessHandlers } from "./types";

export function downloadToFolder(
  url: string, destinationFolder: string,
  processHandlers: ProcessHandlers
){
  const protocol = getDownloadableSourceProtocol(url);
  if(!protocol){
    throw new Error("Invalid Protocol");
  }
  const sourceHandler = getSourceHandlerFromProtocol(protocol);
  if(!sourceHandler){
    throw new Error("No Source Handler Found");
  }
  return sourceHandler.download(url, destinationFolder, processHandlers);
}