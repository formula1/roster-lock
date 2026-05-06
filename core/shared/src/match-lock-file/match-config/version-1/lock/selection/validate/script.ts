import { UntrustedScriptRef, RosterLockV1Config } from "@roster-lock/types";

export function validateGasLimittedScript(
  script: UntrustedScriptRef,
  config: RosterLockV1Config
){
  validateGasLimittedScriptSrc(script.src, config);
  validateGasLimittedScriptMethod(script.method);
}

export function validateGasLimittedScriptSrc(
  scriptSrc: UntrustedScriptRef["src"],
  { selection }: RosterLockV1Config
){
  if(!(scriptSrc in selection.scriptDictionary)){
    throw new Error("Script src is not in scripts");
  }
}

const VALID_IDENTIFIER = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
export function validateGasLimittedScriptMethod(
  method: UntrustedScriptRef["method"]
){
  if(method === undefined) return;
  if(!VALID_IDENTIFIER.test(method)){
    throw new Error("Script method must be a valid identifier");
  }
}

import { getUntrustedScriptByFileExtension } from "../../../usage/untrusted-scripts";
export function validateUntrustedScriptExtension(
  filename: string
){
  if(!getUntrustedScriptByFileExtension(filename)){
    throw new Error("Invalid Script Extension");
  }
}
