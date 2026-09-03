

import { dirname } from "node:path";
import { readFile, writeFile, mkdir, stat } from "node:fs/promises";
import { DEFAULT_MATCH_CONIFG } from "./constants";

const initializeConfig = Promise.resolve().then(()=>{
  return mkdir(dirname(DEFAULT_MATCH_CONIFG), { recursive: true })
})

// pieceFolder/pluginFolder are stored relative to the config file itself, so
// the same config (and the folders it points to) stay valid no matter where
// they're mounted - a drive letter on one machine, a different mount point
// on another. Absent (e.g. the pre-existing home config), they default to
// "pieces"/"plugins" siblings of the config file.
export type MatchAgentConfig = {
  authCode: string,
  pieceFolder?: string,
  pluginFolder?: string,
};

import { z, ZodType } from "zod";

const matchAgentConfig: ZodType<MatchAgentConfig> = z.object({
  authCode: z.string(),
  pieceFolder: z.string().optional(),
  pluginFolder: z.string().optional(),
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
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(newValues, null, 2) + "\n")
}

export async function configExists(filePath: string){
  try {
    const info = await stat(filePath);
    return info.isFile();
  }catch(e){
    return false;
  }
}
