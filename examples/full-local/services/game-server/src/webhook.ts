import { Router } from 'express';
import { z, ZodType } from 'zod';
import { RoomConfig } from './types';
import { WebRTCRoom } from './WRTCRoom';
import { HTTPError } from './utils/errors';

export const router = Router({ mergeParams: true });

const roomCompleteCaster: ZodType<RoomConfig> = z.object({
  matchmakerId: z.string(),
  roomId: z.string(),
  rosterConfigHash: z.string(),
  users: z.array(z.object({
    userId: z.string(),
    publicKey: z.string(),
    displayName: z.string(),
  }).strict()),
}).strict();

router.post('/room-complete', express.json(), (req, res, next) => {
  try {
    const parsed = roomCompleteCaster.safeParse(req.body);
    if(!parsed.success){
      throw new HTTPError(400, 'Invalid request body');
    }
    const config: RoomConfig = parsed.data;

    const room = new WebRTCRoom(config);

    res.json({ status: 'ok' });

  }catch(e){
    next(e);
  }
}
