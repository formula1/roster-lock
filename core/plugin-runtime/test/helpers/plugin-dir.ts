import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { createRequire } from "node:module";
import { installPlugin } from "../../src/plugin-management";

const _require = createRequire(__filename);

// Installs real, already-built workspace plugins into a throwaway pluginDir
// via the actual `installPlugin` - the same code path the CLI's `install`
// command uses (npm install, package.json validation, manifest writing,
// plugin-shape validation) - so these fixtures test the real install
// infrastructure instead of a hand-rolled stand-in for it.
export async function createFixturePluginDir(packageNames: Array<string>) {
  const pluginDir = await mkdtemp(join(tmpdir(), "plugin-runtime-test-"));

  for (const packageName of packageNames) {
    const pkgJsonPath = _require.resolve(`${packageName}/package.json`);
    await installPlugin(pluginDir, dirname(pkgJsonPath));
  }

  return {
    pluginDir,
    cleanup: () => rm(pluginDir, { recursive: true, force: true }),
  };
}
