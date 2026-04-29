import { Outlet, useLocation, useParams } from "react-router";
import { LinkTabs } from "../../../components/Tabs";
import { FileRosterConfigPaths as ConfigPaths } from "./paths";
import { replaceParams } from "../../../utils/router";
import { useCurrentRosterLockFile, CurrentRosterLockFileProvider } from "./data/CurrentFile";
import { useEffect, useMemo } from "react";
import { useRecentFiles } from "../../../globals/recent-files";
import { RECENT_ROSTERLOCK_CONFIG_FILES_KEY } from "../constants";
import { ContextFromDraftProvider } from "../Contexts/ContextFromDraft";
import { useSaveAs } from "./data/saveAs";
import { FollowButtonsProvider } from "../Form/Contexts/Buttons";

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
        { title: 'New', href: ConfigPaths.Root },
        ...(!fileReady ? [] : [
          { title: "Save", onClick: () => currentFile.save() },
          {
            title: "OverView", href: replaceParams(
              ConfigPaths.Root, { filePath: encodeURIComponent(currentFile.activeFile) }
            )
          },
          {
            title: 'Engine', href: replaceParams(
              ConfigPaths.Engine, { filePath: encodeURIComponent(currentFile.activeFile) }
            ),
          },
          {
            title: 'Rosters', href: replaceParams(
              ConfigPaths.Roster, { filePath: encodeURIComponent(currentFile.activeFile) }
            ),
          },
          {
            title: 'Selection', href: replaceParams(
              ConfigPaths.Selection, { filePath: encodeURIComponent(currentFile.activeFile) }
            ),
          },
        ])
      ]}
    />
  )
}

function FileErrorOrOutlet(){
  const currentFile = useCurrentRosterLockFile();
  const saveAs = useSaveAs();
  const location = useLocation();

  if(!currentFile.activeFile) return <Outlet />;
  if(currentFile.state === "loading") return <Outlet />;
  if(currentFile.state === "failed"){
    console.log("Failed to load file", currentFile);
    return <div>
      <h1>Failed to load file</h1>
      <h3><button onClick={()=>(currentFile.reload())}>Reload</button></h3>
      <pre>{currentFile.error.message || JSON.stringify(currentFile.error, null, 2)}</pre>
      {currentFile.value && <pre>{JSON.stringify(currentFile.value, null, 2)}</pre>}
    </div>
  }
  return (
  <FollowButtonsProvider
    buttons={[
      {
        label: "Save",
        onClick: async ()=>{
          await currentFile.save();
        },
        disabled: !currentFile.isDirty,
      },
      {
        label: "Save As...",
        onClick: async ()=>{
          const urlParts = location.pathname.split("/");
          urlParts[2] = ":filePath";
          saveAs(urlParts.join("/"));
        },
      },
      {
        label: "Reset Changes ",
        onClick: () => currentFile.reset(),
        disabled: !currentFile.isDirty,
      },
    ]}
  >
  <ContextFromDraftProvider
    value={currentFile.value}
    onChange={currentFile.update}
  >
    <Outlet />
  </ContextFromDraftProvider>
  </FollowButtonsProvider>
  );
}
