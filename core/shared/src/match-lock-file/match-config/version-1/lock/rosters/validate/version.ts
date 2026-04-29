
import { RosterLockV1Config } from "@roster-lock/types";

import { validateSha256 } from "./utils";

type PieceVersion = RosterLockV1Config["rosters"][string][0]["version"];
export function validateVersions(
  versions: PieceVersion
){
  validateSha256(versions.logic);
  validateSha256(versions.media);
  validateSha256(versions.docs);
}

export function validateVersionUniqueness(
  versions: PieceVersion, index: number, rosters: RosterLockV1Config["rosters"][string]
){
  for(let i = 0; i < rosters.length; i++){
    if(i === index) continue;
    if(rosters[i].version.logic === versions.logic) throw new Error(`Duplicate Logic Version ${versions.logic}`);
  }
}
