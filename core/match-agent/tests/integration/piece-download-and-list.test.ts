import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import { join as pathJoin } from "node:path";
import { startTestServer, TestServer, errorBody } from "./helpers/server";
import {
  makeEngine, makePiece, makeTempFolder, seedCompletePiece, cleanupFolder, TEST_PIECE_TYPE,
} from "./helpers/piece";
import { prepareDatabase } from "../../src/handle-room/version-1/globals/FolderDB/SQLFolderDB/schema";
import { RosterLockPiece, RosterLockV1Config } from "@roster-lock/types";

describe("PUT /v1/piece", () => {
  let server: TestServer;
  let folder: string;

  beforeAll(async () => { server = await startTestServer(); });
  afterAll(() => server.close());

  beforeEach(async () => { folder = await makeTempFolder(); });
  afterEach(() => cleanupFolder(folder));

  const engine = makeEngine();
  const piece = makePiece();

  function put(path: string, body: unknown) {
    return fetch(`${server.httpUrl}/v1${path}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${server.authCode}`,
      },
      body: JSON.stringify(body),
    });
  }

  it("400s on a malformed body", async () => {
    const res = await put("/piece", { folder });
    expect(res.status).toBe(400);
    expect((await errorBody(res)).error).toBe("Bad Form");
  });

  // A real download requires a resolvable dl-protocol plugin under
  // DEFAULT_PLUGIN_DIR (~/roster-lock/plugins), which isn't part of this
  // package's test setup - only the request-shape validation is covered here.
  it("400s when the piece fails the piece schema", async () => {
    const res = await put("/piece", {
      folder, engine, pieceType: TEST_PIECE_TYPE, piece: { ...piece, id: undefined },
    });
    expect(res.status).toBe(400);
    expect((await errorBody(res)).error).toBe("Bad Form");
  });
});

describe("QUERY /v1/piece/list-downloaded", () => {
  let server: TestServer;
  let folder: string;

  beforeAll(async () => { server = await startTestServer(); });
  afterAll(() => server.close());

  beforeEach(async () => { folder = await makeTempFolder(); });
  afterEach(() => cleanupFolder(folder));

  const engine = makeEngine();

  function query(path: string, body: unknown, params: Record<string, string> = {}) {
    const url = new URL(`${server.httpUrl}/v1${path}`);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    return fetch(url, {
      method: "QUERY",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${server.authCode}`,
      },
      body: JSON.stringify(body),
    });
  }

  // seedCompletePiece always stamps completed_at via unixepoch() (second
  // resolution), which is too coarse to assert ordering across pieces
  // seeded within the same test - so pagination/ordering tests set it
  // directly on the row.
  async function setCompletedAt(
    engineConfig: RosterLockV1Config["engine"], pieceType: string, piece: RosterLockPiece, completedAt: number,
  ) {
    const db = prepareDatabase(pathJoin(folder, "rosterlock.sqlite3.db"));
    try {
      db.db.prepare(
        `UPDATE pieces SET completed_at = @completedAt
         WHERE engine_name = @engineName AND piece_type = @pieceType
           AND logic_hash = @logic AND media_hash = @media`
      ).run({
        engineName: engineConfig.name,
        pieceType,
        logic: piece.version.logic,
        media: piece.version.media,
        completedAt,
      });
    } finally {
      db.close();
    }
  }

  describe("/piece/list-downloaded/direct", () => {
    it("400s on a malformed body", async () => {
      const res = await query("/piece/list-downloaded/direct", { folder });
      expect(res.status).toBe(400);
      expect((await errorBody(res)).error).toBe("Bad Form");
    });

    it("returns [] without touching the DB when logicIds is empty", async () => {
      const res = await query("/piece/list-downloaded/direct", {
        folder, engineName: engine.name, pieceType: TEST_PIECE_TYPE, logicIds: [],
      });
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual([]);
    });

    it("only returns complete pieces whose logic hash was requested", async () => {
      const matching = makePiece({ id: "match", version: { logic: "1.0.0", media: "1.0.0", docs: "1.0.0" } });
      const unrequestedLogic = makePiece({ id: "unrequested", version: { logic: "9.9.9", media: "1.0.0", docs: "1.0.0" } });
      const stillPending = makePiece({ id: "pending", version: { logic: "2.0.0", media: "1.0.0", docs: "1.0.0" } });

      await seedCompletePiece({ folder, engine, pieceType: TEST_PIECE_TYPE, piece: matching, folderName: "a", files: {} });
      await seedCompletePiece({ folder, engine, pieceType: TEST_PIECE_TYPE, piece: unrequestedLogic, folderName: "b", files: {} });
      await seedCompletePiece({
        folder, engine, pieceType: TEST_PIECE_TYPE, piece: stillPending, folderName: "c", files: {}, complete: false,
      });

      const res = await query("/piece/list-downloaded/direct", {
        folder, engineName: engine.name, pieceType: TEST_PIECE_TYPE, logicIds: ["1.0.0", "2.0.0"],
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toHaveLength(1);
      expect(body[0].version.logic).toBe("1.0.0");
    });

    it("paginates results ordered by completion time ascending", async () => {
      const pieces = ["1.0.0", "2.0.0", "3.0.0"].map((logic, i) => (
        makePiece({ id: `piece-${i}`, version: { logic, media: "1.0.0", docs: "1.0.0" } })
      ));
      for (const [i, p] of pieces.entries()) {
        await seedCompletePiece({ folder, engine, pieceType: TEST_PIECE_TYPE, piece: p, folderName: `folder-${i}`, files: {} });
        // Seed in reverse completion order so a correct ORDER BY is actually exercised.
        await setCompletedAt(engine, TEST_PIECE_TYPE, p, 3000 - i);
      }
      const logicIds = pieces.map((p) => p.version.logic);

      const page0 = await query(
        "/piece/list-downloaded/direct",
        { folder, engineName: engine.name, pieceType: TEST_PIECE_TYPE, logicIds },
        { page: "0", limit: "2" },
      );
      expect((await page0.json()).map((p: any) => p.version.logic)).toEqual(["3.0.0", "2.0.0"]);

      const page1 = await query(
        "/piece/list-downloaded/direct",
        { folder, engineName: engine.name, pieceType: TEST_PIECE_TYPE, logicIds },
        { page: "1", limit: "2" },
      );
      expect((await page1.json()).map((p: any) => p.version.logic)).toEqual(["1.0.0"]);
    });
  });
});
