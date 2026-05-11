import { UntrustedScriptRef } from "@roster-lock/types";
import { InputProps } from "../../../../../utils/react";
import { AddScriptRefForm, ScriptRefInputSubmit } from "./shared";

export function ScriptRefOptionalInput(
  { value, onChange }: InputProps<UntrustedScriptRef | undefined>
){
  const isEnabled = !!value;

  const wrapperStyle = {
    padding: "8px",
    borderRadius: "4px",
    border: `2px solid ${isEnabled ? "#4caf50" : "#ccc"}`,
    backgroundColor: isEnabled ? "#f1f8f4" : "#fafafa",
    transition: "all 0.2s ease"
  };

  const labelStyle = {
    marginBottom: "8px",
    fontSize: "12px",
    fontWeight: "500" as const,
    color: isEnabled ? "#2e7d32" : "#666"
  };

  if(!value){
    return (
      <div style={wrapperStyle}>
        <div style={labelStyle}>Script: OFF</div>
        <AddScriptRefForm
          onSubmit={onChange}
        />
      </div>
    );
  }
  return (
    <div style={wrapperStyle}>
      <div style={labelStyle}>Script: ON</div>
      <ScriptRefInputSubmit
        value={value}
        onChange={onChange}
        onSubmit={()=>(onChange(undefined))}
        submitName="Remove Script"
      />
    </div>
  )

}