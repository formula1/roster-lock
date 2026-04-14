import { useState } from "react";
import { useRecentFiles } from "../../../../../globals/recent-files";
import { nativeWindow } from "../../../../../tauri/window";
import { InputProps } from "../../../../../utils/react";

import { dirname } from "path";

const TEST_FOLDERS = "engine-test-folders";
export function FolderInput(
  { value, onChange }: (
    & InputProps<string>
  )
){
  const { addRecentFile, value: recentFiles } = useRecentFiles(TEST_FOLDERS);
  const [showRecent, setShowRecent] = useState(true);

  return (
    <>
      <h3>Folder to Test</h3>
      <button
        onClick={async ()=>{
          const defaultPath = (function(){
            const path = value || recentFiles && recentFiles[0]?.path;
            if(!path) return;
            return dirname(path);
          })();
          const { canceled, filePaths } = await nativeWindow.showOpenDialog({
            title: 'Select Folder to Test',
            properties: ['openDirectory'],
            filters: [],
            defaultPath,
          })
          if(canceled) return;
          if(filePaths.length === 0) return;
          const folderPath = filePaths[0];
          addRecentFile(folderPath);
          onChange(folderPath);
        }}
      >
        {value ? 'Change Folder...' : 'Select Folder...'}
      </button>
      {value && <div>Selected: {value}</div>}
      {recentFiles && recentFiles.length > 0 && <div>
      </div>}
      {recentFiles && recentFiles.length > 0 && (
        <div>
          <h4 onClick={() => setShowRecent(!showRecent)}>
            Recent Folders <button
              onClick={() => setShowRecent(!showRecent)}
            > {showRecent ? 'Hide' : 'Show'}</button>
          </h4>
          {showRecent && (
            <ul>
            {recentFiles.map((file) => (
              <li key={file.path}>
                <button
                  onClick={() => {
                    onChange(file.path);
                  }}
                >
                  {file.path}
                </button>
              </li>
            ))}
          </ul>)}
        </div>
      )}
    </>
  )
}
