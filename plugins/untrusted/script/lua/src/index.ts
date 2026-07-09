import { UntrustedScript } from "@roster-lock/types";
import { runLuaScript } from "./run-script";

const LUA_RUNNER: UntrustedScript<any> = {
  name: "lua",
  extensions: [".lua"],
  directoryFile: ["init.lua"],
  runScript: runLuaScript
}

export default LUA_RUNNER;
