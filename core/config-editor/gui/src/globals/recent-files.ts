import { useHostStorage } from "./storage";

export type RecentFile = {
  // Host token (folder or file) - opaque to the gui, but hosts should keep
  // it human-readable when they can (Tauri uses the real path).
  path: string;
  name: string;
  lastOpened: string; // ISO date string
  type?: string; // file type or category
};

export function useRecentFiles(key: string, maxFiles: number = 10){
  const storage = useHostStorage<RecentFile[]>(key);

  return {
    ...storage,
    addRecentFile: async (filePath: string, fileName?: string, fileType?: string) => {
      const recentFiles = storage.value || [];

      // Extract filename if not provided
      const name = fileName || filePath.split(/[/\\]/).pop() || filePath;

      const newFile: RecentFile = {
        path: filePath,
        name,
        lastOpened: new Date().toISOString(),
        type: fileType,
      };

      // Remove existing entry if it exists
      const filteredFiles = recentFiles.filter(file => file.path !== filePath);

      await storage.setValue([newFile, ...filteredFiles].slice(0, maxFiles));
    },
    removeRecentFile: async (filePath: string) => {
      const recentFiles = storage.value || [];
      const filteredFiles = recentFiles.filter(file => file.path !== filePath);
      await storage.setValue(filteredFiles);
    },
    clearRecentFiles: async () => {
      await storage.setValue([]);
    },
  }
}
