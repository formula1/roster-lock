
import { ToolTipSpan } from "../../../../../../components/ToolTip";
import { PieceValue } from "../../types";
import versionTT from "./versionTT.md";
export function DisplayVersion({ value }: { value: PieceValue["version"] }){
  return (
    <div className="section">
      <div><ToolTipSpan tip={versionTT}>Versions</ToolTipSpan></div>
      <div>
        <label>Logic: </label>
        <span>{value.logic}</span>
      </div>
      <div>
        <label>Media: </label>
        <span>{value.media}</span>
      </div>
      <div>
        <label>Docs: </label>
        <span>{value.docs}</span>
      </div>
    </div>
  )
}
