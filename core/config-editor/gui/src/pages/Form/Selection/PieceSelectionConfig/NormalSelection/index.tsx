import { SelectionNormalConfig } from "@roster-lock/types";
import { InputProps } from "../../../../../utils/react";
import { NormalValidation } from "./validation";
import { ScriptRefOptionalInput, ScriptRefMandatoryInput } from "../../ScriptRef";
import { useRosterLock } from "../../../Contexts/RosterLock";
import { useEffect } from "react";

export function NormalSelectionInput(
  { value, onChange, pieceType }: (
    & InputProps<SelectionNormalConfig>
    & { pieceType: string }
  )
){
  const { value: lock } = useRosterLock();
  const definition = lock.engine.pieceDefinitions[pieceType]

  if(!definition){
    return <h1 className="error">No definition for {pieceType}</h1>
  }
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
        {definition.selectionStrategy === "personal" ? (
          <ScriptRefOptionalInput
            value={value.mergeAlgorithm}
            onChange={(mergeAlgorithm)=>{
              onChange({
                ...value, mergeAlgorithm
              })
            }}
          />
        ) : definition.selectionStrategy === "shared" ? (
          <ScriptRefMandatoryInput
            value={value.mergeAlgorithm}
            onChange={(mergeAlgorithm)=>(
              onChange({
                ...value, mergeAlgorithm
              })
            )}
          />
        ) : null}
      </div>
    </>
  );
}


