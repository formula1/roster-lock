import { RosterLockPiece } from "@roster-lock/types";

export function PieceCard({
  piece,
  portraitUrl,
  isDownloaded,
  selected,
  disabled,
  onToggle,
}: {
  piece: RosterLockPiece;
  portraitUrl: string | null;
  isDownloaded: boolean;
  selected: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className={`piece-card ${selected ? "selected" : ""} ${disabled && !selected ? "disabled" : ""}`}
      onClick={() => {
        if (!disabled || selected) onToggle();
      }}
    >
      {portraitUrl ? (
        <img src={portraitUrl} alt={piece.humanInfo.name} />
      ) : (
        <div className="placeholder">{isDownloaded ? "\u{1F5BC}" : "⬇"}</div>
      )}
      <div className="name">{piece.humanInfo.name}</div>
      <div className="download-status">{isDownloaded ? "Downloaded" : "Not downloaded"}</div>
    </div>
  );
}
