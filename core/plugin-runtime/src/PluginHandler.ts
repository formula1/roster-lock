import {
  installPlugin, updatePlugin, uninstallPlugin, setPluginPriority, getPluginPackagesOfType,
  PLUGIN_TYPES, PluginType,
} from "./plugin-management";

import { stat } from "fs/promises"

import { runUntrustedScript, ScriptStarter } from "./run-untrusted";
import { downloadToFolder, DownloadToFolderArg } from "./download";

export class PluginManager {
  private constructor(private pluginDir: string){}
  static async create(pluginDir: string){
    const statInfo = await tryStat(pluginDir)
    if(!statInfo.isDirectory()) throw new Error("Plugin directory must be a directory")
    return new PluginManager(pluginDir);
  }

  installPlugin(pluginName: string){
    return installPlugin(this.pluginDir, pluginName);
  }
  updatePlugin(pluginName: string){
    return updatePlugin(this.pluginDir, pluginName);
  }
  uninstallPlugin(pluginName: string){
    return uninstallPlugin(this.pluginDir, pluginName)
  }
  setPluginPriority(pluginName: string, priority: number){
    return setPluginPriority(this.pluginDir, pluginName, priority)
  }
  getPluginPackagesOfType(type: PluginType){
    if(!PLUGIN_TYPES.has(type)){
      throw new Error("Plugins should be one of " + JSON.stringify(Array.from(PLUGIN_TYPES)))
    }
    return getPluginPackagesOfType(this.pluginDir, type as PluginType)
  }

  downloadToFolder(downloadArgs: DownloadToFolderArg){
    return downloadToFolder(this.pluginDir, downloadArgs);
  }
  runUntrustedScript(scriptStarter: ScriptStarter){
    return runUntrustedScript(this.pluginDir, scriptStarter)
  }

}


async function tryStat(dir: string){
  try {
    return await stat(dir);
  }catch(e){
    throw new Error("Plugin directory not found")
  }
}
