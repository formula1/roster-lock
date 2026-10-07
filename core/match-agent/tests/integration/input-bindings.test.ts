import { describe, it, expect, afterEach } from "vitest";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { startTestServer, TestServer } from "./helpers/server";
import { makeTempFolder, cleanupFolder } from "./helpers/piece";

describe("input-bindings routes", () => {
  const cleanups: Array<() => Promise<void> | void> = [];
  afterEach(async () => {
    while (cleanups.length) await cleanups.pop()!();
  });

  async function setup(): Promise<{ server: TestServer, folder: string }> {
    const folder = await makeTempFolder();
    cleanups.push(() => cleanupFolder(folder));
    const server = await startTestServer(folder);
    cleanups.push(() => server.close());
    return { server, folder };
  }

  function auth(server: TestServer): HeadersInit {
    return { Authorization: `Bearer ${server.authCode}` };
  }

  it("GET returns the defaults before anything has been saved", async () => {
    const { server } = await setup();
    const res = await fetch(`${server.httpUrl}/v1/input-bindings`, { headers: auth(server) });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      keyboard: { select: "Enter", back: "Backspace", menu: " " },
      gamepad: { select: 0, back: 1, menu: 9 },
    });
  });

  it("PUT round-trips through GET", async () => {
    const { server } = await setup();
    const bindings = {
      keyboard: { select: "e", back: "q", menu: "Tab" },
      gamepad: { select: 2, back: 3, menu: 8 },
    };
    const putRes = await fetch(`${server.httpUrl}/v1/input-bindings`, {
      method: "PUT",
      headers: { ...auth(server), "Content-Type": "application/json" },
      body: JSON.stringify(bindings),
    });
    expect(putRes.status).toBe(200);

    const getRes = await fetch(`${server.httpUrl}/v1/input-bindings`, { headers: auth(server) });
    expect(await getRes.json()).toEqual(bindings);
  });

  it("PUT rejects a missing action", async () => {
    const { server } = await setup();
    const res = await fetch(`${server.httpUrl}/v1/input-bindings`, {
      method: "PUT",
      headers: { ...auth(server), "Content-Type": "application/json" },
      body: JSON.stringify({ keyboard: { select: "e", back: "q" }, gamepad: { select: 2, back: 3, menu: 8 } }),
    });
    expect(res.status).toBe(400);
  });

  it("PUT rejects unknown fields", async () => {
    const { server } = await setup();
    const res = await fetch(`${server.httpUrl}/v1/input-bindings`, {
      method: "PUT",
      headers: { ...auth(server), "Content-Type": "application/json" },
      body: JSON.stringify({
        keyboard: { select: "e", back: "q", menu: "Tab" }, gamepad: { select: 2, back: 3, menu: 8 }, extra: true,
      }),
    });
    expect(res.status).toBe(400);
  });

  // The whole point of storing this next to match-agent.json rather than in
  // browser localStorage (see docs/economics/machine-environments/
  // pieces-usb.md/cafe.md) is that it lives under the same portable root a
  // USB's --config-file points at - this checks it actually lands there as
  // its own sibling file, not somewhere disconnected from that root.
  it("persists as input-bindings.json next to the test server's config file", async () => {
    const { server, folder } = await setup();
    await fetch(`${server.httpUrl}/v1/input-bindings`, {
      method: "PUT",
      headers: { ...auth(server), "Content-Type": "application/json" },
      body: JSON.stringify({
        keyboard: { select: "e", back: "q", menu: "Tab" }, gamepad: { select: 2, back: 3, menu: 8 },
      }),
    });

    const onDisk = JSON.parse(await readFile(join(folder, "input-bindings.json"), "utf8"));
    expect(onDisk).toEqual({
      keyboard: { select: "e", back: "q", menu: "Tab" }, gamepad: { select: 2, back: 3, menu: 8 },
    });
  });
});
