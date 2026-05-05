import { RosterLockV1Config } from "@roster-lock/types";
import { getUntrustedScript } from "@roster-lock/shared";
import { StreamLanguage } from '@codemirror/language';
import { Extension } from '@codemirror/state';
import { lua } from '@codemirror/legacy-modes/mode/lua';


type ScriptDictionary = RosterLockV1Config["selection"]["scriptDictionary"];
type Script = ScriptDictionary[string];

const CODE_MIRROR_LANGUAGE_EXTENSIONS: Record<string, StreamLanguage<unknown>> = {
  "lua": StreamLanguage.define(lua)
};

export function getCodeMirrorParser(mimeType: string){
  const untrustedScript = getUntrustedScript(mimeType);
  if(!untrustedScript) return null;
  return CODE_MIRROR_LANGUAGE_EXTENSIONS[untrustedScript.name] ?? null;
}

export const CODE_MIRROR_EXTENSIONS: Extension[] = []
