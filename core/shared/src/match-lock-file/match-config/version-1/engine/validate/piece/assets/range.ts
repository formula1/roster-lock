import { RosterLockV1Config } from "@roster-lock/types";
type EngineAssetDefinition = RosterLockV1Config["engine"]["pieceDefinitions"][string]["assets"][number];


export function validateRange(count: EngineAssetDefinition["count"]){
  if(!Array.isArray(count)){
    if(count === "*") return;
    if(count <= 0) throw new Error(`count should be greater than 0`);
    return;
  }
  if(count.length !== 2){
    throw new Error(`range should be a single value or a range of two values`);
  }
  if(count[0] < 0){
    throw new Error(`range should not have a negative minimum`);
  }
  if(count[1] === "*") return;
  if(count[0] >= count[1]){
    throw new Error(`maximum should be greater than the minimum`);
  }
}
