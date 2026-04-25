import { RosterLockV1Config } from "@roster-lock/types";
import { InputProps } from "../../../../../../utils/react";
import { useEffect } from "react";

export function PieceDefinitionInput(
  { value, onChange, rosterLock }: (
    & InputProps<string>
    & { rosterLock: RosterLockV1Config }
  )
){

  useEffect(()=>{
    if(value !== "") return;
    const pieceDef = Object.keys(rosterLock.engine.pieceDefinitions)[0]
    if(!pieceDef) return
    onChange(pieceDef)
  }, [rosterLock, value])

  return (
    <div>
      <h3>Choose Piece Definition</h3>
      <ul>
      {Object.entries(rosterLock.engine.pieceDefinitions).map(([k, v])=>(
        <li key={k} >
          <input
            type="radio"
            name="piece-definition-key"
            checked={k === value}
            value={k}
            onChange={(e)=>(onChange(e.target.value))}
          />
          <span>{k}</span>
        </li>
      ))}
      </ul>
    </div>
  );
}