#!/usr/bin/env node

export * from "./plugin-management";
import { runCommand } from "./command";

if(require.main === module){
  runCommand();
}
