import { RosterLockV1Config } from "@roster-lock/types";

export function updateScriptRefs(
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
export function removeScriptRef(
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