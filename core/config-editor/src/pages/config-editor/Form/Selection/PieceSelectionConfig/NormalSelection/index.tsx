import { RosterLockV1Config, SelectionNormalConfig, EngineSelectionStrategy } from "@roster-lock/types";
import { InputProps } from "../../../../../../utils/react";
import { NormalValidation } from "./validation";
import { ScriptRefOptionalInput } from "../../ScriptRef";

export function NormalSelectionInput(
  { value, onChange, pieceType }: (
    & InputProps<SelectionNormalConfig>
    & { pieceType: string }
  )
){
  return (
    <>
      <div className="section">
        <h3>Selection Validation</h3>
        <NormalValidation
          value={value.validation}
          onChange={validation => onChange({ ...value, validation })}
          pieceType={pieceType}
        />
      </div>

      <div className="section" >
        <h3>Merge Script</h3>
        <ScriptRefOptionalInput
          value={value.mergeAlgorithm}
          onChange={(mergeAlgorithm)=>{
            onChange({
              ...value, mergeAlgorithm 
            })
          }}
        />
      </div>
    </>
  );
}


