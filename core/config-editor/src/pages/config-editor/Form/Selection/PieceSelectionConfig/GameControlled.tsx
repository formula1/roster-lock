import { SelectionGameControlledConfig } from "@roster-lock/types";
import { InputProps } from "../../../../../utils/react";

export function GameControlledSelectionInput(
  { value, onChange }: (
    & InputProps<SelectionGameControlledConfig>
    & { pieceType: string }
  )
){
  return null;
}
