import { Hono } from "hono";
import { z } from "zod";
import { Env } from "./types";
import {
  requestToken,
  validateAndSetPassword,
  loginUser,
  updateUser,
  getUserByEmail,
  reserveDisplayNameTag,
  verifyJwtToken,
  sendValidationEmail
} from "./userStore";

const app = new Hono<{ Bindings: Env; Variables: { user: { userId: string; email: string } } }>();

app.get("/health", (c) => c.json({ status: "ok", service: "auth-validated" }));

// Letters/numbers/spaces and a few basic punctuation marks only. This keeps
// out control characters and invisible/zero-width unicode (homoglyph and
// spoofing tricks), and excludes '#' since that's the tag delimiter. Shared
// by registration and the later rename endpoint so both enforce the same rule.
const displayNameSchema = z.string()
  .trim()
  .min(1)
  .max(32)
  .regex(/^[\p{L}\p{N} '_.-]+$/u, "displayName may only contain letters, numbers, spaces, and ' _ . -");

const registerSchema = z.object({
  email: z.email(),
});

// Shared by both new registrations and forgot-password requests, so the
// response can't be used to tell an attacker whether the email is taken.
// New accounts get a displayName later via /auth/set-display-name.
app.post("/auth/register", async (c) => {
  try {
    const { email } = registerSchema.parse(await c.req.json());
    const token = await requestToken(c.env, email);

    // Send email with the unique validation token
    await sendValidationEmail(c.env, email, token);

    return c.json({ success: true, message: "Validation email sent" });
  } catch (err: any) {
    return c.json({ error: err.message }, 400);
  }
});

const validateSchema = z.object({
  email: z.email(),
  token: z.string(),
  password: z.string(),
});

app.post("/auth/validate", async (c) => {
  try {
    const { email, token, password } = validateSchema.parse(await c.req.json());
    const success = await validateAndSetPassword(c.env, email, token, password);
    return c.json({ success });
  } catch (err: any) {
    return c.json({ error: err.message }, 400);
  }
});

const loginSchema = z.object({
  email: z.email(),
  password: z.string(),
});

app.post("/auth/login", async (c) => {
  try {
    const { email, password } = loginSchema.parse(await c.req.json());
    const jwtToken = await loginUser(c.env, email, password);
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
    await updateUser(c.env, userPayload.email, { publicKey });
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 400);
  }
});

const setDisplayNameSchema = z.object({
  displayName: displayNameSchema,
});

app.post("/auth/set-display-name", authMiddleware, async (c) => {
  try {
    const userPayload = c.get("user");
    const { displayName } = setDisplayNameSchema.parse(await c.req.json());
    const tag = await reserveDisplayNameTag(c.env, displayName);
    await updateUser(c.env, userPayload.email, { displayName: tag });
    return c.json({ displayName: tag });
  } catch (err: any) {
    return c.json({ error: err.message }, 400);
  }
});

app.get("/auth/verify", authMiddleware, async (c) => {
  try {
    const userPayload = c.get("user");
    const user = await getUserByEmail(c.env, userPayload.email);
    if (!user) return c.json({ error: "User not found" }, 404);

    return c.json({
      id: user.id,
      displayName: user.displayName,
      // titled-room and other matchmakers read this as an opaque login
      // identity string, never as a real email specifically - see
      // examples/mugen/services/titled-room/src/types.ts.
      identifier: user.email,
      publicKey: user.publicKey,
      validated: user.validated,
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
    await updateUser(c.env, userPayload.email, { playerCount });
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 400);
  }
});

export default app;
