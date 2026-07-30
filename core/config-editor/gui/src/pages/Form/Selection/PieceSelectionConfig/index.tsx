import type {
  EngineSelectionStrategy,
  RosterLockV1Config,
} from "@roster-lock/types";
import type { InputProps } from "../../../../utils/react/input";
import { pieceMetaTT, PieceMetaEditor } from "../PieceMetaEditor";
import { useRosterLock } from "../../Contexts/RosterLock";

import { NormalSelectionInput } from "./NormalSelection";
import { GameControlledSelectionInput } from "./GameControlled";
import { PreselectedSelectionInput } from "./Preselected"
import { UnselectableSelectionInput } from "./Unselectable";
import { isStrategyUnselectable } from "../utils/is-unselectable";
import {
  EMPTY_ROSTER_NORMAL_SELECTION,
  EMPTY_ROSTER_GAME_SELECTION,
  EMPTY_ROSTER_PRESELECTED_SELECTION,
  EMPTY_PIECE_META,
} from "@roster-lock/shared"
import { cloneJSON } from "@roster-lock/utils";
import { Link, useParams } from "react-router";

import { RosterLockPaths } from "../../../paths";
import { replaceParams } from "../../../../utils/router";
import { updatePiece } from "../utils/update-piece";
import { updatePieceMeta } from "../utils/update-piece-meta";
import { ToolTipSpan } from "../../../../components/ToolTip";

type SelectionConfig = (
  RosterLockV1Config["selection"]["piece"][string]
)

export function PieceSelectionConfigPage(){
  const { value, onChange } = useRosterLock();
  const params = useParams();

  const pieceType = params.pieceType;

  const pieceConfig = value.selection.piece[pieceType || ""];

  if(!pieceType || !pieceConfig){
    return (
      <>
        <h1>Piece Not Found</h1>
        <p>
          <Link
            to={replaceParams(RosterLockPaths.Selection.INDEX, params)}
          >Go back to Selection</Link>
        </p>
      </>
    );
  }

  return (
    <PieceSelectionConfig
      pieceType={pieceType}
      value={pieceConfig}
      onChange={pieceConfig =>
        onChange(old => updatePiece(old, pieceType, pieceConfig))
      }
    />
  );
}


export function PieceSelectionConfig(
  { pieceType, value, onChange }: (
    & InputProps<SelectionConfig>
    & { pieceType: string }
  )
) {
  const { value: lock, onChange: onLockChange } = useRosterLock();
  const defintion = lock.engine.pieceDefinitions[pieceType]
  if(!defintion) return (
    <h4 className="error">{pieceType} has no engine defintiion</h4>
  )
  const pieces = lock.rosters[pieceType]
  if(!pieces) return (
    <h4 className="error">{pieceType} has no roster list</h4>
  );
  const pieceMeta = lock.pieceMeta[pieceType] ?? EMPTY_PIECE_META;

  return (
    <div className="section">
      <h2>
        {pieceType}
        <span style={{
          marginLeft: "0.75rem",
          fontSize: "0.75em",
          fontWeight: "normal",
          opacity: 0.7,
        }}>
          {STRATEGY_LABELS[defintion.selectionStrategy]}
        </span>
        {!isStrategyUnselectable(defintion) && (
          <select
            value={value.type}
            onChange={(e)=>{
              const config = SELECTION_FORMS[e.target.value];
              if(!config) throw new Error("Missing Selection Type")
              onChange(cloneJSON(config.empty));
            }}
          >
            {Object.entries(SELECTION_FORMS).map(([k, { title }])=>(
              <option value={k} >{title}</option>
            ))}
          </select>
        )}
      </h2>

      <div className="section">
        <h3>
          <ToolTipSpan tip={pieceMetaTT} >Piece Meta</ToolTipSpan>
        </h3>
        <PieceMetaEditor
          value={pieceMeta}
          onChange={(newPieceMeta)=>onLockChange(old => updatePieceMeta(old, pieceType, newPieceMeta))}
          pieces={pieces}
        />
      </div>

      {
        value.type === "unselectable" ? (
          <UnselectableSelectionInput
            value={value}
            onChange={onChange}
            pieceType={pieceType}
          />
        ):
        value.type === "game-controlled" ? (
          <GameControlledSelectionInput
            value={value}
            onChange={onChange}
            pieceType={pieceType}
          />
        ) :
        value.type === "normal" ? (
          <NormalSelectionInput
            value={value}
            onChange={onChange}
            pieceType={pieceType}
          />
        ) : value.type === "preselected" ? (
          <PreselectedSelectionInput
            value={value}
            onChange={onChange}
            pieceType={pieceType}
          />
        ) : null
      }

    </div>
  );
}


const STRATEGY_LABELS: Record<EngineSelectionStrategy, string> = {
  mandatory: "Mandatory",
  personal: "Personal",
  shared: "Shared",
  "on demand": "On Demand"
}

const SELECTION_FORMS: Record<string, { title: string, empty: SelectionConfig }> = {
  "normal": { title: "Normal", empty: EMPTY_ROSTER_NORMAL_SELECTION },
  "preselected": { title: "Preselected", empty: EMPTY_ROSTER_PRESELECTED_SELECTION },
  "game-controlled": { title: "Game Controlled", empty: EMPTY_ROSTER_GAME_SELECTION },
}