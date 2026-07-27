import { RosterLockPiece } from "@roster-lock/types";

export function pieceVersionKey(piece: RosterLockPiece): string {
  return `${piece.version.logic}:${piece.version.media}`;
}
