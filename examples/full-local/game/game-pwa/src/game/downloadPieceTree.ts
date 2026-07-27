import { ensurePieceDownloaded } from "@roster-lock/ts-client";
import { RosterLockV1Config } from "@roster-lock/types";
import { MatchAgentConnection } from "../context/GameSessionContext";

// Same traversal as resolvePiece (selection.ts) - walks a chosen piece's
// `requires` tree and pre-fetches every piece in it. Sub-piece downloads
// (moves, weather, ...) stay fire-and-forget - the download progress screen's
// sync-dl call is the real source of truth for whether pieces are ready, this
// is just a head start. The chosen piece itself is returned as a promise so
// the caller (the thing that knows the user just explicitly picked it) can
// react once it's actually available - e.g. to refresh a "what's downloaded"
// view - without this function needing to know about that.
export function downloadPieceTree(
  rosterConfig: RosterLockV1Config,
  pieceType: string,
  pieceId: string,
  matchAgent: MatchAgentConnection,
): Promise<void> {
  const definition = rosterConfig.engine.pieceDefinitions[pieceType];
  const piece = rosterConfig.rosters[pieceType]?.find((p) => p.id === pieceId);
  if (!definition || !piece) return Promise.resolve();

  const download = ensurePieceDownloaded(
    { version: 1, engine: rosterConfig.engine, pieceType, piece },
    matchAgent.authCode,
    matchAgent.url,
  ).then(() => {});

  for (const requirePieceType of definition.requires) {
    const requireDef = piece.requiredPieces[requirePieceType];
    if (!requireDef) continue;
    for (const expectedId of requireDef.expected) {
      downloadPieceTree(rosterConfig, requirePieceType, expectedId, matchAgent).catch(() => {});
    }
  }

  return download;
}
