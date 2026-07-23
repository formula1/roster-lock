import {
  getPluginFullOfType
} from "@roster-lock/plugin-runtime";


export async function getDownloadPlugins(pluginDir: string){
  const [protocol, compression, archive] = await Promise.all([
    getProtocols(pluginDir),
    getCompressions(pluginDir),
    getArchives(pluginDir),
  ]);

  return {
    protocol,
    compression,
    archive,
  };
}

async function getProtocols(pluginDir: string){
  const protocols = await getPluginFullOfType(pluginDir, "dl-protocol");
  return protocols.map((protocol)=>{
    return {
      name: protocol.module.name,
      package: { name: protocol.package.name, version: protocol.package.version }
    };
  });
}

async function getCompressions(pluginDir: string){
  const protocols = await getPluginFullOfType(pluginDir, "dl-compression");
  return protocols.map((protocol)=>{
    return {
      name: protocol.module.name,
      extensions: protocol.module.extensions,
      package: { name: protocol.package.name, version: protocol.package.version }
    };
  });
}

async function getArchives(pluginDir: string){
  const protocols = await getPluginFullOfType(pluginDir, "dl-archive");
  return protocols.map((protocol)=>{
    return {
      name: protocol.module.name,
      extensions: protocol.module.extensions,
      package: { name: protocol.package.name, version: protocol.package.version }
    };
  });
}
