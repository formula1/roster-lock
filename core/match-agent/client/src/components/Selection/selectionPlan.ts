import { RosterLockV1Config, SelectedPiece, UserSelection } from "@roster-lock/types";

// Ported from examples/full-local/game/game-pwa/src/game/selection.ts
// (itself ported from game-headless/src/steps/0-select.ts's resolvePiece) -
// this app needs the same plan/resolve/build logic, just run once per local
// player slot instead of once for the whole machine.
export function resolvePiece(
  rosterConfig: RosterLockV1Config, pieceType: string, pieceId: string
): SelectedPiece {
  const definition = rosterConfig.engine.pieceDefinitions[pieceType];
  if (!definition) throw new Error(`Missing piece definition for ${pieceType}`);
  const available = rosterConfig.rosters[pieceType];
  if (!available) throw new Error(`Missing roster for ${pieceType}`);
  const item = available.find((p) => p.id === pieceId);
  if (!item) throw new Error(`Missing piece ${pieceId} in roster for ${pieceType}`);

  const selection: SelectedPiece = { id: item.id, required: {} };
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
): UserSelection {
  const selection: UserSelection = {};
  for (const [pieceType, pieceIds] of Object.entries(picks)) {
    selection[pieceType] = pieceIds.map((id) => resolvePiece(rosterConfig, pieceType, id));
  }
  return selection;
}
