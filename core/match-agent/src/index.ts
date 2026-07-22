#!/usr/bin/env node

export * from "./handle-room/version-1";

import { join as pathJoin, resolve as pathResolve } from "node:path";
import { mkdir } from "node:fs/promises";
import {
  CONFIG_FILE_NAME, getConfig, setConfig, configExists, resolveConfigFolders, findConfigFile,
} from "./config";
import { generateAuthCode, authMiddleware, validateAuthCode } from "./authentication";
import { MatchAgentServer } from "./server";
import { program, Command } from "commander";
import { createV1Routers } from "./handle-room/version-1";
import { getSQLite3FolderDB } from "./handle-room/version-1/globals/FolderDB";
import { PluginManager } from "@roster-lock/plugin-runtime";


program
  .name("rosterlock-match-agent")
  .description("Runs the match-agent server")
  .option("--port <port>", "port to listen on", "58732")
  .option("--auth-code <string>", "authentication code required for access (overrides the config file)")
  .option("--piece-folder <path>", "folder to store downloaded pieces in (overrides the config file)")
  .option("--plugin-folder <path>", "folder to load plugins from (overrides the config file)")
  .option(
    "--config-file <path>",
    "config file to read/persist the auth code and folders from " +
    "(defaults to a config next to this executable, falling back to the home directory)"
  )
  .action(async (options: {
    port: string, authCode?: string, pieceFolder?: string, pluginFolder?: string, configFile?: string,
  }) => {
    const port = Number(options.port);
    if (!Number.isInteger(port) || port < 0 || port > 65535) {
      throw new Error(`Invalid port: ${options.port}`);
    }

    const configFilePath = await findConfigFile(options.configFile);
    const existingConfig = (await configExists(configFilePath)) ? await getConfig(configFilePath) : null;

    const authCode = options.authCode || existingConfig?.authCode || generateAuthCode();
    const resolvedFolders = resolveConfigFolders(configFilePath, existingConfig ?? {});
    const pieceFolder = options.pieceFolder ? pathResolve(options.pieceFolder) : resolvedFolders.pieceFolder;
    const pluginFolder = options.pluginFolder ? pathResolve(options.pluginFolder) : resolvedFolders.pluginFolder;

    // Persist so the auth code stays stable across runs (and a first run
    // against a fresh config writes one out) - keep the config's own
    // relative pieceFolder/pluginFolder untouched so a CLI override on this
    // run doesn't get baked in as this config's permanent setting.
    await setConfig(configFilePath, {
      authCode,
      pieceFolder: existingConfig?.pieceFolder,
      pluginFolder: existingConfig?.pluginFolder,
    });

    await mkdir(pieceFolder, { recursive: true });
    await mkdir(pluginFolder, { recursive: true });

    startServer(port, authCode, pluginFolder, pieceFolder);
  });

program
  .command("mount-usb <path>")
  .description(
    "Scaffold a portable config at <path>: creates pieces/plugins folders and a " +
    CONFIG_FILE_NAME + " next to where the match-agent executable will run from " +
    "(e.g. a mounted USB drive), addressing the folders by relative path."
  )
  .option("--piece-folder <name>", "name of the pieces folder to create, relative to <path>", "pieces")
  .option("--plugin-folder <name>", "name of the plugins folder to create, relative to <path>", "plugins")
  .option("--auth-code <string>", "auth code to store in the config (a random one is generated if omitted)")
  .option("--force", "overwrite an existing config at <path>, generating a new auth code unless --auth-code is given", false)
  .action(async (targetPath: string, options: {
    pieceFolder: string, pluginFolder: string, authCode?: string, force: boolean,
  }) => {
    const mountFolder = pathResolve(targetPath);
    await mkdir(mountFolder, { recursive: true });

    const configFilePath = pathJoin(mountFolder, CONFIG_FILE_NAME);
    const existingConfig = (await configExists(configFilePath)) ? await getConfig(configFilePath) : null;
    if(existingConfig && !options.force){
      throw new Error(`${configFilePath} already exists - pass --force to overwrite it`);
    }

    await mkdir(pathJoin(mountFolder, options.pieceFolder), { recursive: true });
    await mkdir(pathJoin(mountFolder, options.pluginFolder), { recursive: true });

    const authCode = options.authCode || existingConfig?.authCode || generateAuthCode();
    await setConfig(configFilePath, {
      authCode,
      pieceFolder: options.pieceFolder,
      pluginFolder: options.pluginFolder,
    });

    console.log(`Wrote ${configFilePath}`);
  });

program
  .command("set-auth-code <authCode>")
  .description("Update the auth code stored in a config file (defaults to the same discovery rules as running the server)")
  .action(async (authCode: string, _options: unknown, command: Command) => {
    // --config-file is declared once, on the root program, and inherited
    // here via optsWithGlobals() - a same-named option declared separately
    // on this subcommand shadows the root's parsed value instead of merging
    // with it, silently falling back to the default discovery path.
    const configFile = (command.optsWithGlobals() as { configFile?: string }).configFile;
    const configFilePath = await findConfigFile(configFile);
    const existingConfig = (await configExists(configFilePath)) ? await getConfig(configFilePath) : null;
    await setConfig(configFilePath, {
      authCode,
      pieceFolder: existingConfig?.pieceFolder,
      pluginFolder: existingConfig?.pluginFolder,
    });
    console.log(`Updated auth code in ${configFilePath}`);
  });

if (require.main === module) {
  program.parse();
}

export async function startServer(port: number, authCode: string, pluginFolder: string, piecesFolder: string){
  const pluginRuntime = await PluginManager.create(pluginFolder);
  const fileDB = getSQLite3FolderDB(piecesFolder, pluginRuntime);

  const server = new MatchAgentServer();
  server.httpRouter.get("/", ({ res })=>{
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ "hello": "world" }));
  });
  server.httpRouter.post("/validate-authcode", validateAuthCode(authCode))

  const { httpRouter: v1HttpRouter, wsRouter: v1WsRouter } = createV1Routers(fileDB, pluginRuntime);
  server.httpRouter.use("/v1", authMiddleware(authCode), v1HttpRouter);
  server.wsRouter.use("/v1", authMiddleware(authCode), v1WsRouter);

  server.listen(port, () => {
    console.log(`match-agent listening on port ${port}`);
  });
}
