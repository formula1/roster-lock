
import { z, ZodType } from "zod";
import { ConnectionMode } from "@roster-lock/types";

export const connectionModeSchema: ZodType<ConnectionMode> = z.enum(["direct-tcp", "room", "internal"]);

// What a room creator supplies at creation time - notably narrower than the
// full ConnectionConfig a participant eventually gets handed:
// - direct-tcp only takes a port. The creator is always the host (see
//   general-plan.md), so `party`/`ipAddress` don't need to come from them -
//   the server fills in "host" for the creator and "client" + a
//   server-derived ipAddress (never client-supplied, see connection.ts) for
//   everyone else, per-viewer, in routes/rooms.ts's connection resolution.
export const connectionSetupSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("direct-tcp"), port: z.number().int().min(1).max(65535) }).strict(),
  z.object({
    type: z.literal("room"), version: z.string().min(1), url: z.url(),
  }).strict(),
  z.object({ type: z.literal("internal") }).strict(),
]);
export type ConnectionSetup = z.infer<typeof connectionSetupSchema>;

export const addGameBodySchema = z.object({
  engineSha: z.string().min(1),
  gamePluginPackage: z.string().min(1),
  gamePluginVersion: z.string().min(1),
  supportedConnectionModes: z.array(connectionModeSchema).min(1),
  // Only meaningful if "room" is one of supportedConnectionModes.
  supportedRoomVersions: z.array(z.string().min(1)).optional(),
  // Set even when empty ({}) - see GameRunnerPlugin.gameConfigSchema.
  gameConfigSchema: z.unknown(),
  publicInfo: z.object({
    title: z.string().min(1),
    description: z.string(),
  }).strict(),
}).strict();
export type AddGameBody = z.infer<typeof addGameBodySchema>;

const identitySchema = z.object({
  machineId: z.string().min(1),
  publicKey: z.string().min(1),
  displayName: z.string().min(1),
  playerCount: z.number().int().min(1),
}).strict();

export const createRoomBodySchema = z.object({
  title: z.string().min(1),
  rosterConfig: z.any(),
  engineSha: z.string().min(1),
  gamePluginPackage: z.string().min(1),
  // Bounded below by 2 (a room of 1 can't ever start) and, in principle, above
  // by the selection config's own player maximum - this route only enforces
  // the lower bound; enforcing the upper bound needs a selection-config-aware
  // check that isn't wired up yet (see general-plan.md).
  maxPlayers: z.number().int().min(2),
  connection: connectionSetupSchema,
  gameConfig: z.unknown(),
  creator: identitySchema,
  timestamp: z.number(),
  signature: z.string(),
}).strict();
export type CreateRoomBody = z.infer<typeof createRoomBodySchema>;

export const joinRoomBodySchema = z.object({
  player: identitySchema,
  timestamp: z.number(),
  signature: z.string(),
}).strict();
export type JoinRoomBody = z.infer<typeof joinRoomBodySchema>;

export const selectionReadyBodySchema = z.object({
  publicKey: z.string().min(1),
  timestamp: z.number(),
  signature: z.string(),
}).strict();
export type SelectionReadyBody = z.infer<typeof selectionReadyBodySchema>;
