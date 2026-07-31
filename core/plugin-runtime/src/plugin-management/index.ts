import type Arborist from "@npmcli/arborist";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { importPluginPackage, PluginPackageType } from "./package";
import { importPluginModule } from "./module";
import { PluginType, PluginTypeMap, PLUGIN_TYPE_VALIDATORS } from "./plugin-types";
import { fetchOfficialManifest, diffAgainstOfficial } from "./official-manifest";

export { DEFAULT_PLUGIN_DIR, DEFAULT_REPO_URL, manifestUrlFromRepo } from "./constants";
export * from "./plugin-types";
export * from "./official-manifest";

export type PluginEntry = {
  package: string;
  version: string;
  type: PluginType;
  priority: number;
};

type PluginManifest = {
  plugins: PluginEntry[];
};

export function getInstalledPlugins(pluginDir: string): Array<PluginEntry> {
  return readManifest(pluginDir).plugins;
}

const manifestPath = (pluginDir: string) => path.join(pluginDir, "plugins.json");

function readManifest(pluginDir: string): PluginManifest {
  const p = manifestPath(pluginDir);
  if (!existsSync(p)) return { plugins: [] };
  return JSON.parse(readFileSync(p, "utf-8")) as PluginManifest;
}

function writeManifest(pluginDir: string, manifest: PluginManifest): void {
  writeFileSync(manifestPath(pluginDir), JSON.stringify(manifest, null, 2) + "\n");
}

function resolvePackageName(packagePath: string): string {
  if (path.isAbsolute(packagePath)) {
    packagePath = path.join(packagePath, "package.json")
    const pkgJson = JSON.parse(readFileSync(packagePath, "utf-8"));
    return pkgJson.name as string;
  }

  // Strip version specifier: @scope/pkg@1.0.0 → @scope/pkg, pkg@1.0.0 → pkg
  const atIndex = packagePath.lastIndexOf("@");
  return atIndex > 0 ? packagePath.slice(0, atIndex) : packagePath;
}


function validatePluginShape(plugin: unknown, type: PluginType, packageName: string): void {
  if (typeof plugin !== "object" || plugin === null) {
    throw new Error(`${packageName}: plugin must export an object`);
  }
  if (!PLUGIN_TYPE_VALIDATORS[type](plugin as Record<string, unknown>)) {
    throw new Error(`${packageName}: declares type "${type}" but does not implement the required interface`);
  }
}

// @npmcli/arborist takes ~250ms just to require() - loaded only by the
// three functions below (install/update/uninstall), so every other consumer
// of plugin-management (running scripts, downloading, listing plugins)
// doesn't pay that cost on every process start.
async function newArborist(pluginDir: string): Promise<Arborist> {
  const { default: ArboristCtor } = await import("@npmcli/arborist");
  return new ArboristCtor({ path: pluginDir });
}

function normalizePackagePath(packagePath: string): string {
  if (packagePath.startsWith("file:"))
    packagePath = packagePath.slice(5);
  if (packagePath.startsWith("~/") || packagePath.startsWith("~\\"))
    packagePath = path.join(os.homedir(), packagePath.slice(2));
  if(path.isAbsolute(packagePath)) return packagePath;
  const isLocal =
    packagePath.startsWith("./") ||
    packagePath.startsWith(".\\") ||
    packagePath.startsWith("../") ||
    packagePath.startsWith("..\\");
  if(isLocal) return path.resolve(process.cwd(), packagePath)

  // If the packagePath isn't a valid path
  // We're expecting the package is a normal npm package
  return packagePath;
}

export async function installPlugin(
  pluginDir: string, packagePath: string
): Promise<void> {
  packagePath = normalizePackagePath(packagePath);
  const packageName = resolvePackageName(packagePath);

  const arborist = await newArborist(pluginDir);
  await arborist.reify({ add: [packagePath] });

  const installedPkgJson = await importPluginPackage(pluginDir, packageName);
  const version = installedPkgJson.version;
  const type = installedPkgJson["roster-lock"].pluginType;

  const pluginModule = await importPluginModule(pluginDir, packageName, installedPkgJson);

  validatePluginShape(
    pluginModule, type, packageName
  );

  const manifest = readManifest(pluginDir);
  const existing = manifest.plugins.findIndex((p) => p.package === packageName);
  if (existing >= 0) {
    manifest.plugins[existing] = { ...manifest.plugins[existing], version, type };
  } else {
    manifest.plugins.push({ package: packageName, version, type, priority: installedPkgJson["roster-lock"].priority || 0 });
  }
  writeManifest(pluginDir, manifest);
}

export async function updatePlugin(
  pluginDir: string, packageName: string
): Promise<void> {
  const manifest = readManifest(pluginDir);
  const existing = manifest.plugins.find((p) => p.package === packageName);
  if (!existing) throw new Error(`Plugin not installed: ${packageName}`);

  const pluginDirPkgJson = JSON.parse(readFileSync(path.join(pluginDir, "package.json"), "utf-8")) as {
    dependencies?: Record<string, string>;
  };
  const specifier = pluginDirPkgJson.dependencies?.[packageName];
  if (!specifier) throw new Error(`No install specifier found for ${packageName} in ${pluginDir}/package.json`);

  const arborist = await newArborist(pluginDir);
  if(specifier.startsWith("file:")){
    const specifierPath = path.resolve(pluginDir, specifier.slice(5));
    await arborist.reify({ add: [specifierPath] });
  } else {
    await arborist.reify({ update: { names: [packageName] } });
  }

  const installedPkgJson = await importPluginPackage(pluginDir, packageName);
  const pluginModule = await importPluginModule(pluginDir, packageName, installedPkgJson);
  validatePluginShape(pluginModule, existing.type, packageName);

  existing.version = installedPkgJson.version;
  writeManifest(pluginDir, manifest);
}

export async function uninstallPlugin(pluginDir: string, packageName: string): Promise<void> {
  const arborist = await newArborist(pluginDir);
  await arborist.reify({ rm: [packageName] });

  const manifest = readManifest(pluginDir);
  manifest.plugins = manifest.plugins.filter((p) => p.package !== packageName);
  writeManifest(pluginDir, manifest);
}

export function setPluginPriority(
  pluginDir: string,
  packageName: string,
  priority: number
): void {
  const manifest = readManifest(pluginDir);
  const entry = manifest.plugins.find((p) => p.package === packageName);
  if (!entry) throw new Error(`Plugin not installed: ${packageName}`);
  entry.priority = priority;
  writeManifest(pluginDir, manifest);
}

export function getPluginPackagesOfType(
  pluginDir: string,
  type: PluginType
){
  const pluginPkgs = readManifest(pluginDir)
    .plugins.filter((p) => p.type === type)
    .sort((a, b) => b.priority - a.priority);
  return Promise.all(pluginPkgs.map(async (plugin) => {
    return {
      entry: plugin,
      package: await importPluginPackage(pluginDir, plugin.package),
    }
  }))
}

export async function getPluginModuleByName<T extends PluginType>(
  pluginDir: string,
  packageName: string,
  type: T
): Promise<PluginTypeMap[T]> {
  const entry = readManifest(pluginDir).plugins.find((p) => p.package === packageName);
  if(!entry) throw new Error(`Plugin not installed: ${packageName}`);
  if(entry.type !== type) throw new Error(`Plugin ${packageName} is a "${entry.type}" plugin, not "${type}"`);

  const packageJson = await importPluginPackage(pluginDir, packageName);
  return await importPluginModule(pluginDir, packageName, packageJson) as PluginTypeMap[T];
}

export function getPluginModulesOfType<T extends PluginType>(
  pluginDir: string,
  type: T
): Promise<Array<PluginTypeMap[T]>> {
  const pluginPkgs = readManifest(pluginDir)
    .plugins.filter((p) => p.type === type)
    .sort((a, b) => b.priority - a.priority);

  return Promise.all(pluginPkgs.map(async (plugin) => {
    const packageJson = await importPluginPackage(pluginDir, plugin.package);
    return await importPluginModule(pluginDir, plugin.package, packageJson) as PluginTypeMap[T]
  }));
}

// Shared by the `plugin sync` CLI command and match-agent's `mount-usb`, so
// there's one place that decides what "in sync with the official manifest"
// means to actually install/update/re-prioritize.
export async function syncPluginsToOfficialManifest(pluginDir: string, manifestUrl: string): Promise<{
  installed: Array<{ package: string, version: string }>,
  priorityChanges: Array<{ package: string, priority: number }>,
}> {
  const official = await fetchOfficialManifest(manifestUrl);
  const installed = getInstalledPlugins(pluginDir);
  const diff = diffAgainstOfficial(installed, official);

  const toInstall = [
    ...diff.missing,
    ...diff.outdated.map((o) => ({ package: o.package, version: o.officialVersion })),
  ];
  for(const p of toInstall){
    await installPlugin(pluginDir, `${p.package}@${p.version}`);
  }

  const priorityChanges: Array<{ package: string, priority: number }> = [];
  for(const [packageName, p] of Object.entries(official.plugins)){
    if(typeof p.priority === "number"){
      await setPluginPriority(pluginDir, packageName, p.priority);
      priorityChanges.push({ package: packageName, priority: p.priority });
    }
  }

  return { installed: toInstall, priorityChanges };
}

export function getPluginFullOfType<T extends PluginType>(
  pluginDir: string,
  type: T
): Promise<Array<{ entry: PluginEntry, package: PluginPackageType, module: PluginTypeMap[T] }>>{
  const pluginPkgs = readManifest(pluginDir)
    .plugins.filter((p) => p.type === type)
    .sort((a, b) => b.priority - a.priority);

  return Promise.all(pluginPkgs.map(async (plugin) => {
    const packageJson = await importPluginPackage(pluginDir, plugin.package);
    return {
      entry: plugin,
      package: packageJson,
      module: await importPluginModule(pluginDir, plugin.package, packageJson) as PluginTypeMap[T]
    }
  }));
}

