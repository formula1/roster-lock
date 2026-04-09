import { RosterLockV1Config } from "@roster-lock/types";
import { InputProps } from "../../../../../utils/react";

import { PieceValueList } from "./PieceList";
export function PieceCollection(
  { value, onChange, config }: (
    & InputProps<RosterLockV1Config["rosters"]>
    & { config: RosterLockV1Config }
  )
){
  return (
    <>
      {Object.entries(value).map(([pieceType, pieceValues]) => (
        <PieceValueList
          key={pieceType}
          value={pieceValues}
          onChange={v => onChange({ ...value, [pieceType]: v })}
          pieceType={pieceType}
          pieceDefinition={config.engine.pieceDefinitions[pieceType]}
          config={config}
        />
      ))}
    </>
  )
}

