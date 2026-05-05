import { UntrustedScriptRef } from "@roster-lock/types";
import { InputProps } from "../../../../../utils/react";
import { useRosterLock } from "../../Contexts/RosterLock";
import { useState } from "react";
import { cloneJSON } from "@roster-lock/utils";

import { join as urlJoin } from "../../../../../utils/router";
import { useURLPrefix } from "../../Contexts/UrlPrefix";
import { RosterLockPaths } from "../../paths";
import { Link } from "react-router";

const INITIAL_REF: UntrustedScriptRef = {
  src: "", method: void 0
}

export function AddScriptRefForm(
  { onSubmit }: { onSubmit: (value: UntrustedScriptRef)=>any }
){
  const urlPrefix = useURLPrefix();
  const { value: lock } = useRosterLock();
  const scripts = Object.entries(lock.selection.scriptDictionary);
  const [value, onChange] = useState<UntrustedScriptRef>(
    cloneJSON(INITIAL_REF)
  )

  if(scripts.length === 0){
    return <>
      <div>No Scripts Available, please add one</div>
      <div>
        <Link
          to={urlJoin(urlPrefix, RosterLockPaths.Selection.ScriptDictionary.MergeFolder)}
        >Merge Folder</Link>
      </div>
    </>
  }
  return (
    <ScriptRefInputSubmit
      value={value}
      onChange={onChange}
      onSubmit={()=>{
        onSubmit(value);
        onChange(cloneJSON(INITIAL_REF))
      }}
      submitName="Add Script"
    />
  )
}

export function ScriptRefInputSubmit(
  { value, onChange, onSubmit, submitName }: (
    & InputProps<UntrustedScriptRef>
    & { onSubmit: ()=> any }
    & { submitName: string }

  )
){
  return (
    <div style={{ display: "flex", flexDirection: "row" }}>
      <ScriptRefInput
        value={value}
        onChange={onChange}
      />
      <button
        style={{ alignSelf: "stretch" }}
        onClick={onSubmit}
      >{submitName}</button>
    </div>
  )
}


export function ScriptRefInput(
  { value, onChange }: (
    & InputProps<UntrustedScriptRef>
  )
){
  return (
    <div style={{ flexGrow: 1, display: "flex", flexDirection: "column" }}>
      <div>
        <span>Source: </span>
        <ScriptRefSrcInput value={value.src} onChange={(src)=>(onChange({...value, src }))} />
      </div>
      <div>
        <span>Method: </span>
        <input
          type="text"
          value={value.method || ""}
          onChange={(e)=>(onChange({ ...value, method: e.target.value }))}
        />
      </div>
    </div>
  )
}

export function ScriptRefSrcInput(
  { value, onChange}: InputProps<string>
){
  const { value: lock } = useRosterLock();
  const scripts = Object.entries(lock.selection.scriptDictionary);
  return (
    <select
      value={value}
      onChange={(e)=>{onChange(e.target.value)}}
    >
      {scripts.map(([scriptName, { mimeType }])=>(
        <option value={scriptName}>{scriptName}</option>
      ))}
    </select>
  );
}