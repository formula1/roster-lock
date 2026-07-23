import { fs } from "../tauri/fs";
import { join as pathJoin } from '@tauri-apps/api/path';

export async function getPluginDir(){
  const homDir = await fs.getHomeDir();
  return pathJoin(homDir, "roster-lock", "plugins");
}
