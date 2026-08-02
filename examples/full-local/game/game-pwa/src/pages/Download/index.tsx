import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { syncDownloadOverWebSocket, getMachines } from "@roster-lock/ts-client";
import {
  ROSTERLOCK_DOWNLOAD_STATE,
  RosterLockDownloadUpdate,
  RosterLockV1SyncDLRequestUserToClient,
} from "@roster-lock/types";
import { useGameSession } from "../../context/GameSessionContext";
import { describeError, humanizeServerMessage } from "../../utils/describeError";

type PieceProgress = { pieceType: string; status: ROSTERLOCK_DOWNLOAD_STATE; progress: number; error?: string };

// Media-override download events (ROSTERLOCK_DOWNLOAD_STATE.mediaOverrideDownload*)
// carry {logic, override} instead of a piece's {pieceVersions: {logic, media}} -
// an override isn't itself a piece, so it has no media/docs hashes of its own.
function isMediaOverrideUpdate(
  update: RosterLockDownloadUpdate,
): update is Extract<RosterLockDownloadUpdate, { logic: string; override: string }> {
  return "override" in update;
}

function applyUpdate(
  prev: Record<string, PieceProgress>,
  update: RosterLockDownloadUpdate,
): Record<string, PieceProgress> {
  if (
    update.type === ROSTERLOCK_DOWNLOAD_STATE.downloadAllComplete ||
    update.type === ROSTERLOCK_DOWNLOAD_STATE.downloadFullFailure
  ) {
    return prev;
  }

  if (isMediaOverrideUpdate(update)) {
    const key = `${update.pieceType}:override:${update.logic}:${update.override}`;
    const existing = prev[key];
    const progress =
      update.type === ROSTERLOCK_DOWNLOAD_STATE.mediaOverrideDownloadProgress
        ? update.progress
        : update.type === ROSTERLOCK_DOWNLOAD_STATE.mediaOverrideDownloadFinished
          ? 100
          : (existing?.progress ?? 0);

    return {
      ...prev,
      [key]: {
        pieceType: `${update.pieceType} (skin)`,
        status: update.type,
        progress,
        error: update.type === ROSTERLOCK_DOWNLOAD_STATE.mediaOverrideDownloadFailure ? update.error : undefined,
      },
    };
  }

  const key = `${update.pieceType}:${update.pieceVersions.logic}:${update.pieceVersions.media}`;
  const existing = prev[key];
  const progress =
    update.type === ROSTERLOCK_DOWNLOAD_STATE.downloadProgress
      ? update.progress
      : update.type === ROSTERLOCK_DOWNLOAD_STATE.downloadFinished
        ? 100
        : (existing?.progress ?? 0);

  return {
    ...prev,
    [key]: {
      pieceType: update.pieceType,
      status: update.type,
      progress,
      error: update.type === ROSTERLOCK_DOWNLOAD_STATE.downloadFailure ? update.error : undefined,
    },
  };
}

export function DownloadScreen() {
  const navigate = useNavigate();
  const { matchAgent, user, rosterConfig, selection, match, setDownloadResult } = useGameSession();
  const [roomState, setRoomState] = useState<string | null>(null);
  const [pieces, setPieces] = useState<Record<string, PieceProgress>>({});
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    if (!user || !rosterConfig || !selection || !match) return;
    started.current = true;

    const request: RosterLockV1SyncDLRequestUserToClient = {
      version: 1,
      relay: { url: match.url, roomId: match.roomId },
      machine: { machineId: user.machineId, keys: user.keys },
      rosterConfig,
      playerSelections: { 0: selection },
    };

    Promise.all([
      getMachines({ machine: request.machine, relay: request.relay }),
      syncDownloadOverWebSocket(
        request,
        matchAgent.authCode,
        {
          onState: (state) => setRoomState(state),
          onDownloadProgress: (update) => {
            if (update.type === ROSTERLOCK_DOWNLOAD_STATE.downloadFullFailure) {
              setError(humanizeServerMessage(update.error));
              return;
            }
            setPieces((prev) => applyUpdate(prev, update));
          },
        },
        matchAgent.url,
      ),
    ])
      .then(([users, downloadResult]) => {
        setDownloadResult(downloadResult, users);
        navigate("/game");
      })
      .catch((err) => {
        setError(describeError(err, "Downloading pieces failed."));
      });
  }, [matchAgent, user, rosterConfig, selection, match, setDownloadResult, navigate]);

  const pieceEntries = Object.entries(pieces);
  const overall = pieceEntries.length
    ? pieceEntries.reduce((sum, [, p]) => sum + p.progress, 0) / pieceEntries.length
    : 0;

  return (
    <div>
      <h1>Downloading Pieces</h1>
      {error && <div className="banner">{error}</div>}
      <p className="status">{roomState ?? "Connecting..."}</p>

      <div className="progress-bar">
        <div className="progress-fill" style={{ width: `${overall}%` }} />
      </div>

      {pieceEntries.map(([key, p]) => (
        <div className="download-row" key={key}>
          <div className="row-label">
            <span>{p.pieceType}</span>
            <span>
              {p.status}
              {p.error ? `: ${humanizeServerMessage(p.error)}` : ""}
            </span>
          </div>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${p.progress}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}
