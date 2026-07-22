import { join as pathJoin, dirname } from "node:path";
import os from "node:os";
import { readFile, writeFile, mkdir } from "node:fs/promises";

export const DEFAULT_MATCH_CONIFG = pathJoin(os.homedir(), "roster-lock", "match-agent.json");
export const DEFAULT_PIECE_DIR = pathJoin(os.homedir(), "roster-lock", "pieces");
const initializeConfig = Promise.resolve().then(()=>{
  return mkdir(dirname(DEFAULT_MATCH_CONIFG), { recursive: true })
})

type MatchAgentConfig = { authCode: string };

import { z, ZodType } from "zod";

const matchAgentConfig: ZodType<MatchAgentConfig> = z.object({
  authCode: z.string()
});

export async function getConfig(filePath: string){
  await initializeConfig;
  const contents = await readFile(filePath, "utf8");
  const json = JSON.parse(contents);
  const casted = matchAgentConfig.safeParse(json);
  if(!casted.success) throw new Error("Invalid config");
  return casted.data;
}

export async function setConfig(filePath: string, newValues: MatchAgentConfig){
  await initializeConfig;
  await writeFile(filePath, JSON.stringify(newValues))
}
