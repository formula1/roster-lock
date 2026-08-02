import { useState } from "react";
import { RosterLockV1Config } from "@roster-lock/types";
import { PieceTypePlan } from "../../game/selection";
import { pieceVersionKey } from "../../game/pieceAssets";
import { downloadPieceTree } from "../../game/downloadPieceTree";
import { useDownloadedPieces } from "../../hooks/useDownloadedPieces";
import { usePieceMedia } from "../../hooks/usePieceMedia";
import { useGameSession } from "../../context/GameSessionContext";
import { PieceCard, DownloadState } from "./PieceCard";
import selectBongoUrl from "../../../assets/select-bongo.mp3";

export function PieceTypeSection({
  rosterConfig,
  pieceType,
  plan,
  selected,
  onChange,
  overridesByPiece,
  onOverridesChange,
}: {
  rosterConfig: RosterLockV1Config;
  pieceType: string;
  plan: Extract<PieceTypePlan, { kind: "pickable" }>;
  selected: Array<string>;
  onChange: (ids: Array<string>) => void;
  overridesByPiece: Record<string, Array<string>>;
  onOverridesChange: (pieceId: string, hashes: Array<string>) => void;
}) {
  const { matchAgent } = useGameSession();
  const pieces = (rosterConfig.rosters[pieceType] ?? []).filter((p) => !plan.banList.includes(p.id));
  const { downloaded, refresh } = useDownloadedPieces(rosterConfig, pieceType);
  const downloadedPieces = pieces.filter((p) => downloaded.has(pieceVersionKey(p)));
  const { portraitUrlFor } = usePieceMedia(rosterConfig.engine, pieceType, downloadedPieces);
  const [downloadStates, setDownloadStates] = useState<Record<string, DownloadState>>({});

  function toggle(pieceId: string) {
    if (selected.includes(pieceId)) {
      onChange(selected.filter((id) => id !== pieceId));
      if ((overridesByPiece[pieceId] ?? []).length > 0) onOverridesChange(pieceId, []);
      return;
    }
    if (selected.length >= plan.max) return;
    onChange([...selected, pieceId]);
    new Audio(selectBongoUrl).play().catch(() => {});
    setDownloadStates((prev) => ({ ...prev, [pieceId]: "downloading" }));
    downloadPieceTree(rosterConfig, pieceType, pieceId, matchAgent)
      .then(() => {
        setDownloadStates((prev) => ({ ...prev, [pieceId]: "done" }));
        refresh();
      })
      .catch(() => {
        setDownloadStates((prev) => ({ ...prev, [pieceId]: "error" }));
      });
  }

  function toggleOverride(pieceId: string, hash: string) {
    const current = overridesByPiece[pieceId] ?? [];
    onOverridesChange(
      pieceId,
      current.includes(hash) ? current.filter((h) => h !== hash) : [...current, hash],
    );
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
        {pieces.map((piece) => {
          const availableOverrides = Object.entries(
            rosterConfig.mediaOverrides?.[pieceType]?.[piece.version.logic] ?? {},
          ).map(([hash, entry]) => ({ hash, name: entry.name }));
          return (
            <PieceCard
              key={piece.id}
              piece={piece}
              portraitUrl={portraitUrlFor(piece.id)}
              isDownloaded={downloaded.has(pieceVersionKey(piece))}
              downloadState={downloadStates[piece.id] ?? "idle"}
              selected={selected.includes(piece.id)}
              disabled={selected.length >= plan.max}
              onToggle={() => toggle(piece.id)}
              availableOverrides={availableOverrides}
              selectedOverrideHashes={overridesByPiece[piece.id] ?? []}
              onToggleOverride={(hash) => toggleOverride(piece.id, hash)}
            />
          );
        })}
      </div>
    </div>
  );
}
