import { Hono } from "hono";
import { cors } from "hono/cors";
import { Env, PublicUserProfile, RoomData } from "./types";
import { createRoomBodySchema, joinRoomBodySchema, startRoomBodySchema, destroyRoomBodySchema } from "./schema";
import { assertGameLauncherAllowed } from "./game-launchers";
import { upsertRoomIndex, deleteRoomIndex, listOpenRooms } from "./db";
import { app as adminApp } from "./admin";
import { app as adminGameLaunchersApp } from "./admin/game-launchers";
export { RoomSession } from "./RoomSession";

const app = new Hono<{ Bindings: Env }>();

app.use('*', cors());

app.get("/health", (c) => c.json({ status: "ok", service: "titled-room" }));

// Which game-launcher plugins this deployment allows and their coordinator
// setup - managed by an admin instead of redeploying with different env
// vars (see admin/game-launchers.ts and game-launchers.ts's reads of the
// game_runner_configs table this manages).
app.route("/admin", adminApp);
app.route("/admin/game-launchers", adminGameLaunchersApp);

const verifyAuthToken = async (c: any): Promise<PublicUserProfile | null> => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const authServiceUrl = c.env.AUTH_SERVICE_URL || "http://localhost:8787";
  const res = await fetch(`${authServiceUrl}/auth/verify`, {
    headers: { Authorization: authHeader },
  });

  if (!res.ok) return null;
  return (await res.json()) as PublicUserProfile;
};

app.post("/room/create", async (c) => {
  const user = await verifyAuthToken(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  let body;
  try {
    body = createRoomBodySchema.parse(await c.req.json());
  } catch (err: any) {
    return c.json({ error: err.message }, 400);
  }

  try {
    await assertGameLauncherAllowed(c.env, body.gameLauncherPlugin, body.rosterConfig);
  } catch (err: any) {
    return c.json({ error: err.message }, 400);
  }

  const roomId = crypto.randomUUID();
  const id = c.env.ROOM_SESSION.idFromName(roomId);
  const stub = c.env.ROOM_SESSION.get(id);

  const res = await stub.fetch(new Request(`https://do/init?roomId=${roomId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ hostUser: user, ...body }),
  }) as any);

  const roomData = await res.json() as RoomData;
  if (res.ok) await upsertRoomIndex(c.env.DB, roomData);
  return c.json(roomData, res.status as any);
});

app.post("/room/join", async (c) => {
  const user = await verifyAuthToken(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  let body;
  try {
    body = joinRoomBodySchema.parse(await c.req.json());
  } catch (err: any) {
    return c.json({ error: err.message }, 400);
  }

  const id = c.env.ROOM_SESSION.idFromName(body.roomId);
  const stub = c.env.ROOM_SESSION.get(id);

  const res = await stub.fetch(new Request("https://do/join", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...user, machineId: body.machineId }),
  }) as any);

  const roomData = await res.json() as RoomData;
  if (res.ok) await upsertRoomIndex(c.env.DB, roomData);
  return c.json(roomData, res.status as any);
});

app.post("/room/destroy", async (c) => {
  const user = await verifyAuthToken(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  let body;
  try {
    body = destroyRoomBodySchema.parse(await c.req.json());
  } catch (err: any) {
    return c.json({ error: err.message }, 400);
  }

  const id = c.env.ROOM_SESSION.idFromName(body.roomId);
  const stub = c.env.ROOM_SESSION.get(id);

  const res = await stub.fetch(new Request("https://do/destroy", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ requestingUserId: user.id }),
  }) as any);

  const result = await res.json();
  if (res.ok) await deleteRoomIndex(c.env.DB, body.roomId);
  return c.json(result, res.status as any);
});

app.post("/room/start", async (c) => {
  const user = await verifyAuthToken(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  let body;
  try {
    body = startRoomBodySchema.parse(await c.req.json());
  } catch (err: any) {
    return c.json({ error: err.message }, 400);
  }

  const id = c.env.ROOM_SESSION.idFromName(body.roomId);
  const stub = c.env.ROOM_SESSION.get(id);

  const res = await stub.fetch(new Request("https://do/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ requestingUserId: user.id }),
  }) as any);

  const result = await res.json() as any;
  if (res.ok) {
    // /start doesn't return the full RoomData, just {success, relayUrl,
    // roomId} - fetch the DO's current state so the index reflects the new
    // "started" status (and drops out of GET /room's open-rooms listing).
    const stateRes = await stub.fetch(new Request("https://do/state", { method: "GET" }) as any);
    if (stateRes.ok) await upsertRoomIndex(c.env.DB, await stateRes.json() as RoomData);
  }
  return c.json(result, res.status as any);
});

// Browse open rooms - not participant-gated (matches general-plan.md's
// "browse before joining" flow), but still requires a logged-in user since
// there's no anonymous access to this matchmaker otherwise.
app.get("/room", async (c) => {
  const user = await verifyAuthToken(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const title = c.req.query("title");
  const rooms = await listOpenRooms(c.env.DB, title);
  return c.json(rooms);
});

// Registered before the /room/:roomId param route below, so "listen" can
// never be captured as a :roomId value.
app.get("/room/listen", async (c) => {
  const token = c.req.query("token");
  const roomId = c.req.query("roomId");
  if (!token || !roomId) return c.text("Missing parameters", 400);

  const authServiceUrl = c.env.AUTH_SERVICE_URL || "http://localhost:8787";
  const res = await fetch(`${authServiceUrl}/auth/verify`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) return c.text("Invalid auth token", 401);
  const user = (await res.json()) as PublicUserProfile;

  const id = c.env.ROOM_SESSION.idFromName(roomId);
  const stub = c.env.ROOM_SESSION.get(id);

  const targetUrl = new URL(c.req.url);
  targetUrl.pathname = "/ws";
  targetUrl.searchParams.set("userId", user.id);
  targetUrl.searchParams.set("identifier", user.identifier);

  return stub.fetch(new Request(targetUrl.toString(), c.req.raw as any) as any) as any;
});

app.get("/room/:roomId", async (c) => {
  const user = await verifyAuthToken(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const id = c.env.ROOM_SESSION.idFromName(c.req.param("roomId"));
  const stub = c.env.ROOM_SESSION.get(id);
  const res = await stub.fetch(new Request("https://do/state", { method: "GET" }) as any);
  return new Response(res.body as any, { status: res.status, headers: res.headers as any });
});

export default app;
