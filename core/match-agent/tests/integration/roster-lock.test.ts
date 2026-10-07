import { describe, it, expect, afterEach } from "vitest";
import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { startTestServer, TestServer } from "./helpers/server";
import { makeTempFolder, cleanupFolder, makeEngine } from "./helpers/piece";

// pickRosterLockFile isn't covered here - it spawns a real native OS
// dialog (zenity/kdialog/osascript/powershell), same as
// game-launcher/settings.ts's pickGameLauncherBinaryLocation, which has no
// test of its own for the same reason.
describe("GET /util/file-system/roster-lock", () => {
  const cleanups: Array<() => Promise<void> | void> = [];
  afterEach(async () => {
    while (cleanups.length) await cleanups.pop()!();
  });

  async function setup(): Promise<{ server: TestServer, rosterLockFolder: string }> {
    const folder = await makeTempFolder();
    cleanups.push(() => cleanupFolder(folder));
    const server = await startTestServer(folder);
    cleanups.push(() => server.close());
    return { server, rosterLockFolder: server.rosterLockFolder };
  }

  function auth(server: TestServer): HeadersInit {
    return { Authorization: `Bearer ${server.authCode}` };
  }

  it("400s when path is missing", async () => {
    const { server } = await setup();
    const res = await fetch(`${server.httpUrl}/util/file-system/roster-lock`, { headers: auth(server) });
    expect(res.status).toBe(400);
  });

  // The actual fix for this feature's exposure - see
  // src/util-routers/file-system/resolve-within-root.ts.
  it("403s for a path outside the configured roster-lock folder", async () => {
    const { server } = await setup();
    const res = await fetch(
      `${server.httpUrl}/util/file-system/roster-lock?path=${encodeURIComponent("/etc/passwd")}`, { headers: auth(server) }
    );
    expect(res.status).toBe(403);
  });

  it("404s for a path that doesn't exist, within the root", async () => {
    const { server, rosterLockFolder } = await setup();
    const path = join(rosterLockFolder, "nope.roster-lock.json");
    const res = await fetch(`${server.httpUrl}/util/file-system/roster-lock?path=${encodeURIComponent(path)}`, { headers: auth(server) });
    expect(res.status).toBe(404);
  });

  it("400s when the file isn't valid JSON", async () => {
    const { server, rosterLockFolder } = await setup();
    const path = join(rosterLockFolder, "garbage.roster-lock.json");
    await writeFile(path, "not json");
    const res = await fetch(`${server.httpUrl}/util/file-system/roster-lock?path=${encodeURIComponent(path)}`, { headers: auth(server) });
    expect(res.status).toBe(400);
  });

  it("400s when the JSON doesn't look like a roster-lock config", async () => {
    const { server, rosterLockFolder } = await setup();
    const path = join(rosterLockFolder, "unrelated.json");
    await writeFile(path, JSON.stringify({ hello: "world" }));
    const res = await fetch(`${server.httpUrl}/util/file-system/roster-lock?path=${encodeURIComponent(path)}`, { headers: auth(server) });
    expect(res.status).toBe(400);
  });

  it("reads and returns a valid roster-lock config", async () => {
    const { server, rosterLockFolder } = await setup();
    const config = { version: 1, engine: makeEngine(), rosters: { character: [] } };
    const path = join(rosterLockFolder, "fixture.roster-lock.json");
    await writeFile(path, JSON.stringify(config));

    const res = await fetch(`${server.httpUrl}/util/file-system/roster-lock?path=${encodeURIComponent(path)}`, { headers: auth(server) });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(config);
  });

  it("400s when path points at a directory", async () => {
    const { server, rosterLockFolder } = await setup();
    const dirPath = join(rosterLockFolder, "a-directory");
    await mkdir(dirPath);
    const res = await fetch(`${server.httpUrl}/util/file-system/roster-lock?path=${encodeURIComponent(dirPath)}`, { headers: auth(server) });
    expect(res.status).toBe(400);
  });
});
