import { UntrustedScript } from "@roster-lock/types";
import { transpileModule, ModuleKind, ScriptTarget } from "typescript";
import { runTSScript } from "./run-script";

const TS_RUNNER: UntrustedScript<any> = {
  name: "typescript/javascript",
  extensions: [".ts", ".js"],
  directoryFile: ["index.ts", "index.js"],
  runScript: runTSScript,
  exportConfig: (config)=>(
    transpileModule(
      `export default (${JSON.stringify(config)});`,
      { compilerOptions: { module: ModuleKind.ESNext, target: ScriptTarget.ESNext } }
    ).outputText
  )
}

export default TS_RUNNER
