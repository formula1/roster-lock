import { fileExtension } from "@roster-lock/utils";
import { UntrustedScript } from "@roster-lock/types";

export function getUntrustedScriptByFileExtension(
  filename: string, availableScripts: Array<UntrustedScript<any>>
){
  const extension = fileExtension(filename);
  if(!extension) return;
  for(const script of availableScripts){
    if(script.extensions.includes(extension)){
      return script;
    }
  }
}
