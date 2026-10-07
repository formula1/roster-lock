import { RosterLockPiece } from "@roster-lock/types";
import { useInView } from "../../hooks/useInView";
import { usePiecePreview, previewImage } from "../../hooks/usePiecePreview";

export function PieceCard({
  piece, pieceType, selected, orderNumber, downloaded, cursored, disabled, onClick, onHoverChange,
}: {
  piece: RosterLockPiece,
  pieceType: string,
  selected: boolean,
  orderNumber: number | undefined,
  downloaded: boolean | undefined,
  cursored: boolean,
  disabled: boolean,
  onClick: () => void,
  onHoverChange?: (hovering: boolean) => void,
}) {
  const [inViewRef, inView] = useInView<HTMLButtonElement>();

  // Only a downloaded piece has assets for the game launcher to read a real
  // portrait out of. Asking about an undownloaded one gets the plugin's
  // generic engine placeholder instead (source "default"), which across a
  // whole grid would paint every unowned piece with the same silhouette and
  // hide the roster author's own thumbnails - so those cards don't ask, and
  // the ones that do ignore a "default" answer. Gated on inView as well:
  // each answer costs match-agent a sprite decode, and a several-hundred
  // piece roster shouldn't pay for the rows nobody has scrolled to.
  const preview = usePiecePreview({ pieceType, piece, enabled: inView && downloaded === true });
  const launcherImage = preview.status === "ready" && preview.source === "piece"
    ? previewImage(preview.preview)
    : undefined;
  const image = launcherImage ?? piece.humanInfo.image;

  return (
    <button
      ref={inViewRef}
      type="button"
      className="piece-card"
      onClick={onClick}
      onMouseEnter={() => onHoverChange?.(true)}
      onMouseLeave={() => onHoverChange?.(false)}
      disabled={disabled && !selected}
      data-selected={selected}
      data-cursored={cursored}
      title={piece.humanInfo.author ? `by ${piece.humanInfo.author}` : undefined}
    >
      <div className="piece-card-image">
        {orderNumber !== undefined && <span className="piece-card-order-badge">{orderNumber}</span>}
        {image ? (
          <img src={image} alt={piece.humanInfo.name} />
        ) : (
          <span className="piece-card-placeholder">{piece.humanInfo.name.slice(0, 1).toUpperCase()}</span>
        )}
      </div>
      <div className="piece-card-name">{piece.humanInfo.name}</div>
      <div className="piece-card-status" data-downloaded={downloaded === undefined ? "unknown" : downloaded}>
        {downloaded === undefined ? "" : downloaded ? "Downloaded" : "Not downloaded"}
      </div>
    </button>
  );
}
