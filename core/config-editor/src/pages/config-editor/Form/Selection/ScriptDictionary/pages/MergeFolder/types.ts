import { RosterLockV1Config, RosterLockV1Draft } from "@roster-lock/types";

export type ScriptDictionary = RosterLockV1Config["selection"]["scriptDictionary"];
export type ScriptInfo = RosterLockV1Draft["draft"]["selectionScriptInfo"];

export type PreppedScripts = {
  files: ScriptDictionary,
  info: ScriptInfo
};
