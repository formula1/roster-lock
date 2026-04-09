import { RosterLockV1Config } from "@roster-lock/types";

export function resetPieces(engine: RosterLockV1Config["engine"], rosters: RosterLockV1Config["rosters"]){
  const newRosters: RosterLockV1Config["rosters"] = {}
  for(const pieceName of Object.keys(engine.pieceDefinitions)){
    if(pieceName in rosters){
      newRosters[pieceName] = rosters[pieceName];
      continue;
    }
    newRosters[pieceName] = [];
  }
  return newRosters;
}
