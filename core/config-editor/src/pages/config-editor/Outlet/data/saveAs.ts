import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useCurrentRosterLockFile } from "./CurrentFile";
import { nativeWindow } from "../../../../tauri/window";
import { replaceParams } from "../../../../utils/router";


export function useSaveAs(){
  const navigate = useNavigate();
  const currentFile = useCurrentRosterLockFile();
  

  return useCallback(async (newURL: string) => {
    if(!currentFile.activeFile){
      throw new Error("No active file");
    }
    if(currentFile.state !== "ready"){
      throw new Error("File is not ready");
    }
    const filePath = currentFile.activeFile;
    if(!filePath) return;
    const { canceled, filePath: newFilePath } = await nativeWindow.showSaveDialog({
      title: 'Save Draft',
      defaultPath: filePath,
      filters: [
        { name: 'JSON Files', extensions: ['json'] }
      ]
    })
    if(canceled || !newFilePath) return;
    await currentFile.saveAs(newFilePath);
    if(newFilePath === filePath) return;

    // Update the file path to the new file
    navigate(replaceParams(
      newURL,
      { filePath: encodeURIComponent(newFilePath) }
    ));
  }, [currentFile, navigate]);
}
