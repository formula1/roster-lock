
import { ToolTipSpan } from "../../../../../../../components/ToolTip";
import { PieceDefinition, PieceValue } from "../../types";
import pathVariablesTT from "./pathVariablesTT.md";

export function DisplayPathVariables({ value, pathVariables }: (
  & { value: PieceValue["pathVariables"] }
  & { pathVariables: PieceDefinition["pathVariables"] }
)){

  if(pathVariables.length === 0) return null;
  return (
    <div className="section">
      <div><ToolTipSpan tip={pathVariablesTT}>Path Variables</ToolTipSpan></div>
      {pathVariables.map((variable) => (
        <div key={variable}>
          <label>{variable}: </label>
          <span>{value[variable]}</span>
        </div>
      ))}
    </div>
  )
}
