import { useEffect, useRef, useState } from "react";
import { RosterLockPiece, RosterLockV1Config } from "@roster-lock/types";
import { getPieceFileBlob } from "../game/pieceFiles";
import { useGameSession } from "../context/GameSessionContext";

const PORTRAIT_FILE = "portrait.svg";

type PieceMedia = { portraitUrl: string | null };
const NO_MEDIA: PieceMedia = { portraitUrl: null };

// Loads the portrait for pieces that are already downloaded. This never
// triggers a download itself - callers pass only the pieces they know are
// present on the match agent (see useDownloadedPieces); a piece only gets
// downloaded when the user explicitly picks it (PieceTypeSection's toggle ->
// downloadPieceTree). "portrait.svg" is a fixed file name in this game's
// engine (see getPieceFileBlob), not something to look up per piece.
export function usePieceMedia(
  engine: RosterLockV1Config["engine"],
  pieceType: string,
  downloadedPieces: Array<RosterLockPiece>,
) {
  const { matchAgent } = useGameSession();
  const [media, setMedia] = useState<Record<string, PieceMedia>>({});
  const started = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!matchAgent) return;

    for (const piece of downloadedPieces) {
      if (started.current.has(piece.id)) continue;
      started.current.add(piece.id);

      const info = { version: 1 as const, engine, pieceType, piece };
      getPieceFileBlob({ ...info, filePath: PORTRAIT_FILE }, matchAgent.authCode, matchAgent.url)
        .catch(() => null)
        .then((portraitUrl) => {
          if (!portraitUrl) return;
          setMedia((prev) => ({ ...prev, [piece.id]: { portraitUrl } }));
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchAgent, engine, pieceType, downloadedPieces]);

  function portraitUrlFor(pieceId: string): string | null {
    return (media[pieceId] ?? NO_MEDIA).portraitUrl;
  }

  return { portraitUrlFor };
}
