import { InputProps, ListItemProps } from "../../../../../../utils/react";
import { PieceDefinition, PieceValue } from "../types";

import { CONFIG_ID_PATHS } from "../../../../paths";
import { RosterLockV1Draft } from "@roster-lock/types";
import { PieceValueItemInput } from "../PieceItem/Input";

type RosterLockV1Config = RosterLockV1Draft["stagedLock"];


export function PieceValueList(
  { value, onChange, pieceType, pieceDefinition, config }: (
    & InputProps<RosterLockV1Config["rosters"][string]>
    & {
      pieceType: string,
      pieceDefinition: PieceDefinition,
      config: RosterLockV1Config
    }
  )
){
  const rosters = config.rosters;

  if(value.length === 0){
    return (
      <div className="section">
        <h2 id={CONFIG_ID_PATHS.roster.pieceTypeId(pieceType)}>{pieceType}</h2>
        <div className="error">No pieces of this type</div>
      </div>
    )
  }

  return (
    <div className="section">
      <h2 id={CONFIG_ID_PATHS.roster.pieceTypeId(pieceType)}>{pieceType}</h2>
      {value.map((piece, index) => (
        <div className="section" key={index} id={CONFIG_ID_PATHS.roster.pieceValueId(piece)}>
          <PieceValueItemInput
            key={index}
            pieceDefinition={pieceDefinition}
            config={config}
            pieceType={pieceType}

            value={piece}
            onChange={v => onChange(value.map((oldPiece, i) => i !== index ? oldPiece : v))}

            index={index}
            items={value}
            onDelete={() => onChange(value.filter((_, i) => i !== index))}

          />
        </div>
      ))}
    </div>
  )
}





