import { RosterLockV1Config } from "@roster-lock/types";
import { PieceTypePlan } from "../../game/selection";
import { pieceVersionKey } from "../../game/pieceAssets";
import { downloadPieceTree } from "../../game/downloadPieceTree";
import { useDownloadedPieces } from "../../hooks/useDownloadedPieces";
import { usePieceMedia } from "../../hooks/usePieceMedia";
import { useGameSession } from "../../context/GameSessionContext";
import { PieceCard } from "./PieceCard";
import selectBongoUrl from "../../../assets/select-bongo.mp3";

export function PieceTypeSection({
  rosterConfig,
  pieceType,
  plan,
  selected,
  onChange,
}: {
  rosterConfig: RosterLockV1Config;
  pieceType: string;
  plan: Extract<PieceTypePlan, { kind: "pickable" }>;
  selected: Array<string>;
  onChange: (ids: Array<string>) => void;
}) {
  const { matchAgent } = useGameSession();
  const pieces = (rosterConfig.rosters[pieceType] ?? []).filter((p) => !plan.banList.includes(p.id));
  const { downloaded, refresh } = useDownloadedPieces(rosterConfig, pieceType);
  const downloadedPieces = pieces.filter((p) => downloaded.has(pieceVersionKey(p)));
  const { portraitUrlFor } = usePieceMedia(rosterConfig.engine, pieceType, downloadedPieces);

  function toggle(pieceId: string) {
    if (selected.includes(pieceId)) {
      onChange(selected.filter((id) => id !== pieceId));
      return;
    }
    if (selected.length >= plan.max) return;
    onChange([...selected, pieceId]);
    new Audio(selectBongoUrl).play().catch(() => {});
    if (matchAgent) downloadPieceTree(rosterConfig, pieceType, pieceId, matchAgent).then(refresh).catch(() => {});
  }

  const countLabel =
    plan.min === plan.max
      ? `pick exactly ${plan.min}`
      : `pick ${plan.min}-${plan.max === Number.POSITIVE_INFINITY ? "any" : plan.max}`;

  return (
    <div className="piece-type-section">
      <h3>
        {pieceType} <span style={{ opacity: 0.6, fontWeight: "normal" }}>({countLabel})</span>
      </h3>
      <div className="card-grid">
        {pieces.map((piece) => (
          <PieceCard
            key={piece.id}
            piece={piece}
            portraitUrl={portraitUrlFor(piece.id)}
            isDownloaded={downloaded.has(pieceVersionKey(piece))}
            selected={selected.includes(piece.id)}
            disabled={selected.length >= plan.max}
            onToggle={() => toggle(piece.id)}
          />
        ))}
      </div>
    </div>
  );
}
