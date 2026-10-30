import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { once } from "node:events";
import { WebSocket } from "ws";
import { MessageBridge } from "@roster-lock/utils";
import { startTestServer, TestServer, errorBody } from "./helpers/server";
import { makeTempFolder, cleanupFolder } from "./helpers/piece";

describe("POST /v1/sync-dl", () => {
  let server: TestServer;
  let folder: string;
  beforeAll(async () => { folder = await makeTempFolder(); server = await startTestServer(folder); });
  afterAll(async () => { await server.close(); await cleanupFolder(folder); });

  it("500s on a malformed body (castRoomRequest throws a plain Error)", async () => {
    const res = await fetch(`${server.httpUrl}/v1/sync-dl`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${server.authCode}`,
      },
      body: JSON.stringify({ not: "a valid room request" }),
    });
    expect(res.status).toBe(500);
    expect((await errorBody(res)).error).toBe("Invalid request");
  });
});

describe("WS /v1/sync-dl", () => {
  let server: TestServer;
  let folder: string;
  beforeAll(async () => { folder = await makeTempFolder(); server = await startTestServer(folder); });
  afterAll(async () => { await server.close(); await cleanupFolder(folder); });

  it("terminates the connection with no auth, without ever sending a ready event", async () => {
    const ws = new WebSocket(`${server.wsUrl}/v1/sync-dl`);
    let receivedMessage = false;
    ws.on("message", () => { receivedMessage = true; });
    ws.on("error", () => {}); // abrupt terminate() can surface as ECONNRESET - not the point of this test

    await once(ws, "close");
    expect(receivedMessage).toBe(false);
  });

  it("sends a ready event once authenticated, and rejects an invalid connect-to-relay request", async () => {
    const ws = new WebSocket(`${server.wsUrl}/v1/sync-dl`, {
      headers: { Authorization: `Bearer ${server.authCode}` },
    });
    try {
      const bridge = new MessageBridge((message) => ws.send(JSON.stringify(message)));
      const readyPromise = new Promise<void>((resolve) => bridge.onEvent("ready", () => resolve()));
      ws.on("message", (data) => bridge.handleMessage(JSON.parse(data.toString())));

      await once(ws, "open");
      await readyPromise;

      await expect(bridge.sendRequest("connect-to-relay", { not: "a valid room request" }))
        .rejects.toThrow("Invalid request");
    } finally {
      ws.close();
    }
  });
});
