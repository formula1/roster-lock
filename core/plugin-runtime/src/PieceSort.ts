import { mkdir } from "fs/promises";
import { join as pathJoin } from "path";
import { PieceSelectionSortPlugin } from "@roster-lock/types";
import { getPluginModuleByName, getPluginFullOfType } from "./plugin-management";
import type { PluginManager } from "./PluginHandler";

type SortPiecesArg = Parameters<PieceSelectionSortPlugin["sortPieces"]>[0];
type HandleFullSelectionArg = Parameters<PieceSelectionSortPlugin["handleFullSelection"]>[0];
type HandleGameCompleteArg = Parameters<PieceSelectionSortPlugin["handleGameComplete"]>[0];

export type AvailableSortPlugin = {
  pluginName: string,
  publicInfo: PieceSelectionSortPlugin["publicInfo"],
};

export interface IPieceSort {
  listAvailable(): Promise<Array<AvailableSortPlugin>>,
  sortPieces(
    pluginName: string, arg: Omit<SortPiecesArg, "dataDir">
  ): Promise<Array<string>>
  handleFullSelection(
    arg: Omit<HandleFullSelectionArg, "dataDir">
  ): Promise<void>
  handleGameComplete(
    arg: Omit<HandleGameCompleteArg, "dataDir">
  ): Promise<void>
}

export class PieceSort implements IPieceSort {
  constructor(private pluginManager: PluginManager){}

  async listAvailable(): Promise<Array<AvailableSortPlugin>> {
    const plugins = await getPluginFullOfType(this.pluginManager.pluginDir, "piece-selection-sort");
    return plugins.map(({ entry, module })=>({ pluginName: entry.package, publicInfo: module.publicInfo }));
  }

  async sortPieces(pluginName: string, arg: Omit<SortPiecesArg, "dataDir">){
    const plugin = await getPluginModuleByName(this.pluginManager.pluginDir, pluginName, "piece-selection-sort");
    const dataDir = await this.dataDirFor(pluginName);
    return plugin.sortPieces({ ...arg, dataDir });
  }

  async handleFullSelection(arg: Omit<HandleFullSelectionArg, "dataDir">){
    const plugins = await this.allPlugins();
    await Promise.all(plugins.map(async ({ packageName, plugin })=>{
      try {
        const dataDir = await this.dataDirFor(packageName);
        await plugin.handleFullSelection({ ...arg, dataDir });
      }catch(e){
        console.error(`piece-selection-sort plugin "${packageName}" failed in handleFullSelection`, e);
      }
    }));
  }

  async handleGameComplete(arg: Omit<HandleGameCompleteArg, "dataDir">){
    const plugins = await this.allPlugins();
    await Promise.all(plugins.map(async ({ packageName, plugin })=>{
      try {
        const dataDir = await this.dataDirFor(packageName);
        await plugin.handleGameComplete({ ...arg, dataDir });
      }catch(e){
        console.error(`piece-selection-sort plugin "${packageName}" failed in handleGameComplete`, e);
      }
    }));
  }

  private async allPlugins(){
    const plugins = await getPluginFullOfType(this.pluginManager.pluginDir, "piece-selection-sort");
    return plugins.map(({ entry, module })=>({ packageName: entry.package, plugin: module }));
  }

  private async dataDirFor(packageName: string){
    const dir = pathJoin(this.pluginManager.pluginDir, "data", packageName);
    await mkdir(dir, { recursive: true });
    return dir;
  }
}
