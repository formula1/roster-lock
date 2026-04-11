import { InputProps } from "../../../../../../../utils/react";
import { PieceDefinition, PieceValue } from "../../types";

import { CONFIG_ID_PATHS } from "../../../../../paths";
import { useState } from "react";
import { ToolTipSpan } from "../../../../../../../components/ToolTip";
import { RosterLockV1Config } from "@roster-lock/types";


import requiredPiecesTT from "./requiredPiecesTT.md";

export function RequiredPieces({ value, onChange, pieceDefinition, rosters }: (
  & InputProps<PieceValue["requiredPieces"]>
  & { pieceDefinition: PieceDefinition, rosters: RosterLockV1Config["rosters"] }
)){

  if(pieceDefinition.requires.length === 0) return null;

  return (
    <div className="section">
      <div><ToolTipSpan tip={requiredPiecesTT}>Required Pieces</ToolTipSpan></div>
      {pieceDefinition.requires.map((requiredPieceType, index) => (
        <RequiredPieceType
          key={index}
          value={value[requiredPieceType]}
          onChange={v => onChange({ ...value, [requiredPieceType]: v })}
          pieceType={requiredPieceType}
          rosters={rosters}
        />
      ))}
    </div>
  )
}

function RequiredPieceType({ value, onChange, pieceType, rosters }: (
  & InputProps<PieceValue["requiredPieces"][string]>
  & {
    pieceType: string, rosters: RosterLockV1Config["rosters"]
  }
)){
  const [displayMandatory, setDisplayMandatory] = useState(false);
  return (
    <div className="section">
      <div>{pieceType}</div>
      <div>
        <label>Selectable: </label>
        <input
          type="checkbox"
          checked={value.selectable}
          onChange={(e) => onChange({ ...value, selectable: e.target.checked })}
        />
      </div>
      <div>
        <div>
          <button
            onClick={() => setDisplayMandatory(!displayMandatory)}
          >{displayMandatory ? 'Hide' : 'Show'} Mandatory</button>
        </div>
        {displayMandatory && rosters[pieceType].map((piece, index) => (
          <div
            key={index}
            style={{ display: "flex", flexDirection: "row"}}
          >
            <input
              type="checkbox"
              checked={value.expected.includes(piece.id)}
              onChange={(e) => onChange({
                ...value,
                expected: (
                  e.target.checked ? [...value.expected, piece.id]
                  : value.expected.filter((v) => v !== piece.id)
                )
              })}
            />
            <a href={`#${CONFIG_ID_PATHS.roster.pieceValueId(piece)}`} >
              <div><pre>{piece.id}</pre></div>
              <div>{piece.humanInfo.name} by {piece.humanInfo.author}</div>
              <div><span>Version: </span>{piece.version.logic}/{piece.version.media}</div>
            </a>
          </div>
        ))}
      </div>
    </div>
  )
}
