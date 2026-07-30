import { join as pathJoin } from "node:path";
import os from "node:os";

export const DEFAULT_PLUGIN_DIR = pathJoin(os.homedir(), "roster-lock", "plugins");

// Raw-content base for the official monorepo, matching the "repository" field
// in package.json (github.com/formula1/roster-lock) resolved to its raw main
// branch - a bare repo/blob URL would serve HTML, not the manifest's JSON.
export const DEFAULT_REPO_URL = "https://raw.githubusercontent.com/formula1/roster-lock/main";

export const manifestUrlFromRepo = (repoUrl: string): string => `${repoUrl}/plugin-manifest.json`;
