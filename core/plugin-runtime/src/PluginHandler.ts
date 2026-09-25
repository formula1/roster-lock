import {
  installPlugin, updatePlugin, uninstallPlugin, setPluginPriority, getPluginPackagesOfType,
  getPluginFullOfType,
  PLUGIN_TYPES, PluginType,
  PluginEntry,
  PluginTypeMap,
} from "./plugin-management";

import { stat } from "fs/promises"

import { runUntrustedScript, ScriptStarter } from "./run-untrusted";
import { downloadToFolder, DownloadToFolderArg } from "./download";
import { IPieceSort, PieceSort } from "./PieceSort";
import { IGameLauncher, GameLauncher, GameLauncherLocalSettings, AvailableGameLauncher, StartGameRequest } from "./GameLauncher";
import { PluginPackageType } from "./plugin-management/package";

export { IPieceSort }
export { IGameLauncher, GameLauncherLocalSettings, AvailableGameLauncher, StartGameRequest }
export interface IPluginManager {
  readonly pluginDir: string
  pieceSort: IPieceSort,
  gameLauncher: IGameLauncher,
  installPlugin(pluginName: string): Promise<void>,
  updatePlugin(pluginName: string): Promise<void>,
  uninstallPlugin(pluginName: string): Promise<void>,
  setPluginPriority(pluginName: string, priority: number): void,
  getPluginPackagesOfType(type: PluginType): Promise<{
    entry: PluginEntry;
    package: PluginPackageType;
  }[]>
  getPluginFullOfType<T extends PluginType>(
    type: T
  ): Promise<Array<{ entry: PluginEntry; package: PluginPackageType; module: PluginTypeMap[T]; }>>,
  downloadToFolder(
    downloadArgs: DownloadToFolderArg
  ): Promise<{ finishPromise: Promise<any>; metaData?: any }>,
  runUntrustedScript(scriptStarter: ScriptStarter): Promise<unknown>,
}

export class PluginManager implements IPluginManager {
  public pieceSort: IPieceSort = new PieceSort(this);
  public gameLauncher: IGameLauncher = new GameLauncher(this);
  private constructor(public readonly pluginDir: string){}
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
  getPluginFullOfType<T extends PluginType>(type: T){
    return getPluginFullOfType(this.pluginDir, type);
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
