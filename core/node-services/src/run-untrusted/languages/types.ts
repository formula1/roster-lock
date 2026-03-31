import { ScriptPurposeInput } from "@match-lock/shared";
import { ScriptGlobals } from "../globals";

export type ScriptRunner<ScriptModule> = (
  globals: ScriptGlobals<ScriptModule>,
  input: ScriptPurposeInput,
  script: string
)=>Promise<unknown>;

export type LanguageRunner<ScriptModule> = {
  mimetypes: Array<string>,
  runScript: ScriptRunner<ScriptModule>,
};
