import { nativeWindow } from "../../../tauri/window";
import { fs } from "../../../tauri/fs";
import {
  ROSTERLOCK_V1_CASTER_JSONSCHEMA,
  EMPTY_ROSTER_DRAFT
} from "@roster-lock/shared";
import { cloneJSON } from "@roster-lock/utils";


export async function newDraftFromLock(){
  const result = await nativeWindow.showOpenDialog({
    title: 'Open Lock File',
    properties: ['openFile'],
    filters: [
      { name: 'Config Files', extensions: ['json'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });

  if(result.canceled) return;
  if(result.filePaths.length === 0) return;

  const openFilePath = result.filePaths[0];

  const json = await fs.readJSON(openFilePath);
  const lockSuccess = ROSTERLOCK_V1_CASTER_JSONSCHEMA.safeCast(json, true);
  if(!lockSuccess.valid){
    throw new Error("Invalid Lock File")
  }
  const saveResult = await nativeWindow.showSaveDialog({
    title: "Save Draft from Lock",
  })
  if(saveResult.canceled) return;
  const { filePath } = saveResult;
  if(!filePath) return;
  const newDraft = cloneJSON(EMPTY_ROSTER_DRAFT);
  newDraft.previousLock = lockSuccess.value
  newDraft.stagedLock = lockSuccess.value;
  await fs.writeJSON(filePath, newDraft)
  return filePath;
}
