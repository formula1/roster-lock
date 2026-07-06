import { RosterLockV1Config, UntrustedScriptRef } from "../../lock";
import { ScriptPurposeInput } from "./purpose-input";
export * from "./purpose-input";

export type ScriptStarter = {
  config: RosterLockV1Config,
  randomSeeds: string[],
  purpose: ScriptPurposeInput,
  entryScript: UntrustedScriptRef
  debugLog?: Array<string>,
};


export type ScriptGlobals<ScriptModule> = {
  randomFloat: ()=>number,
  randomInt: (min: number, max: number)=>number,
  shuffleIndexes: (length: number, startOffset?: number)=>Array<number>,
  getPieceMeta: (pieceType: string, pieceId: string)=>any,
  getAvailablePieces: (pieceType: string)=>Array<string>,
  requireScript: (path: string, runCode: (newPath: string, content: string)=>Promise<ScriptModule>)=>Promise<ScriptModule>,
  log: (...args: any)=>void
};


export type ScriptRunner<ScriptModule> = (
  globals: ScriptGlobals<ScriptModule>,
  input: ScriptPurposeInput,
  script: string,
  initialMethod: string
)=>Promise<unknown>;

export type UntrustedScript<ScriptModule> = {
  name: string,
  extensions: Array<string>,
  directoryFile: Array<string>,
  runScript: ScriptRunner<ScriptModule>,
};

export type ScriptStackFrame = {
  filename: string | null,
  line: number | null,
  name: string | null,
};

export type NormalizedScriptError = {
  type: "UntrustedScriptError"
  message: string,
  filename: string | null,
  line: number | null,
  column: number | null,
  stack: ScriptStackFrame[] | null,
};
