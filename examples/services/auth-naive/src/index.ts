import { Hono } from "hono";
import { z } from "zod";
import { Env } from "./types";
import {
  registerUser,
  loginUser,
  updateUser,
  getUserByUsername,
  reserveDisplayNameTag,
  verifyJwtToken,
} from "./userStore";

const app = new Hono<{ Bindings: Env; Variables: { user: { userId: string; username: string } } }>();

app.get("/health", (c) => c.json({ status: "ok", service: "auth-naive" }));

// Letters/numbers/spaces and a few basic punctuation marks only. This keeps
// out control characters and invisible/zero-width unicode (homoglyph and
// spoofing tricks), and excludes '#' since that's the tag delimiter. Shared
// by username registration and the later display-name rename endpoint so
// both enforce the same rule (see examples/services/auth-validated for the
// email-verified equivalent).
const nameSchema = z.string()
  .trim()
  .min(1)
  .max(32)
  .regex(/^[\p{L}\p{N} '_.-]+$/u, "may only contain letters, numbers, spaces, and ' _ . -");

const registerSchema = z.object({
  username: nameSchema,
  password: z.string(),
});

// No email, no validation token, no pending state - the account is active
// immediately. This service is for fast local testing only.
app.post("/auth/register", async (c) => {
  try {
    const { username, password } = registerSchema.parse(await c.req.json());
    await registerUser(c.env, username, password);
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 400);
  }
});

const loginSchema = z.object({
  username: nameSchema,
  password: z.string(),
});

app.post("/auth/login", async (c) => {
  try {
    const { username, password } = loginSchema.parse(await c.req.json());
    const jwtToken = await loginUser(c.env, username, password);
    return c.json({ token: jwtToken });
  } catch (err: any) {
    return c.json({ error: err.message }, 401);
  }
});

const authMiddleware = async (c: any, next: any) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  try {
    const user = verifyJwtToken(c.env, authHeader.split(" ")[1]);
    c.set("user", user);
    await next();
  } catch (err) {
    return c.json({ error: "Invalid token" }, 401);
  }
};

const setPublicKeySchema = z.object({
  publicKey: z.string(),
});

app.post("/auth/set-public-key", authMiddleware, async (c) => {
  try {
    const userPayload = c.get("user");
    const { publicKey } = setPublicKeySchema.parse(await c.req.json());
    await updateUser(c.env, userPayload.username, { publicKey });
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 400);
  }
});

const setDisplayNameSchema = z.object({
  displayName: nameSchema,
});

app.post("/auth/set-display-name", authMiddleware, async (c) => {
  try {
    const userPayload = c.get("user");
    const { displayName } = setDisplayNameSchema.parse(await c.req.json());
    const tag = await reserveDisplayNameTag(c.env, displayName);
    await updateUser(c.env, userPayload.username, { displayName: tag });
    return c.json({ displayName: tag });
  } catch (err: any) {
    return c.json({ error: err.message }, 400);
  }
});

// No `validated` field - there's nothing to validate without email
// verification (compare examples/services/auth-validated's /auth/verify).
app.get("/auth/verify", authMiddleware, async (c) => {
  try {
    const userPayload = c.get("user");
    const user = await getUserByUsername(c.env, userPayload.username);
    if (!user) return c.json({ error: "User not found" }, 404);

    return c.json({
      id: user.id,
      displayName: user.displayName,
      identifier: user.username,
      publicKey: user.publicKey,
      // Defaults to 1 rather than leaving this undefined - callers like
      // titled-room's RoomSession sum playerCount straight into maxPlayers
      // arithmetic, so an unset value has to mean "just this one person",
      // not "unknown"/NaN.
      playerCount: user.playerCount ?? 1,
    });
  } catch (err: any) {
    return c.json({ error: err.message }, 400);
  }
});

const setPlayersSchema = z.object({
  playerCount: z.number().int().min(1),
});

app.post("/auth/set-players", authMiddleware, async (c) => {
  try {
    const userPayload = c.get("user");
    const { playerCount } = setPlayersSchema.parse(await c.req.json());
    await updateUser(c.env, userPayload.username, { playerCount });
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 400);
  }
});

export default app;
