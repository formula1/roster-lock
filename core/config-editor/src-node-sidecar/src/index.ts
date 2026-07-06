#!/usr/bin/env node
import { Command } from "commander";
import { downloadToFolderCommand } from "./commands/download-to-folder";
import { getDownloadPlugins } from "./commands/get-download-plugins";
import { matchDownloadProtocols } from "./commands/match-download-protocol";
import { listScriptPlugins } from "./commands/get-script-plugins";
import { runUntrustedScriptCommand } from "./commands/run-script";
import { stat as fsStat } from "fs/promises";
import { resolve as pathResolve } from "path";
import { splitStdInByNull, getItemAtOffset } from "./utils";


const program = new Command();

program
  .name("Rosterlock Config Editor Sidecar")
  .description(
    [
      "Node.js sidecar for the Tauri config editor",
      process.argv.join(" "),
      "Used for processes requiring native access"
    ].join("\n")
  )
  .version("0.0.1");

program
  .command("download-to-folder")
  .description(
    [
      "Download from a source to a folder",
    ].join("\n")
  )
  .argument("<plugin-dir>", "The folder that houses the plugins")
  .requiredOption("-i, --input-url <url>", "URL to download")
  .requiredOption("-o, --output-folder <path>", "Output directory for downloaded files")
  .action(async (pluginDir, options)=>{
    const outputFolder = pathResolve(process.cwd(), options.outputFolder);
    const stat = await fsStat(outputFolder);
    if(!stat.isDirectory()){
      throw new Error("Output folder is not a directory");
    }
    await downloadToFolderCommand(pluginDir, options.inputUrl, outputFolder);
  });

program
  .command("get-download-plugins")
  .description("Gets all plugins related to downloading")
  .argument("<plugin-dir>", "The folder that houses the plugins")
  .action(async (pluginDir)=>{
    console.log(await getDownloadPlugins(pluginDir));
  });

program
  .command("match-download-protocol")
  .description("Gets all matching protocols related to the url")
  .argument("<plugin-dir>", "The folder that houses the plugins")
  .argument("<url>", "The url we are trying to match")
  .action(async (pluginDir, url)=>{
    console.log(await matchDownloadProtocols(pluginDir, url));
  });


program
  .command("get-untrusted-script-plugins")
  .description("Get all allowed untrusted scripts")
  .argument("<plugin-dir>", "The folder that houses the plugins")
  .action(async (pluginDir)=>{
    console.log(await listScriptPlugins(pluginDir));
  });

program
  .command("run-script")
  .description("Run a script — reads a JSON ScriptConfig from stdin")
  .argument("<plugin-dir>", "The folder that houses the plugins")
  .action(async (pluginDir)=>{
    let json: unknown;
    try {
      json = JSON.parse(await getItemAtOffset(splitStdInByNull()));
    } catch (err) {
      console.error("INVALID_CONFIG", (err as Error).message);
      process.exitCode = 1;
      return;
    }
    await runUntrustedScriptCommand(pluginDir, json);
  });

program.parse();

