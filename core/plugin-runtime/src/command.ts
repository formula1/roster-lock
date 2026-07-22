import {
  DEFAULT_PLUGIN_DIR,
  installPlugin, updatePlugin, uninstallPlugin, setPluginPriority, getPluginPackagesOfType,
  PLUGIN_TYPES, PluginType,
} from "./plugin-management";
import { mkdir, stat as fsStat } from "node:fs/promises";
import { resolve as pathResolve } from "node:path";

import { Command } from 'commander';

// Returns fresh, parentless Command instances every call, so any CLI
// (this package's own bin, or another package's `program.addCommand(cmd)`)
// can attach its own copies without the two sharing or fighting over state.
export function createPluginCommands(): Array<Command> {
  const initializeDefault = new Command("initialize-default")
    .description("Create default roster-lock folders")
    .action(async ()=>{
      await mkdir(DEFAULT_PLUGIN_DIR, { recursive: true })
    });

  const install = new Command('install')
    .description('Install a new plugin for roster lock to use. The plugin is expected to be a valid npm package.')
    .argument('<package>', 'npm package which the plugin is available in')
    .option('-d, --plugin-dir <dir>', 'folder where the plugins are')
    .action(async (pluginPackage, options) => {
      const pluginDir = await getPluginDir(options.pluginDir);
      await installPlugin(pluginDir, pluginPackage);
    });

  const update = new Command('update')
    .description('Update an installed plugin to its latest semver-compatible version. For local file: plugins, re-run install with the original path instead.')
    .argument('<package>', 'name of the installed plugin package to update')
    .option('-d, --plugin-dir <dir>', 'folder where the plugins are')
    .action(async (pluginPackage, options) => {
      const pluginDir = await getPluginDir(options.pluginDir);
      await updatePlugin(pluginDir, pluginPackage);
    });

  const uninstall = new Command('uninstall')
    .description('Remove a plugin so roster lock can\'t use it. The plugin is expected to be a valid npm package.')
    .argument('<package>', 'npm package which the plugin is available in')
    .option('-d, --plugin-dir <dir>', 'folder where the plugins are')
    .action(async (pluginPackage, options) => {
      const pluginDir = await getPluginDir(options.pluginDir);
      await uninstallPlugin(pluginDir, pluginPackage)
    });

  const updatePriority = new Command("update-priority")
    .description('Update the priority of a package so it runs before or after other plugins. Plugins may overlap in the files they support. The plugin is expected to be a valid npm package.')
    .argument('<package>', 'npm package which the plugin is available in')
    .argument('<priority>', 'The number the new priority the package will be. Decimals (such as 1.5) are supported')
    .option('-d, --plugin-dir <dir>', 'folder where the plugins are')
    .action(async (pluginPackage, priorityStr, options) => {
      const pluginDir = await getPluginDir(options.pluginDir);
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
      const pluginDir = await getPluginDir(options.pluginDir);
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

  return [initializeDefault, install, update, uninstall, updatePriority, list];
}

export function runCommand(){
  const program = new Command()
    .name('roster-lock-plugin-manager')
    .description('CLI to manage plugins for roster lock')
    .version(require("../package.json").version);
  for(const command of createPluginCommands()) program.addCommand(command);
  program.parse();
}

async function getPluginDir(value: string | undefined){
  if(typeof value === "undefined") return DEFAULT_PLUGIN_DIR;
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
