/**
 * Storage service for managing user preferences and recent files
 * Uses Electron's user data directory for persistent storage
 */

import { TypedStorageService, useStorage } from "./storage";

export interface RecentFile {
  path: string;
  name: string;
  lastOpened: string; // ISO date string
  type?: string; // file type or category
}

export class RecentFileStorage {
  public storage: TypedStorageService<RecentFile[]>;
  constructor(public key: string, public maxFiles: number = 10){
    this.storage = new TypedStorageService<RecentFile[]>(key);
  }
/**
   * Get all recent files
   */
  async getRecentFiles(): Promise<RecentFile[]> {
    const files = await this.storage.get();
    return Array.isArray(files) ? files : [];
  }

  /**
   * Add a file to recent files list
   */
  async addRecentFile(filePath: string, fileName?: string, fileType?: string): Promise<void> {
    const recentFiles = await this.getRecentFiles();
    
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
    
    await this.storage.set([newFile, ...filteredFiles].slice(0, this.maxFiles));
  }

  /**
   * Remove a file from recent files list
   */
  async removeRecentFile(filePath: string): Promise<void> {
    const recentFiles = await this.getRecentFiles();
    const filteredFiles = recentFiles.filter(file => file.path !== filePath);
    await this.storage.set(filteredFiles);
  }

  /**
   * Clear all recent files
   */
  async clearRecentFiles(): Promise<void> {
    await this.storage.set([]);
  }
}


export function useRecentFiles(key: string, maxFiles: number = 10){
  const storage = useStorage<RecentFile[]>(key);

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
