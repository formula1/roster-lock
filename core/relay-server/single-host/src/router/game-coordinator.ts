import { z, ZodType } from "zod";
import { HTTPRouter, jsonBody, HTTPRequest } from "../utils/http-router";
import { requireAuth } from "./admin";
import { ENCRYPTION } from "@roster-lock/utils";
import { gameCoordinatorsModel, GameCoordinator } from "../models";
import { getGameCoordinatorEncryptionKey } from "../globals";

export const gameCoordinatorRouter = new HTTPRouter();

// Applies to every route below, mirroring relay-server-cf's router-wide
// `app.use(requireAuth)`.
gameCoordinatorRouter.use("{/*path}", requireAuth);

function sendJSON(res: HTTPRequest["res"], statusCode: number, value: unknown) {
  res.writeHead(statusCode, { "Content-Type": "application/json" });
  res.end(JSON.stringify(value));
}

function validAPIKey(apiKey: string) {
  if (apiKey.length < 32) return false;
  if (!/^[A-Za-z0-9+/=]+$/.test(apiKey)) return false;
  return true;
}

function toApiKeyPreview(apiKey: string) {
  return `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}`;
}

const gameCoordinatorCreateCaster: ZodType<{
  id: string,
  name: string,
  successWebhookUrl: string,
  failureWebhookUrl: string,
  apiKey: string,
}> = z.object({
  id: z.string(),
  name: z.string(),
  successWebhookUrl: z.url(),
  failureWebhookUrl: z.url(),
  apiKey: z.string().refine(validAPIKey),
}).strict();

gameCoordinatorRouter.post("/", async ({ req, res }, params, next) => {
  try {
    const body = await jsonBody(req);
    const casted = gameCoordinatorCreateCaster.safeParse(body);
    if (!casted.success) return sendJSON(res, 400, { error: "Invalid body" });

    const { id, name, successWebhookUrl, failureWebhookUrl, apiKey } = casted.data;
    const apiKeyEncrypted = await ENCRYPTION.SYMMETRIC.encryptValue(getGameCoordinatorEncryptionKey(), apiKey);

    const coordinator = await gameCoordinatorsModel.create({
      id, name, successWebhookUrl, failureWebhookUrl,
      apiKeyEncrypted, apiKeyPreview: toApiKeyPreview(apiKey),
    });
    return sendJSON(res, 201, { id: coordinator.id, name: coordinator.name });
  } catch (e) {
    next(e);
  }
});

gameCoordinatorRouter.get("/", async ({ res }, params, next) => {
  try {
    return sendJSON(res, 200, await gameCoordinatorsModel.list());
  } catch (e) {
    next(e);
  }
});

gameCoordinatorRouter.get("/:id", async ({ res }, params, next) => {
  try {
    const coordinator = await gameCoordinatorsModel.getById(params.params.id);
    if (!coordinator) return sendJSON(res, 404, { error: "Not found" });
    return sendJSON(res, 200, coordinator);
  } catch (e) {
    next(e);
  }
});

const gameCoordinatorUpdateCaster: ZodType<Partial<{
  name: string,
  successWebhookUrl: string,
  failureWebhookUrl: string,
  apiKey: string,
}>> = z.object({
  name: z.string().optional(),
  successWebhookUrl: z.url().optional(),
  failureWebhookUrl: z.url().optional(),
  apiKey: z.string().refine(validAPIKey).optional(),
}).strict();

gameCoordinatorRouter.put("/:id", async ({ req, res }, params, next) => {
  try {
    const id = params.params.id;
    const body = await jsonBody(req);
    const casted = gameCoordinatorUpdateCaster.safeParse(body);
    if (!casted.success) return sendJSON(res, 400, { error: "Invalid body" });

    const existing = await gameCoordinatorsModel.getById(id);
    if (!existing) return sendJSON(res, 404, { error: "Not found" });

    const update: Partial<Pick<GameCoordinator,
      "name" | "successWebhookUrl" | "failureWebhookUrl" | "apiKeyEncrypted" | "apiKeyPreview"
    >> = {
      name: casted.data.name,
      successWebhookUrl: casted.data.successWebhookUrl,
      failureWebhookUrl: casted.data.failureWebhookUrl,
    };
    if (typeof casted.data.apiKey !== "undefined") {
      const apiKey = casted.data.apiKey;
      update.apiKeyEncrypted = await ENCRYPTION.SYMMETRIC.encryptValue(getGameCoordinatorEncryptionKey(), apiKey);
      update.apiKeyPreview = toApiKeyPreview(apiKey);
    }

    const updated = await gameCoordinatorsModel.update(id, update);
    if (!updated) return sendJSON(res, 404, { error: "No matchmaker found" });
    return sendJSON(res, 200, { success: true });
  } catch (e) {
    next(e);
  }
});

gameCoordinatorRouter.put("/:id/suspend", async ({ res }, params, next) => {
  try {
    const updated = await gameCoordinatorsModel.setStatus(params.params.id, "suspended");
    if (!updated) return sendJSON(res, 404, { error: "No matchmaker found" });
    res.writeHead(204);
    return res.end();
  } catch (e) {
    next(e);
  }
});

gameCoordinatorRouter.put("/:id/activate", async ({ res }, params, next) => {
  try {
    const updated = await gameCoordinatorsModel.setStatus(params.params.id, "active");
    if (!updated) return sendJSON(res, 404, { error: "No matchmaker found" });
    res.writeHead(204);
    return res.end();
  } catch (e) {
    next(e);
  }
});
