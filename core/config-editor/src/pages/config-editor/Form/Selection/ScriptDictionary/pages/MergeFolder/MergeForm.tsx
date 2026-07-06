import { InputProps, usePromisedMemo } from "../../../../../../../utils/react";
import { useMemo, useState } from "react";
import { fileExtension } from "@roster-lock/utils";
import { FileSummary } from "../CurrentFiles/FileSummary";

import { PreppedScripts, ScriptDictionary } from "./types";
import { useRosterLock } from "../../../../Contexts/RosterLock";
import { useTrackedKey } from "../../../../../../../utils/react"
import { ROSTERLOCK_SIDECAR } from "../../../../../../../globals/side-car";
import { getPluginDir } from "../../../../../../../globals/plugin-dir";


export function MergeForm(
  { folder, prepped: preppedInput, onSubmit }: (
    & { folder: string, prepped: PreppedScripts }
    & { onSubmit: ({ files, info }: PreppedScripts)=>any } 
  )
){
  const { value: lock } = useRosterLock();
  const dictionary = lock.selection.scriptDictionary;
  const [prepped, setPrepped] = useState<PreppedScripts>(preppedInput);
  const keyTracker = useTrackedKey();
  const untrustedScripts = usePromisedMemo(async ()=>{
    return ROSTERLOCK_SIDECAR.getScriptPlugins(await getPluginDir())
  }, []);

  const problems = useMemo(()=>{
    if(untrustedScripts.status !== "success") return null;
    const problems: Record<string, Array<string>> = {}
    for(const file in prepped.files){
      if(dictionary[file]){
        addError(file, "File already exists" )
      }
      const supportsExtension = getUntrustedScriptByFileExtension(file, untrustedScripts.value);
      const extension = fileExtension(file);
      if(!supportsExtension){
        addError(file, `Extension (${extension || "unknown"}) is not supported`)
      }
    }
    function addError(file: string, error: string){
      if(!problems[file]) problems[file] = [];
      problems[file].push(error);
    }
    return problems;
  }, [dictionary, prepped.files, untrustedScripts]);

  if(problems === null) return null;

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-around" }}>
        <button
          style={{ padding: "30px", fontSize: "2em" }}
          disabled={Object.keys(problems).length > 0}
          onClick={async ()=>{
            if(Object.keys(problems).length > 0){
              throw new Error("There are problems")
            }
            await onSubmit(prepped)
          }}
        >Merge Files</button>
      </div>
      <div>Folder Path: {folder}</div>
      <div>
        <div>Files</div>
        <ul>
          {Object.entries(prepped.files).sort(keyTracker.sortEntries).map(([path, file])=>{
            return (
              <li key={keyTracker.findOrCreate(path)} >
                <LoadedFileEntry
                  value={{ path, file }}
                  onChange={(newValue)=>{
                    const newFiles = {
                      ...prepped.files,
                    }
                    delete newFiles[path];
                    newFiles[newValue.path] = newValue.file
                    keyTracker.update(path, newValue.path);
                    setPrepped({ ...prepped, files: newFiles });
                  }}
                  onRemove={()=>{
                    const newFiles = {
                      ...prepped.files,
                    }
                    delete newFiles[path];
                    keyTracker.delete(path)
                    setPrepped({ ...prepped, files: newFiles });
                  }}
                  allEntries={prepped.files}
                  errors={problems[path] || []}
                />
              </li>
            )
          })}
        </ul>
      </div>
    </>
  );
}


function LoadedFileEntry(
  { value, onChange, onRemove, allEntries, errors }: (
    & InputProps<{ path: string, file: ScriptDictionary[string] }>
    & { onRemove: ()=>any }
    & { allEntries: ScriptDictionary }
    & { errors: Array<string> }
  )
){
  return (
    <>
      <FileSummary
        value={value}
        onChange={onChange}
        onRemove={onRemove}
        allEntries={allEntries}
      />
      {!errors.length ? <div style={{ color: "#00FF00" }}>No Errors</div> : (
        <ul>
          {errors.map((error)=>(
            <li style={{ color: "#FF0000" }}>{error}</li>
          ))}
        </ul>
      )}
    </>
  )
}

export function getUntrustedScriptByFileExtension(
  filename: string, availableScripts: Array<{ extensions: Array<string> }>
){
  const extension = fileExtension(filename);
  if(!extension) return;
  for(const script of availableScripts){
    if(script.extensions.includes(extension)){
      return script;
    }
  }
}

