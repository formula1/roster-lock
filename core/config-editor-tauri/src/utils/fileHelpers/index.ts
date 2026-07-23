import { nativeAPI } from "../../tauri";
import { fileMemory } from "./fileMemory";


/**
 * Helper function to open a file dialog and automatically add to recent files
 */
export async function openFileDialog(options: {
  title?: string;
  filters?: { name: string; extensions: string[] }[];
  fileType?: string;
}): Promise<string | null> {
  try {
    // Get the last opened directory to use as default
    const lastDirectory = await fileMemory.getLastOpenDirectory();
    
    const result = await nativeAPI.nativeWindow.showOpenDialog({
      title: options.title || 'Open File',
      defaultPath: lastDirectory || void 0,
      properties: ['openFile'],
      filters: options.filters || [
        { name: 'All Files', extensions: ['*'] }
      ]
    });

    if (!result.canceled && result.filePaths.length > 0) {
      const filePath = result.filePaths[0];
      const fileName = filePath.split(/[/\\]/).pop() || filePath;
      const directory = filePath.substring(0, Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\')));
      
      // Add to recent files
      await fileMemory.addRecentFile(filePath, fileName, options.fileType);
      
      // Update last opened directory
      await fileMemory.setLastOpenDirectory(directory);
      
      return filePath;
    }
    
    return null;
  } catch (error) {
    console.error('Error opening file dialog:', error);
    return null;
  }
}

/**
 * Helper function to save a file dialog and automatically add to recent files
 */
export async function saveFileDialog(options: {
  title?: string;
  defaultName?: string;
  filters?: { name: string; extensions: string[] }[];
  fileType?: string;
}): Promise<string | null> {
  try {
    // Get the last opened directory to use as default
    const lastDirectory = await fileMemory.getLastOpenDirectory();
    const defaultPath = lastDirectory && options.defaultName 
      ? `${lastDirectory}/${options.defaultName}`
      : options.defaultName;
    
    const result = await nativeAPI.nativeWindow.showSaveDialog({
      title: options.title || 'Save File',
      defaultPath,
      filters: options.filters || [
        { name: 'All Files', extensions: ['*'] }
      ]
    });

    if (!result.canceled && result.filePath) {
      const filePath = result.filePath;
      const fileName = filePath.split(/[/\\]/).pop() || filePath;
      const directory = filePath.substring(0, Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\')));
      
      // Add to recent files
      await fileMemory.addRecentFile(filePath, fileName, options.fileType);
      
      // Update last opened directory
      await fileMemory.setLastOpenDirectory(directory);
      
      return filePath;
    }
    
    return null;
  } catch (error) {
    console.error('Error saving file dialog:', error);
    return null;
  }
}

/**
 * Helper function to check if a file exists (you'll need to add this to your IPC handlers)
 */
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    // Note: You'll need to add a 'file-exists' IPC handler to your main process
    // For now, this is a placeholder
    console.log('Checking if file exists:', filePath);
    return true; // Placeholder
  } catch (error) {
    console.error('Error checking file existence:', error);
    return false;
  }
}

/**
 * Helper to clean up recent files by removing non-existent files
 */
export async function cleanupRecentFiles(): Promise<void> {
  try {
    const recentFiles = await fileMemory.getRecentFiles();
    const validFiles = [];
    
    for (const file of recentFiles) {
      const exists = await fileExists(file.path);
      if (exists) {
        validFiles.push(file);
      }
    }
    
    // If any files were removed, update the list
    if (validFiles.length !== recentFiles.length) {
      await fileMemory.clearRecentFiles();
      for (const file of validFiles) {
        await fileMemory.addRecentFile(file.path, file.name, file.type);
      }
    }
  } catch (error) {
    console.error('Error cleaning up recent files:', error);
  }
}
