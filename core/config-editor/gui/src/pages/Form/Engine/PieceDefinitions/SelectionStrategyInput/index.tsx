import { RosterLockEngineConfig } from "@roster-lock/types";
import { InputProps } from "../../../../../utils/react";
import { ToolTipSpan } from "../../../../../components/ToolTip";

import tooltip from "./tooltip.md";

const STRATEGIES: Array<{
  title: string,
  tooltip: string,
  value: RosterLockEngineConfig["pieceDefinitions"][string]["selectionStrategy"]
}> = []

import mandatoryTT from "./strategy-tooltips/mandatory.md";
STRATEGIES.push({ title: "Mandatory", tooltip: mandatoryTT, value: "mandatory" })
import personalTT from "./strategy-tooltips/personal.md";
STRATEGIES.push({ title: "Personal", tooltip: personalTT, value: "personal" })
import sharedTT from "./strategy-tooltips/shared.md";
STRATEGIES.push({ title: "Shared", tooltip: sharedTT, value: "shared" })
import onDemandTT from "./strategy-tooltips/on-demand.md";
STRATEGIES.push({ title: "On Demand", tooltip: onDemandTT, value: "on demand" })


export function SelectionStrategyInput(
  { value, onChange }: (
    & InputProps<RosterLockEngineConfig["pieceDefinitions"][string]["selectionStrategy"]>
  )
) {
  return <div>
    <h3><ToolTipSpan tip={tooltip} clickable>Selection Strategy</ToolTipSpan></h3>
    <ul>
      {STRATEGIES.map((strategy) => (
        <li key={strategy.value}>
          <label onClick={()=>(onChange(strategy.value))}>
            <input
              type="radio"
              checked={value === strategy.value}
            />
            <ToolTipSpan tip={strategy.tooltip}>{strategy.title}</ToolTipSpan>
          </label>
        </li>
      ))}
    </ul>
  </div>
}
