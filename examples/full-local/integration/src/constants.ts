import * as path from "node:path";

export const REPO_ROOT = path.resolve(__dirname, "../../../..");
export const FULL_LOCAL_DIR = path.resolve(REPO_ROOT, "./examples/full-local");
export const ENV_VARS_DIR = path.join(FULL_LOCAL_DIR, "services/env-vars");


