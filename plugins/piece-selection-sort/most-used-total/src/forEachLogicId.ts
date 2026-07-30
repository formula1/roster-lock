import { RosterLockV1Config, UserSelection, PlayerId } from "@roster-lock/types";
import { buildPieceIdToLogicId } from "./pieceIdToLogicId";
import { forSelectedPieces } from "./forSelectedPieces";

// Combines forSelectedPieces + buildPieceIdToLogicId (cached per pieceType,
// since the same lookup applies to every user in a single call) - the
// composition every plugin here actually needs when recording stats.
export function forEachLogicId(
  lockConfig: RosterLockV1Config,
  userSelections: Record<PlayerId, UserSelection>,
  userIds: Array<PlayerId>,
  callback: (pieceType: string, logicId: string) => void,
){
  const logicIdLookups = new Map<string, Record<string, string>>();
  forSelectedPieces(userSelections, userIds, (pieceType, pieceId)=>{
    let lookup = logicIdLookups.get(pieceType);
    if(!lookup){
      lookup = buildPieceIdToLogicId(lockConfig, pieceType);
      logicIdLookups.set(pieceType, lookup);
    }
    const logicId = lookup[pieceId];
    if(!logicId) return;
    callback(pieceType, logicId);
  });
}
