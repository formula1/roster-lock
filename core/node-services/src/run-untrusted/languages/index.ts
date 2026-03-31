import { LanguageRunner } from "./types";
export const LANGUAGE_RUNNERS: Array<LanguageRunner<any>> = [];
export function getLanguageRunnerFromMimeType(mimeType: string): LanguageRunner<any> | undefined {
  return LANGUAGE_RUNNERS.find(runner => runner.mimetypes.includes(mimeType));
}

import { LUA } from "./lua";
LANGUAGE_RUNNERS.push(LUA);
