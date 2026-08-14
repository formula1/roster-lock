import { Hono } from "hono";
import { z, ZodType } from "zod";
import { Env } from "../types";
import { requireAdminAuth } from "./index";

export const app = new Hono<{ Bindings: Env }>();
app.use(requireAdminAuth);

// `coordinator` is `false` for a plugin that deliberately needs no
// coordinator (see game-runners.ts's gameCoordinatorFor), or its real id +
// the address a client should dial once the room starts.
type UpsertGameRunnerBody = {
  engineSha: string,
  coordinator: false | { id: string, address: { host: string, port: number } },
};
const upsertGameRunnerCaster: ZodType<UpsertGameRunnerBody> = z.object({
  engineSha: z.string().min(1),
  coordinator: z.union([
    z.literal(false),
    z.object({
      id: z.string().min(1),
      address: z.object({ host: z.string().min(1), port: z.number().int().min(1) }).strict(),
    }).strict(),
  ]),
}).strict();

// PUT /admin/game-runners/:pluginName - add or update an allowed game-runner
// plugin. pluginName is the npm package name (e.g.
// "@roster-lock/game-runner-ikemen-go") - see AvailableGameRunner.pluginName
// in core/plugin-runtime.
app.put("/:pluginName", async (c) => {
  const pluginName = c.req.param("pluginName");
  const uncastedBody = await c.req.json();
  const casted = upsertGameRunnerCaster.safeParse(uncastedBody);
  if (!casted.success) {
    return c.json({ error: "Invalid body" }, 400);
  }
  const { engineSha, coordinator } = casted.data;

  await c.env.DB.prepare(`
    INSERT INTO game_runner_configs (plugin_name, engine_sha, coordinator_id, coordinator_host, coordinator_port, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(plugin_name) DO UPDATE SET
      engine_sha = excluded.engine_sha,
      coordinator_id = excluded.coordinator_id,
      coordinator_host = excluded.coordinator_host,
      coordinator_port = excluded.coordinator_port,
      updated_at = excluded.updated_at
  `).bind(
    pluginName,
    engineSha,
    coordinator === false ? null : coordinator.id,
    coordinator === false ? null : coordinator.address.host,
    coordinator === false ? null : coordinator.address.port,
    new Date().toISOString(),
  ).run();

  return c.json({ pluginName, engineSha, coordinator });
});

app.get("/", async (c) => {
  const result = await c.env.DB.prepare("SELECT * FROM game_runner_configs").all();
  return c.json(result.results);
});

app.delete("/:pluginName", async (c) => {
  const pluginName = c.req.param("pluginName");
  const result = await c.env.DB.prepare(
    "DELETE FROM game_runner_configs WHERE plugin_name = ?"
  ).bind(pluginName).run();

  if (!result.meta.changes) {
    return c.json({ error: "No game runner config found" }, 404);
  }
  return c.body(null, 204);
});
