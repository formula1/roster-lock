
import { ProtocolHandler } from "@roster-lock/types";
import { getPluginModulesOfType } from "../plugin-management";

type DownloadArgs = Parameters<ProtocolHandler["download"]>

export async function downloadToFolder(
  pluginDir: string,
  { url, destinationFolder, processHandlers }: {
    url: DownloadArgs[0],
    destinationFolder: DownloadArgs[1],
    processHandlers: DownloadArgs[2]
  }
){
  const protocol = await getURLProtocol(pluginDir, url);
  return protocol.download(url, destinationFolder, processHandlers);
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

