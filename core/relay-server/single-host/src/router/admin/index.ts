import { z } from "zod";
import { HTTPRouter, HTTPError, jsonBody, HTTPRequest, HTTPRequestHandler } from "../../utils/http-router";
import { hashPassword, verifyPassword, generateTemporaryPassword } from "./password";
import { createJWT, validateJWT, JWTPayload } from "./jwt";
import { adminsModel } from "../../models";
import { getJWTSecret, getInitialAdminUsername, getInitialAdminPassword } from "../../globals";

export const adminRouter = new HTTPRouter();

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

const usernameSchema = z.object({
  username: z.string().min(1),
});

const updatePasswordSchema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters"),
});

function getPasswordExpiration(): string {
  return new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
}

function sendJSON(res: HTTPRequest["res"], statusCode: number, value: unknown) {
  res.writeHead(statusCode, { "Content-Type": "application/json" });
  res.end(JSON.stringify(value));
}

function passwordStatus(passwordExpiresAt: string | null): "permanent" | "expired" | "temporary" {
  if (!passwordExpiresAt) return "permanent";
  return new Date(passwordExpiresAt) < new Date() ? "expired" : "temporary";
}

type AuthedAdmin = JWTPayload & { id: string };
// requireAuth stashes the decoded admin directly on the same `request`
// object GenericRouter passes down its callback chain (see Generic.ts's
// eachSeries - every callback for a matched route gets the same reference),
// the same way Express middleware sets req.user.
type AuthedRequest = HTTPRequest & { admin: AuthedAdmin };

// Exported so matchmaker/game-coordinator routers can reuse the same gate,
// mirroring relay-server-cf's `import { requireAuth } from './admins'`.
export const requireAuth: HTTPRequestHandler = async (request, params, next) => {
  const authHeader = request.req.headers["authorization"];
  if (!authHeader?.startsWith("Bearer ")) {
    return next(new HTTPError(401, "Missing or invalid Authorization header"));
  }

  const token = authHeader.slice(7);
  const payload = await validateJWT(token, getJWTSecret(), adminsModel);
  if (!payload) {
    return next(new HTTPError(401, "Invalid or expired token"));
  }

  (request as AuthedRequest).admin = payload;
  next();
};

// ============= Public Routes =============

adminRouter.post("/login", async ({ req, res }, params, next) => {
  try {
    const body = await jsonBody(req);
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) return sendJSON(res, 400, { error: "Invalid request body" });

    const { username, password } = parsed.data;

    // Check for initial admin bootstrap
    const initialUsername = getInitialAdminUsername();
    const initialPassword = getInitialAdminPassword();
    if (initialUsername && initialPassword) {
      const existingAdmin = await adminsModel.getByUsername(initialUsername);
      if (!existingAdmin && username === initialUsername && password === initialPassword) {
        const passwordHash = await hashPassword(password);
        await adminsModel.create({ username, passwordHash, passwordExpiresAt: getPasswordExpiration() });

        const token = await createJWT({ sub: username }, getJWTSecret());
        return sendJSON(res, 200, {
          token,
          passwordExpired: true,
          message: "Initial admin created. Please update your password.",
        });
      }
    }

    // Normal login flow
    const admin = await adminsModel.getByUsername(username);
    if (!admin) return sendJSON(res, 401, { error: "Invalid credentials" });

    const validPassword = await verifyPassword(password, admin.passwordHash);
    if (!validPassword) return sendJSON(res, 401, { error: "Invalid credentials" });

    const token = await createJWT({ sub: username }, getJWTSecret());
    const expired = passwordStatus(admin.passwordExpiresAt) === "expired";

    return sendJSON(res, 200, {
      token,
      passwordExpired: expired,
      ...(expired && { message: "Your password has expired. Please update it." }),
    });
  } catch (e) {
    next(e);
  }
});

// ============= Protected Routes =============

adminRouter.get("/refresh", requireAuth, async (request, params, next) => {
  try {
    const { admin } = request as AuthedRequest;
    const token = await createJWT({ sub: admin.sub }, getJWTSecret());
    return sendJSON(request.res, 200, { token });
  } catch (e) {
    next(e);
  }
});

adminRouter.get("/me", requireAuth, async (request, params, next) => {
  try {
    const { admin } = request as AuthedRequest;
    const record = await adminsModel.getByUsername(admin.sub);
    if (!record) return sendJSON(request.res, 404, { error: "User not found" });

    return sendJSON(request.res, 200, {
      username: record.username,
      passwordStatus: passwordStatus(record.passwordExpiresAt),
      passwordExpiresAt: record.passwordExpiresAt,
      createdAt: record.createdAt,
    });
  } catch (e) {
    next(e);
  }
});

adminRouter.put("/password", requireAuth, async (request, params, next) => {
  try {
    const { admin } = request as AuthedRequest;
    const body = await jsonBody(request.req);
    const parsed = updatePasswordSchema.safeParse(body);
    if (!parsed.success) return sendJSON(request.res, 400, { error: "Invalid password" });

    const passwordHash = await hashPassword(parsed.data.password);
    const updated = await adminsModel.updatePassword(admin.sub, { passwordHash, passwordExpiresAt: null });
    if (!updated) return sendJSON(request.res, 404, { error: "User not found" });

    return sendJSON(request.res, 200, { success: true, message: "Password updated successfully" });
  } catch (e) {
    next(e);
  }
});

adminRouter.post("/users", requireAuth, async (request, params, next) => {
  try {
    const body = await jsonBody(request.req);
    const parsed = usernameSchema.safeParse(body);
    if (!parsed.success) return sendJSON(request.res, 400, { error: "Invalid request body" });

    const { username } = parsed.data;
    const existing = await adminsModel.getByUsername(username);
    if (existing) return sendJSON(request.res, 409, { error: "Username already exists" });

    const tempPassword = generateTemporaryPassword();
    const passwordHash = await hashPassword(tempPassword);
    const expiresAt = getPasswordExpiration();
    await adminsModel.create({ username, passwordHash, passwordExpiresAt: expiresAt });

    return sendJSON(request.res, 201, { username, temporaryPassword: tempPassword, expiresAt });
  } catch (e) {
    next(e);
  }
});

adminRouter.get("/users/:username", requireAuth, async (request, params, next) => {
  try {
    const admin = await adminsModel.getByUsername(params.params.username);
    if (!admin) return sendJSON(request.res, 404, { error: "User not found" });

    const { passwordHash, ...rest } = admin;
    return sendJSON(request.res, 200, rest);
  } catch (e) {
    next(e);
  }
});

adminRouter.post("/users/:username/reset", requireAuth, async (request, params, next) => {
  try {
    const username = params.params.username;
    const existing = await adminsModel.getByUsername(username);
    if (!existing) return sendJSON(request.res, 404, { error: "User not found" });

    const tempPassword = generateTemporaryPassword();
    const passwordHash = await hashPassword(tempPassword);
    const expiresAt = getPasswordExpiration();
    await adminsModel.updatePassword(username, { passwordHash, passwordExpiresAt: expiresAt });

    return sendJSON(request.res, 200, { username, temporaryPassword: tempPassword, expiresAt });
  } catch (e) {
    next(e);
  }
});

adminRouter.delete("/users/:username", requireAuth, async (request, params, next) => {
  try {
    const { admin } = request as AuthedRequest;
    const username = params.params.username;
    if (username === admin.sub) return sendJSON(request.res, 400, { error: "Cannot delete your own account" });

    const deleted = await adminsModel.delete(username);
    if (!deleted) return sendJSON(request.res, 404, { error: "User not found" });

    request.res.writeHead(204);
    return request.res.end();
  } catch (e) {
    next(e);
  }
});

adminRouter.get("/users", requireAuth, async (request, params, next) => {
  try {
    const admins = await adminsModel.list();
    const users = admins
      .slice()
      .sort((a, b) => a.username.localeCompare(b.username))
      .map(admin => ({
        username: admin.username,
        passwordStatus: passwordStatus(admin.passwordExpiresAt),
        passwordExpiresAt: admin.passwordExpiresAt,
        createdAt: admin.createdAt,
        updatedAt: admin.updatedAt,
      }));

    return sendJSON(request.res, 200, users);
  } catch (e) {
    next(e);
  }
});
