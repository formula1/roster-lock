import { RosterLockV1Config } from "@roster-lock/types";

// Mirrors core/match-agent/client/src/components/Selection/selectionPlan.ts's
// planForPieceType - the suite only needs each pickable piece type's `min`
// (how many .piece-card buttons to click to satisfy SelectionBoard's
// allValid check), not the full plan/resolve/build pipeline that file also
// covers, so this stays intentionally small rather than importing across
// into that app's private src.
export function requiredPickCounts(rosterConfig: RosterLockV1Config): Record<string, number> {
  const counts: Record<string, number> = {};

  for (const pieceType of Object.keys(rosterConfig.engine.pieceDefinitions)) {
    const definition = rosterConfig.engine.pieceDefinitions[pieceType];
    if (definition.selectionStrategy === "mandatory") continue;
    if (definition.selectionStrategy === "on demand") continue;

    const selectionConfig = rosterConfig.selection.piece[pieceType];
    if (!selectionConfig || selectionConfig.type !== "normal") continue;

    const count = selectionConfig.validation.count;
    const min = count === "*" ? 1 : Array.isArray(count) ? count[0] : count;
    counts[pieceType] = min;
  }

  return counts;
}
