
import { PieceType } from "../../shared";
import { UntrustedScriptRef } from "./script";
import { SelectionGameControlledConfig } from "./selection-types/game-controlled";
import { SelectionNormalConfig, UserSelectionValidation } from "./selection-types/normal";
import { SelectionPreselectedConfig } from "./selection-types/preselected";
import { SelectionUnselectableConfig } from "./selection-types/unselectable";

export * from "./meta";

export type {
  SelectionPreselectedConfig,
  SelectionGameControlledConfig,
  SelectionNormalConfig,
  SelectionUnselectableConfig,
  UserSelectionValidation,
};

export type { UntrustedScriptRef };

export type RosterLockSelectionConfig = {
  piece: Record<PieceType, (
    | SelectionGameControlledConfig
    | SelectionNormalConfig
    | SelectionPreselectedConfig
    | SelectionUnselectableConfig
  )>,

  globalValidation: Array<UntrustedScriptRef>

  scriptDictionary: Record<string, { content: string, }>
};


