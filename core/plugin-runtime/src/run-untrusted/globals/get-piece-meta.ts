import { RosterLockV1Config, PieceType } from "@roster-lock/types";
import { cloneJSON } from "@roster-lock/utils";

export function createPieceMetaGetter(
  config: RosterLockV1Config, lockedTypes: Set<PieceType>
){
  return function (pieceType: string, pieceId: string){
    if(!lockedTypes.has(pieceType)) return {};
    const pieceMeta = config.selection.piece[pieceType].pieceMeta;
    if(!pieceMeta) return {};
    const defaultMeta = pieceMeta.defaultMeta;
    const pieceSpecificMeta = pieceMeta.pieceMeta[pieceId] || {};
    return cloneJSON({
      ...defaultMeta,
      ...pieceSpecificMeta,
    });
  }
}
