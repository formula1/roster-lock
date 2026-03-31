import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { Env } from '../types';
import { Room } from '../durable-objects/Room';

export { Room };

const app = new Hono<{ Bindings: Env }>();

// Middleware
app.use('*', cors());

// Health check
app.get('/', (c) => {
  return c.json({ status: 'ok', service: 'roster-lock-relay' });
});

// ============= Admin Routes =============
import { app as adminRouter } from './admins';
app.route('/admin', adminRouter);

// ============= Matchmaker Routes =============
import { app as matchmakerRouter } from './matchmaker';
app.route('/matchmaker', matchmakerRouter);

// ============= Room Routes =============
import { app as roomRouter } from './room';
app.route('/room', roomRouter);

export default app;