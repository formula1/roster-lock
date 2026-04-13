import { RosterLockV1Config } from "@roster-lock/types";

export function validatePieceId(id: string){
  if(id.length === 0) throw new Error("ID is empty");
  if(id.length > 128) throw new Error("ID is too long");
  if(id !== id.trim()) throw new Error("ID contains a trailing or leading space");

  if(id.includes('\0')) throw new Error("ID contains null character");
  if(/[\x00-\x1F\x7F-\x9F]/.test(id)) throw new Error("ID contains control character");
  if (/[\r\n\t\v\f]/.test(id)) throw new Error("ID contains whitespace character");
}

export function validatePieceIdUniqueness(
  id: string, index: number, rosters: RosterLockV1Config["rosters"][string]
){
  for(let i = 0; i < rosters.length; i++){
    if(i === index) continue;
    if(rosters[i].id === id) throw new Error(`Duplicate ID ${id}`);
  }
}
