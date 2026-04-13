
import { EngineTest } from "../Form";

import { useCurrentRosterLockFile } from "./data/CurrentFile";

export function FileEngineTest(){
  const currentFile = useCurrentRosterLockFile();
  if(!currentFile.activeFile){
    return <div>No active file</div>
  }

  if(currentFile.state === "loading"){
    return <div>Loading...</div>
  }

  if(currentFile.state === "failed"){
    return <div>Failed</div>
  }

  return <EngineTest config={currentFile.value.stagedLock} />;
}
