import { RosterLockV1Config } from "@roster-lock/types";
import { getUntrustedScriptByFileExtension } from "@roster-lock/shared";
import { fileExtension } from "@roster-lock/utils";
import { StreamLanguage } from '@codemirror/language';
import { Extension } from '@codemirror/state';
import { lua } from '@codemirror/legacy-modes/mode/lua';
import { javascript } from "@codemirror/lang-javascript";

type ScriptDictionary = RosterLockV1Config["selection"]["scriptDictionary"];
type Script = ScriptDictionary[string];

const CODE_MIRROR_LANGUAGE_EXTENSIONS: Record<string, Extension> = {
  ".lua": StreamLanguage.define(lua),
  ".js": javascript(),
  ".ts": javascript({ typescript: true }),
};

export function getCodeMirrorParser(filename: string){
  const untrustedScript = getUntrustedScriptByFileExtension(filename);
  if(!untrustedScript) return;
  const ext = fileExtension(filename);
  if(!ext) return;
  return CODE_MIRROR_LANGUAGE_EXTENSIONS[ext];
}

export const CODE_MIRROR_EXTENSIONS: Extension[] = []
