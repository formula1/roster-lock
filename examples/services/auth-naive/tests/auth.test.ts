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

async function registerAndLogin(env: Env, username: string, password: string): Promise<string> {
  const registerRes = await app.request("/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  }, env);
  expect(registerRes.status).toBe(200);

  const loginRes = await app.request("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  }, env);
  expect(loginRes.status).toBe(200);
  const { token } = await loginRes.json() as { token: string };
  return token;
}

describe("register / login (no email verification)", () => {
  it("registers and logs in immediately, no validation step", async () => {
    const env = makeEnv();
    const token = await registerAndLogin(env, "player-one", "Password1");
    expect(typeof token).toBe("string");
  });

  it("rejects a duplicate username", async () => {
    const env = makeEnv();
    await registerAndLogin(env, "dupe", "Password1");

    const res = await app.request("/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "dupe", password: "Password2" }),
    }, env);
    expect(res.status).toBe(400);
  });

  it("rejects login with the wrong password", async () => {
    const env = makeEnv();
    await registerAndLogin(env, "wrongpass", "Password1");

    const res = await app.request("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "wrongpass", password: "NotIt1" }),
    }, env);
    expect(res.status).toBe(401);
  });
});

describe("GET /auth/verify", () => {
  it("returns identifier=username and no validated field", async () => {
    const env = makeEnv();
    const token = await registerAndLogin(env, "verify-me", "Password1");

    const res = await app.request("/auth/verify", { headers: { Authorization: `Bearer ${token}` } }, env);
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body.identifier).toBe("verify-me");
    expect(body.validated).toBeUndefined();
    expect(body.playerCount).toBe(1);
  });
});

describe("playerCount / set-players", () => {
  it("POST /auth/set-players updates the count and /auth/verify reflects it", async () => {
    const env = makeEnv();
    const token = await registerAndLogin(env, "co-op", "Password1");

    const setRes = await app.request("/auth/set-players", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ playerCount: 3 }),
    }, env);
    expect(setRes.status).toBe(200);

    const verifyRes = await app.request("/auth/verify", { headers: { Authorization: `Bearer ${token}` } }, env);
    expect((await verifyRes.json() as { playerCount: number }).playerCount).toBe(3);
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
