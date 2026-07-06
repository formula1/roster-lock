
import { nativeAPI } from "../../tauri";

import { join } from '@tauri-apps/api/path';

// User settings management using TypeScript
const USER_SETTINGS_KEY = 'user-settings';

type UserSettings = {
  rosterLockDirChoice: 'create' | 'dontAsk' | 'askLater';
}

const DEFAULT_SETTINGS: UserSettings = {
  rosterLockDirChoice: 'askLater'
};

export async function getUserSettings(): Promise<UserSettings> {
  try {
    const userSettings = await nativeAPI.storage.get(USER_SETTINGS_KEY);
    if(userSettings === null) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...userSettings };
  } catch (error) {
    console.error('Error reading user settings:', error);
    return DEFAULT_SETTINGS;
  }
}

export async function updateUserSettings(newSettings: Partial<UserSettings>): Promise<boolean> {
  try {
    const currentSettings = await getUserSettings();
    const updatedSettings = { ...currentSettings, ...newSettings };
    await nativeAPI.storage.set(USER_SETTINGS_KEY, updatedSettings);
    return true;
  } catch (error) {
    console.error('Error updating user settings:', error);
    return false;
  }
}

export async function initializeUserDirectories(): Promise<{ shouldShowDialog: boolean; rosterLockDir: string }> {
  try {
    const homeDir = await nativeAPI.fs.homeDir();
    const rosterLockDir = await join(homeDir, 'roster-lock');
    
    // Check if the match-lock directory already exists
    if (await nativeAPI.fs.exists(rosterLockDir)) {
      return { shouldShowDialog: false, rosterLockDir };
    }
    
    const settings = await getUserSettings();
    
    // If user previously chose to create, create it automatically
    if (settings.rosterLockDirChoice === 'create') {
      await nativeAPI.fs.mkdirAll(rosterLockDir);
      console.log('✅ Created match-lock directory automatically:', rosterLockDir);
      return { shouldShowDialog: false, rosterLockDir };
    }

    // If user chose don't ask, skip
    if (settings.rosterLockDirChoice === 'dontAsk') {
      console.log('ℹ️ User chose not to be asked again, skipping match-lock directory creation');
      return { shouldShowDialog: false, rosterLockDir };
    }

    // Default: ask the user
    return { shouldShowDialog: true, rosterLockDir };
  } catch (error) {
    console.error('Error initializing user directories:', error);
    const homeDir = await nativeAPI.fs.homeDir();
    const rosterLockDir = await join(homeDir, 'roster-lock');
    return { shouldShowDialog: true, rosterLockDir };
  }
}

export async function handleUserChoice(
  choice: 'create' | 'askLater' | 'dontAsk',
  rosterLockDir: string
): Promise<boolean> {
  try {
    switch (choice) {
      case 'create':
        await nativeAPI.fs.mkdirAll(rosterLockDir);
        await updateUserSettings({ rosterLockDirChoice: 'create' });
        console.log('✅ Created match-lock directory:', rosterLockDir);
        return true;
      case 'askLater':
        return true;
      case 'dontAsk':
        await updateUserSettings({ rosterLockDirChoice: 'dontAsk' });
        console.log('ℹ️ User chose not to be asked again');
        return true;
      default:
        return false;
    }
  } catch (error) {
    console.error('Error handling user choice:', error);
    return false;
  }
}
