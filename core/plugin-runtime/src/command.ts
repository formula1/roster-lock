import {
  DEFAULT_PLUGIN_DIR,
  installPlugin, updatePlugin, uninstallPlugin, setPluginPriority, getPluginPackagesOfType,
  PLUGIN_TYPES, PluginType, getInstalledPlugins, fetchOfficialManifest, diffAgainstOfficial,
  syncPluginsToOfficialManifest,
} from "./plugin-management";
import { mkdir, stat as fsStat } from "node:fs/promises";
import { resolve as pathResolve } from "node:path";

import { Command } from 'commander';

export type CreatePluginCommandsOptions = {
  // Resolves the plugin dir to use when -d/--plugin-dir is omitted. Defaults
  // to DEFAULT_PLUGIN_DIR (~/roster-lock/plugins) - callers that have their
  // own config/discovery story (e.g. match-agent's sibling-config-or-home
  // lookup) can override this instead of always falling back to the home dir.
  getDefaultPluginDir?: () => Promise<string>,
};

// Returns fresh, parentless Command instances every call, so any CLI
// (this package's own bin, or another package's `program.addCommand(cmd)`)
// can attach its own copies without the two sharing or fighting over state.
export function createPluginCommands(options: CreatePluginCommandsOptions = {}): Array<Command> {
  const getDefaultPluginDir = options.getDefaultPluginDir ?? (async () => DEFAULT_PLUGIN_DIR);

  async function resolvePluginDir(value: string | undefined): Promise<string> {
    if(typeof value === "undefined") return getDefaultPluginDir();
    const dir = pathResolve(process.cwd(), value);
    const statResult = await (async ()=>{
      try {
        return await fsStat(dir)
      }catch(e){
        throw new Error("Plugin folder doesn't exist");
      }
    })();
    if(!statResult.isDirectory()){
      throw new Error("Plugin folder is a file, expects a folder");
    }
    return dir;
  }

  const initializeDefault = new Command("initialize-default")
    .description("Create default roster-lock folders")
    .action(async ()=>{
      await mkdir(await getDefaultPluginDir(), { recursive: true })
    });

  const install = new Command('install')
    .description('Install a new plugin for roster lock to use. The plugin is expected to be a valid npm package.')
    .argument('<package>', 'npm package which the plugin is available in')
    .option('-d, --plugin-dir <dir>', 'folder where the plugins are')
    .action(async (pluginPackage, options) => {
      const pluginDir = await resolvePluginDir(options.pluginDir);
      await installPlugin(pluginDir, pluginPackage);
    });

  const update = new Command('update')
    .description('Update an installed plugin to its latest semver-compatible version. For local file: plugins, re-run install with the original path instead.')
    .argument('<package>', 'name of the installed plugin package to update')
    .option('-d, --plugin-dir <dir>', 'folder where the plugins are')
    .action(async (pluginPackage, options) => {
      const pluginDir = await resolvePluginDir(options.pluginDir);
      await updatePlugin(pluginDir, pluginPackage);
    });

  const uninstall = new Command('uninstall')
    .description('Remove a plugin so roster lock can\'t use it. The plugin is expected to be a valid npm package.')
    .argument('<package>', 'npm package which the plugin is available in')
    .option('-d, --plugin-dir <dir>', 'folder where the plugins are')
    .action(async (pluginPackage, options) => {
      const pluginDir = await resolvePluginDir(options.pluginDir);
      await uninstallPlugin(pluginDir, pluginPackage)
    });

  const updatePriority = new Command("update-priority")
    .description('Update the priority of a package so it runs before or after other plugins. Plugins may overlap in the files they support. The plugin is expected to be a valid npm package.')
    .argument('<package>', 'npm package which the plugin is available in')
    .argument('<priority>', 'The number the new priority the package will be. Decimals (such as 1.5) are supported')
    .option('-d, --plugin-dir <dir>', 'folder where the plugins are')
    .action(async (pluginPackage, priorityStr, options) => {
      const pluginDir = await resolvePluginDir(options.pluginDir);
      const priority = Number.parseFloat(priorityStr);
      if(Number.isNaN(priority)){
        throw new Error("Priority should be a number. Decimals are supported")
      }
      await setPluginPriority(pluginDir, pluginPackage, priority);
    });

  const list = new Command("list")
    .description('List plugins that serve a specific purpose')
    .argument('<purpose>', `Purpose the plugin is expected to be. Should be one of ${JSON.stringify(Array.from(PLUGIN_TYPES))}`)
    .option('-d, --plugin-dir <dir>', 'folder where the plugins are')
    .action(async (pluginPurpose, options) => {
      const pluginDir = await resolvePluginDir(options.pluginDir);
      if(!PLUGIN_TYPES.has(pluginPurpose)){
        throw new Error("Plugins should be one of " + JSON.stringify(Array.from(PLUGIN_TYPES)))
      }
      const plugins = await getPluginPackagesOfType(pluginDir, pluginPurpose as PluginType)
      if(plugins.length === 0){
        console.warn("No plugins available for " + pluginPurpose)
        return;
      }
      for(const { entry, package: plugin } of plugins){
        console.log(`${plugin.name}@${plugin.version} - priority ${entry.priority}`)
      }
    });

  const status = new Command("status")
    .description(
      "Compare installed plugins against the official plugin manifest. Read-only - " +
      "safe to run anywhere, including machines you don't otherwise trust to install plugins."
    )
    .option('-d, --plugin-dir <dir>', 'folder where the plugins are')
    .requiredOption('--manifest-url <url>', 'URL of the official plugin manifest to check against')
    .action(async (options) => {
      const pluginDir = await resolvePluginDir(options.pluginDir);
      const official = await fetchOfficialManifest(options.manifestUrl);
      const installed = getInstalledPlugins(pluginDir);
      const diff = diffAgainstOfficial(installed, official);

      for(const p of diff.missing) console.log(`MISSING   ${p.package}@${p.version}`);
      for(const p of diff.outdated) {
        console.log(`OUTDATED  ${p.package}: installed ${p.installedVersion}, official ${p.officialVersion}`);
      }
      for(const p of diff.priorityMismatch) {
        console.log(`PRIORITY  ${p.package}: installed ${p.installedPriority}, official ${p.officialPriority}`);
      }
      for(const name of diff.upToDate) console.log(`OK        ${name}`);
      for(const name of diff.unlisted) console.log(`UNLISTED  ${name} (not part of the official list)`);

      const outOfSyncCount = diff.missing.length + diff.outdated.length + diff.priorityMismatch.length;
      if(outOfSyncCount > 0){
        console.log(`\n${outOfSyncCount} plugin(s) out of sync with the official list. Run "sync" on a trusted machine to update.`);
        process.exitCode = 1;
      } else {
        console.log("\nAll official plugins are up to date.");
      }
    });

  const sync = new Command("sync")
    .description(
      "Install/update plugins to match the official manifest exactly. This installs npm " +
      "packages (via Arborist) - only run this on a machine you trust, not an untrusted/shared one."
    )
    .option('-d, --plugin-dir <dir>', 'folder where the plugins are')
    .requiredOption('--manifest-url <url>', 'URL of the official plugin manifest to sync against')
    .action(async (options) => {
      const pluginDir = await resolvePluginDir(options.pluginDir);
      const { installed, priorityChanges } = await syncPluginsToOfficialManifest(pluginDir, options.manifestUrl);
      if(installed.length === 0 && priorityChanges.length === 0){
        console.log("Already in sync with the official list.");
        return;
      }
      for(const p of installed) console.log(`Installed ${p.package}@${p.version}`);
      for(const p of priorityChanges) console.log(`Set priority of ${p.package} to ${p.priority}`);
      console.log(`Sync complete - ${installed.length} plugin(s) installed/updated, ${priorityChanges.length} priority change(s) applied.`);
    });

  return [initializeDefault, install, update, uninstall, updatePriority, list, status, sync];
}

export function runCommand(){
  const program = new Command()
    .name('roster-lock-plugin-manager')
    .description('CLI to manage plugins for roster lock')
    .version(require("../package.json").version);
  for(const command of createPluginCommands()) program.addCommand(command);
  program.parse();
}
