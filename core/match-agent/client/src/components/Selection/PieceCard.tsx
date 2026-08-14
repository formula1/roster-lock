import { RosterLockPiece } from "@roster-lock/types";

export function PieceCard({ piece, selected, downloaded, cursored, disabled, onClick }: {
  piece: RosterLockPiece,
  selected: boolean,
  downloaded: boolean | undefined,
  cursored: boolean,
  disabled: boolean,
  onClick: () => void,
}) {
  return (
    <button
      type="button"
      className="piece-card"
      onClick={onClick}
      disabled={disabled && !selected}
      data-selected={selected}
      data-cursored={cursored}
      title={piece.humanInfo.author ? `by ${piece.humanInfo.author}` : undefined}
    >
      <div className="piece-card-image">
        {piece.humanInfo.image ? (
          <img src={piece.humanInfo.image} alt={piece.humanInfo.name} />
        ) : (
          <span className="piece-card-placeholder">{piece.humanInfo.name.slice(0, 1).toUpperCase()}</span>
        )}
      </div>
      <div className="piece-card-name">{piece.humanInfo.name}</div>
      <div className="piece-card-status">
        {downloaded === undefined ? "" : downloaded ? "Downloaded" : "Not downloaded"}
      </div>
    </button>
  );
}
