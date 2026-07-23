import { RosterLockV1Config } from "@roster-lock/types";
import { CycleError, validatePieceInCycles } from "@roster-lock/shared";
import { InputProps } from "../../../../../../utils/react";
import { useEffect, useMemo } from "react";
import { ToolTipSpan } from "../../../../../../components/ToolTip";

import tooltip from "./tootip.md";

import { CONFIG_ID_PATHS } from "../../../../paths";

type RosterLockEngineConfig = RosterLockV1Config["engine"];

export function RequiresInput(
  { value, onChange, pieceName, engineConfig }: (
    & InputProps<Array<string>>
    & { pieceName: string, engineConfig: RosterLockEngineConfig }
  )
){

  const validPieceTypes = useMemo(() => {
    const validPieceTypes: Array<string> = [];
    for(const [key, definition] of Object.entries(engineConfig.pieceDefinitions)){
      if(definition.selectionStrategy !== "on demand") continue;
      if(key === pieceName) continue;
      validPieceTypes.push(key);
    }

    return validPieceTypes;
  }, [engineConfig, pieceName]);

  useEffect(() => {

    const newValues = value.filter((pieceType)=>{
      const def = engineConfig.pieceDefinitions[pieceType];
      if(!def) return false;
      if(def.selectionStrategy !== "on demand") return false;
      return true;
    });

    if(newValues.sort().join(",") === value.sort().join(",")) return;

    onChange(newValues);
  }, [engineConfig]);

  const cycleError = useMemo(() => {
    try {
      validatePieceInCycles(pieceName, engineConfig);
      return null;
    }catch(e){
      if(e instanceof CycleError) return e;
      return null;
    }
  }, [engineConfig, pieceName]);

  return <>
    <h3><ToolTipSpan tip={tooltip} clickable>Required Piece Types</ToolTipSpan></h3>
    {validPieceTypes.length === 0 ? (
      <div className="error">An on demand piece must be created before another piece can require it</div>
    ) : (
      <div className="section">
        {validPieceTypes.map((requiredPieceType, index) => (
          <div key={requiredPieceType} className="section">
            <label>
              <input
                type="checkbox"
                checked={value.includes(requiredPieceType)}
                onChange={(e) =>{
                  onChange(
                    e.target.checked ? [...value, requiredPieceType] :
                    value.filter((v) => v !== requiredPieceType)
                  )
                }}
              />
              <span>{requiredPieceType}</span>
            </label>
          </div>
        ))}
      </div>
    )}
    {cycleError !== null && <div>
      <div className="error">Circular dependencies have been found</div>
      <ul>
        {cycleError.cycles.map((cycle, index) => (
          <li key={index}>
            {cycle.map((pieceType, index) => (
              <a
                key={`${index}-${pieceType}`}
                href={`#${CONFIG_ID_PATHS.engine.pieceId(pieceType)}`}
              >{pieceType}{index !== cycle.length - 1 ? " -> " : ""}</a>
            ))}
          </li>
        ))}
      </ul>
    </div>}
  </>
}

