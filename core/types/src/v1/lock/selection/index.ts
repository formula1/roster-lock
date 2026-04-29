
import { PieceType } from "../../shared";
import { GasLimittedScript } from "./script";
import { SelectionPreselectedConfig } from "./selection-types/preselected";
import { SelectionGameControlledConfig } from "./selection-types/game-controlled";
import { SelectionNormalConfig, UserSelectionValidation } from "./selection-types/normal";

export * from "./meta"

export {
  SelectionPreselectedConfig,
  SelectionGameControlledConfig,
  SelectionNormalConfig,
  UserSelectionValidation,
}

export { GasLimittedScript }

export type RosterLockSelectionConfig = {
  piece: Record<PieceType, (
    | SelectionGameControlledConfig
    | SelectionNormalConfig
    | SelectionPreselectedConfig
  )>,

  globalValidation?: Array<GasLimittedScript>

  scripts: Record<string, string>
}


