import type { ValidInputProps, ListItemProps } from "../../../../../utils/react/input";
import { MoveButtons } from "../../../../../components/MoveButtons";
import type { RosterLockEngineConfig } from "@roster-lock/types";
import { AssetNameInput } from "./AssetName";
import { AssetClassificationInput } from "./Classification";
import { CountUnknownInput } from "../../../components/CountUnknown";
import { GlobListInput } from "./Glob";

type AssetDefinition = RosterLockEngineConfig["pieceDefinitions"][string]["assets"][number];

export function AssetDefinitionForm(
  { value, onChange, index, items, onDelete, onMove, pathVariables }: (
    & ValidInputProps<AssetDefinition>
    & ListItemProps<AssetDefinition>
    & { onMove: (newIndex: number)=>unknown }
    & { pathVariables: RosterLockEngineConfig["pieceDefinitions"][string]["pathVariables"] }
)){
  return <>
    <h3 style={{ display: "flex", flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
      <AssetNameInput
        value={value.name}
        onChange={v => onChange({...value, name: v})}
        index={index}
        onDelete={onDelete}
        items={items}
      />
      <MoveButtons
        index={index}
        items={items}
        onMove={onMove}
      />
    </h3>
    <div className="section">
      <AssetClassificationInput
        value={value.classification}
        onChange={v => onChange({...value, classification: v})}
      />
    </div>
    <div className="section">
      <CountUnknownInput
        value={value.count}
        onChange={v => onChange({...value, count: v})}
      />
    </div>
    <div className="section">
      <GlobListInput
        value={value.glob}
        onChange={v => onChange({...value, glob: v})}
        pathVariables={pathVariables}
      />
    </div>
  </>
}
