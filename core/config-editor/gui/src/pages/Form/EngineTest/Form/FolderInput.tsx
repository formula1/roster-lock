import { useState } from "react";
import { useHost, FOLDER_ACCESS_HINT } from "../../../../globals/Host";
import { useRecentFiles } from "../../../../globals/recent-files";
import { InputProps } from "../../../../utils/react";

const TEST_FOLDERS = "engine-test-folders";
export function FolderInput(
  { value, onChange }: (
    & InputProps<string>
  )
){
  const host = useHost();
  const { addRecentFile, value: recentFiles } = useRecentFiles(TEST_FOLDERS);
  const [showRecent, setShowRecent] = useState(true);

  return (
    <>
      <h3>Folder to Test</h3>
      <button
        disabled={!host.walkDir}
        title={!host.walkDir ? FOLDER_ACCESS_HINT : undefined}
        onClick={async ()=>{
          if(!host.walkDir) return;
          const walked = await host.walkDir(undefined, { title: 'Select Folder to Test' });
          if(!walked) return;
          addRecentFile(walked.folderToken);
          onChange(walked.folderToken);
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
