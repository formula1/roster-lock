import { UntrustedScriptRef } from "@roster-lock/types";
import { InputProps } from "../../../../../utils/react";
import { useRosterLock } from "../../Contexts/RosterLock";
import { useEffect, useState } from "react";
import { cloneJSON } from "@roster-lock/utils";

import { replaceParams } from "../../../../../utils/router";
import { RosterLockPaths } from "../../../paths";
import { Link, useParams } from "react-router";
import { FileView } from "../ScriptDictionary/pages/Views";
import { useLightbox } from "../../../../../components";
import { ToolTipSpan } from "../../../../../components/ToolTip";

const INITIAL_REF: UntrustedScriptRef = {
  src: "", method: void 0
}

export function AddScriptRefForm(
  { onSubmit }: { onSubmit: (value: UntrustedScriptRef)=>any }
){
  const params = useParams();
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
          to={replaceParams(
            RosterLockPaths.Selection.ScriptDictionary.MergeFolder,
            { filePath: params.filePath || "" }
          )}
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
    <div style={{ display: "flex", flexDirection: "row" }} className="section" >
      <ScriptRefInput
        value={value}
        onChange={onChange}
      />
      <button
        style={{ alignSelf: "stretch", padding: "10px" }}
        onClick={onSubmit}
      >{submitName}</button>
    </div>
  )
}

import methodTT from "./method-tt.md";
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
        <ToolTipSpan tip={methodTT} >Method: </ToolTipSpan>
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
  const scripts = Object.keys(lock.selection.scriptDictionary);
  const lightbox = useLightbox();
  const file = lock.selection.scriptDictionary[value];
  useEffect(()=>{
    if(!value && scripts.length > 0){
      onChange(scripts[0])
    }
  }, [value, scripts]);
  return (
    <>
      <select
        value={value}
        onChange={(e)=>{onChange(e.target.value)}}
      >
        {scripts.map((scriptName)=>(
          <option value={scriptName}>{scriptName}</option>
        ))}
      </select>
      {file && <button
        onClick={()=>(lightbox.open(<FileView path={value} script={file} />))}
        >View Contents</button>
      }

    </>
  );
}