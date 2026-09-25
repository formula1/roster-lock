import { HTTPRequestHandler, HTTPError } from "../../../utils/http-router";
import { V1Env } from "../globals/types";
import { requirePluginName } from "./shared";

// One listing endpoint, mirroring /piece/sort-list/available - every installed
// game-launcher plugin's full AvailableGameLauncher record in one response, rather
// than splitting connection-mode support and gameConfigSchema into separate
// per-plugin routes. Both are small, static JSON already computed by
// listAvailable() from the plugin's own module fields, so there's no
// fetch-cost reason to make a client ask for them separately, and nothing
// else in this router splits a plugin's metadata that way either.
export const listAvailableGameLaunchers: HTTPRequestHandler = async function(
  this: V1Env, { res }
){
  const available = await this.pluginRuntime.gameLauncher.listAvailable();
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify(available));
}

// Installs the plugin *package* itself (registry/manifest-based, via
// PluginManager - distinct from updateBinary in version.ts, which fetches a
// newer engine binary for a plugin that's already installed).
export const installGameLauncherPlugin: HTTPRequestHandler = async function(
  this: V1Env, { res }, routeInfo
){
  const pluginName = requirePluginName(routeInfo);

  try {
    await this.pluginRuntime.installPlugin(pluginName);
  } catch(e){
    throw new HTTPError(400, (e as Error).message);
  }

  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ ok: true }));
}
