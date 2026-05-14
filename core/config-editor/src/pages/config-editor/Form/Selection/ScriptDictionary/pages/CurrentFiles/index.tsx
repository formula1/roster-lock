import { RosterLockV1Config } from "@roster-lock/types";
import { useRosterLock } from "../../../../Contexts/RosterLock";
import { useDraftScriptInfo } from "../../../../Contexts/DraftScriptInfo";
import { FileSummary } from "./FileSummary";
import { InfoSummary } from "./InfoSummary";
import { cloneJSON } from "@roster-lock/utils";

import { updateScriptRefs, removeScriptRef } from "./scriptRef";
import { useTrackedKey } from "../../../../../../../utils/react"

export function CurrentFilesPage(){
  const { value: lock, onChange: setLock } = useRosterLock();
  const { value: draft, onChange: setDraft } = useDraftScriptInfo();
  const trackedKeys = useTrackedKey();
  const files = lock.selection.scriptDictionary;
  return (
    <>
      <div>Files</div>
      <ul>
        {Object.entries(files).sort(trackedKeys.sortEntries).map(([path, file])=>{
          return (
            <li key={trackedKeys.findOrCreate(path)} className="section" >
              <FileSummary
                value={{ path, file }}
                onChange={(updated)=>{
                  trackedKeys.update(path, updated.path);
                  const cloned = cloneJSON(lock)
                  delete cloned.selection.scriptDictionary[path];
                  cloned.selection.scriptDictionary[updated.path] = updated.file
                  updateScriptRefs(cloned, path, updated.path)
                  setLock(cloned);
                  if(draft[path]){
                    const clonedDraft = cloneJSON(draft);
                    delete clonedDraft[path]
                    clonedDraft[updated.path] = draft[path];
                    setDraft(clonedDraft);
                  }
                }}
                allEntries={lock.selection.scriptDictionary}
                onRemove={()=>{
                  trackedKeys.delete(path);
                  const cloned = cloneJSON(lock)
                  if(!removeScriptRef(cloned, path)) return;
                  delete cloned.selection.scriptDictionary[path];
                  setLock(cloned);
                  if(draft[path]){
                    const clonedDraft = cloneJSON(draft);
                    delete clonedDraft[path]
                    setDraft(clonedDraft);
                  }
                }}
              />
              <InfoSummary
                value={{ path, file }}
                onChange={(updated)=>{
                  trackedKeys.update(path, updated.path);
                  const cloned = cloneJSON(lock)
                  delete cloned.selection.scriptDictionary[path];
                  cloned.selection.scriptDictionary[updated.path] = updated.file
                  updateScriptRefs(cloned, path, updated.path)
                  setLock(cloned);
                  if(draft[path]){
                    const clonedDraft = cloneJSON(draft);
                    delete clonedDraft[path]
                    clonedDraft[updated.path] = draft[path];
                    setDraft(clonedDraft);
                  }
                }}
              />
            </li>
          )
        })}
      </ul>
    </>
  )
}

