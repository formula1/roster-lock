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

export const updateGameLauncherBinary: HTTPRequestHandler = async function(
  this: V1Env, { res }, routeInfo
){
  const pluginName = requirePluginName(routeInfo);
  const binaryLocation = await requireBinaryLocation(this, pluginName);
  const target = resolveTarget(routeInfo);

  try {
    await this.pluginRuntime.gameLauncher.updateBinary(pluginName, binaryLocation, target);
  } catch(e){
    // updateBinary throws a plain Error when a plugin doesn't declare one at
    // all (see GameLauncher.updateBinary) - that's a client-facing 400 ("this
    // runner can't be updated in-app"), not a server fault.
    throw new HTTPError(400, (e as Error).message);
  }

  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ ok: true }));
}
