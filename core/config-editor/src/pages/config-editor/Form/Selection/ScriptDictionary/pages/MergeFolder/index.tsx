import { useCallback, useEffect, useRef, useState } from "react";
import { useRosterLock } from "../../../../Contexts/RosterLock";
import { useDraftScriptInfo } from "../../../../Contexts/DraftScriptInfo";
import { loadFolder } from "./load-folder";

import { PreppedScripts, ScriptDictionary, ScriptInfo } from "./types"
import { MergeForm } from "./MergeForm";


export function MergeFolderPage(){
  const { value: lock, onChange: setLock } = useRosterLock();
  const { value: draft, onChange: setDraft } = useDraftScriptInfo();

  return (
    <MergeFolder
      onSubmit={({ files, info })=>{
        setLock({
          ...lock,
          selection: {
            ...lock.selection,
            scriptDictionary: {
              ...lock.selection.scriptDictionary,
              ...files
            }
          }
        })
        setDraft({
          ...draft,
          ...info
        })
      }}
    />
  )

}

const UNKNOWN_MIMETYPE = "UNKNOWN_MIMETYPE";
export function MergeFolder(
  { onSubmit}: {
    onSubmit: (updated: { files: ScriptDictionary, info: ScriptInfo })=>any
  }
){

  const [folder, setFolder] = useState<string | null>(null);
  const [prepped, setPrepped] = useState<PreppedScripts | null>(null);

  const loadAndSave = useCallback(async ()=>{
    const result = await loadFolder();
    if(!result) return;
    setFolder(result.folder);
    setPrepped({ files: result.files, info: result.info })
  }, [])

  const hasOpened = useRef(false);
  useEffect(()=>{
    if(hasOpened.current) return;
    hasOpened.current = true;
    loadAndSave();
  }, [])


  return (
    <>
      <div style={{ textAlign: "center" }}>
        <button
          style={{ padding: "30px", fontSize: "2em" }}
          onClick={async ()=>{loadAndSave()}}
        >Load Folder</button>
      </div>
      {folder !== null && prepped !== null && (
        <MergeForm
          folder={folder}
          prepped={prepped}
          onSubmit={(prepped)=>{
            onSubmit(prepped);
            setFolder(null);
            setPrepped(null)
          }}
        />

      )}
    </>
  )
}


