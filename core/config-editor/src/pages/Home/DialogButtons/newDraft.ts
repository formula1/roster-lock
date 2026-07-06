import { showSaveDialog } from "../../../tauri/window";
import { EMPTY_ROSTER_LOCK } from "@roster-lock/shared";
import { fs } from "../../../tauri/fs";

export async function newDraft(){
  const result = await showSaveDialog({
    title: "Save new Draft"
  });
  if(result.canceled) return;
  const { filePath } = result;
  if(!filePath) return;
  await fs.writeJSON(filePath, EMPTY_ROSTER_LOCK)
  return filePath
}
