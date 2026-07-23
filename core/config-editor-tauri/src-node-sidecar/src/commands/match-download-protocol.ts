import {
  getPluginFullOfType
} from "@roster-lock/plugin-runtime";


type ProtocolResult = {
  name: string,
  package: { name: string, version: string }
};
export async function matchDownloadProtocols(pluginDir: string, url: string){
  const matching: Array<ProtocolResult> = [];
  for(const protocol of await getPluginFullOfType(pluginDir, "dl-protocol")){
    try {
      if(protocol.module.validateURL(url)){
        matching.push({
          name: protocol.module.name,
          package: {
            name: protocol.package.name,
            version: protocol.package.version
          }
        });
      }
    }catch(e){
      // ignore the error
    }
  }
  return matching;
}
