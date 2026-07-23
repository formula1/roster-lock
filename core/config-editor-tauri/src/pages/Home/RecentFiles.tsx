import { Link } from "react-router-dom";
import { useRecentFiles } from "../../globals/recent-files";
import { replaceParams } from "../../utils/router";
import { RosterLockPaths } from "../config-editor";
import { ToolTipSpan } from "../../components/ToolTip";

import { RECENT_ROSTERLOCK_CONFIG_FILES_KEY } from "../config-editor/constants";

export function RecentFiles(
  { maxDisplay }: { maxDisplay?: number }
) {
  const {
    value: recentFiles, loading, error,
    removeRecentFile,
    clearRecentFiles,
  } = useRecentFiles(RECENT_ROSTERLOCK_CONFIG_FILES_KEY);

  if (loading) {
    return <div>Loading recent files...</div>;
  }

  if (error) {
    return (
      <div>
        <p>Error loading recent files: {error}</p>
      </div>
    );
  }
  if (!recentFiles || recentFiles.length === 0) {
    return (
      <div>
        <p>No recent files</p>
      </div>
    );
  }


  const displayFiles = maxDisplay ? recentFiles.slice(0, maxDisplay) : recentFiles;

  return (
    <div>
      <div>
        <h3>Recent Files</h3>
        <button 
          onClick={()=>{
            if (confirm('Are you sure you want to clear all recent files?')) {
              clearRecentFiles();
            }
          }}
          title="Clear all recent files"
        >
          Clear All
        </button>
      </div>
      
      <div>
        {displayFiles.map((file, index) => (
          <div
            key={`${file.path}-${index}`}
            style={{ padding: "5px", border: "solid 1px #000", borderRadius: "5px" }}
          >
            <div className="file-info">
              <Link to={
                replaceParams(RosterLockPaths.Root, { filePath: encodeURIComponent(file.path) })
              } >
                <ToolTipSpan className="file-name" tip={file.path}>{file.name}</ToolTipSpan>
              </Link>
              <div className="file-date">
                Last opened: {formatDate(file.lastOpened)}
              </div>
              {file.type && (
                <div className="file-type">Type: {file.type}</div>
              )}
            </div>
            
            <button
              onClick={(e) =>{
                e.stopPropagation();
                removeRecentFile(file.path);
              }}
              title="Remove from recent files"
            >
              Remove From Recent Files
            </button>
          </div>
        ))}
      </div>
      
      {maxDisplay && recentFiles.length > maxDisplay && (
        <div className="recent-files-footer">
          <p>Showing {maxDisplay} of {recentFiles.length} recent files</p>
        </div>
      )}
    </div>
  );
}

function formatDate(dateString: string){
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  } catch {
    return 'Unknown';
  }
};
