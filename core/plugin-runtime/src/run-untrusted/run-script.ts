import { ScriptStarter } from "@roster-lock/types";
import { getUntrustedScriptByFileExtension } from "./get-by-extension";
import { getScriptGlobals } from "./globals";
import { fileExtension } from "@roster-lock/utils";

export async function runUntrustedScript(
  { config, randomSeeds, purpose, entryScript }: ScriptStarter,
) {
  const entryScriptPath = entryScript.src;
  const script = config.selection.scriptDictionary[entryScriptPath];
  if(!script){
    throw new Error("Missing entry script " + entryScriptPath);
  }
  const runner = getUntrustedScriptByFileExtension(entryScriptPath);
  if(!runner){
    throw new Error("Cannot run script of type " + fileExtension(entryScriptPath));
  }
  console.error("Runner:", runner.name);
  const globals = getScriptGlobals(
    config, entryScriptPath, randomSeeds, purpose, runner
  );
  return await runner.runScript(
    globals, purpose, script.content, entryScript.method || "main"
  );
}
