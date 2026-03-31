
import { dirname, resolve as pathResolve, normalize, extname } from "path";

export class RequiredModule<T> {
  public loadedModules: Map<string, T> = new Map();
  public loadingStack: Array<string> = [];
  constructor(
    public availableScripts: Record<string, string>,
    public currentScriptPath: string,
  ){}
  async require(
    targetScriptpath: string,
    runCode: (newPath: string, content: string)=>Promise<T>,
  ){
    const resolvedPath = resolveScriptPath(
      this.availableScripts, this.currentScriptPath, targetScriptpath
    );
    const module = this.loadedModules.get(resolvedPath);
    if(typeof module !== "undefined") return module;

    if(this.loadingStack.includes(resolvedPath)){
      const cycle = [...this.loadingStack, resolvedPath].join(' -> ');
      throw new Error(`Circular dependency detected: ${cycle}`);
    }

    const previousFile = this.currentScriptPath;
    this.loadingStack.push(resolvedPath);
    this.currentScriptPath = resolvedPath;

    const content = this.availableScripts[resolvedPath];

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
  availableScripts: Record<string, string>,
  currentScriptPath: string,
  targetScriptpath: string,
){
  // Handle different import styles
  // require("lib/balance") -> scripts/lib/balance.lua
  // require("./utils") -> scripts/utils.lua
  // require("utils") -> scripts/utils.lua
  

  const currentDir = dirname(currentScriptPath);
  
  // Resolve relative to scripts directory
  let resolvedPath = pathResolve(currentDir, targetScriptpath);
  if(availableScripts[resolvedPath]) return resolvedPath;

  // Add .lua extension if not present
  const targetExt = extname(resolvedPath);
  if(targetExt){
    throw new Error("Script Not Found");
  }
  resolvedPath += extname(currentScriptPath);
  if(!availableScripts[resolvedPath]){
    throw new Error("Script Not Found");
  }
  return resolvedPath;
}
