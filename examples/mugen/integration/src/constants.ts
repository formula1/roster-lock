import * as path from "node:path";

export const REPO_ROOT = path.resolve(__dirname, "../../../..");
export const MUGEN_DIR = path.resolve(REPO_ROOT, "./examples/mugen");
export const ENV_VARS_DIR = path.join(MUGEN_DIR, "services/env-vars");
export const ROSTER_LOCK_PATH = path.join(MUGEN_DIR, "roster-locks/mugen-simul.roster-lock.json");
