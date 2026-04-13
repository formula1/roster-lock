
import { EngineConfigForm, EngineLegend } from "../Form";
import { RosterLockConfigPaths } from "../paths";

import { useCurrentRosterLockFile } from "./data/CurrentFile";

import { FollowButtonForm } from "../../../components/FollowButtonForm";
import { useSaveAs } from "./data/saveAs";
export function FileEngineConfig(){
  const currentFile = useCurrentRosterLockFile();
  const saveAs = useSaveAs();

  if(!currentFile.activeFile){
    return <div>No active file</div>
  }

  if(currentFile.state === "loading"){
    return <div>Loading...</div>
  }

  if(currentFile.state === "failed"){
    return <div>Failed</div>
  }

  const filePath = currentFile.activeFile;

  return <div style={{ overflow: "hidden", flexGrow: 1, ...(!currentFile.isDirty ? {}  : DIRTY_STYLES) }}>
    <h1>{filePath}</h1>
    <FollowButtonForm
      info={{
        title: "Engine Config",
        note: (
          <>
            {!currentFile.isDirty ? null : <div className="error">You have unsaved changes</div>}
            <EngineLegend config={currentFile.value.stagedLock} />
          </>
        ),
      }}
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
            saveAs(RosterLockConfigPaths.fileEngine);
          },
        },
        {
          label: "Reset Changes ",
          onClick: () => currentFile.reset(),
          disabled: !currentFile.isDirty,
        },
      ]}
    >
      <EngineConfigForm
        value={currentFile.value.stagedLock}
        onChange={(stagedLock)=>{
          currentFile.update((oldValue)=>({ ...oldValue, stagedLock }))
        }}
      />
    </FollowButtonForm>
  </div>
}

const DIRTY_STYLES: React.CSSProperties = {
  backgroundColor: "#FFC",
};

