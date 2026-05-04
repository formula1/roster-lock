import { ScriptPurposeInput, UntrustedScriptType } from "@roster-lock/shared";
import { ScriptGlobals } from "../globals";

export type ScriptRunner<ScriptModule> = (
  globals: ScriptGlobals<ScriptModule>,
  input: ScriptPurposeInput,
  script: string,
  initialMethod: string
)=>Promise<unknown>;

export type LanguageRunner<ScriptModule> = {
  config: UntrustedScriptType,
  runScript: ScriptRunner<ScriptModule>,
};
