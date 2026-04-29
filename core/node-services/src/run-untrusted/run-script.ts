import { ScriptStarter } from "@roster-lock/shared";
import { getLanguageRunnerFromMimeType } from "./languages";
import { getScriptGlobals } from "./globals";
import mime from 'mime-types';


export async function runUntrustedScript(
  { config, randomSeeds, purpose, entryScriptPath }: ScriptStarter,
) {
  const script = config.selection.scripts[entryScriptPath];
  if(!script){
    throw new Error("Missing entry script " + entryScriptPath);
  }
  const mimetype = mime.lookup(entryScriptPath);
  if(!mimetype){
    throw new Error("Cannot determine mime type of " + entryScriptPath);
  }
  const runner = getLanguageRunnerFromMimeType(mimetype);
  if(!runner){
    throw new Error("Cannot run script of type " + mimetype);
  }
  const globals = getScriptGlobals(
    config, entryScriptPath, randomSeeds, purpose
  );
  return await runner.runScript(globals, purpose, script);
}
