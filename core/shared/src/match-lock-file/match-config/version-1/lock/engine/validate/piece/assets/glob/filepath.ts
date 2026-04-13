
import { isValidPathComponent } from "./filepath-component";
export function isValidFilePath(path: string) {
  // Comprehensive validation for file paths
  if(path.length === 0){
    throw new Error("Filepath is empty");
  }

  // Check path length limits (most filesystems have limits)
  if(path.length > 4096){
    throw new Error("Filepath is too long");
  }

  // Only forward slashes allowed - reject backslashes for cross-platform consistency
  if(path.includes('\\')){
    throw new Error("Filepath contains backslash - use forward slashes only");
  }

  // Check for invalid characters across different platforms
  // Windows: < > : " | ? * and control characters (0x00-0x1f)
  // Unix/Linux: null character (0x00) and forward slash in filenames
  // We'll be restrictive and block characters that are problematic on any major platform
  const invalidChars = /[<>:"|?*\x00-\x1f\x7f]/;
  if(invalidChars.test(path)){
    throw new Error("Filepath contains invalid characters");
  }

  // Check for relative path traversal attempts
  if(
    path.includes('../') ||
    path.includes('/..') ||
    path === '..' ||
    path.startsWith('../') ||
    path.endsWith('/..')
  ){
    throw new Error("Filepath contains invalid traversal");
  }

  // Must not end with a slash (indicating a directory)
  if(path.endsWith('/')){
    throw new Error("Filepath ends with a slash");
  }

  // Split into path components and validate each
  const components = path.split('/');
  for(const component of components){
    isValidPathComponent(component);
  }

  // Must have at least one component (the filename)
  if(components.length === 0){
    throw new Error("Filepath has no components");
  }
}

