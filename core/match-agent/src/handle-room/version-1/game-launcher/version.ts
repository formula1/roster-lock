import z from "zod";
import { jsonBody, HTTPRequestHandler, HTTPError } from "../../../utils/http-router";
import { V1Env } from "../globals/types";
import { castLockConfig } from "../piece-sort";
import { requirePluginName, requireBinaryLocation, resolveTarget } from "./shared";

export const getGameLauncherVersion: HTTPRequestHandler = async function(
  this: V1Env, { res }, routeInfo
){
  const pluginName = requirePluginName(routeInfo);
  const binaryLocation = await requireBinaryLocation(this, pluginName);
  const target = resolveTarget(routeInfo);

  const [local, supported] = await Promise.all([
    this.pluginRuntime.gameLauncher.getLocalVersion(pluginName, binaryLocation, target),
    this.pluginRuntime.gameLauncher.getSupportedVersion(pluginName, binaryLocation),
  ]);

  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ local, supported }));
}

export const validateGameLauncherBinaryLocation: HTTPRequestHandler = async function(
  this: V1Env, { res }, routeInfo
){
  const pluginName = requirePluginName(routeInfo);
  const binaryLocation = await requireBinaryLocation(this, pluginName);
  const target = resolveTarget(routeInfo);

  const result = await this.pluginRuntime.gameLauncher.validateBinaryLocation(pluginName, binaryLocation, target);

  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify(result));
}

const validateGameConfigBodySchema = z.object({
  gameConfig: z.unknown(),
  rosterConfig: z.unknown(),
}).strict();

// No binaryLocation involved (unlike every other route in this file) - this is
// a pre-room-creation check, not a local-machine one, so it's callable before
// a binaryLocation is even configured.
export const validateGameLauncherGameConfig: HTTPRequestHandler = async function(
  this: V1Env, { req, res }, routeInfo
){
  const pluginName = requirePluginName(routeInfo);
  const body = await jsonBody(req);
  const parseResult = validateGameConfigBodySchema.safeParse(body);
  if(!parseResult.success) throw new HTTPError(400, "Bad Form", parseResult.error);
  const rosterConfig = castLockConfig(parseResult.data.rosterConfig);

  const problems = await this.pluginRuntime.gameLauncher.validateGameConfig(
    pluginName, parseResult.data.gameConfig, rosterConfig
  );

  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ problems }));
}

// Deliberately doesn't call requireBinaryLocation like every other route in
// this file - getBinary *acquires* a binaryLocation rather than operating
// on an already-configured one (see GameLauncherPlugin.getBinary), so a
// plugin that supports it can be downloaded before any binaryLocation has
// ever been set, not just updated once one already is.
export const updateGameLauncherBinary: HTTPRequestHandler = async function(
  this: V1Env, { res }, routeInfo
){
  const pluginName = requirePluginName(routeInfo);
  const target = resolveTarget(routeInfo);

  let binaryLocation: string;
  try {
    ({ binaryLocation } = await this.pluginRuntime.gameLauncher.getBinary(pluginName, target));
  } catch(e){
    // getBinary throws a plain Error when a plugin doesn't declare one at
    // all (see GameLauncher.getBinary) - that's a client-facing 400 ("this
    // runner can't be downloaded in-app"), not a server fault.
    throw new HTTPError(400, (e as Error).message);
  }
  await this.fileDB.recordBinaryDownloaded(pluginName, binaryLocation);

  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ ok: true, binaryLocation }));
}
