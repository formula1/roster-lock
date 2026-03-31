import { RosterLockV1Config, cloneJSON, PieceType } from "@match-lock/shared";

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
