import { TypedStorageService } from "../../globals/storage";

type FileMemory = {
  lastOpenDirectory?: string;
  recentFiles: Array<{ path: string; name: string; type?: string }>;
}

const fileMemoryStorage = new TypedStorageService<FileMemory>("file-memory");

export const fileMemory = {
  setLastOpenDirectory: async (directory: string) => {
    let current = await fileMemoryStorage.get();
    if(current === null) current = { recentFiles: [] };
    current.lastOpenDirectory = directory;
    await fileMemoryStorage.set(current);
  },
  getLastOpenDirectory: async () => {
    const current = await fileMemoryStorage.get();
    return current?.lastOpenDirectory || null;
  },

  addRecentFile: async (filePath: string, fileName: string, fileType?: string) => {
    let current = await fileMemoryStorage.get();
    if(current === null) current = { recentFiles: [] };
    current.recentFiles.push({
      path: filePath,
      name: fileName,
      type: fileType,
    });
    await fileMemoryStorage.set(current);
  },
  getRecentFiles: async () => {
    const current = await fileMemoryStorage.get();
    return current?.recentFiles || [];
  },
  clearRecentFiles: async () => {
    let current = await fileMemoryStorage.get();
    if(current === null) current = { recentFiles: [] };
    current.recentFiles = [];
    await fileMemoryStorage.set(current);
  },
}
