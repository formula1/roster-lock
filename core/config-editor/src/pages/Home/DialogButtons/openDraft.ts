import { nativeWindow } from "../../../tauri/window";
import { fs } from "../../../tauri/fs";
import {
  ROSTERLOCK_V1_DRAFT_CASTER_JSONSCHEMA,
} from "@roster-lock/shared";


export async function openDraft(){
  const result = await nativeWindow.showOpenDialog({
    title: 'Open Draft',
    properties: ['openFile'],
    filters: [
      { name: 'Config Files', extensions: ['json'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });

  if(result.canceled) return;
  if(result.filePaths.length === 0) return;

  const filePath = result.filePaths[0];

  const json = await fs.readJSON(filePath);
  const draftSuccess = ROSTERLOCK_V1_DRAFT_CASTER_JSONSCHEMA.safeCast(json, true);
  if(!draftSuccess.valid){
    throw new Error("Invalid Draft File")
  }
  return filePath;
}