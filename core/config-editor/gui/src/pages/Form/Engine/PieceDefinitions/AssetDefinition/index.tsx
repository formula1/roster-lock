
import { InputProps } from "../../../../../utils/react";
import { ToolTipSpan } from "../../../../../components/ToolTip";
import { AssetDefinitionCreator } from "./Creation";
import { AssetDefinitionForm } from "./AssetItem";
import { RosterLockV1Config } from "@roster-lock/types";


type RosterLockEngineConfig = RosterLockV1Config["engine"];

import tooltip from "./tooltip.md";
import { useEffect, useState } from "react";
import { CONFIG_ID_PATHS } from "../../../../paths";

type Asset = RosterLockEngineConfig["pieceDefinitions"][string]["assets"][number];

export function AssetsInput(
  { value, onChange, pathVariables }: (
    & InputProps<RosterLockEngineConfig["pieceDefinitions"][string]["assets"]>
    & { pathVariables: RosterLockEngineConfig["pieceDefinitions"][string]["pathVariables"] }
  )
){
  const [newAsset, setNewAsset] = useState<null | Asset>(null);

  useEffect(()=>{
    const to = setTimeout(()=>(setNewAsset(null)), 10 * 1000);
    return () => clearTimeout(to);
  }, [newAsset])

  return <>
    <h3><ToolTipSpan tip={tooltip} clickable>Assets</ToolTipSpan></h3>
    <AssetDefinitionCreator
      validate={(v)=>{
        if(value.some((a) => a.name === v)) throw new Error("Name already exists")
      }}
      onSubmit={(v) =>{
        onChange([...value, v])
        setNewAsset(v);
      }}
    />
    {newAsset !== null && <div className="error">
      <a href={`#${CONFIG_ID_PATHS.engine.assetId(newAsset)}`}>New asset created: {newAsset.name}</a>
    </div>}

    <div className="alternate-list">
      {value.map((asset, i) => (
        <div className="section" key={i} id={CONFIG_ID_PATHS.engine.assetId(asset)}>
          <AssetDefinitionForm
            index={i}
            value={asset}
            onChange={v => onChange(value.map((a, j) => j === i ? v : a))}
            onDelete={() => onChange(value.filter((_, j) => j !== i))}
            onMove={(newIndex: number)=>{
              if(newIndex === i) return;
              onChange(moveItem(value, i, newIndex));
            }}
            items={value}
            pathVariables={pathVariables}
          />
        </div>
      ))}
    </div>
  </>;
}


function moveItem(list: Array<any>, oldIndex: number, newIndex: number){
  if(newIndex === oldIndex) return list;
  const v = list[oldIndex];
  const newList = list.filter((_, j) => j !== oldIndex);
  newList.splice(newIndex, 0, v);
  return newList;
}
