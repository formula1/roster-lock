import { RosterLockV1Config } from "@roster-lock/types";
import { useRosterLock } from "../../../../Contexts/RosterLock";
import { useDraftScriptInfo } from "../../../../Contexts/DraftScriptInfo";
import { FileSummary } from "./FileSummary";
import { InfoSummary } from "./InfoSummary";
import { cloneJSON } from "@roster-lock/utils";

export function CurrentFilesPage(){
  const { value: lock, onChange: setLock } = useRosterLock();
  const { value: draft, onChange: setDraft } = useDraftScriptInfo();
  const files = lock.selection.scriptDictionary;
  return (
    <>
      <div>Files</div>
      <ul>
        {Object.entries(files).map(([path, file])=>{
          return (
            <li>
              <FileSummary
                value={{ path, file }}
                onChange={(updated)=>{
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

function updateScriptRefs(
  mutableLock: RosterLockV1Config, oldRef: string, newRef: string
){
  if(oldRef === newRef) return;
  for(const script of mutableLock.selection.globalValidation){
    if(script.src === oldRef) script.src = newRef
  }
  for(const [k, v] of Object.entries(mutableLock.selection.piece)){
    if(v.type !== "normal") continue;
    if(v.mergeAlgorithm){
      if(v.mergeAlgorithm.src === oldRef) v.mergeAlgorithm.src = newRef
    }
    for(const script of v.validation.customValidation){
      if(script.src === oldRef) script.src = newRef
    }
  }
}

const DONT_UPDATE = Symbol("Dont Update Script")
function removeScriptRef(
  mutableLock: RosterLockV1Config, ref: string
){
  let confirmed = false;
  try {
    mutableLock.selection.globalValidation = mutableLock.selection.globalValidation.filter((script)=>{
      if(script.src !== ref) return true;
      confirmRemove();
      return false;
    })
    for(const [k, v] of Object.entries(mutableLock.selection.piece)){
      if(v.type !== "normal") continue;
      if(v.mergeAlgorithm){
        if(v.mergeAlgorithm.src === ref){
          confirmRemove();
          v.mergeAlgorithm = void 0
        }
      }
      v.validation.customValidation = v.validation.customValidation.filter((script)=>{
        if(script.src !== ref) return true;
        confirmRemove();
        return false;
      })
    }
  }catch(e){
    if(e === DONT_UPDATE) return false;
    throw e
  }

  function confirmRemove(){
    if(confirmed) return;
    if(!confirm(
      [
        "This script is being used, are you sure you want to remove it?",
        ref
      ].join("\n")
    )) throw DONT_UPDATE;
    confirmed = true;
  }
}