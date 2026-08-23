import { Hono } from "hono";
import { z } from "zod";
import { Env } from "../types";
import { hashPassword, verifyPassword } from "./password";
import { createJWT, validateJWT, JWTPayload } from "./jwt";

export const app = new Hono<{ Bindings: Env; Variables: { admin: JWTPayload } }>();

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

function getPasswordExpiration(): string {
  return new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
}

// Exported for use by other admin routers (game-launchers.ts).
export async function requireAdminAuth(c: any, next: () => Promise<void>) {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "Missing or invalid Authorization header" }, 401);
  }

  const token = authHeader.slice(7);
  const payload = await validateJWT(token, c.env.JWT_SECRET, c.env.DB);
  if (!payload) {
    return c.json({ error: "Invalid or expired token" }, 401);
  }

  c.set("admin", payload);
  await next();
}

// POST /admin/login - mirrors core/relay-server's admin bootstrap flow
// exactly: the first successful login with INITIAL_ADMIN_USERNAME/PASSWORD
// creates the real `admins` row; every login after that is checked against it.
app.post("/login", async (c) => {
  const body = await c.req.json();
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid request body" }, 400);
  }
  const { username, password } = parsed.data;

  if (c.env.INITIAL_ADMIN_USERNAME && c.env.INITIAL_ADMIN_PASSWORD) {
    const existingAdmin = await c.env.DB.prepare(
      "SELECT id FROM admins WHERE username = ?"
    ).bind(c.env.INITIAL_ADMIN_USERNAME).first();

    if (!existingAdmin && username === c.env.INITIAL_ADMIN_USERNAME && password === c.env.INITIAL_ADMIN_PASSWORD) {
      const id = crypto.randomUUID();
      const passwordHash = await hashPassword(password);
      await c.env.DB.prepare(
        "INSERT INTO admins (id, username, password_hash, password_expires_at, created_at) VALUES (?, ?, ?, ?, ?)"
      ).bind(id, username, passwordHash, getPasswordExpiration(), new Date().toISOString()).run();

      const token = await createJWT({ sub: username }, c.env.JWT_SECRET);
      return c.json({
        token,
        passwordExpired: true,
        message: "Initial admin created. Please update your password.",
      });
    }
  }

  const admin = await c.env.DB.prepare(
    "SELECT id, username, password_hash, password_expires_at FROM admins WHERE username = ?"
  ).bind(username).first<{ id: string, username: string, password_hash: string, password_expires_at: string | null }>();

  if (!admin) {
    return c.json({ error: "Invalid credentials" }, 401);
  }

  const validPassword = await verifyPassword(password, admin.password_hash);
  if (!validPassword) {
    return c.json({ error: "Invalid credentials" }, 401);
  }

  const token = await createJWT({ sub: username }, c.env.JWT_SECRET);
  const passwordExpired = admin.password_expires_at
    ? new Date(admin.password_expires_at) < new Date()
    : false;

  return c.json({
    token,
    passwordExpired,
    ...(passwordExpired && { message: "Your password has expired. Please update it." }),
  });
});

app.get("/me", requireAdminAuth, (c) => {
  const admin = c.get("admin");
  return c.json({ username: admin.sub });
});
