import { RosterLockPiece } from "@roster-lock/types";

export type DownloadState = "idle" | "downloading" | "done" | "error";

// "error" here means the Select screen's best-effort head start download
// didn't finish - it's not authoritative (the Download screen's sync-dl step
// is, and reliably retries), so this intentionally doesn't read as broken or
// suggest an action: re-clicking the card deselects it, it doesn't retry.
function statusLabel(isDownloaded: boolean, downloadState: DownloadState): string {
  if (downloadState === "downloading") return "Downloading...";
  if (downloadState === "error") return "Not downloaded yet";
  return isDownloaded ? "Downloaded" : "Not downloaded";
}

export type AvailableOverride = { hash: string; name: string };

export function PieceCard({
  piece,
  portraitUrl,
  isDownloaded,
  downloadState,
  selected,
  disabled,
  onToggle,
  availableOverrides,
  selectedOverrideHashes,
  onToggleOverride,
}: {
  piece: RosterLockPiece;
  portraitUrl: string | null;
  isDownloaded: boolean;
  downloadState: DownloadState;
  selected: boolean;
  disabled: boolean;
  onToggle: () => void;
  availableOverrides: Array<AvailableOverride>;
  selectedOverrideHashes: Array<string>;
  onToggleOverride: (hash: string) => void;
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
        <div className="placeholder">
          {downloadState === "downloading" ? (
            <span className="spinner" />
          ) : (
            isDownloaded ? "\u{1F5BC}" : "⬇"
          )}
        </div>
      )}
      <div className="name">{piece.humanInfo.name}</div>
      <div className={`download-status ${downloadState}`}>{statusLabel(isDownloaded, downloadState)}</div>
      {selected && availableOverrides.length > 0 && (
        <div className="piece-overrides" onClick={(e) => e.stopPropagation()}>
          {availableOverrides.map((override) => (
            <label key={override.hash} className="piece-override">
              <input
                type="checkbox"
                checked={selectedOverrideHashes.includes(override.hash)}
                onChange={() => onToggleOverride(override.hash)}
              />
              {override.name}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
