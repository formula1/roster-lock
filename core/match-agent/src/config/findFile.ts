import { dirname } from "node:path";
import { realpath } from "node:fs/promises";
import { resolve as pathResolve, join as pathJoin } from "path";
import { CONFIG_FILE_NAME, DEFAULT_MATCH_CONIFG } from "./constants";
import { configExists } from "./manage";

// The bin entry (dist/index.js) is usually reached through a symlink -
// node_modules/.bin, a pnpm shim, etc. - so argv[1] alone isn't reliable for
// finding "the folder this executable actually lives in" (e.g. a USB mount).
// realpath resolves through those symlinks to the real file location.
export async function getExecutableDir(){
  const scriptPath = process.argv[1];
  if(!scriptPath) return null;
  try {
    return dirname(await realpath(scriptPath));
  }catch(e){
    return null;
  }
}

// Finds the config file that governs this run: an explicit --config-file
// wins; otherwise a config sitting next to the running executable (e.g. on a
// mounted USB, written by `mount-usb`) takes priority over the per-user home
// config, so a USB can be picked up on any machine without touching that
// machine's own defaults.
export async function findConfigFile(explicitPath?: string): Promise<string> {
  if(explicitPath) return pathResolve(explicitPath);
  const execDir = await getExecutableDir();
  if(execDir){
    const sibling = pathJoin(execDir, CONFIG_FILE_NAME);
    if(await configExists(sibling)) return sibling;
  }
  return DEFAULT_MATCH_CONIFG;
}
