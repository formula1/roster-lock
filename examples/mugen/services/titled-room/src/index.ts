import { Hono } from "hono";
import { cors } from "hono/cors";
import { Env, PublicUserProfile, RoomData } from "./types";
import { createRoomBodySchema, joinRoomBodySchema, leaveRoomBodySchema, startRoomBodySchema, destroyRoomBodySchema } from "./schema";
import { assertGameLauncherAllowed, assertGameConfigValid, gameCoordinatorFor, listAllowedGameLaunchers } from "./game-launchers";
import { upsertRoomIndex, deleteRoomIndex, listOpenRooms } from "./db";
export { RoomSession } from "./RoomSession";

const app = new Hono<{ Bindings: Env }>();

app.use('*', cors());

app.get("/health", (c) => c.json({ status: "ok", service: "titled-room" }));

// Which game-launcher plugin(s) this deployment allows - see
// game-launchers.ts, which just hardcodes ikemen-go now that this service
// lives at examples/mugen/services/titled-room instead of as a
// game-agnostic reference service.
app.get("/game-launchers", async (c) => {
  return c.json(await listAllowedGameLaunchers());
});

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
    await assertGameLauncherAllowed(body.gameLauncherPlugin, body.rosterConfig);
    await assertGameConfigValid(body.gameLauncherPlugin, body.gameConfig, body.rosterConfig);
    // Deployment-configured, not room-specific (see gameCoordinatorFor) - if
    // this is going to throw for this plugin, it'll throw the same way at
    // /start too, so catch a misconfigured deployment here instead of
    // letting a room reach "starting" and fail only once someone tries to
    // actually start it.
    await gameCoordinatorFor(c.env, body.gameLauncherPlugin);
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

app.post("/room/leave", async (c) => {
  const user = await verifyAuthToken(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  let body;
  try {
    body = leaveRoomBodySchema.parse(await c.req.json());
  } catch (err: any) {
    return c.json({ error: err.message }, 400);
  }

  const id = c.env.ROOM_SESSION.idFromName(body.roomId);
  const stub = c.env.ROOM_SESSION.get(id);

  const res = await stub.fetch(new Request("https://do/leave", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(user),
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
  // The DO deletes its own room once started (see RoomSession's /start), so
  // there's no state left to re-fetch here - drop it from the browse index
  // the same way /room/destroy does, rather than upserting a "started" row.
  // A failed start can also have deleted the room (see failRoom) even though
  // res.ok is false, so that's checked independently of the response status.
  if (res.ok || result.roomDeleted) await deleteRoomIndex(c.env.DB, body.roomId);
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

// Serve titled-room/client's built static assets for everything else -
// registered last so it never shadows the API routes above. Mirrors
// core/relay-server/cloudflare's CLIENT_ASSETS catch-all.
app.all("*", async (c) => {
  return c.env.CLIENT_ASSETS.fetch(c.req.raw as any) as any;
});

export default app;
