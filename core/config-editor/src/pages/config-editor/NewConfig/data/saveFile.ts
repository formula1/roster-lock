
import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { keyToFilename } from "../../../../utils/filename";
import { fs } from "../../../../tauri/fs";
import { nativeWindow } from "../../../../tauri/window";
import { join as pathJoin } from "path";
import { replaceParams } from "../../../../utils/router";
import { useNewConfig } from "./Config";

import { FileRosterConfigPaths } from "../../FileConfig";

export function useSaveFile(){
  const navigate = useNavigate();
  const { value: config } = useNewConfig();


  return useCallback(async () => {
    const filename = keyToFilename(config.stagedLock.title);
    const matchlockDir = await fs.getMatchLockDir();
    const { canceled, filePath } = await nativeWindow.showSaveDialog({
      title: 'Save New Draft',
      defaultPath: pathJoin(matchlockDir,`${filename}.rosterlock.draft.json`),
      filters: [
        { name: 'JSON Files', extensions: ['json'] }
      ]
    })
    if(canceled || !filePath) return;

    await fs.writeJSON(filePath, config);
    navigate(replaceParams(FileRosterConfigPaths.Root, { filePath: encodeURIComponent(filePath) }))
  }, [config, navigate])
}
