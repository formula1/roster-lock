
import { UntrustedScriptRef } from "@roster-lock/types";
import { InputProps } from "../../../../utils/react";
import { ScriptRefInput } from "./shared";
import { useRosterLock } from "../../Contexts/RosterLock";
import { useEffect } from "react";
import { Link, useParams } from "react-router";
import { replaceParams } from "../../../../utils/router";
import { RosterLockPaths } from "../../../paths";


export function ScriptRefMandatoryInput(
  { value, onChange }: InputProps<UntrustedScriptRef | undefined>
){
  const params = useParams();
  const { value: lock } = useRosterLock();
  const scripts = Object.keys(lock.selection.scriptDictionary);
  useEffect(()=>{
    if(value) return;
    if(scripts.length === 0) return;
    onChange({ src: scripts[0] })
  }, [value, lock]);

  if(!value && scripts.length === 0){
    return (
      <>
        <div>No Scripts Available, please add one</div>
        <div>
          <Link
            to={replaceParams(
              RosterLockPaths.Selection.ScriptDictionary.AddScripts,
              { filePath: params.filePath || "" }
            )}
          >Add Scripts</Link>
        </div>
      </>
    )
  }

  if(!value) return null;

  return (
    <div style={{ display: "flex", flexDirection: "row" }}>
      <ScriptRefInput value={value} onChange={onChange} />
      <button
        disabled={true}
        style={{ alignSelf: "stretch", padding: "10px" }}
      >Script is Mandatory</button>
    </div>
  )
}
