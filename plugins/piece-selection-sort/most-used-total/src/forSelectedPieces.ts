import { UserSelection, PlayerId } from "@roster-lock/types";

// Only walks each pieceType's top-level picks (not the recursive `required`
// sub-selections nested inside a SelectedPiece) - sortPieces ranks exactly one
// pieceType at a time, and a piece's own internal composition is a separate
// concern from how often the piece itself gets picked.
export function forSelectedPieces(
  userSelections: Record<PlayerId, UserSelection>,
  userIds: Array<PlayerId>,
  callback: (pieceType: string, pieceId: string) => void,
){
  for(const userId of userIds){
    const selection = userSelections[userId];
    if(!selection) continue;
    for(const [pieceType, pieces] of Object.entries(selection)){
      for(const piece of pieces) callback(pieceType, piece.id);
    }
  }
}
