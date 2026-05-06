import { fileExtension } from "@roster-lock/utils";

export type UntrustedScriptType = {
  name: string,
  extensions: Array<string>,
  mimeTypes: Array<string>,
  directoryFile?: string | Array<string>,
};
export const UNTRUSTED_SCRIPT_TYPES: Record<string, UntrustedScriptType> = {};

export function getUntrustedScriptByFileExtension(filename: string){
  const extension = fileExtension(filename);
  if(!extension) return;
  for(const script of Object.values(UNTRUSTED_SCRIPT_TYPES)){
    if(script.extensions.includes(extension)){
      return script;
    }
  }
}

UNTRUSTED_SCRIPT_TYPES["lua"] = {
  name: "lua",
  extensions: [".lua"],
  mimeTypes: [ "text/lua", "text/x-lua" ],
  directoryFile: "init.lua"
};
