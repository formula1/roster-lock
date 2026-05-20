import {
  DEFAULT_PLUGIN_DIR,
  installPlugin, uninstallPlugin, setPluginPriority, getPluginPackagesOfType,
  PLUGIN_TYPES, PluginType,
} from "./plugin-management";
import { mkdir, stat as fsStat } from "node:fs/promises";
import { resolve as pathResolve } from "node:path";

import { Command } from 'commander';
const program = new Command();

program
  .name('roster-lock-plugin-manager')
  .description('CLI to manage plugins for roster lock')
  .version(require("../package.json").version);

program.command("initialize-default")
  .description("Create default roster-lock folders")
  .action(async ()=>{
    await mkdir(DEFAULT_PLUGIN_DIR, { recursive: true })
  })

program.command('install')
  .description('Install a new plugin for roster lock to use. The plugin is expected to be a valid npm package.')
  .argument('<package>', 'npm package which the plugin is available in')
  .option('-d, --plugin-dir <dir>', 'folder where the plugins are')
  .action(async (pluginPackage, options) => {
    const pluginDir = await getPluginDir(options.pluginDir);
    await installPlugin(pluginDir, pluginPackage);
  });

program.command('uninstall')
  .description('Remove a plugin so roster lock can\'t use it. The plugin is expected to be a valid npm package.')
  .argument('<package>', 'npm package which the plugin is available in')
  .option('-d, --plugin-dir <dir>', 'folder where the plugins are')
  .action(async (pluginPackage, options) => {
    const pluginDir = await getPluginDir(options.pluginDir);
    await uninstallPlugin(pluginDir, pluginPackage)
  });

program.command("update-priority")
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


program.command("list")
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

export function runCommand(){
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
