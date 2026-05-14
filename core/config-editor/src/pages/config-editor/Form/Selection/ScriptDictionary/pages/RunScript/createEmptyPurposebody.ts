import type { ScriptPurposeInput } from "@roster-lock/shared";
import { RosterLockV1Config, SelectedPiece } from "@roster-lock/types";

export function createEmptyPurposeBody(
  lock: RosterLockV1Config,
  type: ScriptPurposeInput["type"],
  users: Array<string>
): ScriptPurposeInput{
  const pieceTypes = Object.keys(lock.engine.pieceDefinitions).filter((pieceType)=>{
    const strategy = lock.engine.pieceDefinitions[pieceType].selectionStrategy;
    if(strategy === "personal") return true;
    if(strategy === "shared") return true;
    return false;
  });
  if(pieceTypes.length === 0){
    console.log("No piece types:", lock, pieceTypes);
    throw new Error("No piece types available");
  }
  switch(type){
    case "piece-user-validation": return {
      type: "piece-user-validation",
      pieceType: pieceTypes[0],
      userId: users[0] || "UNKNOWN USER",
      input: []
    };
    case "piece-merge": {
      const input: Record<string, Array<SelectedPiece>> = {};
      for(const user of users) input[user] = []
      return {
        type: "piece-merge",
        pieceType: pieceTypes[0],
        users,
        input
      };
    }
    case "global-validation": {
      const input: Record<string, Record<string, Array<SelectedPiece>> | Array<SelectedPiece>> = {};
      for(const pieceType of pieceTypes){
        const strategy = lock.engine.pieceDefinitions[pieceType].selectionStrategy;
        if(strategy === "shared"){
          input[pieceType] = [];
        } else {
          input[pieceType] = {};
          for(const user of users) input[pieceType][user] = []
        }
      }
      return {
        type: "global-validation",
        pieceTypes,
        users,
        input
      }
    }
  }
}