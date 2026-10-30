import { HTTPRequestHandler, HTTPError } from "../../../utils/http-router";
import { V1Env } from "../globals/types";
import { requirePluginName, resolveTarget } from "./shared";

// Every binary GameLauncher.getBinary has ever downloaded for this plugin,
// with when it was downloaded/last actually used merged in from match-agent's
// own bookkeeping (see FolderDB's game_launcher_binaries table -
// GameLauncherPlugin itself has no way to report either) - lets a settings
// UI show what's accumulating under dataDir and offer removeGameLauncherBinary
// below instead of old versions silently piling up forever.
export const listGameLauncherBinaries: HTTPRequestHandler = async function(
  this: V1Env, { res }, routeInfo
){
  const pluginName = requirePluginName(routeInfo);
  const target = resolveTarget(routeInfo);

  const binaries = await this.pluginRuntime.gameLauncher.listBinaries(pluginName, target);
  const usage = await this.fileDB.getBinaryUsageFor(pluginName, binaries.map((b) => b.binaryLocation));

  const result = binaries.map((binary) => ({
    ...binary,
    downloadedAt: usage.get(binary.binaryLocation)?.downloadedAt ?? null,
    lastUsedAt: usage.get(binary.binaryLocation)?.lastUsedAt ?? null,
  }));

  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify(result));
}

// binaryLocation as a query param, not a JSON body - same shape as
// util-routers/file-system's routes, for the same reason (a DELETE
// identifying one resource by path). GameLauncher.removeBinary rejects
// anything outside this plugin's own dataDir with a plain Error, surfaced
// here as a 400 rather than a 500 - a client-facing "that's not a binary
// this plugin downloaded", not a server fault.
export const removeGameLauncherBinary: HTTPRequestHandler = async function(
  this: V1Env, { res }, routeInfo
){
  const pluginName = requirePluginName(routeInfo);
  const binaryLocation = routeInfo.url.searchParams.get("binaryLocation");
  if(!binaryLocation) throw new HTTPError(400, "Missing binaryLocation query parameter");

  try {
    await this.pluginRuntime.gameLauncher.removeBinary(pluginName, binaryLocation);
  } catch(e){
    throw new HTTPError(400, (e as Error).message);
  }
  await this.fileDB.removeBinaryUsage(pluginName, binaryLocation);

  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ ok: true }));
}
