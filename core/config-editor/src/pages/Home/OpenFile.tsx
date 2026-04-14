import { useNavigate } from "react-router";
import { RosterLockConfigPaths } from "../config-editor/paths";
import { replaceParams } from "../../utils/router";
import { nativeWindow } from "../../tauri/window";

export function OpenFile(){
  const navigate = useNavigate();

  return <button
    onClick={async () => {
    try {
      const result = await nativeWindow.showOpenDialog({
        title: 'Open Config',
        properties: ['openFile'],
        filters: [
          { name: 'Config Files', extensions: ['json', 'yaml', 'yml'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      });

      if(result.canceled) return;
      if(result.filePaths.length === 0) return;

      const filePath = result.filePaths[0];

      // Navigate to edit page or handle the file
      console.log('Opened file:', filePath);
      navigate(
        replaceParams(RosterLockConfigPaths.fileRoot, { filePath: encodeURIComponent(filePath) })
      )
    } catch (error) {
      console.error('Error opening file:', error);
    }
  }}
  >Open File...</button>

}
