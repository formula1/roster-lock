import { ServerResponse } from "http";
import { z, ZodType } from "zod";
import { RoomConfig, RoomMachine } from "@roster-lock/types";
import { SIGNATURE_ASYMMETRIC, createShaFromJSON } from "@roster-lock/utils";
import { jsonBody, HTTPError, HTTPRequestHandler } from "../utils/http-router";
import { WebSocketHandlerCallback } from "../utils/websocket-router";
import { matchmakersModel, gameCoordinatorsModel, roomStatsModel } from "../models";
import { messageQueue } from "../message-queue";
import { getServerId } from "../globals";
import { RoomManager_MessageQueue } from "../room";
import { validateAuthFromSearch } from "../room/auth";

// Always the message-queue-backed manager, even for a single process - it
// runs fine against the in-memory queue (MESSAGE_QUEUE_VERSION's default),
// so there's one code path instead of two. RoomManager_SingleProcess is
// kept around for reference, not wired up.
const roomManager = new RoomManager_MessageQueue(roomStatsModel, messageQueue, getServerId());

type PublicKey = Parameters<typeof SIGNATURE_ASYMMETRIC.verifySignature>[0];

function sendJSON(res: ServerResponse, statusCode: number, value: unknown) {
  res.writeHead(statusCode, { "Content-Type": "application/json" });
  res.end(JSON.stringify(value));
}

type CreateRoomBody = {
  rosterConfig: any;
  rosterConfigHash: string;
  machines: Array<RoomMachine>;
  // `false` is an explicit "this room has no game coordinator" choice, kept
  // required rather than optional so a matchmaker can't omit it by accident
  // and have that silently treated as an opt-out.
  coordinatorId: string | false;
  publicKey: string;
  signature: string;
};
const createRoomCaster: ZodType<CreateRoomBody> = z.object({
  rosterConfig: z.any(),
  rosterConfigHash: z.string(),
  machines: z.array(z.object({
    machineId: z.string(),
    publicKey: z.string(),
    displayName: z.string(),
    playerCount: z.number().int().min(1),
  }).strict()),
  coordinatorId: z.union([z.string(), z.literal(false)]),
  publicKey: z.string(),
  signature: z.string(),
}).strict();

export const createRoom: HTTPRequestHandler = async ({ req, res }, params, next) => {
  try {
    const uncastedBody = await jsonBody(req);
    const casted = createRoomCaster.safeParse(uncastedBody);
    if (!casted.success) return sendJSON(res, 400, { error: "Invalid body" });
    const body = casted.data;

    const matchmaker = await matchmakersModel.getByPublicKey(body.publicKey);
    if (!matchmaker || matchmaker.status !== "active") {
      return sendJSON(res, 401, { error: "Invalid matchmaker" });
    }

    // `false` is a deliberate "no coordinator" choice - skip the lookup
    // entirely rather than querying for a row that was never meant to exist.
    let coordinator = null;
    if (body.coordinatorId !== false) {
      coordinator = await gameCoordinatorsModel.getById(body.coordinatorId);
      if (!coordinator || coordinator.status !== "active") {
        return sendJSON(res, 401, { error: "Invalid game coordinator" });
      }
    }

    const isValid = await SIGNATURE_ASYMMETRIC.verifySignature(
      matchmaker.publicKey as PublicKey,
      body.signature,
      {
        service: "create-room",
        publicKey: body.publicKey,
        rosterConfigHash: body.rosterConfigHash,
        machines: body.machines,
        coordinatorId: body.coordinatorId,
      }
    );
    if (!isValid) return sendJSON(res, 401, { error: "Invalid signature" });

    const roomId = crypto.randomUUID();
    const fullHash = await createShaFromJSON(body.rosterConfig);
    if (body.rosterConfigHash !== fullHash) {
      return sendJSON(res, 401, { error: "Invalid roster config hash" });
    }

    const config: RoomConfig = {
      matchmakerId: matchmaker.id,
      coordinatorId: coordinator ? coordinator.id : false,
      roomId,
      rosterConfigHash: fullHash,
      machines: body.machines,
    };
    // Create the in-memory room first - if this fails, we don't want an
    // orphaned room-stats record.
    await roomManager.create(config);

    const rosterHash = await createShaFromJSON(body.rosterConfig.rosters);
    await roomStatsModel.create({
      roomId,
      matchmakerId: matchmaker.id,
      fullConfigHash: fullHash,
      engineId: body.rosterConfig.engine.name,
      engineVersion: body.rosterConfig.engine.version,
      rosterHash,
      machineIds: body.machines.map(machine => machine.machineId).sort(),
      machineCount: body.machines.length,
      coordinatorId: coordinator ? coordinator.id : null,
    });

    return sendJSON(res, 200, { roomId });
  } catch (e) {
    next(e);
  }
};

export const getMachines: HTTPRequestHandler = async ({ req, res }, params, next) => {
  try {
    const roomId = params.params.roomId;
    const config = await roomManager.getConfig(roomId);
    if (!config) throw new HTTPError(404, "Room not found");

    const machine = await validateAuthFromSearch(params.url.searchParams, config, "room-ws");
    if (!machine) throw new HTTPError(403, "Invalid token");

    return sendJSON(res, 200, await roomManager.getMachines(roomId));
  } catch (e) {
    next(e);
  }
};

export const roomWebSocket: WebSocketHandlerCallback = async ({ ws }, params, next) => {
  try {
    const roomId = params.params.roomId;
    const config = await roomManager.getConfig(roomId);
    if (!config) {
      ws.close(4404, "Room not found");
      return;
    }

    const machine = await validateAuthFromSearch(params.url.searchParams, config, "room-ws");
    if (!machine) {
      ws.close(4401, "Invalid token");
      return;
    }

    const connected = await roomManager.connectMachine(roomId, machine, ws);
    if (!connected) {
      ws.close(4409, "Duplicate connection");
      return;
    }
  } catch (e) {
    ws.terminate();
    next(e);
  }
};
