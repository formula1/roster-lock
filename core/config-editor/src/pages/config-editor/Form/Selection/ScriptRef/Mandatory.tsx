
import { UntrustedScriptRef } from "@roster-lock/types";
import { InputProps } from "../../../../../utils/react";
import { ScriptRefInput } from "./shared";
import { useRosterLock } from "../../Contexts/RosterLock";
import { useEffect } from "react";
import { Link } from "react-router";


export function ScriptRefMandatoryInput(
  { value, onChange }: InputProps<UntrustedScriptRef | undefined>
){
  const { value: lock } = useRosterLock();
  const scripts = Object.keys(lock.selection.scriptDictionary);
  useEffect(()=>{
    if(!value) return;
    if(scripts.length === 0) return;
    onChange({ src: scripts[0] })
  }, [value, lock]);

  if(!value && scripts.length === 0){
    return (
      <>
        <h1 className="error" >No scripts available</h1>
        <p><Link to="" >Please add one here</Link></p>
      </>
    )
  }

  if(!value) return null;

  return (
    <ScriptRefInput value={value} onChange={onChange} />
  )
}
