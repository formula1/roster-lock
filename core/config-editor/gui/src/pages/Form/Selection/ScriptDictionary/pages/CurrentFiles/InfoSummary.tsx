import { useCallback } from "react";
import { InputProps, usePromisedMemo } from "../../../../../../utils/react";
import { useDraftScriptInfo } from "../../../../Contexts/DraftScriptInfo";
import { useHost } from "../../../../../../globals/Host";
import { collectStream } from "../../../../../../utils/walk";
import { bufferToStr, createShaFromBuffer } from "@roster-lock/utils";
import { RosterLockV1Config } from "@roster-lock/types";
import { DiffView } from "../Views";
import { useLightbox } from "../../../../../../components/LightBox";


type ScriptDictionary = RosterLockV1Config["selection"]["scriptDictionary"];
type Script = ScriptDictionary[string];
export function InfoSummary(
  { value, onChange }: (
    & InputProps<{ path: string, file: Script }>
  )
){
  const host = useHost();
  const { value: draft, onChange: setDraft } = useDraftScriptInfo();
  const info = draft[value.path];
  const fileContents = usePromisedMemo(async ()=>{
    if(!info) return null;
    // Hosts that can't re-read persisted paths just don't get the automatic
    // "was modified" check - re-linking the file still works via pickFile.
    if(!host.loadFile) return null;
    const contentRaw = await collectStream(host.loadFile(info.referencePath));
    const content = bufferToStr(contentRaw);
    const sha = await createShaFromBuffer(contentRaw);
    return { sha, content }
  }, [host, info])
  const askForDiff = useDraftDiff({
    configFile: value,
    updateConfig: useCallback(({ content, sha }: { content: string, sha?: string })=>{
      onChange({ ...value, file: { ...value.file, content }})
      if(sha !== undefined && info){
        setDraft({ ...draft, [value.path]: { ...info, sha, lastLoad: Date.now() } })
      }
    }, [value, onChange, draft, info, setDraft])
  })
  if(!info){
    return (
    <div>
      <button
        onClick={async ()=>{
          const picked = await host.pickFile({ title: "Link to File" })
          if(!picked) return;
          const contentRaw = await collectStream(picked.loadFile());
          const content = bufferToStr(contentRaw);
          const sha = await createShaFromBuffer(contentRaw);
          // Without a fileToken the reference is display-only - the host
          // can't re-read it later anyway.
          const referencePath = picked.fileToken ?? picked.name;
          setDraft({
            ...draft,
            [value.path]: {
              lastLoad: Date.now(),
              sha,
              referencePath
            }
          })
          askForDiff({ path: referencePath, content })
        }}
      >Link to File</button>
    </div>
    );
  }

  return (
    <>
      <div>
        <span>Full Path:</span>
        <span>{info.referencePath}</span>
      </div>
      <div>
        <span>Last Load:</span>
        <span>{new Date(info.lastLoad).toLocaleString()}</span>
      </div>
      <div>
        <span>Was Modified:</span>
        <FileContentDiff
          activeSha={info.sha}
          loadedValue={fileContents}
          referencePath={info.referencePath}
          toggleDiff={askForDiff}
        />
      </div>
    </>
  )
}

function FileContentDiff(
  { activeSha, loadedValue, referencePath, toggleDiff }: {
    activeSha: string,
    loadedValue: ReturnType<typeof usePromisedMemo<any, null | { sha: string, content: string }>>,
    referencePath: string,
    toggleDiff: (referenceFile: { path: string, content: string, sha?: string })=>any
  }
){
  if(loadedValue.status === "pending") return <span>Loading</span>
  if(loadedValue.status === "failed") return <span style={{ color: "#FF0000" }}>Failed to Load</span>
  if(!loadedValue.value) return null;
  if(loadedValue.value.sha !== activeSha){
    const { content, sha } = loadedValue.value;
    return (
      <>
        <span style={{ color: "#FFFF00" }}>Script is different than File</span>
        <button
          onClick={()=>(toggleDiff({ path: referencePath, content, sha }))}
        >Update Config</button>
      </>
    )
  }
  return <span style={{ color: "#00FF00" }}>Content is Correct</span>
}



export function useDraftDiff(
  {
    configFile, updateConfig
  }: {
    configFile: { path: string, file: Script }
    updateConfig: (config: { content: string, sha?: string })=>any
  }
){
  const lightbox = useLightbox()
  return useCallback((referenceFile: { path: string, content: string, sha?: string })=>{
    lightbox.open(
      <DiffView
        description={
          <p>
            The loaded file's content is different that what is in the lock file.
            Would you like to overwrite what is in the lock file?
          </p>
        }
        path={referenceFile.path}
        configContent={configFile.file.content}
        fileContent={referenceFile.content}
        onKeepConfig={()=>{
          lightbox.close();
        }}
        onUseFile={()=>{
          updateConfig({ content: referenceFile.content, sha: referenceFile.sha })
          lightbox.close();
        }}
      />
    )
  }, [lightbox, configFile, updateConfig])
}

