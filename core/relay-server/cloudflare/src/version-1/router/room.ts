
import { Hono } from 'hono';
import { Env, RoomConfig } from '../types';

import { z, ZodType } from 'zod';
import { SIGNATURE_ASYMMETRIC, createShaFromJSON } from '@roster-lock/utils';
import { GameCoordinatorRow, MatchmakerRow, RoomStatsRow } from '../schema/types';
import { D1Database } from '@cloudflare/workers-types';
import { ContentfulStatusCode } from 'hono/utils/http-status';

type PublicKey = Parameters<typeof SIGNATURE_ASYMMETRIC.verifySignature>[0];

export const app = new Hono<{ Bindings: Env }>();

import { RoomMachine } from '../types';
type CreateRoomBody = {
  rosterConfig: any;

  rosterConfigHash: string;
  machines: RoomMachine[];
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

  // `false` is a deliberate "no coordinator" choice - skip the lookup
  // entirely rather than querying for a row that was never meant to exist.
  let gameCoordinator: GameCoordinatorRow | null = null;
  if (body.coordinatorId !== false) {
    gameCoordinator = await c.env.DB.prepare(
      'SELECT * FROM game_coordinators WHERE id = ? AND status = ?'
    ).bind(body.coordinatorId, 'active').first<GameCoordinatorRow>();

    if (!gameCoordinator) {
      return c.json({ error: 'Invalid game coordinator' }, 401);
    }
  }


  const isValid = await SIGNATURE_ASYMMETRIC.verifySignature(
    matchmaker.public_key as PublicKey,
    body.signature,
    {
      service: 'create-room',
      publicKey: body.publicKey,
      rosterConfigHash: body.rosterConfigHash,
      machines: body.machines,
      coordinatorId: body.coordinatorId,
    }
  );
  if(!isValid) return c.json({ error: 'Invalid signature' }, 401);
  
  const roomId = crypto.randomUUID();
  const full_hashBuffer = await createShaFromJSON(body.rosterConfig);
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
      coordinatorId: gameCoordinator ? gameCoordinator.id : false,
      roomId,
      rosterConfigHash: full_hashBuffer,
      machines: body.machines,
    } satisfies RoomConfig),
  });

  if(!response.ok) return c.json({ error: 'Failed to create room' }, 500);

  // Now store room stats in D1 after DO creation succeeded
  const rosterHash = await createShaFromJSON(body.rosterConfig.rosters);
  const engineId = body.rosterConfig.engine.name;
  const engineVersion = body.rosterConfig.engine.version;
  const machine_ids = JSON.stringify(body.machines.sort());

  await c.env.DB.prepare(`
    INSERT INTO room_stats (
      room_id, matchmaker_id,
      full_config_hash, engine_id, engine_version, roster_hash,
      machine_ids, machine_count,
      coordinator_id,
      created_at,
      status
    ) VALUES (
     ?, ?,
     ?, ?, ?, ?,
     ?, ?,
     ?,
     ?,
     ?
    )
  `).bind(
    roomId, matchmaker.id,
    full_hashBuffer, engineId, engineVersion, rosterHash,
    machine_ids, body.machines.length,
    // NULL (not the string "false") - see tables.sql's comment on this column.
    gameCoordinator ? gameCoordinator.id : null,
    new Date().toISOString(),
    'active',
  ).run();

  return c.json({ roomId });
});

// Get room machines (authenticated machine only)
app.get('/:roomId/machines', async (c) => {
  try {
    const roomId = c.req.param('roomId');
    await ensureRoomExists(c.env.DB, roomId);
    const id = c.env.ROOM.idFromName(roomId);
    const room = c.env.ROOM.get(id);

    const url = new URL(c.req.url);
    url.pathname = '/machines';

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