import { z, ZodType } from "zod";
import { HTTPRouter, jsonBody, HTTPRequest } from "../utils/http-router";
import { requireAuth } from "./admin";
import { matchmakersModel, roomStatsModel } from "../models";

export const matchmakerRouter = new HTTPRouter();

// Applies to every route below, mirroring relay-server-cf's router-wide
// `app.use(requireAuth)` - "{/*path}" (not "/") is the pattern match-agent's
// own router-wide middleware already uses to match every path including root.
matchmakerRouter.use("{/*path}", requireAuth);

function sendJSON(res: HTTPRequest["res"], statusCode: number, value: unknown) {
  res.writeHead(statusCode, { "Content-Type": "application/json" });
  res.end(JSON.stringify(value));
}

const matchmakerInfoCaster: ZodType<{ name: string, publicKey: string }> = z.object({
  name: z.string(),
  publicKey: z.string(),
}).strict();

// Create matchmaker
matchmakerRouter.post("/", async ({ req, res }, params, next) => {
  try {
    const body = await jsonBody(req);
    const casted = matchmakerInfoCaster.safeParse(body);
    if (!casted.success) return sendJSON(res, 400, { error: "Invalid body" });

    const matchmaker = await matchmakersModel.create(casted.data);
    return sendJSON(res, 201, { id: matchmaker.id, name: matchmaker.name, publicKey: matchmaker.publicKey });
  } catch (e) {
    next(e);
  }
});

// List all matchmakers
matchmakerRouter.get("/", async ({ res }, params, next) => {
  try {
    return sendJSON(res, 200, await matchmakersModel.list());
  } catch (e) {
    next(e);
  }
});

matchmakerRouter.get("/:id", async ({ res }, params, next) => {
  try {
    const matchmaker = await matchmakersModel.getById(params.params.id);
    if (!matchmaker) return sendJSON(res, 404, { error: "Not found" });
    return sendJSON(res, 200, matchmaker);
  } catch (e) {
    next(e);
  }
});

matchmakerRouter.put("/:id", async ({ req, res }, params, next) => {
  try {
    const body = await jsonBody(req);
    const casted = matchmakerInfoCaster.safeParse(body);
    if (!casted.success) return sendJSON(res, 400, { error: "Invalid body" });

    const updated = await matchmakersModel.update(params.params.id, casted.data);
    if (!updated) return sendJSON(res, 404, { error: "No matchmaker found" });
    return sendJSON(res, 200, { success: true });
  } catch (e) {
    next(e);
  }
});

matchmakerRouter.put("/:id/suspend", async ({ res }, params, next) => {
  try {
    const updated = await matchmakersModel.setStatus(params.params.id, "suspended");
    if (!updated) return sendJSON(res, 404, { error: "No matchmaker found" });
    res.writeHead(204);
    return res.end();
  } catch (e) {
    next(e);
  }
});

matchmakerRouter.put("/:id/activate", async ({ res }, params, next) => {
  try {
    const updated = await matchmakersModel.setStatus(params.params.id, "active");
    if (!updated) return sendJSON(res, 404, { error: "No matchmaker found" });
    res.writeHead(204);
    return res.end();
  } catch (e) {
    next(e);
  }
});

// Get matchmaker statistics
matchmakerRouter.get("/:id/stats", async ({ res }, params, next) => {
  try {
    const rooms = await roomStatsModel.listByMatchmaker(params.params.id);
    const lifetimes = rooms
      .filter(room => room.finishedAt)
      .map(room => (new Date(room.finishedAt as string).getTime() - new Date(room.createdAt).getTime()) / 1000);

    return sendJSON(res, 200, {
      total_rooms: rooms.length,
      active_rooms: rooms.filter(room => room.status === "active").length,
      successful_rooms: rooms.filter(room => room.status === "completed").length,
      failed_rooms: rooms.filter(room => room.status === "failed").length,
      avg_lifetime_seconds: lifetimes.length
        ? lifetimes.reduce((sum, seconds) => sum + seconds, 0) / lifetimes.length
        : null,
    });
  } catch (e) {
    next(e);
  }
});
