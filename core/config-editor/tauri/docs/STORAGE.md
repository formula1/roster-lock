# Storage System Documentation

This document explains how to use the storage system for managing user preferences and recent files in the MatchLock Prep App.

## Overview

The storage system uses Electron's built-in user data directory to persistently store user preferences, recent files, and other application data. This is the recommended approach for Electron applications as it:

- Stores data in OS-appropriate locations
- Survives app updates and system restarts
- Has no size limitations (unlike localStorage)
- Is secure and isolated per application

## Architecture

The storage system consists of:

1. **Main Process Handlers** (`src/electron/main.ts`) - IPC handlers for file operations
2. **Preload Script** (`src/electron/preload.ts`) - Exposes storage APIs to renderer
3. **Storage Service** (`src/services/storage.ts`) - High-level API for storage operations
4. **React Hooks** (`src/hooks/useStorage.ts`) - React hooks for easy component integration
5. **UI Components** (`src/components/RecentFiles.tsx`) - Ready-to-use UI components

## Storage Location

Data is stored in:
- **Windows**: `%APPDATA%/MatchLock Prep App/preferences.json`
- **macOS**: `~/Library/Application Support/MatchLock Prep App/preferences.json`
- **Linux**: `~/.config/MatchLock Prep App/preferences.json`

## Usage Examples

### Basic Storage Operations

```typescript
import { storageService } from '../services/storage';

// Store a value
await storageService.set('myKey', { some: 'data' });

// Retrieve a value
const data = await storageService.get('myKey');

// Remove a value
await storageService.remove('myKey');

// Clear all data
await storageService.clear();
```

### Recent Files Management

```typescript
import { storageService } from '../services/storage';

// Add a file to recent files
await storageService.addRecentFile('/path/to/file.json', 'file.json', 'config');

// Get all recent files
const recentFiles = await storageService.getRecentFiles();

// Remove a specific file
await storageService.removeRecentFile('/path/to/file.json');

// Clear all recent files
await storageService.clearRecentFiles();

// Set maximum number of recent files to keep
await storageService.setMaxRecentFiles(15);
```

### Using React Hooks

```typescript
import { useRecentFiles, useStorage } from '../hooks/useStorage';

function MyComponent() {
  // Hook for recent files
  const { 
    recentFiles, 
    loading, 
    error, 
    addRecentFile, 
    removeRecentFile, 
    clearRecentFiles 
  } = useRecentFiles();

  // Generic storage hook
  const { 
    value: mySettings, 
    setValue: setMySettings 
  } = useStorage('mySettings', { theme: 'dark' });

  // Use the data...
}
```

### Using the RecentFiles Component

```typescript
import { RecentFiles } from '../components/RecentFiles';

function HomePage() {
  const handleFileSelect = (file) => {
    console.log('User selected:', file.path);
    // Navigate to file or open it
  };

  return (
    <div>
      <h1>Welcome</h1>
      <RecentFiles
        onFileSelect={handleFileSelect}
        maxDisplay={5}
        showLastOpened={true}
        showRemoveButton={true}
      />
    </div>
  );
}
```

### File Dialog Helpers

```typescript
import { openFileDialog, saveFileDialog } from '../utils/fileHelpers';

// Open file with automatic recent files tracking
const filePath = await openFileDialog({
  title: 'Open Config File',
  filters: [
    { name: 'Config Files', extensions: ['json', 'yaml'] },
    { name: 'All Files', extensions: ['*'] }
  ],
  fileType: 'config'
});

// Save file with automatic recent files tracking
const savePath = await saveFileDialog({
  title: 'Save Config',
  defaultName: 'config.json',
  filters: [
    { name: 'JSON Files', extensions: ['json'] }
  ],
  fileType: 'config'
});
```

## Data Structures

### RecentFile Interface

```typescript
interface RecentFile {
  path: string;        // Full file path
  name: string;        // Display name (usually filename)
  lastOpened: string;  // ISO date string
  type?: string;       // Optional file type/category
}
```

### UserPreferences Interface

```typescript
interface UserPreferences {
  recentFiles: RecentFile[];
  maxRecentFiles: number;
  lastOpenDirectory?: string;
}
```

## Best Practices

1. **Always handle errors** - Storage operations can fail
2. **Use appropriate file types** - Categorize files for better organization
3. **Limit recent files** - Don't let the list grow indefinitely
4. **Clean up periodically** - Remove references to deleted files
5. **Use React hooks** - They handle loading states and errors automatically

## Comparison with Other Storage Options

| Storage Type | Pros | Cons | Use Case |
|--------------|------|------|----------|
| **Electron User Data** ✅ | Native, persistent, no size limits, secure | Electron-specific | **Recommended for desktop apps** |
| localStorage | Simple, web-standard | 5-10MB limit, not persistent across updates | Small temporary data |
| IndexedDB | Large storage, structured | Complex API, web-only | Large datasets in web apps |
| File-based | Full control, any format | Manual management, error-prone | Custom requirements |

## Migration from Web Storage

If you're migrating from localStorage/sessionStorage:

```typescript
// Old way (localStorage)
localStorage.setItem('recentFiles', JSON.stringify(files));
const files = JSON.parse(localStorage.getItem('recentFiles') || '[]');

// New way (Electron storage)
await storageService.set('recentFiles', files);
const files = await storageService.get('recentFiles') || [];
```

## Troubleshooting

### Common Issues

1. **"electronAPI is not defined"** - Make sure the preload script is loaded
2. **Storage not persisting** - Check file permissions in user data directory
3. **Performance issues** - Avoid storing large objects; use file references instead

### Debugging

```typescript
// Check if Electron APIs are available
if (window.electronAPI) {
  console.log('Electron APIs available');
} else {
  console.error('Electron APIs not available - check preload script');
}

// Get storage file location
console.log('User data path:', await window.electronAPI.storageGet('__debug_path'));
```

## Future Enhancements

Potential improvements to consider:

1. **Encryption** - For sensitive data
2. **Compression** - For large datasets
3. **Backup/Sync** - Cloud synchronization
4. **Migration** - Automatic data migration between app versions
5. **Validation** - Schema validation for stored data
