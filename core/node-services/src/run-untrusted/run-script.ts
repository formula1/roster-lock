import { ScriptStarter } from "@roster-lock/shared";
import { getLanguageRunnerFromFileExtension } from "./languages";
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
  const runner = getLanguageRunnerFromFileExtension(entryScriptPath);
  if(!runner){
    throw new Error("Cannot run script of type " + fileExtension(entryScriptPath));
  }
  const globals = getScriptGlobals(
    config, entryScriptPath, randomSeeds, purpose
  );
  return await runner.runScript(
    globals, purpose, script.content, entryScript.method || "main"
  );
}
