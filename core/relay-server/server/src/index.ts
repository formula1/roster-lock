import { Hono } from 'hono';
import v1Router from './version-1/router';
import { Env } from './version-1/types';

const app = new Hono<{ Bindings: Env }>();

app.route('/api/v1', v1Router);

// Serve static assets (React client) for all non-API routes
app.all('*', async (c) => {
  return c.env.CLIENT_ASSETS.fetch(c.req.raw);
});

export default app;
