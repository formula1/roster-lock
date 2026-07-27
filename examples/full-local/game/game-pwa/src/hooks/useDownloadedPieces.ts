import { listDownloadedPiecesFromConfig } from "@roster-lock/ts-client";
import { RosterLockV1Config } from "@roster-lock/types";
import { useGameSession } from "../context/GameSessionContext";
import { usePromisedMemo } from "../utils/promised-memo";

const EMPTY: ReadonlySet<string> = new Set();

// Fetches which pieces of a given type the match agent already has fully
// downloaded, keyed by "logicHash:mediaHash" so callers can check a specific
// RosterLockPiece's status with pieceVersionKey(). There's no push channel
// for "a download finished", so callers that trigger one should call the
// returned `refresh()` once it resolves, instead of this polling on a timer.
export function useDownloadedPieces(rosterConfig: RosterLockV1Config, pieceType: string) {
  const { matchAgent } = useGameSession();

  const result = usePromisedMemo(async () => {
    if (!matchAgent) return EMPTY;
    const items = await listDownloadedPiecesFromConfig(
      { version: 1, rosterConfig, pieceType },
      { page: 1, limit: 200 },
      matchAgent.authCode,
      matchAgent.url,
    );
    return new Set(items.map((i) => `${i.version.logic}:${i.version.media}`));
  }, [matchAgent, rosterConfig, pieceType]);

  const downloaded = result.status === "success" ? result.value : (result.previous ?? EMPTY);
  return { downloaded, refresh: result.refresh };
}
