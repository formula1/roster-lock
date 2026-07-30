import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join as pathJoin } from "node:path";
import { EMPTY_ROSTER_DRAFT, EMPTY_ROSTER_LOCK } from "@roster-lock/shared";
import { cloneJSON } from "@roster-lock/utils";
import { RosterLockPiece, RosterLockV1Config, RosterLockV1Draft } from "@roster-lock/types";

async function runImportPiece(args: Array<string>){
  vi.resetModules();
  const { importPieceCommand } = await import("../../src/commands/roster/import-piece.js");

  process.exitCode = undefined;
  const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  await importPieceCommand.parseAsync(["node", "import-piece", ...args]);
  const logs = logSpy.mock.calls.map((call) => call.join(" "));
  logSpy.mockRestore();
  const exitCode = process.exitCode;
  process.exitCode = undefined;
  return { logs, exitCode };
}

const CHARACTER_DEFINITION = {
  selectionStrategy: "mandatory" as const,
  requires: [],
  pathVariables: [],
  assets: [{ name: "sprite", classification: "media" as const, count: 1, glob: ["*.png"] }],
};

const CHARACTER_WITH_WEAPON_DEFINITION = {
  ...CHARACTER_DEFINITION,
  requires: ["weapon"],
};

const WEAPON_DEFINITION = {
  selectionStrategy: "on demand" as const,
  requires: [],
  pathVariables: [],
  assets: [{ name: "sprite", classification: "media" as const, count: 1, glob: ["*.png"] }],
};

const SOURCE_PIECE: RosterLockPiece = {
  id: "@author/blue",
  version: { logic: "a".repeat(64), media: "b".repeat(64), docs: "c".repeat(64) },
  humanInfo: { name: "Blue", author: "author", url: "https://example.com/blue" },
  downloadSources: ["https://example.com/blue.tar"],
  pathVariables: {},
  requiredPieces: {},
};

const SOURCE_WEAPON_PIECE: RosterLockPiece = {
  id: "@author/sword",
  version: { logic: "d".repeat(64), media: "e".repeat(64), docs: "f".repeat(64) },
  humanInfo: { name: "Sword", author: "author", url: "https://example.com/sword" },
  downloadSources: ["https://example.com/sword.tar"],
  pathVariables: {},
  requiredPieces: {},
};

const SOURCE_PIECE_WITH_REQUIRED: RosterLockPiece = {
  ...cloneJSON(SOURCE_PIECE),
  requiredPieces: { weapon: { expected: ["@author/sword"], selectable: false } },
};

describe("roster import-piece", () => {
  let tempDir: string;
  let draftPath: string;

  beforeEach(() => {
    tempDir = mkdtempSync(pathJoin(tmpdir(), "rosterlock-import-piece-"));
    draftPath = pathJoin(tempDir, "test.rosterlock.draft.json");

    const draft: RosterLockV1Draft = cloneJSON(EMPTY_ROSTER_DRAFT);
    draft.stagedLock.engine.pieceDefinitions["character"] = cloneJSON(CHARACTER_DEFINITION);
    draft.stagedLock.rosters["character"] = [];
    writeFileSync(draftPath, JSON.stringify(draft));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  function readTargetPiece(){
    const draft: RosterLockV1Draft = JSON.parse(readFileSync(draftPath, "utf-8"));
    return draft.stagedLock.rosters["character"][0];
  }

  function writeSourceLock(){
    const lock: RosterLockV1Config = cloneJSON(EMPTY_ROSTER_LOCK);
    lock.engine.pieceDefinitions["character"] = cloneJSON(CHARACTER_DEFINITION);
    lock.rosters["character"] = [cloneJSON(SOURCE_PIECE)];
    const lockPath = pathJoin(tempDir, "source.rosterlock.json");
    writeFileSync(lockPath, JSON.stringify(lock));
    return lockPath;
  }

  function writeSourceDraft(){
    const source: RosterLockV1Draft = cloneJSON(EMPTY_ROSTER_DRAFT);
    source.stagedLock.engine.pieceDefinitions["character"] = cloneJSON(CHARACTER_DEFINITION);
    source.stagedLock.rosters["character"] = [cloneJSON(SOURCE_PIECE)];
    const sourcePath = pathJoin(tempDir, "source.rosterlock.draft.json");
    writeFileSync(sourcePath, JSON.stringify(source));
    return sourcePath;
  }

  it("copies a piece from a published lock, trusting its existing hash as-is", async () => {
    const lockPath = writeSourceLock();

    const { exitCode } = await runImportPiece([lockPath, "character", "@author/blue", "--draft", draftPath]);
    expect(exitCode).toBeUndefined();

    const piece = readTargetPiece();
    expect(piece).toEqual(SOURCE_PIECE);
  });

  it("copies a piece from another draft's staged lock", async () => {
    const sourcePath = writeSourceDraft();

    const { exitCode } = await runImportPiece([sourcePath, "character", "@author/blue", "--draft", draftPath]);
    expect(exitCode).toBeUndefined();

    expect(readTargetPiece()).toEqual(SOURCE_PIECE);
  });

  it("--as imports under a different piece id", async () => {
    const lockPath = writeSourceLock();

    await runImportPiece([lockPath, "character", "@author/blue", "--as", "@author/blue-renamed", "--draft", draftPath]);

    const piece = readTargetPiece();
    expect(piece.id).toBe("@author/blue-renamed");
    expect(piece.version).toEqual(SOURCE_PIECE.version);
  });

  it("fails for an unknown target piece type", async () => {
    const lockPath = writeSourceLock();

    const { exitCode } = await runImportPiece([lockPath, "vehicle", "@author/blue", "--draft", draftPath]);
    expect(exitCode).toBe(1);
  });

  it("fails for an unknown piece id in the source", async () => {
    const lockPath = writeSourceLock();

    const { exitCode } = await runImportPiece([lockPath, "character", "@author/missing", "--draft", draftPath]);
    expect(exitCode).toBe(1);
  });

  it("fails when a piece with the same id already exists, without --as", async () => {
    const lockPath = writeSourceLock();
    await runImportPiece([lockPath, "character", "@author/blue", "--draft", draftPath]);

    const { exitCode } = await runImportPiece([lockPath, "character", "@author/blue", "--draft", draftPath]);
    expect(exitCode).toBe(1);

    const draft: RosterLockV1Draft = JSON.parse(readFileSync(draftPath, "utf-8"));
    expect(draft.stagedLock.rosters["character"]).toHaveLength(1);
  });

  describe("required pieces", () => {
    function setUpDraftAndSourceWithRequires(){
      const draft: RosterLockV1Draft = JSON.parse(readFileSync(draftPath, "utf-8"));
      draft.stagedLock.engine.pieceDefinitions["character"] = cloneJSON(CHARACTER_WITH_WEAPON_DEFINITION);
      draft.stagedLock.engine.pieceDefinitions["weapon"] = cloneJSON(WEAPON_DEFINITION);
      draft.stagedLock.rosters["weapon"] = [];
      writeFileSync(draftPath, JSON.stringify(draft));

      const lock: RosterLockV1Config = cloneJSON(EMPTY_ROSTER_LOCK);
      lock.engine.pieceDefinitions["character"] = cloneJSON(CHARACTER_WITH_WEAPON_DEFINITION);
      lock.engine.pieceDefinitions["weapon"] = cloneJSON(WEAPON_DEFINITION);
      lock.rosters["character"] = [cloneJSON(SOURCE_PIECE_WITH_REQUIRED)];
      lock.rosters["weapon"] = [cloneJSON(SOURCE_WEAPON_PIECE)];
      const lockPath = pathJoin(tempDir, "source.rosterlock.json");
      writeFileSync(lockPath, JSON.stringify(lock));
      return lockPath;
    }

    it("also imports a required piece that doesn't yet exist in the target", async () => {
      const lockPath = setUpDraftAndSourceWithRequires();

      const { exitCode } = await runImportPiece([lockPath, "character", "@author/blue", "--draft", draftPath]);
      expect(exitCode).toBeUndefined();

      const draft: RosterLockV1Draft = JSON.parse(readFileSync(draftPath, "utf-8"));
      expect(draft.stagedLock.rosters["weapon"]).toEqual([SOURCE_WEAPON_PIECE]);
      expect(draft.stagedLock.rosters["character"][0].requiredPieces).toEqual({
        weapon: { expected: ["@author/sword"], selectable: false },
      });
    });

    it("reuses an existing piece of matching version, rewriting the expected id to match it", async () => {
      const lockPath = setUpDraftAndSourceWithRequires();

      const draft: RosterLockV1Draft = JSON.parse(readFileSync(draftPath, "utf-8"));
      const existingWeapon: RosterLockPiece = { ...cloneJSON(SOURCE_WEAPON_PIECE), id: "@other/existing-sword" };
      draft.stagedLock.rosters["weapon"] = [existingWeapon];
      writeFileSync(draftPath, JSON.stringify(draft));

      const { exitCode } = await runImportPiece([lockPath, "character", "@author/blue", "--draft", draftPath]);
      expect(exitCode).toBeUndefined();

      const result: RosterLockV1Draft = JSON.parse(readFileSync(draftPath, "utf-8"));
      expect(result.stagedLock.rosters["weapon"]).toEqual([existingWeapon]);
      expect(result.stagedLock.rosters["character"][0].requiredPieces).toEqual({
        weapon: { expected: ["@other/existing-sword"], selectable: false },
      });
    });

    it("fails when a required piece id conflicts with a different version already in the target", async () => {
      const lockPath = setUpDraftAndSourceWithRequires();

      const draft: RosterLockV1Draft = JSON.parse(readFileSync(draftPath, "utf-8"));
      const conflictingWeapon: RosterLockPiece = {
        ...cloneJSON(SOURCE_WEAPON_PIECE),
        version: { logic: "1".repeat(64), media: "2".repeat(64), docs: "3".repeat(64) },
      };
      draft.stagedLock.rosters["weapon"] = [conflictingWeapon];
      writeFileSync(draftPath, JSON.stringify(draft));

      const { exitCode } = await runImportPiece([lockPath, "character", "@author/blue", "--draft", draftPath]);
      expect(exitCode).toBe(1);

      const result: RosterLockV1Draft = JSON.parse(readFileSync(draftPath, "utf-8"));
      expect(result.stagedLock.rosters["character"]).toHaveLength(0);
      expect(result.stagedLock.rosters["weapon"]).toEqual([conflictingWeapon]);
    });
  });
});
