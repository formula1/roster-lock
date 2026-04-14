
import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { keyToFilename } from "../../../../utils/filename";
import { fs } from "../../../../tauri/fs";
import { nativeWindow } from "../../../../tauri/window";
import { join as pathJoin } from "path";
import { replaceParams } from "../../../../utils/router";
import { useNewConfig } from "./Config";

import { RosterLockConfigPaths } from "../../paths";

export function useSaveFile(){
  const navigate = useNavigate();
  const { value: config } = useNewConfig();


  return useCallback(async () => {
    const filename = keyToFilename(config.stagedLock.engine.name);
    const matchlockDir = await fs.getMatchLockDir();
    const { canceled, filePath } = await nativeWindow.showSaveDialog({
      title: 'Save Engine Config',
      defaultPath: pathJoin(matchlockDir,`${filename}.rosterlock.json`),
      filters: [
        { name: 'JSON Files', extensions: ['json'] }
      ]
    })
    if(canceled || !filePath) return;

    await fs.writeJSON(filePath, config);
    navigate(replaceParams(RosterLockConfigPaths.fileRoot, { filePath: encodeURIComponent(filePath) }))
  }, [config, navigate])
}
