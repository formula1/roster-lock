import { RosterLockPiece } from "@roster-lock/types";
import { usePiecePreview, previewImage } from "../../hooks/usePiecePreview";

// The one large preview beside the grid, for whichever piece is hovered or
// under a player's cursor. Three images can answer for a piece, and they're
// not equally good:
//
//   1. the game launcher's own preview, read out of the piece's downloaded
//      assets (Ikemen's 9000,1 select portrait, say) - the real thing,
//   2. humanInfo.image, the roster author's thumbnail baked into the lock
//      file - always available, but only as good as the author made it,
//   3. the launcher's generic engine placeholder, which is all it can offer
//      for a piece that isn't downloaded yet.
//
// Both (1) and (3) arrive as one PiecePreview; `source` is what separates
// them, and it's the reason a not-yet-downloaded piece still shows its own
// author thumbnail here instead of the same silhouette as everything else.
export function PiecePreviewPanel({ piece, pieceType }: {
  piece: RosterLockPiece | null,
  pieceType: string,
}) {
  // priority: this is answering a piece the player is pointing at right now,
  // so it jumps ahead of the card thumbnails queued behind it.
  const preview = usePiecePreview({ pieceType, piece, priority: true });

  if (!piece) return null;

  const launcherImage = preview.status === "ready" ? previewImage(preview.preview) : undefined;
  const image = (preview.status === "ready" && preview.source === "piece" && launcherImage)
    || piece.humanInfo.image
    || launcherImage;

  return (
    <div className="piece-preview-panel">
      <div className="piece-preview-frame">
        {image ? (
          <img className="piece-preview-image" src={image} alt={piece.humanInfo.name} />
        ) : preview.status === "loading" ? (
          <span className="piece-preview-loading">Loading preview…</span>
        ) : (
          <span className="piece-preview-placeholder">No preview</span>
        )}
      </div>
      <div className="piece-preview-name">{piece.humanInfo.name}</div>
      {piece.humanInfo.author && <div className="piece-preview-author">by {piece.humanInfo.author}</div>}
    </div>
  );
}
