import type { HostFunctions } from "@roster-lock/config-editor-gui";
import type { JSON_Unknown } from "@roster-lock/utils";
import {
  supportsFolderAccess, walkDir, folderExists, loadFile,
  pickHostFile, downloadFile,
} from "./files";

const STORAGE_PREFIX = "roster-lock-editor:storage:";

export function createPwaHost(): HostFunctions {
  return {
    openUrl: (url) => { window.open(url, "_blank", "noopener"); },

    // Folder access rides on the File System Access API - Chromium only, so
    // elsewhere these stay undefined and the UI disables folder features.
    ...(supportsFolderAccess ? { walkDir, folderExists, loadFile } : {}),

    pickFile: () => pickHostFile(),

    saveFile: async ({ suggestedName, data }) => {
      downloadFile(suggestedName, data);
      return true;
    },

    storage: {
      get: async (key) => {
        const raw = localStorage.getItem(STORAGE_PREFIX + key);
        if(raw === null) return null;
        try {
          return JSON.parse(raw) as JSON_Unknown;
        }catch(e){
          return null;
        }
      },
      set: async (key, value) => {
        localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
      },
      remove: async (key) => {
        localStorage.removeItem(STORAGE_PREFIX + key);
      },
    },
  };
}
