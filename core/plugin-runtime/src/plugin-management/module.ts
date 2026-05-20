import { join as pathJoin } from "node:path";
import { createRequire } from "node:module";
import { PluginPackageType } from "./package";

const _require = createRequire(__filename);

export async function importPluginModule(
  pluginDir: string, packageName: string, installedPkgJson: PluginPackageType
){
  const mainFile = (installedPkgJson.main as string | undefined) ?? "index.js";
  const mainPath = pathJoin(pluginDir, "node_modules", packageName, mainFile);

  let mod = _require(mainPath) as Record<string, unknown>;

  // CJS compiled from ESM has __esModule:true on module.exports; dynamic import()
  // then wraps that as the default, producing nested defaults — unwrap them all.
  while (mod.__esModule && typeof mod.default === "object" && mod.default !== null) {
    mod = mod.default as Record<string, unknown>;
  }

  // Resolve a top-level default export (ESM `export default` or CJS equivalent)
  if (mod.default !== undefined) {
    return mod.default as Record<string, unknown>;
  }

  return mod;
}
