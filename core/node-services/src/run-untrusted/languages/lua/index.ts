import { LanguageRunner } from "../types";

import { LUA_MIMETYPES } from "./mimetype";
import { runLuaScript } from "./run-script";

export const LUA: LanguageRunner<any> = {
  mimetypes: LUA_MIMETYPES,
  runScript: runLuaScript,
};
