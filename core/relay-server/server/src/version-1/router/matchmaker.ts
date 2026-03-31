
import { Hono } from 'hono';
import { Env } from '../types';

import { requireAuth } from './admins';

export const app = new Hono<{ Bindings: Env }>();

app.use(requireAuth)

import { z, ZodType } from 'zod';
const matchmakerInfoCaster: ZodType<{ name: string; publicKey: string }> = z.object({
  name: z.string(),
  publicKey: z.string(),
}).strict();

// Create matchmaker (admin only)
app.post('/', async (c) => {
  // TODO: Add admin auth middleware
  const uncastedBody = await c.req.json();
  const casted = matchmakerInfoCaster.safeParse(uncastedBody);
  if(!casted.success){
    return c.json({ error: 'Invalid body' }, 400);
  }
  const { name, publicKey } = casted.data;
  const id = crypto.randomUUID();

  await c.env.DB.prepare(`
    INSERT INTO matchmakers (id, name, public_key, registered_at)
    VALUES (?, ?, ?, ?)
  `).bind(id, name, publicKey, new Date().toISOString()).run();

  return c.json({ id, name, publicKey }, 201);
});

// List all active matchmakers
app.get('/', async (c) => {
  const result = await c.env.DB.prepare(
    'SELECT * FROM matchmakers'
  ).bind().all();
  
  return c.json(result.results);
});

app.get("/:id", async (c) => {
  const id = c.req.param('id');
  
  const matchmaker = await c.env.DB.prepare(
    'SELECT * FROM matchmakers WHERE id = ?'
  ).bind(id).first();

  return c.json(matchmaker);
});


app.put('/:id', async (c) => {
  // TODO: Add admin auth middleware
  const id = c.req.param('id');
  const uncastedBody = await c.req.json();
  const casted = matchmakerInfoCaster.safeParse(uncastedBody);
  if(!casted.success){
    return c.json({ error: 'Invalid body' }, 400);
  }
  const { name, publicKey } = casted.data;

  await c.env.DB.prepare(
    'UPDATE matchmakers SET name = ?, public_key = ? WHERE id = ?'
  ).bind(name, publicKey, id).run();

  return c.json({ success: true });
});


// Delete/suspend matchmaker (admin only)
app.put('/:id/suspend', async (c) => {
  // TODO: Add admin auth middleware
  const id = c.req.param('id');
  
  await c.env.DB.prepare(
    'UPDATE matchmakers SET status = ? WHERE id = ?'
  ).bind('suspended', id).run();

  return c.body(null, 204);
});

app.put("/:id/activate", async (c) => {
  const id = c.req.param('id');
  
  await c.env.DB.prepare(
    'UPDATE matchmakers SET status = ? WHERE id = ?'
  ).bind('active', id).run();

  return c.body(null, 204);
});


// Get matchmaker statistics
app.get('/:id/stats', async (c) => {
  const id = c.req.param('id');
  
  const stats = await c.env.DB.prepare(`
    SELECT 
      COUNT(*) as total_rooms,
      SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_rooms,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as successful_rooms,
      SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_rooms,
      AVG(
        CASE 
          WHEN finished_at IS NOT NULL 
          THEN (julianday(finished_at) - julianday(created_at)) * 86400
          ELSE NULL 
        END
      ) as avg_lifetime_seconds
    FROM room_stats
    WHERE matchmaker_id = ?
  `).bind(id).first();

  return c.json(stats);
});
