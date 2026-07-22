import { join as pathJoin } from "node:path";
import os from "node:os";


export const CONFIG_FILE_NAME = "match-agent.json";
export const DEFAULT_MATCH_CONIFG = pathJoin(os.homedir(), "roster-lock", CONFIG_FILE_NAME);
export const DEFAULT_PIECE_DIR = pathJoin(os.homedir(), "roster-lock", "pieces");
