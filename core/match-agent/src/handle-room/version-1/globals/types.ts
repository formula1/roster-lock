
import { IFolderDB } from "./FolderDB";
import { PluginManager } from "@roster-lock/plugin-runtime";
export type V1Env = {
  fileDB: IFolderDB,
  pluginRuntime: PluginManager,
}
