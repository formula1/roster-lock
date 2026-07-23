import { RosterLockV1Config, RosterLockV1Draft } from "@roster-lock/types";
import { useCallback, useEffect, useRef } from "react";
import { fs } from "../../../../../../../tauri/fs";
import { showOpenDialog } from "../../../../../../../tauri/window";
import { bufferToStr, createShaFromBuffer } from "@roster-lock/utils";

type ScriptDictionary = RosterLockV1Config["selection"]["scriptDictionary"];
type ScriptInfo = RosterLockV1Draft["draft"]["selectionScriptInfo"];


export async function loadFolder(){
  const openResult = await showOpenDialog({
    title: "Load Script Folder",
    properties: ["openDirectory"],
  });
  if(openResult.canceled) return;
  if(openResult.filePaths.length === 0) return;

  let folder = openResult.filePaths[0];
  if(folder.at(-1) !== "/") folder += "/";

  const { files, info } = await loadFolderContents(folder);

  return { folder, files, info }
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
