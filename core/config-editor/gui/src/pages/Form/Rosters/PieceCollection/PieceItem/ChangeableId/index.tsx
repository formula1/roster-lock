
import { ToolTipSpan } from "../../../../../../components/ToolTip";
import usableIdTT from "./usableIdTT.md";
import { InputProps } from "../../../../../../utils/react";
import { PieceValue } from "../../types";
import { RosterLockV1Config } from "@roster-lock/types";
import { validatePieceId, validatePieceIdUniqueness } from "@roster-lock/shared";
import { useMemo } from "react";

export function ChangeableId({ value, onChange, index, roster }: (
  & InputProps<PieceValue["id"]>
  & { index: number, roster: RosterLockV1Config["rosters"][string] }
)){
  const error = useMemo(()=>{
    try {
      validatePieceId(value);
      validatePieceIdUniqueness(value, index, roster);
      return null;
    }catch(e){
      return (e as Error).message;
    }
  },[value, index, roster])
  return (
    <div className="section">
      <div><ToolTipSpan tip={usableIdTT}>Usable ID</ToolTipSpan></div>
      <div>
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
        />
      </div>
      {error !== null && <div className="error">{error}</div>}
    </div>
  )
}

