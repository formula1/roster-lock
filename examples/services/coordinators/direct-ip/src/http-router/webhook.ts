import { Router, json } from "express";
import { z, ZodType } from "zod";
import { RoomConfig } from "@roster-lock/types";
import { canonicalJSONStringify, SIGNATURE } from "@roster-lock/utils";
import { CoordinatorServer } from "@roster-lock/direct-ip-coordinator";
import { HTTPError } from "../utils/errors";

type SymmetricKey = Parameters<typeof SIGNATURE.SYMMETRIC.verifySignature>[0];

const COORDINATOR_API_KEY = process.env.COORDINATOR_API_KEY as SymmetricKey | undefined;
if(!COORDINATOR_API_KEY) throw new Error("Missing COORDINATOR_API_KEY");
const MAX_AGE = 60 * 1000; // 1 minute

// A room reaching this webhook always has a real (string) coordinatorId -
// relay-server never calls a coordinator's webhook for a room whose
// coordinatorId is `false` (see core/relay-server's webhook.ts).
const roomCompleteCaster: ZodType<RoomConfig & { timestamp: number }> = z.object({
  matchmakerId: z.string(),
  coordinatorId: z.string(),
  roomId: z.string(),
  rosterConfigHash: z.string(),
  machines: z.array(z.object({
    machineId: z.string(),
    publicKey: z.string(),
    displayName: z.string(),
    playerCount: z.number(),
  }).strict()),
  timestamp: z.number(),
}).strict();

const roomFailureCaster: ZodType<RoomConfig & { timestamp: number, failedUser: string, failedReason: string }> = z.object({
  matchmakerId: z.string(),
  coordinatorId: z.string(),
  roomId: z.string(),
  rosterConfigHash: z.string(),
  machines: z.array(z.object({
    machineId: z.string(),
    publicKey: z.string(),
    displayName: z.string(),
    playerCount: z.number(),
  }).strict()),
  timestamp: z.number(),
  failedUser: z.string(),
  failedReason: z.string(),
}).strict();

async function verifySignature(req: { headers: Record<string, unknown>, body: unknown }): Promise<void> {
  const signature = req.headers["x-signature"];
  if(typeof signature !== "string") throw new HTTPError(400, "Invalid signature");

  const bodyAsString = canonicalJSONStringify(req.body);
  const isValid = await SIGNATURE.SYMMETRIC.verifySignature(COORDINATOR_API_KEY!, bodyAsString, signature);
  if(!isValid) throw new HTTPError(401, "Invalid signature");
}

export function createWebhookRouter(coordinatorServer: CoordinatorServer) {
  const router = Router({ mergeParams: true });

  // relay-server's success webhook - fired once every machine in the room
  // has finished downloading. This is what tells the rendezvous coordinator
  // which roomKey (roomId) to expect connections for, and how many clients
  // (everyone but the host) - see @roster-lock/direct-ip-coordinator's
  // server.ts's registerRoom.
  router.post("/room-complete", json(), async (req, res, next) => {
    try {
      await verifySignature(req);

      const parsed = roomCompleteCaster.safeParse(req.body);
      if(!parsed.success) throw new HTTPError(400, "Invalid request body");
      if(parsed.data.timestamp < Date.now() - MAX_AGE) throw new HTTPError(400, "Request too old");

      coordinatorServer.registerRoom(parsed.data.roomId, parsed.data.machines.length - 1);

      res.json({ status: "ok" });
    } catch(e){
      next(e);
    }
  });

  router.post("/room-failure", json(), async (req, res, next) => {
    try {
      await verifySignature(req);

      const parsed = roomFailureCaster.safeParse(req.body);
      if(!parsed.success) throw new HTTPError(400, "Invalid request body");

      coordinatorServer.clearRoom(parsed.data.roomId);

      res.json({ status: "ok" });
    } catch(e){
      next(e);
    }
  });

  return router;
}
