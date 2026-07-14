import express, { Request, Response } from 'express';
import cors from 'cors';
import { z, ZodType } from 'zod';
import { createShaFromJSON, SIGNATURE } from '@roster-lock/utils';
import { MatchmakingQueue, QueuedUser } from './queue';

type PublicKey = Parameters<typeof SIGNATURE.ASYMMETRIC.verifySignature>[0];

const app = express();
const PORT = process.env.PORT;
if (!PORT) throw new Error('PORT is not defined');

app.use(cors());
app.use(express.json());

const matchmakingQueue = new MatchmakingQueue();

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'matchmaking-server' });
});

import { getSignatureKeys } from './globals/signature-keys';
app.get("/public-key", async (req: Request, res: Response) => {
  const { publicKey } = await getSignatureKeys();
  res.json({ publicKey });
});

// Get queue status
app.get('/queue/:hash', (req: Request, res: Response) => {
  const list = matchmakingQueue.getUserQueue(req.params.hash);
  res.json({
    queueLength: list.length,
    users: Array.from(list).map(u => ({ userId: u.userId, timestamp: u.timestamp }))
  });
});

// Join matchmaking queue
const joinBodySchema: ZodType<Omit<QueuedUser, "timestamp" | "rosterConfigHash"> & { timestamp: number, signature: string }> = z.object({
  userId: z.string(),
  displayName: z.string(),
  rosterConfig: z.any(),
  publicKey: z.string(),
  timestamp: z.number(),
  signature: z.string(),
}).strict();
app.post('/join', async (req: Request, res: Response) => {
  const uncastedBody = req.body;
  const casted = joinBodySchema.safeParse(uncastedBody);
  if(!casted.success){
    return res.status(400).json({ error: 'Invalid body' });
  }
  if(Date.now() - casted.data.timestamp > 1000){
    return res.status(400).json({ error: 'Timestamp is too old' });
  }
  const rosterHash = await createShaFromJSON(casted.data.rosterConfig);

  if(!await SIGNATURE.ASYMMETRIC.verifySignature(casted.data.publicKey as PublicKey, casted.data.signature, {
    service: 'join-queue',
    userId: casted.data.userId,
    displayName: casted.data.displayName,
    rosterHash: rosterHash,
    timestamp: casted.data.timestamp,
    publicKey: casted.data.publicKey,
  })){
    return res.status(401).json({ error: 'Invalid signature' });
  }
  const body = casted.data;

  // Add user to queue
  const queuedUser: QueuedUser = {
    ...body,
    rosterConfigHash: rosterHash,
  };

  const storedUser = matchmakingQueue.join(queuedUser);

  console.log(`User ${body.userId} joined queue. Queue length: ${matchmakingQueue.totalUsers}`);


  // User is waiting
  res.json({
    status: 'waiting',
    position: matchmakingQueue.totalUsers,
    queuedAt: storedUser.timestamp
  });
});

app.get("/status/:rosterHash", async (req: Request, res: Response) => {
  const rosterHash = req.params.rosterHash;
  const publicKey = req.query.publicKey as string;
  const signature = req.query.signature as string;
  const timestamp = Number.parseInt(req.query.timestamp as string);
  if(!publicKey || !signature){
    return res.status(400).json({ error: 'publicKey and signature are required' });
  }
  if(Number.isNaN(timestamp)){
    return res.status(400).json({ error: 'Invalid timestamp' });
  }
  if(Date.now() - timestamp > 1000){
    return res.status(400).json({ error: 'Timestamp is too old' });
  }

  if(!await SIGNATURE.ASYMMETRIC.verifySignature(publicKey as PublicKey, signature, {
    service: 'queue-status',
    rosterConfigHash: rosterHash,
    timestamp: timestamp,
    publicKey: publicKey,
  })){
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const match = matchmakingQueue.checkForMatch(publicKey, rosterHash);
  if(!match){
    return res.json({ status: 'waiting' });
  }
  if(!match.success){
    return res.status(500).json(match);
  }
  res.json({ status: 'matched', roomId: match.roomId, url: match.url });
});

// Leave matchmaking queue
const leaveBodySchema: ZodType<{ rosterConfigHash: string; publicKey: string; signature: string }> = z.object({
  rosterConfigHash: z.string(),
  publicKey: z.string(),
  signature: z.string(),
}).strict();
app.post('/leave', (req: Request, res: Response) => {
  const bodyUncasted = req.body;
  const casted = leaveBodySchema.safeParse(bodyUncasted);
  if(!casted.success){
    return res.status(400).json({ error: 'Invalid body' });
  }

  if(!await SIGNATURE.ASYMMETRIC.verifySignature(casted.data.publicKey as PublicKey, casted.data.signature, {
    service: 'leave-queue',
    rosterConfigHash: casted.data.rosterConfigHash,
    publicKey: casted.data.publicKey,
  })){
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const left = matchmakingQueue.leave(casted.data.publicKey, casted.data.rosterConfigHash);

  res.json({ wasInQueue: left });
});

app.listen(PORT, () => {
  console.log(`Matchmaking server running on port ${PORT}`);
});

