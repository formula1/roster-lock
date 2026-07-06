import { ScriptStarter } from "@roster-lock/types";
import { getUntrustedScriptByFileExtension } from "./get-by-extension";
import { getScriptGlobals } from "./globals";
import { fileExtension } from "@roster-lock/utils";

import { getPluginModulesOfType } from "../plugin-management"

export async function runUntrustedScript(
  pluginDir: string,
  scriptStarter: ScriptStarter,
) {
  const entryScriptPath = scriptStarter.entryScript.src;
  const script = scriptStarter.config.selection.scriptDictionary[entryScriptPath];
  if(!script){
    throw new Error("Missing entry script " + entryScriptPath);
  }
  const untrustedScripts = await getPluginModulesOfType(pluginDir, "untrusted-script")
  const runner = getUntrustedScriptByFileExtension(entryScriptPath, untrustedScripts);
  if(!runner){
    throw new Error("Cannot run script of type " + fileExtension(entryScriptPath));
  }
  const globals = getScriptGlobals(
    scriptStarter, runner
  );
  return await runner.runScript(
    globals,
    scriptStarter.purpose,
    script.content,
    scriptStarter.entryScript.method || "main"
  );
}

export class ScriptError extends Error {
  constructor(e: unknown){
    const message = (
      typeof e === "string" ? e :
      e instanceof Error ? e.message :
      "Unknown Error"
    );
    super(message)
  }
}
