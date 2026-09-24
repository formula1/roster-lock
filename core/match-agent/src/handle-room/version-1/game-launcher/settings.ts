import z, { ZodType } from "zod";
import { GameLauncherLocalSettings } from "@roster-lock/plugin-runtime";
import { jsonBody, HTTPRequestHandler, HTTPError } from "../../../utils/http-router";
import { pickFolder, NoFolderPickerAvailable } from "../../../utils/pick-folder";
import { V1Env } from "../globals/types";
import { requirePluginName } from "./shared";

export const getGameLauncherSettings: HTTPRequestHandler = async function(
  this: V1Env, { res }, routeInfo
){
  const pluginName = requirePluginName(routeInfo);
  const settings = await this.pluginRuntime.gameLauncher.getLocalSettings(pluginName);
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify(settings));
}

const localSettingsBodySchema: ZodType<GameLauncherLocalSettings> = z.object({
  binaryLocation: z.string().optional(),
  localConfig: z.unknown().optional(),
}).strict();

export const setGameLauncherSettings: HTTPRequestHandler = async function(
  this: V1Env, { req, res }, routeInfo
){
  const pluginName = requirePluginName(routeInfo);
  const body = await jsonBody(req);
  const parseResult = localSettingsBodySchema.safeParse(body);
  if(!parseResult.success) throw new HTTPError(400, "Bad Form", parseResult.error);

  await this.pluginRuntime.gameLauncher.setLocalSettings(pluginName, parseResult.data);
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ ok: true }));
}

// Opens a native OS folder-picker on match-agent's own host and returns the
// chosen absolute path, so a UI can offer "Browse..." for binaryLocation
// instead of only free-text entry - see docs/v2/binary-location.md (it's a
// folder, not a single file) and pick-folder.ts (why this has to happen
// server-side rather than via a browser <input>). Pre-seeds the dialog with
// the plugin's current binaryLocation, if any, since that's the most useful
// starting point for re-pointing an existing config.
export const pickGameLauncherBinaryLocation: HTTPRequestHandler = async function(
  this: V1Env, { res }, routeInfo
){
  const pluginName = requirePluginName(routeInfo);
  const settings = await this.pluginRuntime.gameLauncher.getLocalSettings(pluginName);

  let path: string | null;
  try {
    path = await pickFolder(settings.binaryLocation);
  } catch(e){
    if(e instanceof NoFolderPickerAvailable) throw new HTTPError(400, e.message);
    throw e;
  }

  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify(path === null ? { cancelled: true } : { path }));
}
