
import { ProtocolHandler } from "@roster-lock/types";
import { getPluginModulesOfType } from "../plugin-management";
import { createGetProcessors } from "./processors";

type DownloadArgs = Parameters<ProtocolHandler["download"]>

export async function downloadToFolder(
  pluginDir: string,
  { url, destinationFolder, processHandlers }: {
    url: DownloadArgs[0],
    destinationFolder: DownloadArgs[1],
    processHandlers: Omit<DownloadArgs[2], "getProcessors">
  }
){
  const [
    protocol, decompressors, archive
  ] = await Promise.all([
    getURLProtocol(pluginDir, url),
    getPluginModulesOfType(pluginDir, "dl-compression"),
    getPluginModulesOfType(pluginDir, "dl-archive"),
  ])
  const getProcessors = createGetProcessors(
    decompressors, archive
  )
  return protocol.download(
    url, destinationFolder, { ...processHandlers, getProcessors }
  );
}

async function getURLProtocol(
  pluginDir: string, url: string
){
  for(const protocol of await getPluginModulesOfType(pluginDir, "dl-protocol")){
    try {
      if(protocol.validateURL(url)) return protocol
    }catch(e){
    }
  }
  throw new Error("No protocol to handle url")
}

