import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { dirname, join as pathJoin } from "@tauri-apps/api/path";
import {
  useConfigSource, useRecentFiles, RosterLockPaths, type ConfigSource,
} from "@roster-lock/config-editor-gui";
import type { JSON_Unknown } from "@roster-lock/utils";

import { fs } from "../tauri/fs";
import { showSaveDialog } from "../tauri/window";

export const RECENT_ROSTERLOCK_CONFIG_FILES_KEY = "recent-rosterlock-files";

const JSON_FILTERS = [{ name: "JSON Files", extensions: ["json"] }];

// Open a draft file into the gui's ConfigSource and jump to the editor.
// The file path never reaches the gui - it lives inside the source's
// closures (and moves when the user does a Save As).
export function useOpenDraftFile(){
  const [, setSource] = useConfigSource();
  const navigate = useNavigate();
  const { addRecentFile } = useRecentFiles(RECENT_ROSTERLOCK_CONFIG_FILES_KEY);

  return useCallback(async (filePath: string) => {
    await loadFileIntoSource(filePath, setSource);
    await addRecentFile(filePath);
    navigate(RosterLockPaths.Root);
  }, [setSource, navigate, addRecentFile]);
}

type SetSource = (source: ConfigSource) => void;

async function loadFileIntoSource(filePath: string, setSource: SetSource){
  try {
    const contents = await fs.readJSON(filePath);
    setSource(fileSource(filePath, contents, setSource));
  }catch(error){
    setSource({
      state: "error",
      error,
      reload: () => { loadFileIntoSource(filePath, setSource); },
    });
  }
}

function fileSource(filePath: string, contents: JSON_Unknown, setSource: SetSource): ConfigSource {
  return {
    state: "ready",
    contents,
    reload: () => { loadFileIntoSource(filePath, setSource); },
    save: async (newDraft) => {
      await fs.writeJSON(filePath, newDraft);
    },
    saveAs: async (newDraft) => {
      const { canceled, filePath: newPath } = await showSaveDialog({
        title: "Save Draft",
        defaultPath: filePath,
        filters: JSON_FILTERS,
      });
      if(canceled || !newPath) return;
      await fs.writeJSON(newPath, newDraft);
      // Re-point the source so later saves go to the new file.
      setSource(fileSource(newPath, newDraft as JSON_Unknown, setSource));
    },
    publish: async (lock) => {
      const defaultPath = await pathJoin(
        await dirname(filePath),
        `${lock.title}-${lock.version}.rosterlock.json`
      );
      const { canceled, filePath: lockPath } = await showSaveDialog({
        title: "Publish new Roster Lock file",
        defaultPath,
        filters: JSON_FILTERS,
      });
      if(canceled || !lockPath) return;
      await fs.writeJSON(lockPath, lock);
    },
  };
}
