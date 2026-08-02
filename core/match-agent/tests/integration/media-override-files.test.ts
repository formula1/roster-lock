import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { startTestServer, TestServer } from "./helpers/server";
import {
  makeEngine, makePiece, makeTempFolder, seedCompletePiece, cleanupFolder, TEST_PIECE_TYPE,
} from "./helpers/piece";
import { makeMediaOverrideEntry, seedCompleteMediaOverride } from "./helpers/media-override";

describe("/v1/piece/asset-files and /v1/piece/file-contents with mediaOverrides", () => {
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
  const overrideHash = "override-hash";
  const entry = makeMediaOverrideEntry();

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
    it("falls back to the base piece's files when the given override has never been seen", async () => {
      await seedCompletePiece({
        folder, engine, pieceType: TEST_PIECE_TYPE, piece,
        folderName: "piece-complete-folder", files: { "sprite.png": "base-sprite-bytes" },
      });
      const res = await post("/piece/asset-files", {
        engine, pieceType: TEST_PIECE_TYPE, piece, assetName: "sprite",
        mediaOverrides: [overrideHash],
      });
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual(["sprite.png"]);
    });

    it("falls back to the base piece's files when the given override hasn't finished downloading", async () => {
      await seedCompletePiece({
        folder, engine, pieceType: TEST_PIECE_TYPE, piece,
        folderName: "piece-complete-folder", files: { "sprite.png": "base-sprite-bytes" },
      });
      await seedCompleteMediaOverride({
        folder, engine, pieceType: TEST_PIECE_TYPE, logicHash: piece.version.logic, overrideHash, entry,
        folderName: "override-pending-folder", files: {}, complete: false,
      });
      const res = await post("/piece/asset-files", {
        engine, pieceType: TEST_PIECE_TYPE, piece, assetName: "sprite",
        mediaOverrides: [overrideHash],
      });
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual(["sprite.png"]);
    });

    it("falls back to the base piece's files when a complete override doesn't cover the requested asset", async () => {
      await seedCompletePiece({
        folder, engine, pieceType: TEST_PIECE_TYPE, piece,
        folderName: "piece-complete-folder", files: { "sprite.png": "base-sprite-bytes" },
      });
      await seedCompleteMediaOverride({
        folder, engine, pieceType: TEST_PIECE_TYPE, logicHash: piece.version.logic, overrideHash, entry,
        folderName: "override-complete-folder", files: { "unrelated.txt": "not an asset" },
      });
      const res = await post("/piece/asset-files", {
        engine, pieceType: TEST_PIECE_TYPE, piece, assetName: "sprite",
        mediaOverrides: [overrideHash],
      });
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual(["sprite.png"]);
    });

    it("200s with the override's files, not the base piece's, when the override is complete and covers the asset", async () => {
      await seedCompletePiece({
        folder, engine, pieceType: TEST_PIECE_TYPE, piece,
        folderName: "piece-complete-folder", files: { "sprite.png": "base-sprite-bytes" },
      });
      await seedCompleteMediaOverride({
        folder, engine, pieceType: TEST_PIECE_TYPE, logicHash: piece.version.logic, overrideHash, entry,
        folderName: "override-complete-folder", files: { "sprite.png": "override-sprite-bytes" },
      });
      const res = await post("/piece/asset-files", {
        engine, pieceType: TEST_PIECE_TYPE, piece, assetName: "sprite",
        mediaOverrides: [overrideHash],
      });
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual(["sprite.png"]);
    });
  });

  describe("POST /v1/piece/file-contents", () => {
    it("streams the override's file contents, not the base piece's, when the override is complete and covers the asset", async () => {
      await seedCompletePiece({
        folder, engine, pieceType: TEST_PIECE_TYPE, piece,
        folderName: "piece-complete-folder", files: { "sprite.png": "base-sprite-bytes" },
      });
      await seedCompleteMediaOverride({
        folder, engine, pieceType: TEST_PIECE_TYPE, logicHash: piece.version.logic, overrideHash, entry,
        folderName: "override-complete-folder", files: { "sprite.png": "override-sprite-bytes" },
      });
      const res = await post("/piece/file-contents", {
        engine, pieceType: TEST_PIECE_TYPE, piece, filePath: "sprite.png",
        mediaOverrides: [overrideHash],
      });
      expect(res.status).toBe(200);
      await expect(res.text()).resolves.toBe("override-sprite-bytes");
    });

    it("falls back to the base piece's file contents when the given override isn't complete", async () => {
      await seedCompletePiece({
        folder, engine, pieceType: TEST_PIECE_TYPE, piece,
        folderName: "piece-complete-folder", files: { "sprite.png": "base-sprite-bytes" },
      });
      const res = await post("/piece/file-contents", {
        engine, pieceType: TEST_PIECE_TYPE, piece, filePath: "sprite.png",
        mediaOverrides: [overrideHash],
      });
      expect(res.status).toBe(200);
      await expect(res.text()).resolves.toBe("base-sprite-bytes");
    });

    it("falls back to the base piece's file contents when a complete override doesn't cover that file's asset", async () => {
      await seedCompletePiece({
        folder, engine, pieceType: TEST_PIECE_TYPE, piece,
        folderName: "piece-complete-folder", files: { "sprite.png": "base-sprite-bytes" },
      });
      await seedCompleteMediaOverride({
        folder, engine, pieceType: TEST_PIECE_TYPE, logicHash: piece.version.logic, overrideHash, entry,
        folderName: "override-complete-folder", files: { "unrelated.txt": "not an asset" },
      });
      const res = await post("/piece/file-contents", {
        engine, pieceType: TEST_PIECE_TYPE, piece, filePath: "sprite.png",
        mediaOverrides: [overrideHash],
      });
      expect(res.status).toBe(200);
      await expect(res.text()).resolves.toBe("base-sprite-bytes");
    });
  });
});
