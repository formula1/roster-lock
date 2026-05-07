import { UNTRUSTED_SCRIPT_TYPES } from "@roster-lock/shared";
import { LanguageRunner } from "../types";

import { runTSScript } from "./run-script";

const config = UNTRUSTED_SCRIPT_TYPES["typescript"];
if(!config) throw new Error("Missing typecript config");
export const TYPESCRIPT: LanguageRunner<any> = {
  config: config,
  runScript: runTSScript,
};
