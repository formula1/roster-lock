import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { importPackage, importPlugin } from "./utils";
import { PluginType, PluginTypeMap, PLUGIN_TYPES, PLUGIN_TYPE_VALIDATORS } from "./plugin-types";

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


function readPluginType(pkgJson: Record<string, unknown>, packageName: string): PluginType {
  const meta = pkgJson["roster-lock"];
  if (typeof meta !== "object" || meta === null || !("pluginType" in meta)) {
    throw new Error(`${packageName}: missing "roster-lock": { "pluginType": "..." } in package.json`);
  }
  const pluginType = (meta as Record<string, unknown>).pluginType;
  if (!PLUGIN_TYPES.has(pluginType as PluginType)) {
    throw new Error(`${packageName}: invalid pluginType "${pluginType}". Must be one of: ${[...PLUGIN_TYPES].join(", ")}`);
  }
  return pluginType as PluginType;
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

  const installedPkgJson = importPackage(pluginDir, packageName);
  const version = installedPkgJson.version as string;
  const type = readPluginType(installedPkgJson, packageName);

  const pluginModule = await importPlugin(pluginDir, packageName, installedPkgJson);

  validatePluginShape(
    pluginModule.default ?? pluginModule, type, packageName
  );

  const manifest = readManifest(pluginDir);
  const existing = manifest.plugins.findIndex((p) => p.package === packageName);
  if (existing >= 0) {
    manifest.plugins[existing] = { ...manifest.plugins[existing], version, type };
  } else {
    manifest.plugins.push({ package: packageName, version, type, priority: 0 });
  }
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

export function getPluginsOfType<T extends PluginType>(
  pluginDir: string,
  type: T
): Promise<Array<PluginTypeMap[T]>> {
  const pluginPkgs = readManifest(pluginDir)
    .plugins.filter((p) => p.type === type)
    .sort((a, b) => b.priority - a.priority);

  return Promise.all(pluginPkgs.map(async (plugin) => {
    const packageJson = importPackage(pluginDir, plugin.package);
    return await importPlugin(pluginDir, plugin.package, packageJson) as PluginTypeMap[T];
  }));
}

