import { UntrustedScriptRef } from "@roster-lock/types";
import { InputProps, useTrackedKey } from "../../../../../utils/react";

import {
  AddScriptRefForm, ScriptRefInputSubmit
} from "./shared";
import { CSSProperties } from "react";

export function ScriptRefArrayInput(
  {
    value: scripts,
    onChange,
    itemStyle
  }: (
    & InputProps<Array<UntrustedScriptRef>>
    & { itemStyle?: CSSProperties }
  )
){
  return (
    <>
    <AddScriptRefForm
      onSubmit={(newScriptRef)=>(onChange([...scripts, newScriptRef]))}
    />
    {scripts.length === 0 ? null : (
      <ul>
        {scripts.map((script, oldI)=>(
          <ScriptRefInputSubmit
            style={itemStyle}
            key={`${script.src} ${oldI}`}
            value={script}
            onChange={(updated)=>(
              onChange(scripts.map((s, newI)=>{
                return oldI !== newI ? s : updated
              }))
            )}
            onSubmit={()=>{
              onChange(scripts.filter((s, newI)=>{
                return oldI !== newI
              }))
            }}
            submitName="Remove"
          />
        ))}
      </ul>
    )}
    </>
  )
}

