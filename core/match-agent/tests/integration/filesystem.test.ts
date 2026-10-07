import { describe, it, expect, afterEach } from "vitest";
import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { startTestServer, TestServer } from "./helpers/server";
import { makeTempFolder, cleanupFolder } from "./helpers/piece";

describe("GET /util/file-system/list", () => {
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

  async function seedFolder(folder: string) {
    await mkdir(join(folder, "sub-folder"));
    await mkdir(join(folder, ".hidden-folder"));
    await writeFile(join(folder, "a.roster-lock.json"), "{}");
    await writeFile(join(folder, "z.roster-lock.json"), "{}");
    await writeFile(join(folder, "notes.txt"), "hello");
    await writeFile(join(folder, ".hidden-file"), "secret");
  }

  it("lists directories first, then matching files, excluding dotfiles", async () => {
    const { server, rosterLockFolder } = await setup();
    await seedFolder(rosterLockFolder);

    const res = await fetch(
      `${server.httpUrl}/util/file-system/list?path=${encodeURIComponent(rosterLockFolder)}&extension=${encodeURIComponent(".roster-lock.json")}`,
      { headers: auth(server) }
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.path).toBe(rosterLockFolder);
    expect(body.entries.map((e: { name: string }) => e.name)).toEqual([
      "sub-folder", "a.roster-lock.json", "z.roster-lock.json",
    ]);
    expect(body.entries.find((e: { name: string }) => e.name === "sub-folder").isDirectory).toBe(true);
    expect(body.entries.find((e: { name: string }) => e.name === "a.roster-lock.json").isDirectory).toBe(false);
  });

  it("includes all directories regardless of the extension filter, so navigation is never blocked", async () => {
    const { server, rosterLockFolder } = await setup();
    await mkdir(join(rosterLockFolder, "empty-folder"));
    const res = await fetch(
      `${server.httpUrl}/util/file-system/list?path=${encodeURIComponent(rosterLockFolder)}&extension=${encodeURIComponent(".roster-lock.json")}`,
      { headers: auth(server) }
    );
    const body = await res.json();
    expect(body.entries.map((e: { name: string }) => e.name)).toContain("empty-folder");
  });

  it("defaults to the configured root when no path is given", async () => {
    const { server, rosterLockFolder } = await setup();
    const res = await fetch(`${server.httpUrl}/util/file-system/list`, { headers: auth(server) });
    expect(res.status).toBe(200);
    expect((await res.json()).path).toBe(rosterLockFolder);
  });

  it("reports the parent folder within the root, and null at the root itself", async () => {
    const { server, rosterLockFolder } = await setup();
    await mkdir(join(rosterLockFolder, "sub-folder"));

    const subRes = await fetch(
      `${server.httpUrl}/util/file-system/list?path=${encodeURIComponent(join(rosterLockFolder, "sub-folder"))}`,
      { headers: auth(server) }
    );
    expect((await subRes.json()).parent).toBe(rosterLockFolder);

    const rootRes = await fetch(
      `${server.httpUrl}/util/file-system/list?path=${encodeURIComponent(rosterLockFolder)}`, { headers: auth(server) }
    );
    expect((await rootRes.json()).parent).toBeNull();
  });

  // The actual fix for this feature's exposure - see
  // src/util-routers/file-system/resolve-within-root.ts.
  it("403s for a path outside the configured root", async () => {
    const { server } = await setup();
    const res = await fetch(`${server.httpUrl}/util/file-system/list?path=${encodeURIComponent("/etc")}`, { headers: auth(server) });
    expect(res.status).toBe(403);
  });

  it("403s for a path that climbs out of the configured root with ..", async () => {
    const { server, rosterLockFolder } = await setup();
    const escapee = join(rosterLockFolder, "..", "..");
    const res = await fetch(`${server.httpUrl}/util/file-system/list?path=${encodeURIComponent(escapee)}`, { headers: auth(server) });
    expect(res.status).toBe(403);
  });

  it("404s for a path that doesn't exist, within the root", async () => {
    const { server, rosterLockFolder } = await setup();
    const res = await fetch(
      `${server.httpUrl}/util/file-system/list?path=${encodeURIComponent(join(rosterLockFolder, "nope"))}`,
      { headers: auth(server) }
    );
    expect(res.status).toBe(404);
  });

  it("400s when path points at a file, not a folder", async () => {
    const { server, rosterLockFolder } = await setup();
    const filePath = join(rosterLockFolder, "a-file.txt");
    await writeFile(filePath, "hello");
    const res = await fetch(`${server.httpUrl}/util/file-system/list?path=${encodeURIComponent(filePath)}`, { headers: auth(server) });
    expect(res.status).toBe(400);
  });
});
