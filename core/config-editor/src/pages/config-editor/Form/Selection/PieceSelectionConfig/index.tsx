import type {
  EngineSelectionStrategy,
  RosterLockV1Config,
} from "@roster-lock/types";
import type { InputProps } from "../../../../../utils/react/input";
import { PieceMetaEditor } from "../PieceMetaEditor";
import { useRosterLock } from "../../Contexts/RosterLock";

import { NormalSelectionInput } from "./NormalSelection";
import { GameControlledSelectionInput } from "./GameControlled";
import { PreselectedSelectionInput } from "./Preselected"
import { UnselectableSelectionInput } from "./Unselectable";

type SelectionConfig = (
  RosterLockV1Config["selection"]["piece"][string]
)

export function PieceSelectionConfig(
  { pieceType, value, onChange }: (
    & InputProps<SelectionConfig>
    & { pieceType: string }
  )
) {
  const { value: lock } = useRosterLock();
  const defintion = lock.engine.pieceDefinitions[pieceType]
  if(!defintion) return (
    <h4 className="error">{pieceType} has no engine defintiion</h4>
  )
  const pieces = lock.rosters[pieceType]
  if(!pieces) return (
    <h4 className="error">{pieceType} has no roster list</h4>
  );

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
      </h2>

      <div className="section">
        <h3>Piece Meta</h3>
        <PieceMetaEditor
          value={value.pieceMeta}
          onChange={(pieceMeta)=>(onChange({ ...value, pieceMeta }))}
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

const UNSELECTABLE_STRATEGIES: Array<EngineSelectionStrategy> = ["mandatory", "on demand"];
