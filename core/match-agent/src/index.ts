#!/usr/bin/env node

export * from "./handle-room/version-1";

import { join as pathJoin, resolve as pathResolve } from "node:path";
import { mkdir } from "node:fs/promises";
import {
  CONFIG_FILE_NAME, DEFAULT_MATCH_CONIFG, getConfig, setConfig, configExists, resolveConfigFolders, findConfigFile,
} from "./config";
import { generateAuthCode, authMiddleware, validateAuthCode } from "./authentication";
import { corsMiddleware } from "./cors";
import { createEditorV1Router } from "./editor-support";
import { MatchAgentServer } from "./server";
import { program } from "commander";
import { createV1Routers } from "./handle-room/version-1";
import { getSQLite3FolderDB } from "./handle-room/version-1/globals/FolderDB";
import {
  PluginManager, createPluginCommands, syncPluginsToOfficialManifest, DEFAULT_REPO_URL, manifestUrlFromRepo,
} from "@roster-lock/plugin-runtime";


program
  .name("rosterlock-match-agent")
  .description("Runs the match-agent server");

// Resolves the same way `listen` does (sibling config next to the executable,
// falling back to home), so `plugin install` without -d/--plugin-dir lands
// in the folder a mounted USB's config actually points at, instead of
// silently defaulting to plugin-runtime's own ~/roster-lock/plugins.
async function defaultPluginDirFromConfig(): Promise<string> {
  const configFilePath = await findConfigFile();
  const existingConfig = (await configExists(configFilePath)) ? await getConfig(configFilePath) : null;
  return resolveConfigFolders(configFilePath, existingConfig ?? {}).pluginFolder;
}

// Plugin management (install/update/uninstall/list/priority), reused as-is
// from plugin-runtime under its own `plugin` group - mainly here for testing
// convenience, not meant to be the primary way plugins get managed.
const pluginCommand = program
  .command("plugin")
  .description("Manage plugins (install/update/uninstall/list/priority)");
for(const command of createPluginCommands({ getDefaultPluginDir: defaultPluginDirFromConfig })){
  pluginCommand.addCommand(command);
}

program
  .command("listen")
  .description("Runs the match-agent server (leave this running while you play - it can serve multiple games/matches at once)")
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
  .option(
    "--manifest-url <url>",
    "if given, sync plugins to match the official manifest at this URL right after mounting"
  )
  .action(async (targetPath: string, options: {
    pieceFolder: string, pluginFolder: string, authCode?: string, force: boolean, manifestUrl?: string,
  }) => {
    const mountFolder = pathResolve(targetPath);
    await mkdir(mountFolder, { recursive: true });

    const configFilePath = pathJoin(mountFolder, CONFIG_FILE_NAME);
    const existingConfig = (await configExists(configFilePath)) ? await getConfig(configFilePath) : null;
    if(existingConfig && !options.force){
      throw new Error(`${configFilePath} already exists - pass --force to overwrite it`);
    }

    const pluginFolder = pathJoin(mountFolder, options.pluginFolder);
    await mkdir(pathJoin(mountFolder, options.pieceFolder), { recursive: true });
    await mkdir(pluginFolder, { recursive: true });

    const authCode = options.authCode || existingConfig?.authCode || generateAuthCode();
    await setConfig(configFilePath, {
      authCode,
      pieceFolder: options.pieceFolder,
      pluginFolder: options.pluginFolder,
    });

    console.log(`Wrote ${configFilePath}`);

    if(options.manifestUrl){
      const { installed, priorityChanges } = await syncPluginsToOfficialManifest(pluginFolder, options.manifestUrl);
      for(const p of installed) console.log(`Installed ${p.package}@${p.version}`);
      for(const p of priorityChanges) console.log(`Set priority of ${p.package} to ${p.priority}`);
      console.log(`Plugin sync complete - ${installed.length} plugin(s) installed/updated, ${priorityChanges.length} priority change(s) applied.`);
    }
  });

program
  .command("install <authCode>")
  .description(
    "Install match-agent for regular (non-USB) use: creates pieces/plugins folders and a " +
    CONFIG_FILE_NAME + " at the default config location, stores the given auth code, and syncs " +
    "plugins to the official manifest. Intended as the one-time setup step before `listen`."
  )
  .option(
    "--config-file <path>",
    "config file to write (defaults to the standard home-directory location)"
  )
  .option("--piece-folder <name>", "name of the pieces folder to create, relative to the config file", "pieces")
  .option("--plugin-folder <name>", "name of the plugins folder to create, relative to the config file", "plugins")
  .option("--force", "overwrite an existing config at the target location", false)
  .option("--manifest-url <url>", "URL of the official plugin manifest to sync plugins against", manifestUrlFromRepo(DEFAULT_REPO_URL))
  .action(async (authCode: string, options: {
    configFile?: string, pieceFolder: string, pluginFolder: string, force: boolean, manifestUrl: string,
  }) => {
    const configFilePath = options.configFile ? pathResolve(options.configFile) : DEFAULT_MATCH_CONIFG;
    const existingConfig = (await configExists(configFilePath)) ? await getConfig(configFilePath) : null;
    if(existingConfig && !options.force){
      throw new Error(`${configFilePath} already exists - pass --force to overwrite it`);
    }

    const resolvedFolders = resolveConfigFolders(configFilePath, {
      pieceFolder: options.pieceFolder, pluginFolder: options.pluginFolder,
    });
    await mkdir(resolvedFolders.pieceFolder, { recursive: true });
    await mkdir(resolvedFolders.pluginFolder, { recursive: true });

    await setConfig(configFilePath, {
      authCode,
      pieceFolder: options.pieceFolder,
      pluginFolder: options.pluginFolder,
    });

    console.log(`Wrote ${configFilePath}`);

    const { installed, priorityChanges } = await syncPluginsToOfficialManifest(
      resolvedFolders.pluginFolder, options.manifestUrl
    );
    for(const p of installed) console.log(`Installed ${p.package}@${p.version}`);
    for(const p of priorityChanges) console.log(`Set priority of ${p.package} to ${p.priority}`);
    console.log(`Plugin sync complete - ${installed.length} plugin(s) installed/updated, ${priorityChanges.length} priority change(s) applied.`);
  });

program
  .command("set-auth-code <authCode>")
  .description("Update the auth code stored in a config file (defaults to the same discovery rules as running the server)")
  .option(
    "--config-file <path>",
    "config file to update (defaults to a config next to this executable, falling back to the home directory)"
  )
  .action(async (authCode: string, options: { configFile?: string }) => {
    const configFilePath = await findConfigFile(options.configFile);
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
  // "{/*path}" = path-to-regexp v8 catch-all; a bare "/" only matches the
  // root exactly, which would skip CORS on every real route.
  server.httpRouter.use("{/*path}", corsMiddleware);
  server.httpRouter.get("/", ({ res })=>{
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ "hello": "world" }));
  });
  server.httpRouter.post("/validate-authcode", validateAuthCode(authCode))

  const { httpRouter: v1HttpRouter, wsRouter: v1WsRouter } = createV1Routers(
    fileDB, pluginRuntime, { authCode, getPort: () => port }
  );
  server.httpRouter.use("/v1", authMiddleware(authCode), v1HttpRouter);
  server.wsRouter.use("/v1", authMiddleware(authCode), v1WsRouter);

  // Config-editor support lives on its own version axis (/editor/v1) so the
  // room protocol (/v1) can move to /v2 without dragging the editor API along.
  server.httpRouter.use("/editor/v1", authMiddleware(authCode), createEditorV1Router(pluginRuntime, fileDB));

  server.listen(port, () => {
    console.log(`match-agent listening on port ${port}`);
  });
}
