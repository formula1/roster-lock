import { UntrustedScript } from "@roster-lock/types";
import { runTSScript } from "./run-script";

const TS_RUNNER: UntrustedScript<any> = {
  name: "typescript/javascript",
  extensions: [".ts", ".js"],
  directoryFile: ["index.ts", "index.js"],
  runScript: runTSScript
}

export default TS_RUNNER
