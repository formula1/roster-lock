import { Hono } from "hono";
import { Env } from "../types";
import { GameCoordinatorRow } from "../schema/types";

import { requireAuth } from "./admins";
import { ENCRYPTION } from "@roster-lock/utils";

type SymmetricEncryptionKey = Parameters<typeof ENCRYPTION.SYMMETRIC.encryptValue>[0];

export const app = new Hono<{ Bindings: Env }>();

app.use(requireAuth);

import { z, ZodType } from "zod";
const gameCoordinatorCreateCaster: ZodType<{
  id: string,
  name: string,
  success_webhook_url: string,
  failure_webhook_url: string,
  api_key: string,
}> = z.object({
  id: z.string(),
  name: z.string(),
  success_webhook_url: z.url(),
  failure_webhook_url: z.url(),
  api_key: z.string().refine(validAPIKey),
}).strict();

app.post("/", async (c) => {
  const uncastedBody = await c.req.json();
  const casted = gameCoordinatorCreateCaster.safeParse(uncastedBody);
  if(!casted.success){
    return c.json({ error: "Invalid body" }, 400);
  }
  const { id, name, success_webhook_url, failure_webhook_url, api_key } = casted.data;

  const encryptedApiKey = await ENCRYPTION.SYMMETRIC.encryptValue(
    c.env.GAME_COORDINATOR_ENCRYPTION_KEY as SymmetricEncryptionKey,
    api_key
  );

  const api_key_preview = `${api_key.slice(0, 4)}...${api_key.slice(-4)}`;

  await c.env.DB.prepare(`
    INSERT INTO game_coordinators (
      id, name,
      success_webhook_url, failure_webhook_url,
      api_key_encrypted, api_key_preview,
      registered_at
    )
    VALUES (
      ?, ?,
      ?, ?,
      ?, ?,
      ?
    )
  `).bind(
    id, name,
    success_webhook_url, failure_webhook_url,
    encryptedApiKey, api_key_preview,
    new Date().toISOString()
  ).run();

  return c.json({ id, name }, 201);
});

app.get("/", async (c) => {
  const result = await c.env.DB.prepare(
    "SELECT * FROM game_coordinators"
  ).bind().all();
  
  return c.json(result.results);
});


app.get("/:id", async (c) => {
  const id = c.req.param("id");
  
  const doc = await c.env.DB.prepare(
    "SELECT * FROM game_coordinators WHERE id = ?"
  ).bind(id).first();

  if(doc === null){
    return c.json({ error: "Not found" }, 404);
  }

  return c.json(doc);
});

const gameCoordinatorUpdateCaster: ZodType<Partial<{
  name: string,
  success_webhook_url: string,
  failure_webhook_url: string,
  api_key: string,
}>> = z.object({
  name: z.string().optional(),
  success_webhook_url: z.url().optional(),
  failure_webhook_url: z.url().optional(),
  api_key: z.string().refine(validAPIKey).optional(),
}).strict();

app.put("/:id", async (c) => {
  // TODO: Add admin auth middleware
  const id = c.req.param("id");
  const uncastedBody = await c.req.json();
  const casted = gameCoordinatorUpdateCaster.safeParse(uncastedBody);
  if(!casted.success){
    return c.json({ error: "Invalid body" }, 400);
  }
  const oldValue: GameCoordinatorRow | null = await c.env.DB.prepare(
    "SELECT * FROM game_coordinators WHERE id = ?"
  ).bind(id).first();
  if(oldValue === null){
    return c.json({ error: "Not found" }, 404);
  }

  const newValues = { ...oldValue, ...casted.data };
  if(typeof casted.data.api_key !== "undefined"){
    const api_key= casted.data.api_key;
    const encryptedApiKey = await ENCRYPTION.SYMMETRIC.encryptValue(
      c.env.GAME_COORDINATOR_ENCRYPTION_KEY as SymmetricEncryptionKey,
      api_key
    );

    const api_key_preview = `${api_key.slice(0, 4)}...${api_key.slice(-4)}`;

    newValues.api_key_encrypted = encryptedApiKey;
    newValues.api_key_preview = api_key_preview;
  }

  const result = await c.env.DB.prepare(`
    UPDATE game_coordinators SET
    name = ?,
    success_webhook_url = ?, failure_webhook_url = ?,
    api_key_encrypted, api_key_preview,
    WHERE id = ?
  `).bind(
    newValues.name,
    newValues.success_webhook_url, newValues.failure_webhook_url,
    newValues.api_key_encrypted, newValues.api_key_preview,
    id
  ).run();

  if(!result.meta.changes){
    return c.json({ error: "No matchmaker found" }, 404);
  }

  return c.json({ success: true });
});

app.put("/:id/suspend", async (c) => {
  // TODO: Add admin auth middleware
  const id = c.req.param("id");
  
  const result = await c.env.DB.prepare(
    "UPDATE game_coordinators SET status = ? WHERE id = ?"
  ).bind("suspended", id).run();

  if(!result.meta.changes){
    return c.json({ error: "No matchmaker found" }, 404);
  }

  return c.body(null, 204);
});

app.put("/:id/activate", async (c) => {
  const id = c.req.param("id");
  
  const result = await c.env.DB.prepare(
    "UPDATE game_coordinators SET status = ? WHERE id = ?"
  ).bind("active", id).run();

  if(!result.meta.changes){
    return c.json({ error: "No matchmaker found" }, 404);
  }

  return c.body(null, 204);
});


function validAPIKey(apiKey: string){
  if(apiKey.length < 32) return false;
  if(!/^[A-Za-z0-9+/=]+$/.test(apiKey)) return false;
  return true;
}
