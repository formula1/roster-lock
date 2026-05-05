import { UntrustedScriptRef } from "@roster-lock/types";
import { InputProps } from "../../../../../utils/react";
import { AddScriptRefForm, ScriptRefInputSubmit } from "./shared";

export function ScriptRefOptionalInput(
  { value, onChange }: InputProps<UntrustedScriptRef | undefined>
){
  if(!value){
    return (
      <AddScriptRefForm
        onSubmit={onChange}
      />
    );
  }
  return (
    <ScriptRefInputSubmit
      value={value}
      onChange={onChange}
      onSubmit={()=>(onChange(undefined))}
      submitName="Remove Script"
    />
  )
  
}