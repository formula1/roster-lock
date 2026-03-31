import { Hono } from 'hono';
import { z } from 'zod';
import { Env } from '../../types';
import {
  hashPassword,
  verifyPassword,
  generateTemporaryPassword,
} from './password';

import { createJWT, validateJWT, JWTPayload } from './jwt';


import { AdminRow } from '../../schema/types';

export const app = new Hono<{ Bindings: Env; Variables: { user: JWTPayload } }>();

// Zod schemas
const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1)
});

const usernameSchema = z.object({
  username: z.string().min(1)
});

const updatePasswordSchema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters')
});

// Helper: Get expiration date (24 hours from now)
function getPasswordExpiration(): string {
  return new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
}

// Middleware: Require authenticated admin (exported for use in other routers)
export async function requireAuth(c: any, next: () => Promise<void>) {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Missing or invalid Authorization header' }, 401);
  }

  const token = authHeader.slice(7);
  const payload = await validateJWT(token, c.env.JWT_SECRET, c.env.DB);
  if (!payload) {
    return c.json({ error: 'Invalid or expired token' }, 401);
  }

  c.set('user', payload);
  await next();
}

// ============= Public Routes =============

// POST /login - Authenticate and get JWT
app.post('/login', async (c) => {
  const body = await c.req.json();
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Invalid request body' }, 400);
  }

  const { username, password } = parsed.data;

  // Check for initial admin bootstrap
  if (c.env.INITIAL_ADMIN_PASSWORD && c.env.INITIAL_ADMIN_USERNAME) {
    const existingAdmin = await c.env.DB.prepare(
      'SELECT id FROM admins WHERE username = ?'
    ).bind(c.env.INITIAL_ADMIN_USERNAME).first();

    if (!existingAdmin && username === c.env.INITIAL_ADMIN_USERNAME && password === c.env.INITIAL_ADMIN_PASSWORD) {
      // Bootstrap: create initial admin with temporary password
      const id = crypto.randomUUID();
      const passwordHash = await hashPassword(password);
      await c.env.DB.prepare(
        'INSERT INTO admins (id, username, password_hash, password_expires_at) VALUES (?, ?, ?, ?)'
      ).bind(id, username, passwordHash, getPasswordExpiration()).run();

      const token = await createJWT({ sub: username }, c.env.JWT_SECRET);
      return c.json({
        token,
        passwordExpired: true,
        message: 'Initial admin created. Please update your password.'
      });
    }
  }

  // Normal login flow
  const admin = await c.env.DB.prepare(
    'SELECT id, username, password_hash, password_expires_at FROM admins WHERE username = ?'
  ).bind(username).first<AdminRow>();

  if (!admin) {
    return c.json({ error: 'Invalid credentials' }, 401);
  }

  const validPassword = await verifyPassword(password, admin.password_hash);
  if (!validPassword) {
    return c.json({ error: 'Invalid credentials' }, 401);
  }

  const token = await createJWT({ sub: username }, c.env.JWT_SECRET);

  // Check if password is expired
  const passwordExpired = admin.password_expires_at
    ? new Date(admin.password_expires_at) < new Date()
    : false;

  return c.json({
    token,
    passwordExpired,
    ...(passwordExpired && { message: 'Your password has expired. Please update it.' })
  });
});


// ============= Protected Routes =============

// GET /refresh - Refresh JWT
app.get("/refresh", requireAuth, async (c) => {
  const user = c.get('user');
  const token = await createJWT({ sub: user.sub }, c.env.JWT_SECRET);
  return c.json({ token });
});


// GET /me - Get current user info
app.get('/me', requireAuth, async (c) => {
  const user = c.get('user');

  const admin = await c.env.DB.prepare(
    'SELECT username, password_expires_at, created_at FROM admins WHERE username = ?'
  ).bind(user.sub).first<{ username: string; password_expires_at: string | null; created_at: string }>();

  if (!admin) {
    return c.json({ error: 'User not found' }, 404);
  }

  const now = new Date();
  return c.json({
    username: admin.username,
    passwordStatus: !admin.password_expires_at
      ? 'permanent'
      : new Date(admin.password_expires_at) < now
        ? 'expired'
        : 'temporary',
    passwordExpiresAt: admin.password_expires_at,
    createdAt: admin.created_at
  });
});


// PUT /password - Update own password (removes expiration)
app.put('/password', requireAuth, async (c) => {
  const user = c.get('user');
  const body = await c.req.json();
  const parsed = updatePasswordSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Invalid password' }, 400);
  }

  const { password } = parsed.data;
  const passwordHash = await hashPassword(password);

  await c.env.DB.prepare(
    'UPDATE admins SET password_hash = ?, password_expires_at = NULL WHERE username = ?'
  ).bind(passwordHash, user.sub).run();

  return c.json({ success: true, message: 'Password updated successfully' });
});


// POST /users - Add new admin user (returns temporary password)
app.post('/users', requireAuth, async (c) => {
  const body = await c.req.json();
  const parsed = usernameSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Invalid request body' }, 400);
  }

  const { username } = parsed.data;

  // Check if username already exists
  const existing = await c.env.DB.prepare(
    'SELECT id FROM admins WHERE username = ?'
  ).bind(username).first();
  if (existing) {
    return c.json({ error: 'Username already exists' }, 409);
  }

  const tempPassword = generateTemporaryPassword();
  const passwordHash = await hashPassword(tempPassword);
  const id = crypto.randomUUID();

  await c.env.DB.prepare(
    'INSERT INTO admins (id, username, password_hash, password_expires_at) VALUES (?, ?, ?, ?)'
  ).bind(id, username, passwordHash, getPasswordExpiration()).run();

  return c.json({
    username,
    temporaryPassword: tempPassword,
    expiresAt: getPasswordExpiration()
  }, 201);
});

app.get('/users/:username', requireAuth, async (c) => {
  const username = c.req.param('username');

  const admin = await c.env.DB.prepare(
    'SELECT * EXCEPT (password_hash) FROM admins WHERE username = ?'
  ).bind(username).first<AdminRow>();

  if (!admin) {
    return c.json({ error: 'User not found' }, 404);
  }

  return c.json(admin);
});


// POST /users/:username/reset - Reset user password (returns temporary password)
app.post('/users/:username/reset', requireAuth, async (c) => {
  const username = c.req.param('username');

  const existing = await c.env.DB.prepare(
    'SELECT id FROM admins WHERE username = ?'
  ).bind(username).first();
  if (!existing) {
    return c.json({ error: 'User not found' }, 404);
  }

  const tempPassword = generateTemporaryPassword();
  const passwordHash = await hashPassword(tempPassword);

  await c.env.DB.prepare(
    'UPDATE admins SET password_hash = ?, password_expires_at = ? WHERE username = ?'
  ).bind(passwordHash, getPasswordExpiration(), username).run();

  return c.json({
    username,
    temporaryPassword: tempPassword,
    expiresAt: getPasswordExpiration()
  });
});


// DELETE /users/:username - Remove admin user
app.delete('/users/:username', requireAuth, async (c) => {
  const user = c.get('user');
  const username = c.req.param('username');

  // Prevent self-deletion
  if (username === user.sub) {
    return c.json({ error: 'Cannot delete your own account' }, 400);
  }

  const result = await c.env.DB.prepare(
    'DELETE FROM admins WHERE username = ?'
  ).bind(username).run();

  if (result.meta.changes === 0) {
    return c.json({ error: 'User not found' }, 404);
  }

  return c.body(null, 204);
});

// GET /users - List all admin users
app.get('/users', requireAuth, async (c) => {
  const result = await c.env.DB.prepare(`
    SELECT
      username,
      password_expires_at,
      created_at,
      updated_at
    FROM admins
    ORDER BY username
  `).all<{
    username: string;
    password_expires_at: string | null;
    created_at: string;
    updated_at: string;
  }>();

  const now = new Date();
  const users = result.results.map(user => ({
    username: user.username,
    passwordStatus: !user.password_expires_at
      ? 'permanent'
      : new Date(user.password_expires_at) < now
        ? 'expired'
        : 'temporary',
    passwordExpiresAt: user.password_expires_at,
    createdAt: user.created_at,
    updatedAt: user.updated_at
  }));

  return c.json(users);
});

