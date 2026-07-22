#!/usr/bin/env node

export * from "./plugin-management";
export * from "./download"
export * from "./run-untrusted"
export { PluginManager } from "./PluginHandler";
import { runCommand, createPluginCommands } from "./command";
export { createPluginCommands };

if(require.main === module){
  runCommand();
}
