
import { dirname, resolve as pathResolve, join as pathJoin } from "path";
import { fileExtension } from "@roster-lock/utils";

import { RosterLockV1Config } from "@roster-lock/types";
import { getUntrustedScriptByFileExtension, UntrustedScriptType } from "@roster-lock/shared";

type ScriptDictionary = RosterLockV1Config["selection"]["scriptDictionary"];

export class RequiredModule<T> {
  public scriptType: UntrustedScriptType;
  public loadedModules: Map<string, T> = new Map();
  public loadingStack: Array<string> = [];
  constructor(
    public availableScripts: ScriptDictionary,
    public currentScriptPath: string,
  ){
    const scriptType = getUntrustedScriptByFileExtension(currentScriptPath);
    if(!scriptType) throw new Error(`Cannot support ${fileExtension(currentScriptPath)}`);
    this.scriptType = scriptType;
  }
  async require(
    targetScriptpath: string,
    runCode: (newPath: string, content: string)=>Promise<T>,
  ){
    const resolvedPath = resolveScriptPath(
      this.availableScripts, this.scriptType, this.currentScriptPath, targetScriptpath
    );
    const module = this.loadedModules.get(resolvedPath);
    if(typeof module !== "undefined") return module;

    if(this.loadingStack.includes(resolvedPath)){
      const cycle = [...this.loadingStack, resolvedPath].join(" -> ");
      throw new Error(`Circular dependency detected: ${cycle}`);
    }

    const previousFile = this.currentScriptPath;
    this.loadingStack.push(resolvedPath);
    this.currentScriptPath = resolvedPath;

    const { content } = this.availableScripts[resolvedPath];
    const extension = fileExtension(resolvedPath);
    if(!extension){
      throw new Error(
        [
          "Filename needs an extension",
          "Requires: " + JSON.stringify(this.scriptType.extensions),
        ].join("\n")
      );
    }
    if(!this.scriptType.extensions.includes(extension)){
      throw new Error(
        [
          "We don't currently support inter language communication",
          "Supports: " + JSON.stringify(this.scriptType.extensions),
          "Requesting: " + extension
        ].join("\n")
      );
    }

    try {
      const newModule = await runCode(resolvedPath, content);
      this.loadedModules.set(resolvedPath, newModule);
      return newModule;
    }finally{
      this.loadingStack.pop();
      this.currentScriptPath = previousFile;
    }
  }
}

export function resolveScriptPath(
  availableScripts: ScriptDictionary,
  scriptType: UntrustedScriptType,
  currentScriptPath: string,
  targetScriptpath: string,
){
  // Handle different import styles
  // require("lib/balance") -> scripts/lib/balance.lua
  // require("./utils") -> scripts/utils.lua
  // require("utils") -> scripts/utils.lua
  

  const currentDir = dirname(currentScriptPath);
  
  // Resolve relative to scripts directory
  const resolvedPath = pathResolve(currentDir, targetScriptpath);
  if(availableScripts[resolvedPath]) return resolvedPath;

  // Add .lua extension if not present
  // Support for multiple for example typescript/javascript
  for(const extension of scriptType.extensions){
    const resolvedPathWithExt = resolvedPath + extension;
    if(availableScripts[resolvedPathWithExt]) return resolvedPathWithExt;
  }

  if(scriptType.directoryFile){
    for(const file of scriptType.directoryFile){
      const resolvedPathIndex = pathJoin(resolvedPath, file);
      if(availableScripts[resolvedPathIndex]) return resolvedPathIndex;
    }
  }
  throw new Error("Script Not Found");
}
