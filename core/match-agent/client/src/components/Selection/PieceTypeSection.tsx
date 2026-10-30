import { useEffect, useMemo, useRef, useState } from "react";
import { RosterLockV1Config } from "@roster-lock/types";
import { PieceTypePlan } from "./selectionPlan";
import { PieceCard } from "./PieceCard";
import { PiecePreviewPanel } from "./PiecePreviewPanel";
import { InputSource } from "../../context/JoinSettingsContext";
import { useCursorInput } from "../../hooks/useCursorInput";
import { useGridColumns } from "../../hooks/useGridColumns";
import { useDownloadedPieceVersions } from "../../hooks/useDownloadedPieceVersions";

// Rosters here run from a handful of pieces (a curated tournament lock) to
// several hundred (a full MUGEN-style collection), and one fixed card size
// serves neither end: large cards turn a 300-piece roster into an endless
// scroll, small ones leave a 6-piece roster as a row of stamps in a mostly
// empty panel. Density scales the cards off how many there are (the actual
// sizes live in global.css, keyed off data-density) and only the crowded
// tiers pay for a filter box and a height-capped scrolling grid.
const COZY_MAX_PIECES = 12;
const COMFY_MAX_PIECES = 60;
const FILTER_MIN_PIECES = 24;

type Density = "cozy" | "comfy" | "dense";

function densityFor(pieceCount: number): Density {
  if (pieceCount <= COZY_MAX_PIECES) return "cozy";
  if (pieceCount <= COMFY_MAX_PIECES) return "comfy";
  return "dense";
}

export function PieceTypeSection({
  rosterConfig, pieceType, plan, picks, onTogglePick, onReorderPick, inputSource,
}: {
  rosterConfig: RosterLockV1Config,
  pieceType: string,
  plan: Extract<PieceTypePlan, { kind: "pickable" }>,
  picks: Array<string>,
  onTogglePick: (pieceId: string) => void,
  onReorderPick: (fromIndex: number, toIndex: number) => void,
  inputSource: InputSource,
}) {
  const allPieces = useMemo(
    () => (rosterConfig.rosters[pieceType] ?? []).filter((piece) => !plan.banList.includes(piece.id)),
    [rosterConfig, pieceType, plan]
  );
  const downloadedLogic = useDownloadedPieceVersions(rosterConfig, pieceType);

  const [filter, setFilter] = useState("");
  const [cursorIndex, setCursorIndex] = useState(0);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const columns = useGridColumns(gridRef);

  const density = densityFor(allPieces.length);
  const showFilter = allPieces.length >= FILTER_MIN_PIECES;

  const pieces = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    if (!needle) return allPieces;
    return allPieces.filter((piece) => (
      piece.humanInfo.name.toLowerCase().includes(needle) || piece.humanInfo.author.toLowerCase().includes(needle)
    ));
  }, [allPieces, filter]);

  // Narrowing the list renumbers everything under the cursor, so park it back
  // at the top rather than leave it pointing at whatever now sits at that index.
  useEffect(() => { setCursorIndex(0); }, [filter, pieceType]);

  // Cursoring is useless if the card it lands on is below the fold of a
  // height-capped grid.
  useEffect(() => {
    gridRef.current
      ?.querySelector<HTMLElement>('[data-cursored="true"]')
      ?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [cursorIndex]);

  useCursorInput({
    source: inputSource,
    enabled: pieces.length > 0,
    onMoveColumn: (delta) => setCursorIndex((i) => (i + delta + pieces.length) % pieces.length),
    // Rows don't wrap: wrapping left/right is how a select screen has always
    // behaved, but wrapping "down" off the last row back to the first is
    // disorienting once the grid is tall enough to scroll. Off either end the
    // cursor simply stays where it is, rather than clamping to index 0/last
    // and so sliding sideways to another column.
    onMoveRow: (delta) => setCursorIndex((i) => {
      const next = i + delta * columns;
      if (next >= 0 && next < pieces.length) return next;
      // The one exception: pressing down out of a full row into a shorter
      // last row should still reach it, at its final card.
      const lastRow = Math.floor((pieces.length - 1) / columns);
      if (delta > 0 && Math.floor(i / columns) < lastRow) return pieces.length - 1;
      return i;
    }),
    onConfirm: () => {
      const piece = pieces[cursorIndex];
      if (piece) onTogglePick(piece.id);
    },
  });

  const atMax = picks.length >= plan.max;
  const countLabel = plan.min === plan.max
    ? `pick exactly ${plan.min}`
    : plan.max === Number.POSITIVE_INFINITY
      ? `pick ${plan.min}-any`
      : `pick ${plan.min}-${plan.max}`;

  const pieceById = new Map(allPieces.map((piece) => [piece.id, piece]));

  // Mouse hover wins over keyboard/gamepad cursor while active, but either
  // one alone is enough to drive the preview panel beside the grid - a
  // controller-only player never hovers anything, so falling back to
  // cursorIndex is what gives them a live preview at all.
  const activePiece = pieceById.get(hoveredId ?? "") ?? pieces[cursorIndex] ?? null;

  return (
    <div className="piece-type-section" data-density={density}>
      <div className="piece-type-header">
        {showFilter && (
          <input
            className="piece-type-filter"
            type="search"
            value={filter}
            placeholder={`Filter ${allPieces.length} ${pieceType}…`}
            onChange={(e) => setFilter(e.target.value)}
            aria-label={`Filter ${pieceType}`}
          />
        )}
        <span className="piece-type-count">
          {countLabel} ({picks.length} picked{filter ? `, ${pieces.length} shown` : ""})
        </span>
      </div>
      <div className="piece-type-body">
        <div className="card-grid" ref={gridRef}>
          {pieces.map((piece, index) => {
            const orderIndex = picks.indexOf(piece.id);
            return (
              <PieceCard
                key={piece.id}
                piece={piece}
                pieceType={pieceType}
                selected={orderIndex !== -1}
                orderNumber={orderIndex === -1 ? undefined : orderIndex + 1}
                downloaded={downloadedLogic ? downloadedLogic.has(piece.version.logic) : undefined}
                cursored={index === cursorIndex}
                disabled={atMax}
                onClick={() => onTogglePick(piece.id)}
                onHoverChange={(hovering) => setHoveredId(hovering ? piece.id : null)}
              />
            );
          })}
          {pieces.length === 0 && (
            <span className="card-grid-empty">No {pieceType} match “{filter}”</span>
          )}
        </div>
        <PiecePreviewPanel piece={activePiece} pieceType={pieceType} />
      </div>
      {picks.length > 0 && (
        <ol className="pick-order-list">
          {picks.map((pieceId, index) => (
            <li key={pieceId} className="pick-order-item">
              <span className="pick-order-index">{index + 1}</span>
              <span className="pick-order-name">{pieceById.get(pieceId)?.humanInfo.name ?? pieceId}</span>
              <button
                type="button"
                className="pick-order-move"
                disabled={index === 0}
                onClick={() => onReorderPick(index, index - 1)}
                aria-label="Move earlier"
              >
                ↑
              </button>
              <button
                type="button"
                className="pick-order-move"
                disabled={index === picks.length - 1}
                onClick={() => onReorderPick(index, index + 1)}
                aria-label="Move later"
              >
                ↓
              </button>
              <button type="button" className="pick-order-remove" onClick={() => onTogglePick(pieceId)}>
                Remove
              </button>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
