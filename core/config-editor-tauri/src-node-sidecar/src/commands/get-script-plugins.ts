import { getPluginFullOfType } from "@roster-lock/plugin-runtime";

export async function listScriptPlugins(pluginDir: string){
  const items = await getPluginFullOfType(pluginDir, "untrusted-script");
  return items.map((item)=>{
    return {
      name: item.module.name,
      extensions: item.module.extensions,
      package: { name: item.package.name, version: item.package.version }
    };
  });
}
