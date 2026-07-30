import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { startTestServer, TestServer, errorBody } from "./helpers/server";
import { makeTempFolder, cleanupFolder } from "./helpers/piece";

describe("GET /", () => {
  let server: TestServer;
  let folder: string;
  beforeAll(async () => { folder = await makeTempFolder(); server = await startTestServer(folder); });
  afterAll(async () => { await server.close(); await cleanupFolder(folder); });

  it("responds with hello world and requires no auth", async () => {
    const res = await fetch(`${server.httpUrl}/`);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ hello: "world" });
  });
});

describe("POST /validate-authcode", () => {
  let server: TestServer;
  let folder: string;
  beforeAll(async () => { folder = await makeTempFolder(); server = await startTestServer(folder); });
  afterAll(async () => { await server.close(); await cleanupFolder(folder); });

  it("returns true for the real auth code, no auth header required", async () => {
    const res = await fetch(`${server.httpUrl}/validate-authcode`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ authCode: server.authCode }),
    });
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toBe(true);
  });

  it("returns false for a wrong auth code", async () => {
    const res = await fetch(`${server.httpUrl}/validate-authcode`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ authCode: "not-the-real-code" }),
    });
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toBe(false);
  });

  it("400s on a malformed body", async () => {
    const res = await fetch(`${server.httpUrl}/validate-authcode`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notAuthCode: 123 }),
    });
    expect(res.status).toBe(400);
    expect((await errorBody(res)).error).toBe("Bad body");
  });
});

describe("/v1 auth gate", () => {
  let server: TestServer;
  let folder: string;
  beforeAll(async () => { folder = await makeTempFolder(); server = await startTestServer(folder); });
  afterAll(async () => { await server.close(); await cleanupFolder(folder); });

  const v1Url = () => `${server.httpUrl}/v1/piece/asset-files`;

  it("401s with no auth provided", async () => {
    const res = await fetch(v1Url(), { method: "POST", body: "{}" });
    expect(res.status).toBe(401);
    expect((await errorBody(res)).error).toBe("User Required");
  });

  it("401s with a wrong Authorization header", async () => {
    const res = await fetch(v1Url(), {
      method: "POST",
      headers: { Authorization: "Bearer wrong-code" },
      body: "{}",
    });
    expect(res.status).toBe(401);
    expect((await errorBody(res)).error).toBe("Invalid User");
  });

  it("401s with a wrong ?authorization= query param", async () => {
    const res = await fetch(`${v1Url()}?authorization=wrong-code`, { method: "POST", body: "{}" });
    expect(res.status).toBe(401);
    expect((await errorBody(res)).error).toBe("Invalid User");
  });

  it("passes through with a correct Authorization header (reaches the route, fails its own validation instead)", async () => {
    const res = await fetch(v1Url(), {
      method: "POST",
      headers: { Authorization: `Bearer ${server.authCode}` },
      body: "{}",
    });
    expect(res.status).toBe(400);
    expect((await errorBody(res)).error).toBe("Bad Form");
  });

  it("passes through with a correct ?authorization= query param", async () => {
    const res = await fetch(`${v1Url()}?authorization=${server.authCode}`, { method: "POST", body: "{}" });
    expect(res.status).toBe(400);
    expect((await errorBody(res)).error).toBe("Bad Form");
  });
});
