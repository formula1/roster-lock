
import {
  PieceType,
} from "../shared";


export type RosterLockEngineConfig = {
  name: string,
  version: string,
  pieceDefinitions: Record<PieceType, {
    selectionStrategy: EngineSelectionStrategy,
    requires: Array<PieceType>
    pathVariables: Array<string>,
    assets: Array<EngineAssetDefinition>
  }>
}

export type AssetClassification = "logic" | "media" | "doc";
export type EngineAssetDefinition = {
  name: string,
  classification: AssetClassification,
  count: number | "*" | [number, number | "*"]
  glob: Array<string>,
}

export type EngineSelectionStrategy = (
  | "mandatory"
  | "personal"
  | "shared"
  | "on demand"
)
