import { RosterLockV1Config, RosterLockV1Draft } from "@roster-lock/types";
import { InputProps } from "../../../../../../utils/react";
import { useMemo, useState } from "react";
import { fs } from "../../../../../../tauri/fs";
import { showOpenDialog } from "../../../../../../tauri/window";
import { bufferToStr, createShaFromBuffer, fileExtension } from "@roster-lock/utils";
import { getUntrustedScriptByFileExtension } from "@roster-lock/shared";
import { FileSummary } from "./CurrentFiles/FileSummary";
import { useRosterLock } from "../../../Contexts/RosterLock";
import { useDraftScriptInfo } from "../../../Contexts/DraftScriptInfo";

type ScriptDictionary = RosterLockV1Config["selection"]["scriptDictionary"];
type ScriptInfo = RosterLockV1Draft["draft"]["selectionScriptInfo"];

export function MergeFolderPage(){
  const { value: lock, onChange: setLock } = useRosterLock();
  const { value: draft, onChange: setDraft } = useDraftScriptInfo();

  const dictionary = lock.selection.scriptDictionary
  return (
    <MergeFolder
      dictionary={dictionary}
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
  { dictionary, onSubmit}: {
    dictionary: ScriptDictionary,
    onSubmit: (updated: { files: ScriptDictionary, info: ScriptInfo })=>any
  }
){


  const [folder, setFolder] = useState<string | null>(null);
  const [files, setFiles] = useState<ScriptDictionary | null>(null);
  const [info, setInfo] = useState<ScriptInfo | null>(null);
  const problems = useMemo(()=>{
    if(!files) return {};
    const problems: Record<string, Array<string>> = {}
    for(const file in files){
      if(dictionary[file]){
        addError(file, "File already exists" )
      }
      const supportsExtension = getUntrustedScriptByFileExtension(file);
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
  }, [dictionary, files]);
  return (
    <>
      <div>
        <button
          onClick={async ()=>{
            const openResult = await showOpenDialog({
              title: "Load Script Folder",
              properties: ["openDirectory"],
            });
            if(openResult.canceled) return;
            if(openResult.filePaths.length === 0) return;
          
            let folder = openResult.filePaths[0];
            if(folder.at(-1) !== "/") folder += "/";
            setFolder(folder);

            const { files, info } = await loadFolderContents(folder);

            setFiles(files);
            setInfo(info);
          }}
        >Load Folder</button>
      </div>
      <div>
        <button
          disabled={
            folder === null ||
            files === null ||
            info === null ||
            Object.keys(problems).length > 0
          }
          onClick={async ()=>{
            if(files === null || info === null){
              throw new Error("Files or info not loaded")
            }
            if(Object.keys(problems).length > 0){
              throw new Error("There are problems")
            }
            await onSubmit({ files, info })
            setFolder(null);
            setFiles(null);
            setInfo(null)
          }}
        >Merge Files</button>
      </div>
      {folder !== null && files !== null && (
        <>
          <div>Folder Path: {folder}</div>
          <div>
            <div>Files</div>
            <ul>
              {Object.entries(files).map(([path, file])=>{
                return (
                  <li>
                    <LoadedFileEntry
                      value={{ path, file }}
                      onChange={(newValue)=>{
                        const newFiles = {
                          ...files,
                          [newValue.path]: file
                        }
                        delete newFiles[path];
                        setFiles(newFiles);
                      }}
                      onRemove={()=>{
                        const newFiles = {
                          ...files,
                        }
                        delete newFiles[path];
                        setFiles(newFiles);
                      }}
                      allEntries={files}
                      errors={problems[path] || []}
                    />
                  </li>
                )
              })}
            </ul>
          </div>
        </>
      )}
    </>
  )
}

async function loadFolderContents(folder: string){
  const lastLoad = Date.now();
  const files: ScriptDictionary = {};
  const info: ScriptInfo = {};
  const promises: Array<Promise<any>> = []
  for await (const fileResult of fs.walkDirStream(folder)){
    if(fileResult.is_directory) continue;
    const filepath = fileResult.path;
    const relativePath = fileResult.relative_path;
    promises.push(Promise.resolve().then(async ()=>{
      const contentRaw = await fs.readFile(filepath);
      files[relativePath] = {
        content: bufferToStr(contentRaw as Uint8Array<ArrayBuffer>)
      }
      const sha = await createShaFromBuffer(contentRaw);
      info[relativePath] = {
        lastLoad, sha, referencePath: filepath
      }
    }))
  }
  await Promise.all(promises)
  return { files, info }
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


