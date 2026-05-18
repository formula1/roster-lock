
import { nativeAPI } from "../../tauri";

import { join } from 'path-browserify';

// User settings management using TypeScript
const USER_SETTINGS_KEY = 'user-settings';

type UserSettings = {
  matchLockDirChoice: 'create' | 'dontAsk' | 'askLater';
}

const DEFAULT_SETTINGS: UserSettings = {
  matchLockDirChoice: 'askLater'
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

export async function initializeUserDirectories(): Promise<{ shouldShowDialog: boolean; matchLockDir: string }> {
  try {
    const homeDir = await nativeAPI.fs.homeDir();
    const matchLockDir = join(homeDir, 'match-lock');
    
    // Check if the match-lock directory already exists
    if (await nativeAPI.fs.exists(matchLockDir)) {
      return { shouldShowDialog: false, matchLockDir };
    }
    
    const settings = await getUserSettings();
    
    // If user previously chose to create, create it automatically
    if (settings.matchLockDirChoice === 'create') {
      await nativeAPI.fs.mkdirAll(matchLockDir);
      console.log('✅ Created match-lock directory automatically:', matchLockDir);
      return { shouldShowDialog: false, matchLockDir };
    }

    // If user chose don't ask, skip
    if (settings.matchLockDirChoice === 'dontAsk') {
      console.log('ℹ️ User chose not to be asked again, skipping match-lock directory creation');
      return { shouldShowDialog: false, matchLockDir };
    }

    // Default: ask the user
    return { shouldShowDialog: true, matchLockDir };
  } catch (error) {
    console.error('Error initializing user directories:', error);
    const homeDir = await nativeAPI.fs.homeDir();
    const matchLockDir = join(homeDir, 'match-lock');
    return { shouldShowDialog: true, matchLockDir };
  }
}

export async function handleUserChoice(
  choice: 'create' | 'askLater' | 'dontAsk',
  matchLockDir: string
): Promise<boolean> {
  try {
    switch (choice) {
      case 'create':
        await nativeAPI.fs.mkdirAll(matchLockDir);
        await updateUserSettings({ matchLockDirChoice: 'create' });
        console.log('✅ Created match-lock directory:', matchLockDir);
        return true;
      case 'askLater':
        return true;
      case 'dontAsk':
        await updateUserSettings({ matchLockDirChoice: 'dontAsk' });
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
