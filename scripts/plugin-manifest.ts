#!/usr/bin/env tsx

// Generates /plugin-manifest.json - the official manifest that `match-agent install`
// and `plugin sync` (both in core/plugin-runtime) fetch and sync installed plugins
// against. This file is committed, not a build artifact: it's the single source of
// truth for which plugin package versions/priorities are "official" and should be
// re-run (and the result committed) whenever a published plugin's version changes.

import { readdir, readFile, writeFile, stat as fsStat } from "node:fs/promises";
import { resolve as pathResolve, join as pathJoin } from "node:path";
import { PLUGIN_TYPES } from "@roster-lock/plugin-runtime";

const __root = pathResolve(__dirname, "..");
const PLUGIN_ROOTS = ["plugins/download", "plugins/untrusted"];
const MANIFEST_PATH = pathJoin(__root, "plugin-manifest.json");

type OfficialPluginEntry = { version: string; priority?: number };
type OfficialManifest = { plugins: Record<string, OfficialPluginEntry> };

async function* findPackagesInFolder(folderPath: string): AsyncGenerator<string> {
  const stat = await fsStat(folderPath);
  if (!stat.isDirectory()) return;

  if (await fileExists(pathJoin(folderPath, "package.json"))) {
    yield folderPath;
    return;
  }
  for (const entry of await readdir(folderPath)) {
    yield* findPackagesInFolder(pathJoin(folderPath, entry));
  }
}

async function fileExists(path: string): Promise<boolean> {
  try {
    return (await fsStat(path)).isFile();
  } catch {
    return false;
  }
}

Promise.resolve().then(async () => {
  const plugins: OfficialManifest["plugins"] = {};

  for (const pluginRoot of PLUGIN_ROOTS) {
    for await (const packageDir of findPackagesInFolder(pathJoin(__root, pluginRoot))) {
      const packageJsonPath = pathJoin(packageDir, "package.json");
      const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8"));

      const pluginType = packageJson["roster-lock"]?.pluginType;
      if (!pluginType) {
        console.warn(`${packageDir} has no roster-lock.pluginType - skipping`);
        continue;
      }
      if (!PLUGIN_TYPES.has(pluginType)) {
        console.warn(`${packageDir} declares pluginType "${pluginType}", not an installable plugin type - skipping`);
        continue;
      }

      const entry: OfficialPluginEntry = { version: packageJson.version };
      const priority = packageJson["roster-lock"]?.priority;
      if (typeof priority === "number") entry.priority = priority;

      plugins[packageJson.name] = entry;
    }
  }

  const manifest: OfficialManifest = {
    plugins: Object.fromEntries(Object.entries(plugins).sort(([a], [b]) => a.localeCompare(b))),
  };

  await writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + "\n");
  console.log(`Wrote ${MANIFEST_PATH} with ${Object.keys(manifest.plugins).length} plugin(s)`);
}).catch((e) => {
  console.error("Failure:", e);
  process.exitCode = 1;
});
