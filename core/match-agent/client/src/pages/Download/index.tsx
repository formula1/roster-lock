import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { syncDownloadOverWebSocket, getMachines } from "@roster-lock/ts-client";
import {
  ROSTERLOCK_DOWNLOAD_STATE, RosterLockDownloadUpdate, RosterLockV1SyncDLRequestUserToClient,
  RosterLockV1SyncDLResult,
} from "@roster-lock/types";
import { useIdentity } from "../../context/IdentityContext";
import { useMatchAgent } from "../../context/MatchAgentContext";
import { useDownloadSession } from "../../context/DownloadSessionContext";
import { startGameRunner } from "../../api/matchAgent";

type PieceProgress = { pieceType: string, status: ROSTERLOCK_DOWNLOAD_STATE, progress: number, error?: string };
type MachineRow = { machineId: string, publicKey: string, displayName: string, playerCount: number, connected: boolean };

// Reused by every matchmaking algorithm, not just /match-making/rooms - once
// a match maker hands off a relay room, this is the only step left before
// starting the game, regardless of how the room/opponent was found. See
// examples/full-local/game/game-pwa/src/pages/Download/index.tsx, which this
// is ported from, generalized from "one machine's own piece progress" to
// also list which machines in the room are connected.
export function DownloadPage() {
  const navigate = useNavigate();
  const identity = useIdentity();
  const matchAgent = useMatchAgent();
  const { session, clearSession } = useDownloadSession();

  const [machines, setMachines] = useState<Array<MachineRow>>([]);
  const [downloadResult, setDownloadResult] = useState<RosterLockV1SyncDLResult | null>(null);
  const [roomState, setRoomState] = useState<string | null>(null);
  const [pieces, setPieces] = useState<Record<string, PieceProgress>>({});
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const startedDownload = useRef(false);
  const startedGame = useRef(false);

  useEffect(() => {
    if (session) return;
    navigate("/match-making");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (startedDownload.current) return;
    if (!session) return;
    startedDownload.current = true;

    const request: RosterLockV1SyncDLRequestUserToClient = {
      version: 1,
      relay: session.relay,
      machine: { machineId: identity.machineId, keys: identity.keys },
      rosterConfig: session.rosterConfig,
      playerSelections: session.playerSelections,
    };

    Promise.all([
      getMachines({ machine: request.machine, relay: request.relay })
        .catch((e) => { throw new Error(`getMachines (relay ${request.relay.url}) failed: ${(e as Error).message}`); }),
      syncDownloadOverWebSocket(
        request,
        matchAgent.settings.authCode,
        {
          onState: (state) => setRoomState(state),
          onDownloadProgress: (update: RosterLockDownloadUpdate) => {
            if (update.type === ROSTERLOCK_DOWNLOAD_STATE.downloadFullFailure) {
              setError(update.error);
              return;
            }
            if (update.type === ROSTERLOCK_DOWNLOAD_STATE.downloadAllComplete) return;
            const key = `${update.pieceType}:${update.pieceVersions.logic}:${update.pieceVersions.media}`;
            setPieces((prev) => {
              const existing = prev[key];
              const progress = update.type === ROSTERLOCK_DOWNLOAD_STATE.downloadProgress
                ? update.progress
                : update.type === ROSTERLOCK_DOWNLOAD_STATE.downloadFinished ? 100 : (existing?.progress ?? 0);
              return {
                ...prev,
                [key]: {
                  pieceType: update.pieceType,
                  status: update.type,
                  progress,
                  error: update.type === ROSTERLOCK_DOWNLOAD_STATE.downloadFailure ? update.error : undefined,
                },
              };
            });
          },
        },
        matchAgent.settings.url,
      ).catch((e) => { throw new Error(`syncDownloadOverWebSocket (match-agent ${matchAgent.settings.url}) failed: ${(e as Error).message}`); }),
    ])
      .then(([users, result]) => {
        setMachines(users.map((u) => ({
          machineId: u.machineId, publicKey: u.publicKey, displayName: u.displayName,
          playerCount: u.playerCount, connected: u.connected,
        })));
        setDownloadResult(result);
      })
      .catch((e) => setError((e as Error).message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  const pieceEntries = Object.entries(pieces);
  const overall = pieceEntries.length
    ? pieceEntries.reduce((sum, [, p]) => sum + p.progress, 0) / pieceEntries.length
    : 0;
  const downloadComplete = pieceEntries.length > 0 && pieceEntries.every(([, p]) => p.progress >= 100);

  // Starts automatically as soon as the download finishes - no separate
  // "Start Match" click needed. Guarded so it only ever attempts once, same
  // as the download-kickoff effect above.
  useEffect(() => {
    if (startedGame.current) return;
    if (!session || !downloadComplete || !downloadResult) return;
    startedGame.current = true;

    if (!session.coordinator) {
      setError(`No rendezvous coordinator available for "${session.gameRunnerPlugin}" - the matchmaker didn't provide one`);
      return;
    }
    setStarting(true);
    setError(null);

    const connectionConfig = session.isHost
      ? { type: "direct-tcp" as const, party: "host" as const, port: 7000, coordinator: session.coordinator }
      : { type: "direct-tcp" as const, party: "client" as const, port: 7000, coordinator: session.coordinator };

    startGameRunner(matchAgent.settings.url, matchAgent.settings.authCode, session.gameRunnerPlugin, {
      connectionConfig,
      currentMachine: { machineId: identity.machineId, publicKey: identity.keys.publicKey, privateKey: identity.keys.privateKey },
      allMachines: machines,
      selectionResult: downloadResult,
      rosterConfig: session.rosterConfig,
      gameConfig: session.gameConfig,
      relayRoomId: session.relay.roomId,
    })
      .then(() => {
        clearSession();
        navigate("/game");
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setStarting(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, downloadComplete, downloadResult]);

  if (!session) return null;

  return (
    <div className="page">
      <h1>Downloading</h1>
      {error && <p className="error">{error}</p>}
      <p>{roomState ?? "Connecting..."}</p>

      <h2>Players</h2>
      <ul>
        {machines.map((m) => (
          <li key={m.machineId}>{m.displayName} - {m.connected ? "Connected" : "Not connected"} - Selected</li>
        ))}
      </ul>

      <div className="progress-bar"><div className="progress-fill" style={{ width: `${overall}%` }} /></div>
      {pieceEntries.map(([key, p]) => (
        <div className="download-row" key={key}>
          <div>{p.pieceType}: {p.status}{p.error ? ` - ${p.error}` : ""}</div>
          <div className="progress-bar"><div className="progress-fill" style={{ width: `${p.progress}%` }} /></div>
        </div>
      ))}

      {downloadComplete && (
        <div className="start-game">
          <h2>{starting ? "Starting..." : "Ready to start"}</h2>
        </div>
      )}
    </div>
  );
}
