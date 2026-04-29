
const WINDOWS_RESERVED_NAMES = [
  'CON', 'PRN', 'AUX', 'NUL',
  'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
  'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'
];

export function isValidPathComponent(component: string) {
  // Empty components are invalid
  if(component.length === 0){
    throw new Error("Filepath component is empty");
  }

  // Check component length (most filesystems have per-component limits)
  if(component.length > 255){
    throw new Error("Filepath component is too long");
  }

  // Reserved names on Windows (even on other platforms, better to be safe)
  const upperComponent = component.toUpperCase();
  const baseName = upperComponent.split('.')[0]; // Remove extension for check
  if(WINDOWS_RESERVED_NAMES.includes(baseName)){
    throw new Error("Filepath component is a reserved name");
  }

  // Must not start or end with spaces (problematic on Windows)
  // Note: Leading dots are actually valid (hidden files on Unix)
  if(component.startsWith(' ') || component.endsWith(' ')){
    throw new Error("Filepath component has leading/trailing spaces");
  }

  // Must not end with dots (problematic on Windows)
  if(component.endsWith('.')){
    throw new Error("Filepath component ends with a dot");
  }

  // Must not be just dots
  if(/^\.+$/.test(component)){
    throw new Error("Filepath component is just dots");
  }
}
