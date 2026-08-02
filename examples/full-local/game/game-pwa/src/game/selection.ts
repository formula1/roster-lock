import { RosterLockV1Config, SelectedPiece, UserSelection } from "@roster-lock/types";

// Ported verbatim from game-headless/src/steps/0-select.ts's resolvePiece.
// Every piece a roster entry declares as "expected" for a required piece
// type must be downloaded up front (whichever one is actually used gets
// decided later, e.g. at play time for "on demand" pieces like moves/
// weather) - so this always resolves the full expected set as "mandatory",
// never a subset.
export function resolvePiece(
  rosterConfig: RosterLockV1Config, pieceType: string, pieceId: string, mediaOverrides?: Array<string>
): SelectedPiece {
  const definition = rosterConfig.engine.pieceDefinitions[pieceType];
  if (!definition) throw new Error(`Missing piece definition for ${pieceType}`);
  const available = rosterConfig.rosters[pieceType];
  if (!available) throw new Error(`Missing roster for ${pieceType}`);
  const item = available.find((p) => p.id === pieceId);
  if (!item) throw new Error(`Missing piece ${pieceId} in roster for ${pieceType}`);

  const selection: SelectedPiece = { id: item.id, required: {} };
  if (mediaOverrides && mediaOverrides.length > 0) selection.mediaOverrides = mediaOverrides;
  for (const requirePieceType of definition.requires) {
    const requireDef = item.requiredPieces[requirePieceType];
    if (!requireDef) {
      throw new Error(`Piece ${item.id} is missing required piece type ${requirePieceType}`);
    }
    selection.required[requirePieceType] = {
      mandatory: requireDef.expected.map((expectedId) => resolvePiece(rosterConfig, requirePieceType, expectedId)),
      selectable: [],
    };
  }
  return selection;
}

export type PieceTypePlan = (
  | { kind: "auto"; reason: "mandatory" | "on-demand" | "unselectable" }
  | { kind: "unsupported"; configType: "preselected" | "game-controlled" }
  | { kind: "pickable"; min: number; max: number; banList: Array<string> }
);

// Mirrors headless's selectPiecesAtRandom/selectFromPieceType (0-select.ts),
// but produces a *range* the user can pick within instead of a single random
// count - headless only ever needed one concrete number for its random pick.
export function planForPieceType(rosterConfig: RosterLockV1Config, pieceType: string): PieceTypePlan {
  const definition = rosterConfig.engine.pieceDefinitions[pieceType];
  if (definition.selectionStrategy === "mandatory") return { kind: "auto", reason: "mandatory" };
  if (definition.selectionStrategy === "on demand") return { kind: "auto", reason: "on-demand" };

  const selectionConfig = rosterConfig.selection.piece[pieceType];
  if (!selectionConfig) throw new Error(`Missing selection config for ${pieceType}`);
  if (selectionConfig.type === "preselected") return { kind: "unsupported", configType: "preselected" };
  if (selectionConfig.type === "game-controlled") return { kind: "unsupported", configType: "game-controlled" };
  if (selectionConfig.type === "unselectable") return { kind: "auto", reason: "unselectable" };

  const validation = selectionConfig.validation;
  const count = validation?.count ?? 1;
  let min: number;
  let max: number;
  if (count === "*") {
    min = 1;
    max = Number.POSITIVE_INFINITY;
  } else if (Array.isArray(count)) {
    min = count[0];
    max = count[1] === "*" ? Number.POSITIVE_INFINITY : count[1];
  } else {
    min = count;
    max = count;
  }

  return { kind: "pickable", min, max, banList: validation?.banList ?? [] };
}

export function buildUserSelection(
  rosterConfig: RosterLockV1Config,
  picks: Record<string, Array<string>>,
  // Keyed by pieceId (not pieceType+id - piece ids are unique within a type,
  // and only explicitly-picked pieces can carry overrides in the first place).
  overridePicks: Record<string, Array<string>> = {},
): UserSelection {
  const selection: UserSelection = {};
  for (const [pieceType, pieceIds] of Object.entries(picks)) {
    selection[pieceType] = pieceIds.map((id) => resolvePiece(rosterConfig, pieceType, id, overridePicks[id]));
  }
  return selection;
}
