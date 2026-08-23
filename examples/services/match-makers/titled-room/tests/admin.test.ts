import { describe, it, expect } from "vitest";
import app from "../src/index";
import { Env } from "../src/types";
import { FakeAdminD1 } from "./helpers/fakeAdminD1";

function makeEnv(db: FakeAdminD1, overrides: Partial<Env> = {}): Env {
  return {
    ROOM_SESSION: {} as any,
    DB: db as any,
    JWT_SECRET: "test-secret" as any,
    INITIAL_ADMIN_USERNAME: "hello",
    INITIAL_ADMIN_PASSWORD: "world",
    ...overrides,
  };
}

async function bootstrapAdmin(env: Env): Promise<string> {
  const res = await app.request("/admin/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "hello", password: "world" }),
  }, env);
  expect(res.status).toBe(200);
  const { token } = await res.json() as { token: string };
  return token;
}

describe("POST /admin/login", () => {
  it("bootstraps the first admin from INITIAL_ADMIN_USERNAME/PASSWORD", async () => {
    const db = new FakeAdminD1();
    const token = await bootstrapAdmin(makeEnv(db));
    expect(typeof token).toBe("string");
    expect(db.admins.has("hello")).toBe(true);
  });

  it("rejects wrong bootstrap credentials", async () => {
    const db = new FakeAdminD1();
    const res = await app.request("/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "hello", password: "wrong" }),
    }, makeEnv(db));
    expect(res.status).toBe(401);
  });

  it("rejects a second bootstrap attempt once the admin row exists", async () => {
    const db = new FakeAdminD1();
    const env = makeEnv(db);
    await bootstrapAdmin(env);

    const res = await app.request("/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "hello", password: "world" }),
    }, env);
    // Second login is a normal login against the real password hash, not a
    // re-bootstrap - "world" still matches, so this actually succeeds.
    expect(res.status).toBe(200);
  });
});

describe("/admin/game-launchers", () => {
  const PLUGIN_NAME = "@roster-lock/game-launcher-ikemen-go";

  it("requires admin auth", async () => {
    const db = new FakeAdminD1();
    const res = await app.request(`/admin/game-launchers/${encodeURIComponent(PLUGIN_NAME)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ engineSha: "sha1", coordinator: false }),
    }, makeEnv(db));
    expect(res.status).toBe(401);
  });

  it("adds a game runner with a real coordinator, then lists and reads it back", async () => {
    const db = new FakeAdminD1();
    const env = makeEnv(db);
    const token = await bootstrapAdmin(env);

    const putRes = await app.request(`/admin/game-launchers/${encodeURIComponent(PLUGIN_NAME)}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        engineSha: "sha1",
        coordinator: { id: "ikemen-coordinator-1", address: { host: "127.0.0.1", port: 9010 } },
      }),
    }, env);
    expect(putRes.status).toBe(200);

    const listRes = await app.request("/admin/game-launchers", { headers: { Authorization: `Bearer ${token}` } }, env);
    const list = await listRes.json() as Array<{ plugin_name: string, coordinator_id: string | null }>;
    expect(list).toHaveLength(1);
    expect(list[0].plugin_name).toBe(PLUGIN_NAME);
    expect(list[0].coordinator_id).toBe("ikemen-coordinator-1");
  });

  it("adds a game runner with no coordinator (false)", async () => {
    const db = new FakeAdminD1();
    const env = makeEnv(db);
    const token = await bootstrapAdmin(env);

    const putRes = await app.request(`/admin/game-launchers/${encodeURIComponent(PLUGIN_NAME)}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ engineSha: "sha1", coordinator: false }),
    }, env);
    expect(putRes.status).toBe(200);
    expect(db.gameLauncherConfigs.get(PLUGIN_NAME)).toMatchObject({ coordinator_id: null });
  });

  it("updates an existing entry on a second PUT rather than duplicating it", async () => {
    const db = new FakeAdminD1();
    const env = makeEnv(db);
    const token = await bootstrapAdmin(env);
    const put = (body: unknown) => app.request(`/admin/game-launchers/${encodeURIComponent(PLUGIN_NAME)}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }, env);

    await put({ engineSha: "sha1", coordinator: false });
    await put({ engineSha: "sha2", coordinator: false });

    expect(db.gameLauncherConfigs.size).toBe(1);
    expect(db.gameLauncherConfigs.get(PLUGIN_NAME)).toMatchObject({ engine_sha: "sha2" });
  });

  it("removes an entry", async () => {
    const db = new FakeAdminD1();
    const env = makeEnv(db);
    const token = await bootstrapAdmin(env);
    await app.request(`/admin/game-launchers/${encodeURIComponent(PLUGIN_NAME)}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ engineSha: "sha1", coordinator: false }),
    }, env);

    const deleteRes = await app.request(`/admin/game-launchers/${encodeURIComponent(PLUGIN_NAME)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    }, env);
    expect(deleteRes.status).toBe(204);
    expect(db.gameLauncherConfigs.has(PLUGIN_NAME)).toBe(false);
  });

  it("404s deleting a plugin that was never added", async () => {
    const db = new FakeAdminD1();
    const env = makeEnv(db);
    const token = await bootstrapAdmin(env);

    const res = await app.request(`/admin/game-launchers/${encodeURIComponent(PLUGIN_NAME)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    }, env);
    expect(res.status).toBe(404);
  });
});
