import { UntrustedScriptRef } from "@roster-lock/types";
import { InputProps } from "../../../../../utils/react";

import {
  AddScriptRefForm, ScriptRefInputSubmit
} from "./shared";

export function ScriptRefArrayInput(
  { value: scripts, onChange }: InputProps<Array<UntrustedScriptRef>>
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
            key={`${script.src} ${script.method} ${oldI}`}
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

