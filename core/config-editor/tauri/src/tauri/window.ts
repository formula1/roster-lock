import { open, save } from '@tauri-apps/plugin-dialog';
import { getCurrentWindow } from '@tauri-apps/api/window';


export const showOpenDialog = async (options?: {
  title?: string;
  defaultPath?: string;
  properties?: ('openFile' | 'openDirectory' | 'multiSelections' | 'showHiddenFiles' | 'createDirectory')[];
  filters?: { name: string; extensions: string[] }[];
}): Promise<{ canceled: boolean; filePaths: string[] }> => {
  try {
    const result = await open({
      title: options?.title,
      defaultPath: options?.defaultPath,
      multiple: options?.properties?.includes('multiSelections'),
      directory: options?.properties?.includes('openDirectory'),
      filters: options?.filters,
    });

    if (result === null) {
      return { canceled: true, filePaths: [] };
    }

    const filePaths = Array.isArray(result) ? result : [result];
    return { canceled: false, filePaths };
  } catch (error) {
    console.error('Dialog error:', error);
    return { canceled: true, filePaths: [] };
  }
};

export const showSaveDialog = async (options?: {
  title?: string;
  defaultPath?: string;
  filters?: { name: string; extensions: string[] }[];
}): Promise<{ canceled: boolean; filePath?: string }> => {
  try {
    const result = await save({
      title: options?.title,
      defaultPath: options?.defaultPath,
      filters: options?.filters,
    });

    if (result === null) {
      return { canceled: true };
    }

    return { canceled: false, filePath: result };
  } catch (error) {
    console.error('Dialog error:', error);
    return { canceled: true };
  }
};

// Window operations
const currentWindow = getCurrentWindow();

export const windowMinimize = async (): Promise<void> => {
  await currentWindow.minimize();
};

export const windowMaximize = async (): Promise<void> => {
  const isMaximized = await currentWindow.isMaximized();
  if (isMaximized) {
    await currentWindow.unmaximize();
  } else {
    await currentWindow.maximize();
  }
};

export const windowClose = async (): Promise<void> => {
  await currentWindow.close();
};


export const nativeWindow = {
  MAIN_WINDOW: currentWindow,
  showOpenDialog,
  showSaveDialog,
  minimize: windowMinimize,
  maximize: windowMaximize,
  close: windowClose,
};
