import { Router, json } from 'express';
import { z, ZodType } from 'zod';
import { RoomConfig } from '../types';
import { WebRTCRoom } from '../WRTCRoom';
import { HTTPError } from '../utils/errors';
import { canonicalJSONStringify, SIGNATURE } from '@roster-lock/utils';

type SymmetricKey = Parameters<typeof SIGNATURE.SYMMETRIC.verifySignature>[0];

const COORDINATOR_API_KEY = process.env.COORDINATOR_API_KEY as SymmetricKey | undefined;
if(!COORDINATOR_API_KEY) throw new Error("Missing COORDINATOR_API_KEY");
const MAX_AGE = 60 * 1000; // 1 minute

export const router = Router({ mergeParams: true });

const roomCompleteCaster: ZodType<RoomConfig & { timestamp: number }> = z.object({
  matchmakerId: z.string(),
  coordinatorId: z.string(),
  roomId: z.string(),
  rosterConfigHash: z.string(),
  users: z.array(z.object({
    userId: z.string(),
    publicKey: z.string(),
    displayName: z.string(),
  }).strict()),
  timestamp: z.number(),
}).strict();

router.post('/room-complete', json(), async (req, res, next) => {
  try {
    const signature = req.headers['x-signature'];
    if(typeof signature !== "string"){
      throw new HTTPError(400, 'Invalid signature');
    }

    const casted = roomCompleteCaster.safeParse(req.body);
    if(!casted.success){
      throw new HTTPError(400, 'Invalid request body');
    }
    if(casted.data.timestamp < Date.now() - MAX_AGE){
      throw new HTTPError(400, 'Request too old');
    }

    const bodyAsString = canonicalJSONStringify(req.body)

    const isValid = await SIGNATURE.SYMMETRIC.verifySignature(COORDINATOR_API_KEY, bodyAsString, signature);
    if(!isValid) throw new HTTPError(401, 'Invalid signature');

    const parsed = roomCompleteCaster.safeParse(req.body);
    if(!parsed.success){
      throw new HTTPError(400, 'Invalid request body');
    }

    WebRTCRoom.createRoom(parsed.data);

    res.json({ status: 'ok' });

  }catch(e){
    next(e);
  }
});

const roomFailureCaster: ZodType<(
  & RoomConfig
  & { timestamp: number }
  & { failedUser: string, failedReason: string }
)> = z.object({
  matchmakerId: z.string(),
  coordinatorId: z.string(),
  roomId: z.string(),
  rosterConfigHash: z.string(),
  users: z.array(z.object({
    userId: z.string(),
    publicKey: z.string(),
    displayName: z.string(),
  }).strict()),
  timestamp: z.number(),
  failedUser: z.string(),
  failedReason: z.string(),
}).strict();
router.post("/room-failure", json(), async (req, res, next)=>{
  try {
    const signature = req.headers['x-signature'];
    if(typeof signature !== "string"){
      throw new HTTPError(400, 'Invalid signature');
    }
    const bodyAsString = canonicalJSONStringify(req.body)

    const isValid = await SIGNATURE.SYMMETRIC.verifySignature(COORDINATOR_API_KEY, bodyAsString, signature);
    if(!isValid) throw new HTTPError(401, 'Invalid signature');

    const parsed = roomFailureCaster.safeParse(req.body);
    if(!parsed.success){
      throw new HTTPError(400, 'Invalid request body');
    }

    res.json({ status: 'ok' });

  }catch(e){
    next(e);
  }
})
