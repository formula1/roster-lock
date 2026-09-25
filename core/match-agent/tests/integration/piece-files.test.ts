import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { startTestServer, TestServer, errorBody } from "./helpers/server";
import {
  makeEngine, makePiece, makeTempFolder, seedCompletePiece, cleanupFolder, TEST_PIECE_TYPE,
} from "./helpers/piece";

describe("/v1/piece/asset-files and /v1/piece/file-contents", () => {
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
  const piece = makePiece();

  function post(path: string, body: unknown) {
    return fetch(`${server.httpUrl}/v1${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${server.authCode}`,
      },
      body: JSON.stringify(body),
    });
  }

  describe("POST /v1/piece/asset-files", () => {
    it("400s on a malformed body", async () => {
      const res = await post("/piece/asset-files", {});
      expect(res.status).toBe(400);
      expect((await errorBody(res)).error).toBe("Bad Form");
    });

    it("404s when the piece has never been seen", async () => {
      const res = await post("/piece/asset-files", {
        engine, pieceType: TEST_PIECE_TYPE, piece, assetName: "sprite",
      });
      expect(res.status).toBe(404);
      expect((await errorBody(res)).error).toBe("Piece doesn't exist");
    });

    it("409s when the piece exists but hasn't finished downloading", async () => {
      await seedCompletePiece({
        folder, engine, pieceType: TEST_PIECE_TYPE, piece,
        folderName: "pending-folder", files: {}, complete: false,
      });
      const res = await post("/piece/asset-files", {
        engine, pieceType: TEST_PIECE_TYPE, piece, assetName: "sprite",
      });
      expect(res.status).toBe(409);
      expect((await errorBody(res)).error).toBe("Piece not finished");
    });

    it("200s with matching files for a completed piece", async () => {
      await seedCompletePiece({
        folder, engine, pieceType: TEST_PIECE_TYPE, piece,
        folderName: "complete-folder",
        files: { "sprite.png": "fake-png-bytes", "unrelated.txt": "not an asset" },
      });
      const res = await post("/piece/asset-files", {
        engine, pieceType: TEST_PIECE_TYPE, piece, assetName: "sprite",
      });
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual(["sprite.png"]);
    });
  });

  describe("POST /v1/piece/file-contents", () => {
    it("400s on a malformed body", async () => {
      const res = await post("/piece/file-contents", {});
      expect(res.status).toBe(400);
      expect((await errorBody(res)).error).toBe("Bad Form");
    });

    it("404s when the piece has never been seen", async () => {
      const res = await post("/piece/file-contents", {
        engine, pieceType: TEST_PIECE_TYPE, piece, filePath: "sprite.png",
      });
      expect(res.status).toBe(404);
      expect((await errorBody(res)).error).toBe("Piece doesn't exist");
    });

    it("409s when the piece exists but hasn't finished downloading", async () => {
      await seedCompletePiece({
        folder, engine, pieceType: TEST_PIECE_TYPE, piece,
        folderName: "pending-folder", files: {}, complete: false,
      });
      const res = await post("/piece/file-contents", {
        engine, pieceType: TEST_PIECE_TYPE, piece, filePath: "sprite.png",
      });
      expect(res.status).toBe(409);
      expect((await errorBody(res)).error).toBe("Piece not finished");
    });

    it("400s on a path-traversal attempt", async () => {
      await seedCompletePiece({
        folder, engine, pieceType: TEST_PIECE_TYPE, piece,
        folderName: "complete-folder", files: { "sprite.png": "fake-png-bytes" },
      });
      const res = await post("/piece/file-contents", {
        engine, pieceType: TEST_PIECE_TYPE, piece, filePath: "../../etc/passwd",
      });
      expect(res.status).toBe(400);
      expect((await errorBody(res)).error).toBe("Can't back out of folder");
    });

    it("404s when the requested file isn't on disk", async () => {
      await seedCompletePiece({
        folder, engine, pieceType: TEST_PIECE_TYPE, piece,
        folderName: "complete-folder", files: { "sprite.png": "fake-png-bytes" },
      });
      const res = await post("/piece/file-contents", {
        engine, pieceType: TEST_PIECE_TYPE, piece, filePath: "missing.png",
      });
      expect(res.status).toBe(404);
      expect((await errorBody(res)).error).toBe("File doesn't exist");
    });

    it("200s and streams the file contents with the right content type", async () => {
      await seedCompletePiece({
        folder, engine, pieceType: TEST_PIECE_TYPE, piece,
        folderName: "complete-folder", files: { "sprite.png": "fake-png-bytes" },
      });
      const res = await post("/piece/file-contents", {
        engine, pieceType: TEST_PIECE_TYPE, piece, filePath: "sprite.png",
      });
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toBe("image/png");
      await expect(res.text()).resolves.toBe("fake-png-bytes");
    });
  });
});
