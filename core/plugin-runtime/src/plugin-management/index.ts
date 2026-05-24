import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { importPluginPackage, PluginPackageType } from "./package";
import { importPluginModule } from "./module";
import { PluginType, PluginTypeMap, PLUGIN_TYPE_VALIDATORS } from "./plugin-types";

export { DEFAULT_PLUGIN_DIR } from "./constants";
export * from "./plugin-types";

type PluginEntry = {
  package: string;
  version: string;
  type: PluginType;
  priority: number;
};

type PluginManifest = {
  plugins: PluginEntry[];
};

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
  const isLocal =
    packagePath.startsWith("file:") ||
    packagePath.startsWith("./") ||
    packagePath.startsWith("../") ||
    path.isAbsolute(packagePath);

  if (isLocal) {
    const localPath = packagePath.startsWith("file:") ? packagePath.slice(5) : packagePath;
    const pkgJson = JSON.parse(readFileSync(path.join(localPath, "package.json"), "utf-8"));
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

export async function installPlugin(
  pluginDir: string, packagePath: string
): Promise<void> {
  const packageName = resolvePackageName(packagePath);

  execSync(`npm install "${packagePath}" --prefix "${pluginDir}"`, { stdio: "inherit" });

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

  execSync(`npm update "${packageName}" --prefix "${pluginDir}"`, { stdio: "inherit" });

  const installedPkgJson = await importPluginPackage(pluginDir, packageName);
  const pluginModule = await importPluginModule(pluginDir, packageName, installedPkgJson);
  validatePluginShape(pluginModule, existing.type, packageName);

  existing.version = installedPkgJson.version;
  writeManifest(pluginDir, manifest);
}

export function uninstallPlugin(pluginDir: string, packageName: string): void {
  execSync(`npm uninstall "${packageName}" --prefix "${pluginDir}"`, { stdio: "inherit" });

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

