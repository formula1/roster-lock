import { join as pathJoin } from "node:path";
import os from "node:os";

export const DEFAULT_PLUGIN_DIR = pathJoin(os.homedir(), "roster-lock", "plugins");
