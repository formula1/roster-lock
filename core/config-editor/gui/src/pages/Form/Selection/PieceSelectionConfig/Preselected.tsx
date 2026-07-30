import { InputProps } from "../../../../utils/react";
import { SelectionPreselectedConfig } from "@roster-lock/types";

import { SelectionListInput } from "../../components/SelectionListInput";

export function PreselectedSelectionInput(
  { value, onChange, pieceType }: (
    & InputProps<SelectionPreselectedConfig>
    & { pieceType: string }
  )
){
  return (
    <SelectionListInput
      value={value.pieces}
      onChange={(pieces)=>(onChange({ ...value, pieces }))}
      pieceType={pieceType}
    />
  )
}
