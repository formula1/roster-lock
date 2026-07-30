import { RosterLockV1Config, PieceId, LogicId, PieceType } from "@roster-lock/types";

// Stats are keyed by LogicId (the piece's real identity - a logic update makes
// it a "wholly new" piece) but SelectedPiece only carries a PieceId, so callers
// need this to translate what a user picked into what to record.
export function buildPieceIdToLogicId(
  lockConfig: RosterLockV1Config, pieceType: PieceType
): Record<PieceId, LogicId> {
  const pieces = lockConfig.rosters[pieceType] ?? [];
  const map: Record<PieceId, LogicId> = {};
  for(const piece of pieces) map[piece.id] = piece.version.logic;
  return map;
}
