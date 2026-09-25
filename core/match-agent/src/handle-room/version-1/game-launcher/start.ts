import { randomUUID } from "node:crypto";
import z, { ZodType } from "zod";
import { ConnectionSetup, StartGameArgs } from "@roster-lock/types";
import { jsonBody, HTTPRequestHandler, HTTPError } from "../../../utils/http-router";
import { V1Env } from "../globals/types";
import { castLockConfig } from "../piece-sort";
import { requirePluginName, requireBinaryLocation, resolveTarget } from "./shared";

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
