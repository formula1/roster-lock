import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { startTestServer, TestServer, errorBody } from "./helpers/server";
import {
  makeEngine, makePiece, makeTempFolder, seedCompletePiece, cleanupFolder, TEST_PIECE_TYPE,
} from "./helpers/piece";
import { RosterLockPiece } from "@roster-lock/types";

type SearchResult = {
  total: number,
  items: Array<{
    piece: (
      & Pick<RosterLockPiece, "version" | "humanInfo" | "pathVariables">
      & {
        engineName: string,
        pieceType: string,
        downloadSources: Array<{
          source: string,
          lastTest: number | null,
          success: boolean | null,
          error?: string,
        }>,
      }
    ),
    completedAt: number | null,
  }>,
};

describe("POST /editor/v1/pieces/search", () => {
  let server: TestServer;
  let folder: string;

  beforeEach(async () => {
    folder = await makeTempFolder();
    server = await startTestServer(folder);
  });
  afterEach(async () => {
    await server.close();
    await cleanupFolder(folder);
  });

  const engine = makeEngine();

  function search(body: unknown) {
    return fetch(`${server.httpUrl}/editor/v1/pieces/search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${server.authCode}`,
      },
      body: JSON.stringify(body),
    });
  }

  it("400s on a malformed body", async () => {
    const res = await search({});
    expect(res.status).toBe(400);
    expect((await errorBody(res)).error).toBe("Bad body");
  });

  it("returns completed pieces with their stored info and tested sources", async () => {
    const complete = makePiece({ id: "downloaded-piece" });
    const pending = makePiece({
      id: "pending-piece",
      version: { logic: "2.0.0", media: "1.0.0", docs: "1.0.0" },
    });
    await seedCompletePiece({
      folder, engine, pieceType: TEST_PIECE_TYPE, piece: complete, folderName: "a", files: {},
    });
    await seedCompletePiece({
      folder, engine, pieceType: TEST_PIECE_TYPE, piece: pending, folderName: "b", files: {}, complete: false,
    });

    const res = await search({ engineName: engine.name });
    expect(res.status).toBe(200);
    const body = await res.json() as SearchResult;
    expect(body.total).toBe(1);
    expect(body.items).toHaveLength(1);
    // Everything the agent stores round-trips - version hashes, human info,
    // path variables, and per-source test state.
    expect(body.items[0].piece).toEqual({
      engineName: engine.name,
      pieceType: TEST_PIECE_TYPE,
      version: complete.version,
      humanInfo: complete.humanInfo,
      pathVariables: complete.pathVariables,
      downloadSources: [{
        // The seeded download counts as this source's passed test.
        source: complete.downloadSources[0],
        lastTest: expect.any(Number),
        success: true,
      }],
    });
    expect(body.items[0].completedAt).toBeTypeOf("number");
  });

  it("filters by search text over human info and sources", async () => {
    const ryu = makePiece({
      id: "ryu",
      version: { logic: "ryu-1", media: "1.0.0", docs: "1.0.0" },
      humanInfo: { name: "Ryu", author: "capcom", url: "http://example.com" },
    });
    const ken = makePiece({
      id: "ken",
      version: { logic: "ken-1", media: "1.0.0", docs: "1.0.0" },
      humanInfo: { name: "Ken", author: "capcom", url: "http://example.com" },
    });
    await seedCompletePiece({ folder, engine, pieceType: TEST_PIECE_TYPE, piece: ryu, folderName: "a", files: {} });
    await seedCompletePiece({ folder, engine, pieceType: TEST_PIECE_TYPE, piece: ken, folderName: "b", files: {} });

    const res = await search({ engineName: engine.name, search: "Ryu" });
    const body = await res.json() as SearchResult;
    expect(body.total).toBe(1);
    expect(body.items[0].piece.version.logic).toBe("ryu-1");

    const both = await search({ engineName: engine.name, search: "capcom" });
    expect((await both.json() as SearchResult).total).toBe(2);

    const bySource = await search({ engineName: engine.name, search: "example.com/download" });
    expect((await bySource.json() as SearchResult).total).toBe(2);
  });

  it("paginates and filters by pieceType", async () => {
    const pieces = ["a", "b", "c"].map((id, i) => makePiece({
      id, version: { logic: `${id}-1`, media: "1.0.0", docs: "1.0.0" },
    }));
    for (const [i, piece] of pieces.entries()) {
      await seedCompletePiece({
        folder, engine, pieceType: TEST_PIECE_TYPE, piece, folderName: `folder-${i}`, files: {},
      });
    }

    const page0 = await search({
      engineName: engine.name, pieceType: TEST_PIECE_TYPE, page: 0, limit: 2,
    });
    const page0Body = await page0.json() as SearchResult;
    expect(page0Body.total).toBe(3);
    expect(page0Body.items).toHaveLength(2);

    const page1 = await search({
      engineName: engine.name, pieceType: TEST_PIECE_TYPE, page: 1, limit: 2,
    });
    expect((await page1.json() as SearchResult).items).toHaveLength(1);

    const otherType = await search({ engineName: engine.name, pieceType: "not-a-type" });
    expect((await otherType.json() as SearchResult).total).toBe(0);
  });
});
