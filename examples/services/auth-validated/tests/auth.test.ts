import { describe, it, expect } from "vitest";
import type { KVNamespace, D1Database } from "@cloudflare/workers-types";
import app from "../src/index";
import { Env } from "../src/types";

// A minimal in-memory KV good enough for the store.ts functions this service
// actually calls (get/put) - no real Workers runtime (miniflare/wrangler) is
// wired up for this package yet, so this is the cheapest way to exercise the
// Hono app's routes end to end without one.
class FakeKV {
  private store = new Map<string, string>();
  async get(key: string): Promise<string | null> {
    return this.store.get(key) ?? null;
  }
  async put(key: string, value: string): Promise<void> {
    this.store.set(key, value);
  }
}

function makeEnv(): Env {
  return {
    USER_STORE: new FakeKV() as unknown as KVNamespace,
    DB: undefined as unknown as D1Database,
    JWT_SECRET: "test-secret",
  };
}

async function registerAndLogin(env: Env, email: string, password: string): Promise<string> {
  const registerRes = await app.request("/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  }, env);
  expect(registerRes.status).toBe(200);

  // requestToken() persists the validation token into USER_STORE keyed by
  // email - read it straight back out rather than re-deriving/mocking email
  // delivery, which this service doesn't test.
  const stored = JSON.parse((await (env.USER_STORE as unknown as FakeKV).get(`user:${email}`))!);

  const validateRes = await app.request("/auth/validate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, token: stored.validationToken, password }),
  }, env);
  expect(validateRes.status).toBe(200);
  expect((await validateRes.json() as { success: boolean }).success).toBe(true);

  const loginRes = await app.request("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  }, env);
  expect(loginRes.status).toBe(200);
  const { token } = await loginRes.json() as { token: string };
  return token;
}

describe("playerCount / set-players", () => {
  it("GET /auth/verify defaults playerCount to 1 when never set", async () => {
    const env = makeEnv();
    const token = await registerAndLogin(env, "solo@example.com", "Password1");

    const res = await app.request("/auth/verify", { headers: { Authorization: `Bearer ${token}` } }, env);
    expect(res.status).toBe(200);
    expect((await res.json() as { playerCount: number }).playerCount).toBe(1);
  });

  it("POST /auth/set-players updates the count and /auth/verify reflects it", async () => {
    const env = makeEnv();
    const token = await registerAndLogin(env, "co-op@example.com", "Password1");

    const setRes = await app.request("/auth/set-players", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ playerCount: 3 }),
    }, env);
    expect(setRes.status).toBe(200);

    const verifyRes = await app.request("/auth/verify", { headers: { Authorization: `Bearer ${token}` } }, env);
    expect((await verifyRes.json() as { playerCount: number }).playerCount).toBe(3);
  });

  it("POST /auth/set-players rejects a count below 1", async () => {
    const env = makeEnv();
    const token = await registerAndLogin(env, "zero@example.com", "Password1");

    const res = await app.request("/auth/set-players", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ playerCount: 0 }),
    }, env);
    expect(res.status).toBe(400);
  });

  it("POST /auth/set-players requires auth", async () => {
    const env = makeEnv();
    const res = await app.request("/auth/set-players", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerCount: 2 }),
    }, env);
    expect(res.status).toBe(401);
  });
});
