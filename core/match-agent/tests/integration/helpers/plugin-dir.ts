import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { createRequire } from "node:module";
import { installPlugin } from "@roster-lock/plugin-runtime";

const _require = createRequire(__filename);

// Installs real, already-built workspace dl-* plugins into a throwaway
// pluginDir via the actual `installPlugin` - mirrors
// core/plugin-runtime/test/helpers/plugin-dir.ts, duplicated here since that
// helper lives under plugin-runtime's test/ (not published) and match-agent
// needs the same fixture to exercise a real download through ensurePieceExists.
export async function createFixturePluginDir(packageNames: Array<string>) {
  const pluginDir = await mkdtemp(join(tmpdir(), "match-agent-plugin-dir-"));

  for (const packageName of packageNames) {
    const pkgJsonPath = _require.resolve(`${packageName}/package.json`);
    await installPlugin(pluginDir, dirname(pkgJsonPath));
  }

  return {
    pluginDir,
    cleanup: () => rm(pluginDir, { recursive: true, force: true }),
  };
}
