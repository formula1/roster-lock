
import { dirname, resolve as pathResolve, join as pathJoin, extname } from "path";

import { RosterLockV1Config } from "@roster-lock/types";
import { getUntrustedScript, UntrustedScriptType } from "@roster-lock/shared";
import mimetypes from "mime-types";

type ScriptDictionary = RosterLockV1Config["selection"]["scriptDictionary"];

export class RequiredModule<T> {
  public scriptType: UntrustedScriptType;
  public loadedModules: Map<string, T> = new Map();
  public loadingStack: Array<string> = [];
  constructor(
    public availableScripts: ScriptDictionary,
    public currentScriptPath: string,
  ){
    const mimeType = mimetypes.lookup(currentScriptPath);
    if(!mimeType) throw new Error(`Invalid initial script ${currentScriptPath}`);
    const scriptType = getUntrustedScript(mimeType);
    if(!scriptType) throw new Error(`Cannot support ${mimeType}`);
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

    const { mimeType, content } = this.availableScripts[resolvedPath];
    if(!this.scriptType.mimeTypes.includes(mimeType)){
      throw new Error(
        [
          "We don't currently support inter language communication",
          "Supports: " + JSON.stringify(this.scriptType.mimeTypes),
          "Requesting: " + mimeType
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
  const targetExt = extname(resolvedPath);
  if(targetExt){
    throw new Error("Script Not Found");
  }
  const resolvedPathWithExt = resolvedPath + extname(currentScriptPath);
  if(availableScripts[resolvedPathWithExt]) return resolvedPathWithExt;

  if(scriptType.directoryFile){
    const resolvedPathIndex = pathJoin(resolvedPath, scriptType.directoryFile);
    if(availableScripts[resolvedPathIndex]) return resolvedPathIndex;
  }
  throw new Error("Script Not Found");
}
