
import { dirname, resolve as pathResolve, join as pathJoin } from "path";
import { fileExtension } from "@roster-lock/utils";

import { RosterLockV1Config, UntrustedConfig } from "@roster-lock/types";
import { UntrustedScript } from "@roster-lock/types";

type ScriptDictionary = RosterLockV1Config["selection"]["scriptDictionary"];

export class ScriptImportError extends Error {
  constructor(
    public readonly importPath: string,
    public readonly fromPath: string,
    cause: unknown,
  ) {
    const causeMessage = cause instanceof Error ? cause.message : String(cause);
    super(`Cannot import "${importPath}" from "${fromPath}": ${causeMessage}`);
    this.name = "ScriptImportError";
  }
}

export class RequiredModule<T> {
  public loadedModules: Map<string, T> = new Map();
  public loadingStack: Array<string> = [];
  constructor(
    public availableScripts: ScriptDictionary,
    public currentScriptPath: string,
    public scriptType: UntrustedScript<any>,
    public untrustedConfigs: Array<UntrustedConfig>,
  ){}
  async require(
    targetScriptpath: string,
    runCode: (newPath: string, content: string)=>Promise<T>,
  ){
    const fromPath = this.currentScriptPath;

    const resolvedPath = resolveScriptPath(
      this.availableScripts, this.scriptType, fromPath, targetScriptpath
    );

    const module = this.loadedModules.get(resolvedPath);
    if(typeof module !== "undefined") return module;

    if(this.loadingStack.includes(resolvedPath)){
      const cycle = [...this.loadingStack, resolvedPath].join(" -> ");
      throw new ScriptImportError(targetScriptpath, fromPath, `Circular dependency detected: ${cycle}`);
    }

    const previousFile = fromPath;
    this.loadingStack.push(resolvedPath);
    this.currentScriptPath = resolvedPath;

    try {
      const { content } = this.availableScripts[resolvedPath];
      const extension = fileExtension(resolvedPath);
      if(!extension){
        throw new ScriptImportError(targetScriptpath, fromPath,
          "Filename needs an extension, requires: " + JSON.stringify(this.scriptType.extensions)
        );
      }

      const newModule = await (async (): Promise<T> => {
        if(this.scriptType.extensions.includes(extension)){
          return runCode(resolvedPath, content);
        }
        const configHandler = this.untrustedConfigs.find(c => c.extensions.includes(extension));
        if(!configHandler){
          throw new ScriptImportError(targetScriptpath, fromPath,
            `Unsupported extension "${extension}", supports: ${JSON.stringify(
              collectAllSupportedExtensions(this)
            )}`
          );
        }
        return this.scriptType.exportConfig(await configHandler.runConfig(content));
      })();

      this.loadedModules.set(resolvedPath, newModule);
      return newModule;
    }catch(e){
      if(e instanceof ScriptImportError) throw e;
      throw new ScriptImportError(targetScriptpath, fromPath, e);
    }finally{
      this.loadingStack.pop();
      this.currentScriptPath = previousFile;
    }
  }
}

export function resolveScriptPath(
  availableScripts: ScriptDictionary,
  scriptType: UntrustedScript<any>,
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
  throw new ScriptImportError(
    targetScriptpath, currentScriptPath, "Script Not Found"
  );
}


function collectAllSupportedExtensions(requiredModule: RequiredModule<any>){
    const allSupportedExtensions = [...requiredModule.scriptType.extensions];
    for(const configHandler of requiredModule.untrustedConfigs){
      allSupportedExtensions.push(...configHandler.extensions);
    }
    return Array.from(new Set(allSupportedExtensions));
}