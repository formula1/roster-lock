import { RosterLockV1Config, SelectionUnselectableConfig } from "@roster-lock/types";
import { InputProps } from "../../../../../utils/react";

export function UnselectableSelectionInput(
  { value, onChange }: (
    & InputProps<SelectionUnselectableConfig>
    & { pieceType: string }
  )
){
  return null;
}
