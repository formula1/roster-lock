import { ScriptStarter } from "@roster-lock/types";
import { getUntrustedScriptByFileExtension } from "./get-by-extension";
import { getScriptGlobals } from "./globals";
import { fileExtension } from "@roster-lock/utils";

import { getPluginModulesOfType } from "../plugin-management"

export async function runUntrustedScript(
  pluginDir: string,
  { config, randomSeeds, purpose, entryScript }: ScriptStarter,
) {
  const entryScriptPath = entryScript.src;
  const script = config.selection.scriptDictionary[entryScriptPath];
  if(!script){
    throw new Error("Missing entry script " + entryScriptPath);
  }
  const untrustedScripts = await getPluginModulesOfType(pluginDir, "untrusted-script")
  const runner = getUntrustedScriptByFileExtension(entryScriptPath, untrustedScripts);
  if(!runner){
    throw new Error("Cannot run script of type " + fileExtension(entryScriptPath));
  }
  const globals = getScriptGlobals(
    config, entryScriptPath, randomSeeds, purpose, runner
  );
  return await runner.runScript(
    globals, purpose, script.content, entryScript.method || "main"
  );
}
