import { useEffect, useState } from "react";
import { RosterLockV1Config } from "@roster-lock/types";
import { PieceTypePlan } from "./selectionPlan";
import { PieceCard } from "./PieceCard";
import { InputSource } from "../../context/JoinSettingsContext";
import { useCursorInput } from "../../hooks/useCursorInput";
import { listDownloadedPiecesFromConfig } from "@roster-lock/ts-client";

export function PieceTypeSection({
  rosterConfig, pieceType, plan, picks, onTogglePick, inputSource, matchAgentUrl, matchAgentAuth,
}: {
  rosterConfig: RosterLockV1Config,
  pieceType: string,
  plan: Extract<PieceTypePlan, { kind: "pickable" }>,
  picks: Array<string>,
  onTogglePick: (pieceId: string) => void,
  inputSource: InputSource,
  matchAgentUrl: string,
  matchAgentAuth: string,
}) {
  const pieces = (rosterConfig.rosters[pieceType] ?? []).filter((p) => !plan.banList.includes(p.id));
  const [downloaded, setDownloaded] = useState<Record<string, boolean>>({});
  const [cursorIndex, setCursorIndex] = useState(0);

  useEffect(() => {
    let cancelled = false;
    listDownloadedPiecesFromConfig(
      { version: 1, rosterConfig, pieceType }, { page: 0, limit: 500 }, matchAgentAuth, matchAgentUrl
    ).then((rows) => {
      if (cancelled) return;
      const byLogic = new Set(rows.map((r) => r.version.logic));
      const next: Record<string, boolean> = {};
      for (const piece of pieces) next[piece.id] = byLogic.has(piece.version.logic);
      setDownloaded(next);
    }).catch(() => {});
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pieceType]);

  const atMax = picks.length >= plan.max;
  const move = (delta: number) => setCursorIndex((i) => (i + delta + pieces.length) % Math.max(pieces.length, 1));
  const confirm = () => {
    const piece = pieces[cursorIndex];
    if (piece) onTogglePick(piece.id);
  };
  useCursorInput(inputSource, pieces.length > 0, move, confirm);

  const countLabel = plan.min === plan.max
    ? `pick exactly ${plan.min}`
    : plan.max === Number.POSITIVE_INFINITY
      ? `pick ${plan.min}-any`
      : `pick ${plan.min}-${plan.max}`;

  return (
    <div className="piece-type-section">
      <div className="piece-type-header">
        <span className="piece-type-name">{pieceType}</span>
        <span className="piece-type-count">{countLabel} ({picks.length} picked)</span>
      </div>
      <div className="card-grid">
        {pieces.map((piece, index) => (
          <PieceCard
            key={piece.id}
            piece={piece}
            selected={picks.includes(piece.id)}
            downloaded={downloaded[piece.id]}
            cursored={index === cursorIndex}
            disabled={atMax}
            onClick={() => onTogglePick(piece.id)}
          />
        ))}
      </div>
    </div>
  );
}
