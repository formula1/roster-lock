
import { Hono } from 'hono';
import { Env, RoomConfig } from '../types';

import { z, ZodType } from 'zod';
import { verifySignature, createSha } from '../../utils/crypto';
import { MatchmakerRow, RoomStatsRow } from '../schema/types';
import { D1Database } from '@cloudflare/workers-types';
import { ContentfulStatusCode } from 'hono/utils/http-status';

export const app = new Hono<{ Bindings: Env }>();

import { RoomUser } from '../types';
type CreateRoomBody = {
  rosterConfig: any;

  rosterConfigHash: string;
  users: RoomUser[];
  webhooks: {
    onRoomComplete: string;
    onRoomFailed?: string;
  };

  publicKey: string;
  signature: string;
};
const createRoomCaster: ZodType<CreateRoomBody> = z.object({
  rosterConfig: z.any(),

  rosterConfigHash: z.string(),
  users: z.array(z.object({
    userId: z.string(),
    publicKey: z.string(),
    displayName: z.string(),
  }).strict()),
  webhooks: z.object({
    onRoomComplete: z.string().url(),
    onRoomFailed: z.string().url().optional(),
  }),

  publicKey: z.string(),
  signature: z.string(),
}).strict();

app.post('/', async (c)=> {
  const uncastedBody = await c.req.json();
  const casted = createRoomCaster.safeParse(uncastedBody);
  if(!casted.success){
    return c.json({ error: 'Invalid body' }, 400);
  }

  const body = casted.data;

  // Verify matchmaker exists and get public key
  const matchmaker = await c.env.DB.prepare(
    'SELECT * FROM matchmakers WHERE public_key = ? AND status = ?'
  ).bind(body.publicKey, 'active').first<MatchmakerRow>();

  if (!matchmaker) {
    return c.json({ error: 'Invalid matchmaker' }, 401);
  }


  const isValid = await verifySignature(matchmaker.public_key, body.signature, {
    service: 'create-room',
    publicKey: body.publicKey,
    rosterConfigHash: body.rosterConfigHash,
    users: body.users,
    webhooks: body.webhooks,
  });
  if(!isValid) return c.json({ error: 'Invalid signature' }, 401);
  
  const roomId = crypto.randomUUID();
  const full_hashBuffer = await createSha(body.rosterConfig);
  if(body.rosterConfigHash !== full_hashBuffer){
    return c.json({ error: 'Invalid roster config hash' }, 401);
  }

  // Create Room DO first - if this fails, we don't want orphaned D1 records
  const durObjRoomId = c.env.ROOM.idFromName(roomId);
  const room = c.env.ROOM.get(durObjRoomId);

  const url = new URL(c.req.url);
  url.pathname = '/';

  const response = await room.fetch(url, {
    method: 'POST',
    headers: c.req.raw.headers,
    body: JSON.stringify({
      matchmakerId: matchmaker.id,
      roomId,
      rosterConfigHash: full_hashBuffer,
      users: body.users,
    } satisfies RoomConfig),
  });

  if(!response.ok) return c.json({ error: 'Failed to create room' }, 500);

  // Now store room stats in D1 after DO creation succeeded
  const rosterHash = await createSha(body.rosterConfig.rosters);
  const engineId = body.rosterConfig.engine.name;
  const engineVersion = body.rosterConfig.engine.version;
  const users_ids = JSON.stringify(body.users.sort());

  await c.env.DB.prepare(`
    INSERT INTO room_stats (
      room_id, matchmaker_id,
      full_config_hash, engine_id, engine_version, roster_hash,
      user_ids, user_count,
      webhook_room_complete, webhhook_room_failed,
      created_at,
      status
    ) VALUES (
     ?, ?,
     ?, ?, ?, ?,
     ?, ?,
     ?, ?
     ?,
     ?
    )
  `).bind(
    roomId, matchmaker.id,
    full_hashBuffer, engineId, engineVersion, rosterHash,
    users_ids, body.users.length,
    body.webhooks.onRoomComplete, body.webhooks.onRoomFailed || null,
    new Date().toISOString(),
    'active',
  ).run();

  return c.json({ roomId });
});

// Get room users (authenticated user only)
app.get('/:roomId/users', async (c) => {
  try {
    const roomId = c.req.param('roomId');
    await ensureRoomExists(c.env.DB, roomId);
    const id = c.env.ROOM.idFromName(roomId);
    const room = c.env.ROOM.get(id);

    const url = new URL(c.req.url);
    url.pathname = '/users';

    return room.fetch(url, {
      headers: c.req.raw.headers,
    }) as unknown as Response;

  }catch(e){
    if(e instanceof HTTPError){
      return c.json({ error: e.message }, e.statusCode);
    }
    return c.json({ error: 'Internal Server Error' }, 500);
  }
});

// WebSocket connection to room
app.get('/:roomId', async (c) => {
  // Check for WebSocket upgrade
  if (c.req.header('upgrade') !== 'websocket') {
    return c.json({ error: 'Expected WebSocket' }, 400);
  }
  try {
    const roomId = c.req.param('roomId');
    await ensureRoomExists(c.env.DB, roomId);

    const id = c.env.ROOM.idFromName(roomId);
    const room = c.env.ROOM.get(id);

    // Forward entire request to Room DO
    const url = new URL(c.req.url);
    url.pathname = '/room-ws';
    return room.fetch(url, {
      method: c.req.method,
      headers: c.req.raw.headers,
    }) as unknown as Response;
  }catch(e){
    if(e instanceof HTTPError){
      return c.json({ error: e.message }, e.statusCode);
    }
    return c.json({ error: 'Internal Server Error' }, 500);
  }
});


async function ensureRoomExists(DB: D1Database, roomId: string){
  const roomFromDB: RoomStatsRow | null = await DB.prepare(
    'SELECT * FROM room_stats WHERE room_id = ?'
  ).bind(roomId).first();

  if(!roomFromDB) throw new HTTPError(404, 'Room not found');

  if(roomFromDB.status !== 'active') throw new HTTPError(400, 'Room not waiting');
}



class HTTPError extends Error {
  constructor(public statusCode: ContentfulStatusCode, public message: string){
    super(message);
    this.statusCode = statusCode;
  }
}