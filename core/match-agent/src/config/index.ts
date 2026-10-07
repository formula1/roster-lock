
export * from "./constants";
export * from "./manage";
export * from "./findFile";
export * from "./inputBindings";

import { dirname, resolve as pathResolve } from "node:path";
import { MatchAgentConfig } from "./manage";

// Resolves a config's pieceFolder/pluginFolder/rosterLockFolder (relative
// to the config file's own directory, defaulting to "pieces"/"plugins"/
// "roster-locks") to absolute paths.
export function resolveConfigFolders(
  configFilePath: string, config: Pick<MatchAgentConfig, "pieceFolder" | "pluginFolder" | "rosterLockFolder">
){
  const configDir = dirname(configFilePath);
  return {
    pieceFolder: pathResolve(configDir, config.pieceFolder ?? "pieces"),
    pluginFolder: pathResolve(configDir, config.pluginFolder ?? "plugins"),
    rosterLockFolder: pathResolve(configDir, config.rosterLockFolder ?? "roster-locks"),
  };
}
