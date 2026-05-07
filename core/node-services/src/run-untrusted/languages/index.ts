import { LanguageRunner } from "./types";
import { fileExtension } from "@roster-lock/utils";
export const LANGUAGE_RUNNERS: Array<LanguageRunner<any>> = [];
export function getLanguageRunnerFromFileExtension(filename: string): LanguageRunner<any> | undefined {
  const extension = fileExtension(filename);
  if(!extension) return;
  return LANGUAGE_RUNNERS.find(runner => runner.config.extensions.includes(extension));
}

import { LUA } from "./lua";
LANGUAGE_RUNNERS.push(LUA);

import { TYPESCRIPT } from "./typescript";
LANGUAGE_RUNNERS.push(TYPESCRIPT);
