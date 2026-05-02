
import { PieceType } from "../../shared";
import { UntrustedScriptRef } from "./script";
import { SelectionPreselectedConfig } from "./selection-types/preselected";
import { SelectionGameControlledConfig } from "./selection-types/game-controlled";
import { SelectionNormalConfig, UserSelectionValidation } from "./selection-types/normal";

export * from "./meta";

export {
  SelectionPreselectedConfig,
  SelectionGameControlledConfig,
  SelectionNormalConfig,
  UserSelectionValidation,
};

export { UntrustedScriptRef };

export type RosterLockSelectionConfig = {
  piece: Record<PieceType, (
    | SelectionGameControlledConfig
    | SelectionNormalConfig
    | SelectionPreselectedConfig
  )>,

  globalValidation?: Array<UntrustedScriptRef>

  scriptDictionary: Record<string, { mimeType: string, content: string, }>
};


