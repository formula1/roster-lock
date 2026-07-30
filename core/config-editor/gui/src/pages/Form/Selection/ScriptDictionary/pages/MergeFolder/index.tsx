import { useCallback, useEffect, useRef, useState } from "react";
import { useRosterLock } from "../../../../Contexts/RosterLock";
import { useDraftScriptInfo } from "../../../../Contexts/DraftScriptInfo";
import { loadFolder } from "./load-folder";

import { PreppedScripts, ScriptDictionary, ScriptInfo } from "./types"
import { MergeForm } from "./MergeForm";
import { useHost, FOLDER_ACCESS_HINT } from "../../../../../../globals/Host";


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

  const host = useHost();
  const [folder, setFolder] = useState<string | null>(null);
  const [prepped, setPrepped] = useState<PreppedScripts | null>(null);

  const loadAndSave = useCallback(async ()=>{
    const result = await loadFolder(host);
    if(!result) return;
    setFolder(result.folder);
    setPrepped({ files: result.files, info: result.info })
  }, [host])

  const canWalk = !!host.walkDir;
  const hasOpened = useRef(false);
  useEffect(()=>{
    if(!canWalk) return;
    if(hasOpened.current) return;
    hasOpened.current = true;
    loadAndSave();
  }, [canWalk, loadAndSave])

  if(!canWalk){
    return <div className="error">{FOLDER_ACCESS_HINT}</div>;
  }

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


