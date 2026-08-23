import { z } from "zod";

export const createRoomBodySchema = z.object({
  title: z.string().min(1),
  gameLauncherPlugin: z.string().min(1),
  // Plugin-defined shapes validated downstream, not at this layer - see
  // examples/multi-game-room/services/room-match-maker/src/schema.ts for the
  // same precedent. game-launchers.ts separately checks rosterConfig.engine
  // against the allowlisted engineSha for gameLauncherPlugin.
  rosterConfig: z.any(),
  gameConfig: z.unknown(),
  maxPlayers: z.number().int().min(2).optional(),
  minPlayers: z.number().int().min(2).optional(),
  machineId: z.string().min(1),
}).strict();
export type CreateRoomBody = z.infer<typeof createRoomBodySchema>;

export const joinRoomBodySchema = z.object({
  roomId: z.string().min(1),
  machineId: z.string().min(1),
}).strict();
export type JoinRoomBody = z.infer<typeof joinRoomBodySchema>;

export const startRoomBodySchema = z.object({
  roomId: z.string().min(1),
}).strict();
export type StartRoomBody = z.infer<typeof startRoomBodySchema>;

export const destroyRoomBodySchema = z.object({
  roomId: z.string().min(1),
}).strict();
export type DestroyRoomBody = z.infer<typeof destroyRoomBodySchema>;
