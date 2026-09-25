import { useEffect, useState } from "react";
import { PiecePreview, RosterLockV1Config, RosterLockPiece } from "@roster-lock/types";
import { getGameLauncherPreview } from "../api/matchAgent";

// Module-level (not per-component) so repeated hovers of the same piece
// across renders/remounts don't refetch, and concurrent hovers of the same
// piece dedupe onto one in-flight request. A resolved `null` (piece not
// downloaded and the plugin has no useDefaultPreview, unsupported sprite
// format, no getPreview at all, ...) is cached too - same shape as a real
// preview, just falsy - so a piece that can't produce one doesn't get
// re-queried on every hover.
const previewCache = new Map<string, Promise<PiecePreview | null>>();

function cacheKey(pluginName: string, pieceType: string, piece: Pick<RosterLockPiece, "version">): string {
  return `${pluginName}\x00${pieceType}\x00${piece.version.logic}\x00${piece.version.media}`;
}

// activePiece is null when nothing is currently hovered/cursored - the hook
// then reports null without making any request.
export function usePiecePreview(args: {
  pluginName: string,
  engine: RosterLockV1Config["engine"],
  pieceType: string,
  piece: Pick<RosterLockPiece, "version" | "pathVariables"> | null,
  matchAgentUrl: string,
  matchAgentAuth: string,
}): PiecePreview | "loading" | null {
  const { pluginName, engine, pieceType, piece, matchAgentUrl, matchAgentAuth } = args;
  const [preview, setPreview] = useState<PiecePreview | "loading" | null>(null);

  useEffect(() => {
    if (!piece) {
      setPreview(null);
      return;
    }
    const key = cacheKey(pluginName, pieceType, piece);
    let cached = previewCache.get(key);
    if (!cached) {
      cached = getGameLauncherPreview(matchAgentUrl, matchAgentAuth, pluginName, engine, pieceType, piece)
        .catch(() => null);
      previewCache.set(key, cached);
    }

    let cancelled = false;
    setPreview("loading");
    cached.then((result) => {
      if (!cancelled) setPreview(result);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pluginName, pieceType, piece?.version.logic, piece?.version.media]);

  return preview;
}
