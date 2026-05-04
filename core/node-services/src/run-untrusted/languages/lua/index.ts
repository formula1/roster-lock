import { UNTRUSTED_SCRIPT_TYPES } from "@roster-lock/shared";
import { LanguageRunner } from "../types";

import { runLuaScript } from "./run-script";

const config = UNTRUSTED_SCRIPT_TYPES["lua"];
if(!config) throw new Error("Missing lua config");
export const LUA: LanguageRunner<any> = {
  config: config,
  runScript: runLuaScript,
};
