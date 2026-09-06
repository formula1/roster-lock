import { randomUUID } from "node:crypto";
import { ConnectionSetup, StartGameArgs, PlatformTarget } from "@roster-lock/types";
import { GameLauncherLocalSettings } from "@roster-lock/plugin-runtime";
import { MessageBridge } from "@roster-lock/utils";
import { jsonBody, HTTPRequestHandler, HTTPError } from "../../utils/http-router";
import { WebSocketHandlerCallback } from "../../utils/websocket-router";
import { V1Env } from "./globals/types";
import { castLockConfig } from "./piece-sort";
import { engineCaster, pieceFileInfoCaster } from "./schema/lock";
import z, { ZodType } from "zod";

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

function requirePluginName(routeInfo: { params: Record<string, string | undefined> }): string {
  const pluginName = routeInfo.params.pluginName;
  if(!pluginName) throw new HTTPError(400, "Missing pluginName");
  return pluginName;
}

async function requireBinaryLocation(env: V1Env, pluginName: string): Promise<string> {
  const settings = await env.pluginRuntime.gameLauncher.getLocalSettings(pluginName);
  if(!settings.binaryLocation){
    throw new HTTPError(400, `Game launcher "${pluginName}" has no binaryLocation configured`);
  }
  return settings.binaryLocation;
}

// See docs/v2/binary-location.md - every GameLauncherPlugin function that
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

// Installs the plugin *package* itself (registry/manifest-based, via
// PluginManager - distinct from updateBinary below, which fetches a newer
// engine binary for a plugin that's already installed).
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

// No binaryLocation involved (unlike every other route above) - this is a pre-room-creation check,
// not a local-machine one, so it's callable before a binaryLocation is even configured.
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

const validateGameConfigBodySchema = z.object({
  gameConfig: z.unknown(),
  rosterConfig: z.unknown(),
}).strict();

const getPreviewBodySchema = z.object({
  engine: engineCaster, pieceType: z.string(), piece: pieceFileInfoCaster,
}).strict();

// Live per-piece preview for the selection screen's hover/focus panel - see
// GameLauncherPlugin["getPreview"]/["useDefaultPreview"]. Unlike every other
// route in this file, this one also needs this.fileDB, to turn the piece
// identity a browser can actually send (engine/pieceType/piece.{version,
// pathVariables}) into the real on-disk folder only match-agent can resolve.
export const getGameLauncherPreview: HTTPRequestHandler = async function (
  this: V1Env, { req, res }, routeInfo
){
  const pluginName = requirePluginName(routeInfo);
  const body = await jsonBody(req);
  const parsed = getPreviewBodySchema.safeParse(body);
  if(!parsed.success) throw new HTTPError(400, "Bad Form", parsed.error);
  const { engine, pieceType, piece } = parsed.data;

  // A piece is selectable before it's downloaded (see PieceTypeSection's own
  // "downloaded"/undefined tri-state) - no folder yet means there's nothing
  // for getPreview to read, so ask the plugin for its generic placeholder
  // instead (useDefaultPreview) rather than surfacing this as an error.
  let folder: string;
  try {
    folder = await this.fileDB.getPieceFolder(engine, pieceType, piece);
  } catch {
    const preview = await this.pluginRuntime.gameLauncher.useDefaultPreview(pluginName, pieceType);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ preview: preview ?? null }));
    return;
  }

  const preview = await this.pluginRuntime.gameLauncher.getPreview(pluginName, pieceType, piece.pathVariables, folder);
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ preview: preview ?? null }));
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

const coordinatorAddressSchema = z.object({ host: z.string(), port: z.number() }).strict();

// This is what a caller sends match-agent, not what the plugin ends up
// with - direct-tcp still carries a coordinator address here.
// GameLauncher.startGame (plugin-runtime) resolves it into a ConnectionConfig
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
// the browser holds it, and GameLauncher.startGame is what turns it into the
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

export const startGameLauncher: HTTPRequestHandler = async function(
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

  const handle = await this.pluginRuntime.gameLauncher.startGame(pluginName, binaryLocation, target, connectionConfig, {
    currentMachine,
    allMachines: allMachines as StartGameArgs<unknown>["allMachines"],
    selectionResult: selectionResult as StartGameArgs<unknown>["selectionResult"],
    rosterConfig,
    gameConfig,
    relayRoomId,
    matchAgent: { port: this.matchAgent.getPort(), authCode: this.matchAgent.authCode },
    gameEnded: (result)=>{
      const ctx = this.gameCompletionContext.get(relayRoomId);
      if(!ctx){
        console.error(`No game-completion context for relayRoomId "${relayRoomId}"`);
        return;
      }
      this.gameCompletionContext.delete(relayRoomId);
      this.pluginRuntime.pieceSort.handleGameComplete({ ...ctx, winners: result.winners }).catch((e)=>{
        console.error("piece-selection-sort handleGameComplete failed", e);
      });
    },
  });

  const handleId = randomUUID();
  this.processHandles.set(handleId, { pluginName, handle });
  // onExit/onCrash rather than polling handle.exited - these are the only
  // moments a process's status can actually change after this point, and
  // gameProcessesWs's subscribers need to hear about it as it happens.
  handle.onExit(()=>this.processEvents.emit("changed"));
  handle.onCrash(()=>this.processEvents.emit("changed"));
  this.processEvents.emit("changed");

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

// Shared by both the HTTP listing below and gameProcessesWs's push updates,
// so the two stay in the same shape.
function summarizeProcesses(env: V1Env){
  return Array.from(env.processHandles.entries()).map(([handleId, entry]) => ({
    handleId, pluginName: entry.pluginName, exited: entry.handle.exited,
  }));
}

// Every process this match-agent has started, across every game-launcher
// plugin - backs pages/Game in match-agent-client, which shows one row per
// entry regardless of which plugin launched it.
export const listGameProcesses: HTTPRequestHandler = async function(
  this: V1Env, { res }
){
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify(summarizeProcesses(this)));
}

// WS counterpart to listGameProcesses - pushes a "processes" snapshot as
// soon as a client connects, then again on every processEvents "changed" (a
// process started, exited, or crashed). No "ready" handshake like the other
// WS routes here use: those exist so a client knows it's safe to send a
// request (onRequest handlers registered), but this route never receives a
// request at all - it's pure server push, so the first "processes" event
// already doubles as that signal.
export const gameProcessesWs: WebSocketHandlerCallback = async function(
  this: V1Env, { ws }, params, next
){
  try {
    const bridge = new MessageBridge((message)=>ws.send(JSON.stringify(message)));
    ws.on("message", (message)=>{
      bridge.handleMessage(JSON.parse(message.toString()));
    });

    const sendSnapshot = ()=>{ bridge.sendEvent("processes", summarizeProcesses(this)); };
    this.processEvents.on("changed", sendSnapshot);
    ws.on("close", ()=>{ this.processEvents.off("changed", sendSnapshot); });

    sendSnapshot();
  }catch(e){
    ws.terminate();
    next(e);
  }
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
