import { RosterLockV1Config } from "@roster-lock/types";

export function isStrategyUnselectable(
  definition: RosterLockV1Config["engine"]["pieceDefinitions"][string]
){
  if(definition.selectionStrategy === "mandatory") return true;
  if(definition.selectionStrategy === "on demand") return true;
  return false;
}
