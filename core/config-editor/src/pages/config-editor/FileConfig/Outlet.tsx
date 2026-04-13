import { Outlet, useParams } from "react-router";
import { LinkTabs } from "../../../components/Tabs";
import { RosterLockConfigPaths as ConfigPaths } from "../paths";
import { replaceParams } from "../../../utils/router";
import { useCurrentRosterLockFile, CurrentRosterLockFileProvider } from "./data/CurrentFile";
import { useEffect, useMemo } from "react";
import { useRecentFiles } from "../../../globals/recent-files";
import { RECENT_ROSTERLOCK_CONFIG_FILES_KEY } from "../constants";
import { DraftInfoProvider } from "../Contexts/DraftInfo";

export function FileConfigOutlet(){
  const params = useParams();

  const activeFile = useMemo(() => {
    if(!params.filePath) return;
    return decodeURIComponent(params.filePath);
  }, [params.filePath]);


  const { addRecentFile } = useRecentFiles(RECENT_ROSTERLOCK_CONFIG_FILES_KEY);
  
  useEffect(()=>{
    if(activeFile) addRecentFile(activeFile);
  }, [activeFile])
  

  return <CurrentRosterLockFileProvider filePath={activeFile}>
    <ConfigTabs />
    <FileErrorOrOutlet />
  </CurrentRosterLockFileProvider>
}

function ConfigTabs(){
  const currentFile = useCurrentRosterLockFile();
  const fileReady = currentFile.activeFile && currentFile.state === "ready";
  return (
    <LinkTabs
      className="secondary"
      pages={[
        { title: 'Recent Files', href: "/" },
        { title: 'New', href: ConfigPaths.newRoot },
        !fileReady ? null :
        {
          title: 'Engine', href: replaceParams(
            ConfigPaths.fileEngine, { filePath: encodeURIComponent(currentFile.activeFile) }
          ),
        },
        !fileReady ? null :
        {
          title: 'Rosters', href: replaceParams(
            ConfigPaths.fileRoster, { filePath: encodeURIComponent(currentFile.activeFile) }
          ),
        },
        !fileReady ? null :
        {
          title: 'Selection', href: replaceParams(
            ConfigPaths.fileSelection, { filePath: encodeURIComponent(currentFile.activeFile) }
          ),
        },
      ]}
    />
  )
}

function FileErrorOrOutlet(){
  const currentFile = useCurrentRosterLockFile();

  if(!currentFile.activeFile) return <Outlet />;
  if(currentFile.state === "loading") return <Outlet />;
  if(currentFile.state === "failed"){
    console.log("Failed to load file", currentFile);
    return <div>
      <h1>Failed to load file</h1>
      <pre>{JSON.stringify(currentFile.error, null, 2)}</pre>
    </div>
  }
  return <DraftInfoProvider draft={currentFile.value}>
    <Outlet />
  </DraftInfoProvider>;
}
