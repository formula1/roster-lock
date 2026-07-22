import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { once } from "node:events";
import { createServer, Server } from "node:http";
import { mkdtemp, rm, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AddressInfo } from "node:net";
import { WebSocket } from "ws";
import { MessageBridge } from "@roster-lock/utils";
import { startTestServer, TestServer } from "./helpers/server";
import {
  makeEngine, makePiece, makeTempFolder, cleanupFolder, seedCompletePiece, TEST_PIECE_TYPE,
} from "./helpers/piece";
import { createFixturePluginDir } from "./helpers/plugin-dir";
import { makeTarGz } from "./helpers/make-tar-gz";
import { getDownloadSourceVersion } from "../../src/handle-room/version-1/globals/FolderDB/SQLFolderDB/getVersions";

describe("WS /v1/piece/ensure", () => {
  let server: TestServer;
  let folder: string;
  beforeAll(async () => { folder = await makeTempFolder(); server = await startTestServer(folder); });
  afterAll(async () => { await server.close(); await cleanupFolder(folder); });

  const engine = makeEngine();
  const piece = makePiece();

  // Opens an authenticated connection and waits for "ready", mirroring the
  // handshake every other test here needs before it can send a request.
  async function connectReady() {
    const ws = new WebSocket(`${server.wsUrl}/v1/piece/ensure`, {
      headers: { Authorization: `Bearer ${server.authCode}` },
    });
    const bridge = new MessageBridge((message) => ws.send(JSON.stringify(message)));
    const readyPromise = new Promise<void>((resolve) => bridge.onEvent("ready", () => resolve()));
    ws.on("message", (data) => bridge.handleMessage(JSON.parse(data.toString())));

    await once(ws, "open");
    await readyPromise;
    return { ws, bridge };
  }

  it("terminates the connection with no auth, without ever sending a ready event", async () => {
    const ws = new WebSocket(`${server.wsUrl}/v1/piece/ensure`);
    let receivedMessage = false;
    ws.on("message", () => { receivedMessage = true; });
    ws.on("error", () => {}); // abrupt terminate() can surface as ECONNRESET - not the point of this test

    await once(ws, "close");
    expect(receivedMessage).toBe(false);
  });

  it("sends a ready event once authenticated, and rejects an invalid ensure-piece request", async () => {
    const { ws, bridge } = await connectReady();
    try {
      await expect(bridge.sendRequest("ensure-piece", { not: "a valid ensure-piece request" }))
        .rejects.toMatch(/^Bad Form/);
    } finally {
      ws.close();
    }
  });

  // A real download requires a resolvable dl-protocol plugin under
  // DEFAULT_PLUGIN_DIR (~/roster-lock/plugins), which isn't part of this
  // package's test setup - only the request-shape validation is covered here
  // (mirrors the same limitation noted in piece-download-and-list.test.ts).
  it("surfaces a download failure over the bridge rather than hanging", async () => {
    const { ws, bridge } = await connectReady();
    try {
      await expect(bridge.sendRequest("ensure-piece", { engine, pieceType: TEST_PIECE_TYPE, piece }))
        .rejects.toBeTruthy();
    } finally {
      ws.close();
    }
  });

  // ensurePieceExists (SQLite3FolderDB) short-circuits to the existing folder
  // when the DB already has the piece marked complete, without touching the
  // download pipeline - so this is reachable without a real dl-protocol
  // plugin, unlike the failure-path test above.
  it("resolves with the existing folder and emits no progress when the piece is already downloaded", async () => {
    const downloaded = makePiece({
      id: "already-downloaded",
      version: { logic: "already-downloaded-1.0.0", media: "1.0.0", docs: "1.0.0" },
    });
    const expectedFolder = await seedCompletePiece({
      folder, engine, pieceType: TEST_PIECE_TYPE, piece: downloaded, folderName: "already-downloaded-folder", files: {},
    });

    const { ws, bridge } = await connectReady();
    try {
      const progressEvents: unknown[] = [];
      bridge.onEvent("download-progress", (update) => progressEvents.push(update));

      const result = await bridge.sendRequest(
        "ensure-piece", { engine, pieceType: TEST_PIECE_TYPE, piece: downloaded },
      );

      expect(result).toEqual({
        pieceType: TEST_PIECE_TYPE,
        pieceId: downloaded.id,
        pieceVersions: { logic: downloaded.version.logic, media: downloaded.version.media },
        folder: expectedFolder,
      });
      expect(progressEvents).toEqual([]);
    } finally {
      ws.close();
    }
  });
});

describe("WS /v1/piece/ensure - first-time download", () => {
  const cleanups: Array<() => Promise<void> | void> = [];
  afterEach(async () => {
    while (cleanups.length) await cleanups.pop()!();
  });

  const engine = makeEngine();
  const spriteContent = "not actually a png, just fixture bytes\n";

  async function connectReady(server: TestServer) {
    const ws = new WebSocket(`${server.wsUrl}/v1/piece/ensure`, {
      headers: { Authorization: `Bearer ${server.authCode}` },
    });
    const bridge = new MessageBridge((message) => ws.send(JSON.stringify(message)));
    const readyPromise = new Promise<void>((resolve) => bridge.onEvent("ready", () => resolve()));
    ws.on("message", (data) => bridge.handleMessage(JSON.parse(data.toString())));

    await once(ws, "open");
    await readyPromise;
    return { ws, bridge };
  }

  function startArchiveServer(archive: Buffer): Promise<Server> {
    return new Promise((resolve) => {
      const server = createServer((_req, res) => {
        res.writeHead(200, { "content-length": String(archive.length) });
        res.end(archive);
      });
      server.listen(0, "localhost", () => resolve(server));
    });
  }

  // Exercises the real download path end to end (http fetch -> gzip decompress
  // -> tar extract -> hash validation) instead of the DB short-circuit the
  // other tests in this file use, since that's the only way to see
  // "download-progress" events actually stream and a first-time download
  // land on disk. Requires a real plugin dir - see helpers/plugin-dir.ts.
  it("streams download-progress events and resolves once the archive is extracted and validated", async () => {
    const sourceDir = await mkdtemp(join(tmpdir(), "match-agent-source-"));
    cleanups.push(() => rm(sourceDir, { recursive: true, force: true }));
    await writeFile(join(sourceDir, "sprite.png"), spriteContent);
    const version = await getDownloadSourceVersion(sourceDir, {}, engine.pieceDefinitions[TEST_PIECE_TYPE]);

    const archive = makeTarGz([{ path: "sprite.png", content: spriteContent }]);
    const archiveServer = await startArchiveServer(archive);
    cleanups.push(() => new Promise((resolve) => archiveServer.close(() => resolve(undefined))));
    const port = (archiveServer.address() as AddressInfo).port;

    const fixture = await createFixturePluginDir([
      "@roster-lock/dl-protocol-http", "@roster-lock/dl-compression-gzip", "@roster-lock/dl-archive-tar",
    ]);
    cleanups.push(fixture.cleanup);

    const folder = await makeTempFolder();
    cleanups.push(() => cleanupFolder(folder));
    const server = await startTestServer(folder, undefined, fixture.pluginDir);
    cleanups.push(() => server.close());

    const piece = makePiece({
      version,
      downloadSources: [`http://localhost:${port}/archive.tar.gz`],
    });

    const { ws, bridge } = await connectReady(server);
    try {
      const progressEvents: Array<{ type: string }> = [];
      bridge.onEvent("download-progress", (update) => progressEvents.push(update as { type: string }));

      const result = await bridge.sendRequest("ensure-piece", { engine, pieceType: TEST_PIECE_TYPE, piece });

      expect(result).toMatchObject({
        pieceType: TEST_PIECE_TYPE,
        pieceId: piece.id,
        pieceVersions: { logic: version.logic, media: version.media },
      });
      expect(progressEvents.some((e) => e.type === "download-progress")).toBe(true);
      expect(progressEvents.at(-1)).toMatchObject({ type: "download-validation" });

      const downloadedFile = await readFile(join((result as { folder: string }).folder, "sprite.png"), "utf-8");
      expect(downloadedFile).toBe(spriteContent);
    } finally {
      ws.close();
    }
  });

  // Second ensure-piece call for the same piece should hit the DB
  // short-circuit and emit no further progress or network traffic - this is
  // the "second match reuses the cache" behavior already covered against a
  // seeded DB in the test above this describe block; here it's proven
  // end-to-end against a piece that was actually downloaded moments ago.
  it("reuses the cached download on a second ensure-piece call, without re-downloading", async () => {
    const sourceDir = await mkdtemp(join(tmpdir(), "match-agent-source-"));
    cleanups.push(() => rm(sourceDir, { recursive: true, force: true }));
    await writeFile(join(sourceDir, "sprite.png"), spriteContent);
    const version = await getDownloadSourceVersion(sourceDir, {}, engine.pieceDefinitions[TEST_PIECE_TYPE]);

    const archive = makeTarGz([{ path: "sprite.png", content: spriteContent }]);
    let requestCount = 0;
    const archiveServer = await new Promise<Server>((resolve) => {
      const s = createServer((_req, res) => {
        requestCount += 1;
        res.writeHead(200, { "content-length": String(archive.length) });
        res.end(archive);
      });
      s.listen(0, "localhost", () => resolve(s));
    });
    cleanups.push(() => new Promise((resolve) => archiveServer.close(() => resolve(undefined))));
    const port = (archiveServer.address() as AddressInfo).port;

    const fixture = await createFixturePluginDir([
      "@roster-lock/dl-protocol-http", "@roster-lock/dl-compression-gzip", "@roster-lock/dl-archive-tar",
    ]);
    cleanups.push(fixture.cleanup);

    const folder = await makeTempFolder();
    cleanups.push(() => cleanupFolder(folder));
    const server = await startTestServer(folder, undefined, fixture.pluginDir);
    cleanups.push(() => server.close());

    const piece = makePiece({
      version,
      downloadSources: [`http://localhost:${port}/archive.tar.gz`],
    });

    const first = await connectReady(server);
    try {
      await first.bridge.sendRequest("ensure-piece", { engine, pieceType: TEST_PIECE_TYPE, piece });
    } finally {
      first.ws.close();
    }
    expect(requestCount).toBe(1);

    const second = await connectReady(server);
    try {
      const progressEvents: unknown[] = [];
      second.bridge.onEvent("download-progress", (update) => progressEvents.push(update));
      const result = await second.bridge.sendRequest("ensure-piece", { engine, pieceType: TEST_PIECE_TYPE, piece });

      expect(result).toMatchObject({ pieceType: TEST_PIECE_TYPE, pieceId: piece.id });
      expect(progressEvents).toEqual([]);
      expect(requestCount).toBe(1);
    } finally {
      second.ws.close();
    }
  });
});
