#!/usr/bin/env node

export * from "./plugin-management";
export * from "./download"
export * from "./run-untrusted"
import { runCommand } from "./command";

if(require.main === module){
  runCommand();
}
