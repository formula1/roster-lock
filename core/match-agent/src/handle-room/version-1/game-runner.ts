import { randomUUID } from "node:crypto";
import { ConnectionSetup, StartGameArgs, PlatformTarget } from "@roster-lock/types";
import { GameRunnerLocalSettings } from "@roster-lock/plugin-runtime";
import { jsonBody, HTTPRequestHandler, HTTPError } from "../../utils/http-router";
import { V1Env } from "./globals/types";
import { castLockConfig } from "./piece-sort";
import z, { ZodType } from "zod";

// One listing endpoint, mirroring /piece/sort-list/available - every installed
// game-runner plugin's full AvailableGameRunner record in one response, rather
// than splitting connection-mode support and gameConfigSchema into separate
// per-plugin routes. Both are small, static JSON already computed by
// listAvailable() from the plugin's own module fields, so there's no
// fetch-cost reason to make a client ask for them separately, and nothing
// else in this router splits a plugin's metadata that way either.
export const listAvailableGameRunners: HTTPRequestHandler = async function(
  this: V1Env, { res }
){
  const available = await this.pluginRuntime.gameRunner.listAvailable();
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify(available));
}

function requirePluginName(routeInfo: { params: Record<string, string | undefined> }): string {
  const pluginName = routeInfo.params.pluginName;
  if(!pluginName) throw new HTTPError(400, "Missing pluginName");
  return pluginName;
}

async function requireBinaryLocation(env: V1Env, pluginName: string): Promise<string> {
  const settings = await env.pluginRuntime.gameRunner.getLocalSettings(pluginName);
  if(!settings.binaryLocation){
    throw new HTTPError(400, `Game runner "${pluginName}" has no binaryLocation configured`);
  }
  return settings.binaryLocation;
}

// See docs/v2/binary-location.md - every GameRunnerPlugin function that
// resolves a concrete binary out of a (possibly multi-platform) binaryLocation
// bundle takes a required target, with no implicit "current host" default at
// that layer. match-agent is what decides the target value: it defaults to
// its own process.platform/process.arch (the ordinary case - a client asking
// match-agent to run/inspect the game it's about to run on this same host),
// but a caller can override either via query params for the deliberate
// exception (e.g. forcing a win32-x64 build under Wine on a Linux host).
function resolveTarget(routeInfo: { url: URL }): PlatformTarget {
  const platform = routeInfo.url.searchParams.get("platform");
  const arch = routeInfo.url.searchParams.get("arch");
  return {
    platform: (platform || process.platform) as PlatformTarget["platform"],
    arch: (arch || process.arch) as PlatformTarget["arch"],
  };
}

export const getGameRunnerSettings: HTTPRequestHandler = async function(
  this: V1Env, { res }, routeInfo
){
  const pluginName = requirePluginName(routeInfo);
  const settings = await this.pluginRuntime.gameRunner.getLocalSettings(pluginName);
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify(settings));
}

const localSettingsBodySchema: ZodType<GameRunnerLocalSettings> = z.object({
  binaryLocation: z.string().optional(),
  localConfig: z.unknown().optional(),
}).strict();

export const setGameRunnerSettings: HTTPRequestHandler = async function(
  this: V1Env, { req, res }, routeInfo
){
  const pluginName = requirePluginName(routeInfo);
  const body = await jsonBody(req);
  const parseResult = localSettingsBodySchema.safeParse(body);
  if(!parseResult.success) throw new HTTPError(400, "Bad Form", parseResult.error);

  await this.pluginRuntime.gameRunner.setLocalSettings(pluginName, parseResult.data);
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ ok: true }));
}

// Installs the plugin *package* itself (registry/manifest-based, via
// PluginManager - distinct from updateBinary below, which fetches a newer
// engine binary for a plugin that's already installed).
export const installGameRunnerPlugin: HTTPRequestHandler = async function(
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

export const getGameRunnerVersion: HTTPRequestHandler = async function(
  this: V1Env, { res }, routeInfo
){
  const pluginName = requirePluginName(routeInfo);
  const binaryLocation = await requireBinaryLocation(this, pluginName);
  const target = resolveTarget(routeInfo);

  const [local, supported] = await Promise.all([
    this.pluginRuntime.gameRunner.getLocalVersion(pluginName, binaryLocation, target),
    this.pluginRuntime.gameRunner.getSupportedVersion(pluginName, binaryLocation),
  ]);

  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ local, supported }));
}

export const validateGameRunnerBinaryLocation: HTTPRequestHandler = async function(
  this: V1Env, { res }, routeInfo
){
  const pluginName = requirePluginName(routeInfo);
  const binaryLocation = await requireBinaryLocation(this, pluginName);
  const target = resolveTarget(routeInfo);

  const result = await this.pluginRuntime.gameRunner.validateBinaryLocation(pluginName, binaryLocation, target);

  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify(result));
}

export const updateGameRunnerBinary: HTTPRequestHandler = async function(
  this: V1Env, { res }, routeInfo
){
  const pluginName = requirePluginName(routeInfo);
  const binaryLocation = await requireBinaryLocation(this, pluginName);
  const target = resolveTarget(routeInfo);

  try {
    await this.pluginRuntime.gameRunner.updateBinary(pluginName, binaryLocation, target);
  } catch(e){
    // updateBinary throws a plain Error when a plugin doesn't declare one at
    // all (see GameRunner.updateBinary) - that's a client-facing 400 ("this
    // runner can't be updated in-app"), not a server fault.
    throw new HTTPError(400, (e as Error).message);
  }

  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ ok: true }));
}

const coordinatorAddressSchema = z.object({ host: z.string(), port: z.number() }).strict();

// This is what a caller sends match-agent, not what the plugin ends up
// with - direct-tcp still carries a coordinator address here.
// GameRunner.startGame (plugin-runtime) resolves it into a ConnectionConfig
// before ever invoking a plugin, so a plugin never has to know a coordinator
// exists at all.
const connectionSetupSchema: ZodType<ConnectionSetup> = z.union([
  z.object({
    type: z.literal("direct-tcp"), party: z.literal("host"), port: z.number(), coordinator: coordinatorAddressSchema,
  }).strict(),
  z.object({
    type: z.literal("direct-tcp"), party: z.literal("client"), port: z.number(), coordinator: coordinatorAddressSchema,
  }).strict(),
  z.object({ type: z.literal("room"), version: z.string(), url: z.string() }).strict(),
  z.object({ type: z.literal("internal") }).strict(),
]);

// Everything StartGameArgs needs except currentMachine.privateKeyFile (a
// match-agent-managed temp file, not something a caller ever supplies) and
// matchAgent (match-agent knows its own port/authCode - trusting a caller's
// claim about either would let it point a plugin at a different match-agent
// entirely). currentMachine's raw privateKey *is* client-supplied here: only
// the browser holds it, and GameRunner.startGame is what turns it into the
// restrictive-permission temp file plugins actually receive.
type StartGameBody = {
  connectionConfig: ConnectionSetup,
  currentMachine: { machineId: string, publicKey: string, privateKey: string },
  allMachines: unknown,
  selectionResult: unknown,
  rosterConfig: unknown,
  gameConfig: unknown,
  relayRoomId: string,
}

const startGameBodySchema: ZodType<StartGameBody> = z.object({
  connectionConfig: connectionSetupSchema,
  currentMachine: z.object({
    machineId: z.string(), publicKey: z.string(), privateKey: z.string(),
  }).strict(),
  allMachines: z.unknown(),
  selectionResult: z.unknown(),
  rosterConfig: z.unknown(),
  gameConfig: z.unknown(),
  relayRoomId: z.string(),
}).strict();

export const startGameRunner: HTTPRequestHandler = async function(
  this: V1Env, { req, res }, routeInfo
){
  const pluginName = requirePluginName(routeInfo);
  const binaryLocation = await requireBinaryLocation(this, pluginName);
  const target = resolveTarget(routeInfo);

  const body = await jsonBody(req);
  const parseResult = startGameBodySchema.safeParse(body);
  if(!parseResult.success) throw new HTTPError(400, "Bad Form", parseResult.error);
  const { connectionConfig, currentMachine, allMachines, selectionResult, gameConfig, relayRoomId } = parseResult.data;
  const rosterConfig = castLockConfig(parseResult.data.rosterConfig);

  const handle = await this.pluginRuntime.gameRunner.startGame(pluginName, binaryLocation, target, connectionConfig, {
    currentMachine,
    allMachines: allMachines as StartGameArgs["allMachines"],
    selectionResult: selectionResult as StartGameArgs["selectionResult"],
    rosterConfig,
    gameConfig,
    relayRoomId,
    matchAgent: { port: this.matchAgent.getPort(), authCode: this.matchAgent.authCode },
  });

  const handleId = randomUUID();
  this.processHandles.set(handleId, { pluginName, handle });

  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ handleId }));
}

export const getGameProcessStatus: HTTPRequestHandler = async function(
  this: V1Env, { res }, routeInfo
){
  const handleId = routeInfo.params.handleId;
  const entry = handleId ? this.processHandles.get(handleId) : undefined;
  if(!entry) throw new HTTPError(404, "Unknown process handle");

  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ exited: entry.handle.exited }));
}

// Every process this match-agent has started, across every game-runner
// plugin - backs pages/Game in match-agent-client, which shows one row per
// entry regardless of which plugin launched it.
export const listGameProcesses: HTTPRequestHandler = async function(
  this: V1Env, { res }
){
  const processes = Array.from(this.processHandles.entries()).map(([handleId, entry]) => ({
    handleId, pluginName: entry.pluginName, exited: entry.handle.exited,
  }));
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify(processes));
}

// Best-effort, same as GameProcessHandle.stop() itself - see that type's own
// docs on why a plugin may not always be able to actually stop the game.
export const stopGameProcess: HTTPRequestHandler = async function(
  this: V1Env, { res }, routeInfo
){
  const handleId = routeInfo.params.handleId;
  const entry = handleId ? this.processHandles.get(handleId) : undefined;
  if(!entry) throw new HTTPError(404, "Unknown process handle");

  await entry.handle.stop();

  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ ok: true }));
}
