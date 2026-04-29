import isGlob from "is-glob";

export { validatePathVariablesInGlob } from "./pathvariables";
import { replacePathVariablesWithGlob } from "./pathvariables";
import { isValidFilePath } from "./filepath";
export function validateGlobItem(pattern: string) {
  // First, check if the glob uses any undefined path variables
  pattern = replacePathVariablesWithGlob(pattern);

  // Check for absolute paths (we want relative paths only)
  if(pattern.startsWith('/') || /^[a-zA-Z]:/.test(pattern)){
    throw new Error("File pattern is absolute");
  }

  // If it's a valid glob pattern, accept it
  if(isGlob(pattern)) return;

  // If it's not a glob, check if it's a valid file path
  isValidFilePath(pattern);
}

