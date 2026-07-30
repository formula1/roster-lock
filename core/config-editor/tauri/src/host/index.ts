import { open as shellOpen } from "@tauri-apps/plugin-shell";
import { type HostFunctions, type WalkEntry } from "@roster-lock/config-editor-gui";

import { fs } from "../tauri/fs";
import { showOpenDialog, showSaveDialog } from "../tauri/window";
import { storage } from "../tauri/json-storage";

// The Tauri implementation of the shared gui's host interface. Tokens are
// plain absolute paths here - the browser-based hosts are the ones that
// need something more indirect.

async function* walkEntries(folder: string): AsyncGenerator<WalkEntry> {
  for await (const result of fs.walkDirStream(folder)){
    if(!result.is_file) continue;
    const path = result.path;
    yield {
      relativePath: result.relative_path,
      fileToken: path,
      size: result.size,
      loadFile: () => fs.getFileStream(path),
    };
  }
}

export const HOST: HostFunctions = {
  openUrl: (url) => { shellOpen(url); },

  walkDir: async (folderToken, options) => {
    let folder = folderToken;
    if(!folder){
      const { canceled, filePaths } = await showOpenDialog({
        title: options?.title,
        properties: ["openDirectory"],
        filters: [],
      });
      if(canceled || filePaths.length === 0) return null;
      folder = filePaths[0];
    }
    const walkedFolder = folder;
    return {
      folderToken: walkedFolder,
      // Fresh generator per iteration so the same WalkedFolder can be
      // walked more than once.
      entries: { [Symbol.asyncIterator]: () => walkEntries(walkedFolder) },
    };
  },

  folderExists: (folderToken) => fs.exists(folderToken),

  pickFile: async (options) => {
    const { canceled, filePaths } = await showOpenDialog({
      title: options?.title,
      properties: ["openFile"],
    });
    if(canceled || filePaths.length === 0) return null;
    const path = filePaths[0];
    const info = await fs.stat(path);
    return {
      name: path.split(/[/\\]/).pop() || path,
      size: info.size,
      fileToken: path,
      loadFile: () => fs.getFileStream(path),
    };
  },

  loadFile: (fileToken) => fs.getFileStream(fileToken),

  saveFile: async ({ suggestedName, data, title, filters }) => {
    const { canceled, filePath } = await showSaveDialog({
      title,
      defaultPath: suggestedName,
      filters,
    });
    if(canceled || !filePath) return false;
    await fs.writeFile(filePath, data);
    return true;
  },

  storage: {
    get: async (key) => {
      const value = await storage.get(key);
      return value === undefined ? null : value;
    },
    set: (key, value) => storage.set(key, value),
    remove: (key) => storage.remove(key),
  },
};
